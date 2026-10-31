"use strict";
// Citas del cliente: crear, ver las propias y cancelar.
const express = require("express");
const rateLimit = require("express-rate-limit");
const { query, tx } = require("../db");
const { config } = require("../config");
const { requireAuth } = require("../middleware/auth");
const { generateSlots, shopDateOf, dayBounds } = require("../services/slots");
const { HttpError, wrap, int, str, shapeAppointment, APPOINTMENT_SELECT } = require("../util");

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

router.post("/", requireAuth, createLimiter, wrap(async (req, res) => {
  const body = req.body || {};
  const barberId = int(body.barberId, "El barbero");
  const serviceId = int(body.serviceId, "El servicio");
  const notes = str(body.notes, "Las notas", { max: 300, optional: true });
  const startsAt = new Date(typeof body.startsAt === "string" ? body.startsAt : NaN);
  if (Number.isNaN(startsAt.getTime())) throw new HttpError(400, "El horario no es válido.");

  let created;
  try {
    created = await tx(async (client) => {
      // Un barbero a la vez: evita que dos clientes tomen el mismo horario simultáneamente
      await client.query("SELECT pg_advisory_xact_lock($1, $2)", [BARBER_LOCK, barberId]);

      const b = await client.query("SELECT * FROM barbers WHERE id = $1 AND active", [barberId]);
      const s = await client.query("SELECT * FROM services WHERE id = $1 AND active", [serviceId]);
      if (!b.rows[0]) throw new HttpError(404, "Ese barbero no existe.");
      if (!s.rows[0]) throw new HttpError(404, "Ese servicio no existe.");

      const date = shopDateOf(startsAt, config.shopUtcOffset);
      const today = shopDateOf(new Date(), config.shopUtcOffset);
      const last = shopDateOf(new Date(Date.now() + config.maxDaysAhead * 86400000), config.shopUtcOffset);
      if (date < today || date > last) throw new HttpError(400, "Elige una fecha de hoy a los próximos " + config.maxDaysAhead + " días.");

      const { start, end } = dayBounds(date, config.shopUtcOffset);
      const busy = await client.query(
        `SELECT starts_at, ends_at FROM appointments
          WHERE barber_id = $1 AND status <> 'cancelled' AND starts_at < $3 AND ends_at > $2`,
        [barberId, start, end]
      );
      const slots = generateSlots({
        date,
        barber: b.rows[0],
        durationMin: s.rows[0].duration_min,
        busy: busy.rows.map((r) => ({ start: r.starts_at, end: r.ends_at })),
        now: new Date(),
        offset: config.shopUtcOffset,
        minLeadMinutes: config.minLeadMinutes,
      });
      const slot = slots.find((x) => x.startsAt === startsAt.toISOString());
      if (!slot) throw new HttpError(409, "Ese horario ya no está disponible. Elige otro.");

      const mine = await client.query(
        `SELECT
            count(*) FILTER (WHERE starts_at > now())::int AS upcoming,
            count(*) FILTER (WHERE starts_at < $3 AND ends_at > $2)::int AS overlapping
           FROM appointments WHERE client_id = $1 AND status IN ('pending', 'confirmed')`,
        [req.user.id, slot.startsAt, slot.endsAt]
      );
      if (mine.rows[0].overlapping > 0) throw new HttpError(409, "Ya tienes otra cita en ese horario.");
      if (mine.rows[0].upcoming >= MAX_ACTIVE_UPCOMING) {
        throw new HttpError(409, `Ya tienes ${MAX_ACTIVE_UPCOMING} citas próximas. Cancela alguna para reservar otra.`);
      }

      const ins = await client.query(
        `INSERT INTO appointments (client_id, barber_id, service_id, starts_at, ends_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [req.user.id, barberId, serviceId, slot.startsAt, slot.endsAt, notes]
      );
      return ins.rows[0].id;
    });
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ese horario ya no está disponible. Elige otro.");
    throw err;
  }

  const { rows } = await query(`${APPOINTMENT_SELECT} WHERE a.id = $1`, [created]);
  res.status(201).json({ appointment: shapeAppointment(rows[0]) });
}));

router.get("/mine", requireAuth, wrap(async (req, res) => {
  const { rows } = await query(
    `${APPOINTMENT_SELECT} WHERE a.client_id = $1 ORDER BY a.starts_at DESC LIMIT 100`,
    [req.user.id]
  );
  res.json({ appointments: rows.map(shapeAppointment) });
}));

router.patch("/:id/cancel", requireAuth, wrap(async (req, res) => {
  const id = int(req.params.id, "La cita");
  const found = await query("SELECT status, starts_at FROM appointments WHERE id = $1 AND client_id = $2", [id, req.user.id]);
  const appt = found.rows[0];
  if (!appt) throw new HttpError(404, "No encontramos esa cita.");
  if (!["pending", "confirmed"].includes(appt.status)) throw new HttpError(409, "Esa cita ya no se puede cancelar.");
  if (appt.starts_at <= new Date()) throw new HttpError(409, "Esa cita ya empezó o pasó.");
  await query("UPDATE appointments SET status = 'cancelled' WHERE id = $1", [id]);
  res.json({ ok: true });
}));

module.exports = router;
