"use strict";
// Citas del cliente: crear, ver las propias y cancelar.
const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, tx, busyIntervals } = require("../db");
const { config } = require("../config");
const { requireAuth } = require("../middleware/auth");
const { generateSlots, shopDateOf, dayBounds } = require("../services/slots");
const {
  HttpError, wrap, int, str, shapeAppointment, APPOINTMENT_SELECT,
  CitaBuilder, EstadoCita, ManejadorReserva, publicar, limpiarCachesPublicos,
} = require("../util");

const router = express.Router();
const BARBER_LOCK = 1001; // espacio de claves para pg_advisory_xact_lock
const MAX_ACTIVE_UPCOMING = 5;

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Has hecho demasiadas reservas seguidas. Inténtalo más tarde." },
});

// ---- PATRÓN Chain of Responsibility: las reglas de una reserva, una por eslabón ---------------------------------
// (la clase base ManejadorReserva está en util.js). Cada eslabón lanza HttpError si su regla falla.

class FechaEnRango extends ManejadorReserva {
  async validar(ctx) {
    ctx.date = shopDateOf(ctx.startsAt, config.shopUtcOffset);
    const today = shopDateOf(new Date(), config.shopUtcOffset);
    const last = shopDateOf(new Date(Date.now() + config.maxDaysAhead * 86400000), config.shopUtcOffset);
    if (ctx.date < today || ctx.date > last) throw new HttpError(400, "Elige una fecha de hoy a los próximos " + config.maxDaysAhead + " días.");
  }
}

class HorarioDisponible extends ManejadorReserva {
  async validar(ctx) {
    const { start, end } = dayBounds(ctx.date, config.shopUtcOffset);
    // Citas activas + bloqueos de horario del barbero (o de toda la barbería); al reprogramar se ignora la propia cita
    const busy = await busyIntervals((t, p) => ctx.client.query(t, p), ctx.barber.id, start, end, ctx.excludeId || null);
    const slots = generateSlots({
      date: ctx.date,
      barber: ctx.barber,
      durationMin: ctx.service.duration_min,
      busy,
      now: new Date(),
      offset: config.shopUtcOffset,
      minLeadMinutes: config.minLeadMinutes,
    });
    ctx.slot = slots.find((x) => x.startsAt === ctx.startsAt.toISOString());
    if (!ctx.slot) throw new HttpError(409, "Ese horario ya no está disponible. Elige otro.");
  }
}

class SinCruceDelCliente extends ManejadorReserva {
  async validar(ctx) {
    const r = await ctx.client.query(
      `SELECT count(*)::int AS n FROM appointments
        WHERE client_id = $1 AND status IN ('pending', 'confirmed') AND starts_at < $3 AND ends_at > $2
          AND ($4::int IS NULL OR id <> $4)`,
      [ctx.user.id, ctx.slot.startsAt, ctx.slot.endsAt, ctx.excludeId || null]
    );
    if (r.rows[0].n > 0) throw new HttpError(409, "Ya tienes otra cita en ese horario.");
  }
}

class LimiteDeCitas extends ManejadorReserva {
  async validar(ctx) {
    const r = await ctx.client.query(
      `SELECT count(*)::int AS n FROM appointments
        WHERE client_id = $1 AND status IN ('pending', 'confirmed') AND starts_at > now()`,
      [ctx.user.id]
    );
    if (r.rows[0].n >= MAX_ACTIVE_UPCOMING) {
      throw new HttpError(409, `Ya tienes ${MAX_ACTIVE_UPCOMING} citas próximas. Cancela alguna para reservar otra.`);
    }
  }
}

// La cadena se arma una sola vez. El orden importa: primero lo más barato (fecha), al final lo que consulta más.
const cadenaDeReserva = new FechaEnRango();
cadenaDeReserva.siguiente(new HorarioDisponible()).siguiente(new SinCruceDelCliente()).siguiente(new LimiteDeCitas());

// Reprogramar reutiliza los mismos eslabones, salvo el límite de citas (mover una cita no suma otra).
const cadenaDeReprogramacion = new FechaEnRango();
cadenaDeReprogramacion.siguiente(new HorarioDisponible()).siguiente(new SinCruceDelCliente());

// ---- PATRÓN Facade: una sola puerta de entrada que oculta todo el proceso de reservar -------------------------
// (bloqueo del barbero, carga de datos, cadena de validaciones, inserción y manejo del choque de horarios).
class ReservaFacade {
  static async reservar(user, { barberId, serviceId, notes, startsAt }) {
    try {
      return await tx(async (client) => {
        // Un barbero a la vez: evita que dos clientes tomen el mismo horario simultáneamente
        await client.query("SELECT pg_advisory_xact_lock($1, $2)", [BARBER_LOCK, barberId]);

        const b = await client.query("SELECT * FROM barbers WHERE id = $1 AND active", [barberId]);
        const s = await client.query("SELECT * FROM services WHERE id = $1 AND active", [serviceId]);
        if (!b.rows[0]) throw new HttpError(404, "Ese barbero no existe.");
        if (!s.rows[0]) throw new HttpError(404, "Ese servicio no existe.");

        const ctx = { client, user, barber: b.rows[0], service: s.rows[0], startsAt };
        await cadenaDeReserva.manejar(ctx);

        const ins = await client.query(
          `INSERT INTO appointments (client_id, barber_id, service_id, starts_at, ends_at, notes)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [user.id, barberId, serviceId, ctx.slot.startsAt, ctx.slot.endsAt, notes]
        );
        return ins.rows[0].id;
      });
    } catch (err) {
      if (err.code === "23505") throw new HttpError(409, "Ese horario ya no está disponible. Elige otro.");
      throw err;
    }
  }
}

ReservaFacade.reprogramar = async function reprogramar(user, id, startsAt) {
  try {
    await tx(async (client) => {
      const first = await client.query("SELECT barber_id FROM appointments WHERE id = $1 AND client_id = $2", [id, user.id]);
      if (!first.rows[0]) throw new HttpError(404, "No encontramos esa cita.");
      const barberId = first.rows[0].barber_id;
      // Mismo candado que al reservar: nadie más toma horarios de este barbero mientras se mueve la cita
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [BARBER_LOCK, barberId]);

      const cur = (await client.query("SELECT * FROM appointments WHERE id = $1 AND client_id = $2 FOR UPDATE", [id, user.id])).rows[0];
      if (!cur) throw new HttpError(404, "No encontramos esa cita.");
      if (!EstadoCita.de(cur.status).reprogramable) throw new HttpError(409, "Esa cita ya no se puede reprogramar."); // PATRÓN State
      if (cur.starts_at <= new Date()) throw new HttpError(409, "Esa cita ya empezó o pasó.");
      if (new Date(cur.starts_at).getTime() === startsAt.getTime()) throw new HttpError(400, "Elige un horario distinto al actual.");

      const b = await client.query("SELECT * FROM barbers WHERE id = $1 AND active", [barberId]);
      const s = await client.query("SELECT * FROM services WHERE id = $1", [cur.service_id]);
      if (!b.rows[0]) throw new HttpError(409, "Ese barbero ya no está disponible. Cancela la cita y reserva con otro.");

      const ctx = { client, user, barber: b.rows[0], service: s.rows[0], startsAt, excludeId: id };
      await cadenaDeReprogramacion.manejar(ctx);

      // Al moverla vuelve a «pendiente»: el barbero debe confirmarla de nuevo
      await client.query(
        "UPDATE appointments SET starts_at = $1, ends_at = $2, status = 'pending', rescheduled_at = now() WHERE id = $3",
        [ctx.slot.startsAt, ctx.slot.endsAt, id]
      );
    });
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ese horario ya no está disponible. Elige otro.");
    throw err;
  }
};

router.post("/", requireAuth, createLimiter, wrap(async (req, res) => {
  const body = req.body || {};
  // PATRÓN Builder: arma y valida los datos de la cita paso a paso (CitaBuilder está en util.js)
  const datos = new CitaBuilder()
    .barbero(body.barberId)
    .servicio(body.serviceId)
    .notas(body.notes)
    .inicio(body.startsAt)
    .build();

  const created = await ReservaFacade.reservar(req.user, datos);

  const { rows } = await query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [created]);
  const appointment = shapeAppointment(rows[0]);
  publicar("cita:creada", appointment); // PATRÓN Observer: avisa a quien esté escuchando
  res.status(201).json({ appointment });
}));

router.get("/mine", requireAuth, wrap(async (req, res) => {
  const { rows } = await query(
    `${APPOINTMENT_SELECT} WHERE a.client_id = $1 ORDER BY a.starts_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ appointments: rows.map(shapeAppointment) });
}));

router.patch("/:id/reschedule", requireAuth, createLimiter, wrap(async (req, res) => {
  const id = int(req.params.id, "La cita");
  const startsAt = new Date(typeof (req.body || {}).startsAt === "string" ? req.body.startsAt : NaN);
  if (Number.isNaN(startsAt.getTime())) throw new HttpError(400, "El horario no es válido.");
  await ReservaFacade.reprogramar(req.user, id, startsAt);
  const { rows } = await query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [id]);
  const appointment = shapeAppointment(rows[0]);
  publicar("cita:reprogramada", appointment); // PATRÓN Observer
  res.json({ appointment });
}));

// Reseña: el cliente califica una cita completada (1 a 5 estrellas y un comentario opcional), una sola vez
router.post("/:id/review", requireAuth, wrap(async (req, res) => {
  const id = int(req.params.id, "La cita");
  const body = req.body || {};
  const rating = int(body.rating, "La calificación", { min: 1, max: 5 });
  const comment = str(body.comment, "El comentario", { max: 300, optional: true });

  const found = await query("SELECT status, barber_id, service_id FROM appointments WHERE id = $1 AND client_id = $2", [id, req.user.id]);
  const appt = found.rows[0];
  if (!appt) throw new HttpError(404, "No encontramos esa cita.");
  if (appt.status !== "completed") throw new HttpError(409, "Solo puedes calificar citas que ya se completaron.");
  try {
    await query(
      "INSERT INTO reviews (appointment_id, client_id, barber_id, service_id, rating, comment) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, req.user.id, appt.barber_id, appt.service_id, rating, comment]
    );
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ya calificaste esta cita.");
    throw err;
  }
  limpiarCachesPublicos(); // el promedio del barbero está en caché (PATRÓN Proxy)
  publicar("resena:creada", { appointmentId: id, barberId: appt.barber_id, rating }); // PATRÓN Observer
  res.status(201).json({ review: { rating, comment } });
}));

router.patch("/:id/cancel", requireAuth, wrap(async (req, res) => {
  const id = int(req.params.id, "La cita");
  const found = await query("SELECT status, starts_at FROM appointments WHERE id = $1 AND client_id = $2", [id, req.user.id]);
  const appt = found.rows[0];
  if (!appt) throw new HttpError(404, "No encontramos esa cita.");
  if (!EstadoCita.de(appt.status).cancelable) throw new HttpError(409, "Esa cita ya no se puede cancelar."); // PATRÓN State
  if (appt.starts_at <= new Date()) throw new HttpError(409, "Esa cita ya empezó o pasó.");
  await query("UPDATE appointments SET status = 'cancelled' WHERE id = $1", [id]);
  publicar("cita:cancelada", { id }); // PATRÓN Observer
  res.json({ ok: true });
}));

module.exports = router;
