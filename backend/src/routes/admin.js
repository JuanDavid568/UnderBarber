"use strict";
// Panel del dueño: estadísticas, citas, servicios y barberos.
const express = require("express");
const { query } = require("../db");
const { config } = require("../config");
const { requireRole } = require("../middleware/auth");
const { isValidDate, shopDateOf, dayBounds } = require("../services/slots");
const {
  HttpError, wrap, int, str, time, weekdays, tags, publicBarber, publicService, shapeAppointment, APPOINTMENT_SELECT,
  ActualizarRecurso, limpiarCachesPublicos,
} = require("../util");

const router = express.Router();
router.use(requireRole("admin"));

// Cualquier cambio del administrador (POST, PUT, DELETE) invalida las listas públicas en caché (PATRÓN Proxy)
router.use((req, res, next) => {
  if (req.method !== "GET") res.on("finish", limpiarCachesPublicos);
  next();
});

router.get("/stats", wrap(async (_req, res) => {
  const today = dayBounds(shopDateOf(new Date(), config.shopUtcOffset), config.shopUtcOffset);
  const [byStatus, clients, todayCount, upcoming, quizByBarber, quizTotal, revenue] = await Promise.all([
    query("SELECT status, count(*)::int AS n FROM appointments GROUP BY status"),
    query("SELECT count(*)::int AS n FROM users WHERE role = 'client'"),
    query("SELECT count(*)::int AS n FROM appointments WHERE starts_at >= $1 AND starts_at < $2 AND status <> 'cancelled'", [today.start, today.end]),
    query("SELECT count(*)::int AS n FROM appointments WHERE starts_at > now() AND status IN ('pending', 'confirmed')"),
    query(
      `SELECT b.id, b.display_name AS name, count(r.id)::int AS n
         FROM barbers b LEFT JOIN quiz_results r ON r.barber_id = b.id
        GROUP BY b.id ORDER BY b.position, b.id`
    ),
    query("SELECT count(*)::int AS n FROM quiz_results"),
    query(
      `SELECT coalesce(sum(s.price), 0)::bigint AS total
         FROM appointments a JOIN services s ON s.id = a.service_id WHERE a.status = 'completed'`
    ),
  ]);
  const statuses = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  for (const r of byStatus.rows) statuses[r.status] = r.n;
  res.json({
    appointmentsByStatus: statuses,
    clients: clients.rows[0].n,
    appointmentsToday: todayCount.rows[0].n,
    appointmentsUpcoming: upcoming.rows[0].n,
    quizTotal: quizTotal.rows[0].n,
    quizByBarber: quizByBarber.rows,
    revenueCompleted: Number(revenue.rows[0].total), // estimado con el precio actual de cada servicio
  });
}));

router.get("/appointments", wrap(async (req, res) => {
  const params = [];
  const where = [];
  if (req.query.status) {
    if (!["pending", "confirmed", "completed", "cancelled"].includes(req.query.status)) throw new HttpError(400, "El estado no es válido.");
    params.push(req.query.status);
    where.push(`a.status = $${params.length}`);
  }
  if (req.query.barberId) {
    params.push(int(req.query.barberId, "El barbero"));
    where.push(`a.barber_id = $${params.length}`);
  }
  if (req.query.from) {
    if (!isValidDate(String(req.query.from))) throw new HttpError(400, "La fecha «desde» no es válida.");
    params.push(dayBounds(String(req.query.from), config.shopUtcOffset).start);
    where.push(`a.starts_at >= $${params.length}`);
  }
  if (req.query.to) {
    if (!isValidDate(String(req.query.to))) throw new HttpError(400, "La fecha «hasta» no es válida.");
    params.push(dayBounds(String(req.query.to), config.shopUtcOffset).end);
    where.push(`a.starts_at < $${params.length}`);
  }
  const sql = `${APPOINTMENT_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY a.starts_at DESC LIMIT 200`;
  const { rows } = await query(sql, params);
  res.json({ appointments: rows.map(shapeAppointment) });
}));

// --- Servicios -----------------------------------------------------------------------

function serviceFields(body, cur = {}) {
  const has = (k) => body[k] !== undefined;
  return {
    name: has("name") ? str(body.name, "El nombre", { max: 120 }) : cur.name,
    description: has("description") ? str(body.description, "La descripción", { max: 300, optional: true }) : cur.description || "",
    price: has("price") ? int(body.price, "El precio", { min: 0, max: 10000000 }) : cur.price,
    duration_min: has("durationMin") ? int(body.durationMin, "La duración", { min: 15, max: 240 }) : cur.duration_min,
    position: has("position") ? int(body.position, "La posición", { min: 0, max: 999 }) : cur.position ?? 0,
    active: has("active") ? body.active === true : cur.active ?? true,
  };
}

router.get("/services", wrap(async (_req, res) => {
  const { rows } = await query("SELECT * FROM services ORDER BY position, id");
  res.json({ services: rows.map((r) => ({ ...publicService(r), active: r.active, position: r.position })) });
}));

router.post("/services", wrap(async (req, res) => {
  const body = req.body || {};
  for (const k of ["name", "price", "durationMin"]) if (body[k] === undefined) throw new HttpError(400, "Faltan datos del servicio.");
  const f = serviceFields(body);
  const { rows } = await query(
    `INSERT INTO services (name, description, price, duration_min, position, active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [f.name, f.description, f.price, f.duration_min, f.position, f.active]
  );
  res.status(201).json({ service: { ...publicService(rows[0]), active: rows[0].active, position: rows[0].position } });
}));

// PATRÓN Template Method: mismo esqueleto (ActualizarRecurso, en util.js) para editar servicios y barberos.
class ActualizarServicio extends ActualizarRecurso {
  constructor() { super("Ese servicio no existe."); }
  async cargar(id) { return (await query("SELECT * FROM services WHERE id = $1", [id])).rows[0]; }
  validar(body, cur) { return serviceFields(body, cur); }
  async guardar(id, f) {
    const { rows } = await query(
      `UPDATE services SET name = $1, description = $2, price = $3, duration_min = $4, position = $5, active = $6
        WHERE id = $7 RETURNING *`,
      [f.name, f.description, f.price, f.duration_min, f.position, f.active, id]
    );
    return rows[0];
  }
  responder(r) { return { service: { ...publicService(r), active: r.active, position: r.position } }; }
}

router.put("/services/:id", wrap(async (req, res) => {
  res.json(await new ActualizarServicio().ejecutar(int(req.params.id, "El servicio"), req.body));
}));

// «Eliminar» = desactivar, para no romper las citas históricas
router.delete("/services/:id", wrap(async (req, res) => {
  const id = int(req.params.id, "El servicio");
  const { rowCount } = await query("UPDATE services SET active = FALSE WHERE id = $1", [id]);
  if (!rowCount) throw new HttpError(404, "Ese servicio no existe.");
  res.json({ ok: true });
}));

// --- Barberos -------------------------------------------------------------------------

router.get("/barbers", wrap(async (_req, res) => {
  const { rows } = await query("SELECT * FROM barbers ORDER BY position, id");
  res.json({ barbers: rows.map((r) => ({ ...publicBarber(r), active: r.active })) });
}));

class ActualizarBarbero extends ActualizarRecurso {
  constructor() { super("Ese barbero no existe."); }
  async cargar(id) { return (await query("SELECT * FROM barbers WHERE id = $1", [id])).rows[0]; }
  validar(b, cur) {
    const has = (k) => b[k] !== undefined;
    const displayName = has("name") ? str(b.name, "El nombre", { min: 2, max: 120 }) : cur.display_name;
    const title = has("title") ? str(b.title, "El título", { max: 120 }) : cur.title;
    const bio = has("bio") ? str(b.bio, "La biografía", { max: 600, optional: true }) : cur.bio;
    const specialties = has("specialties") ? tags(b.specialties) : cur.specialties;
    const workDays = has("workDays") ? weekdays(b.workDays) : cur.work_days;
    const workStart = has("workStart") ? time(b.workStart, "La hora de inicio") : cur.work_start.slice(0, 5);
    const workEnd = has("workEnd") ? time(b.workEnd, "La hora de cierre") : cur.work_end.slice(0, 5);
    const active = has("active") ? b.active === true : cur.active;
    if (workEnd <= workStart) throw new HttpError(400, "La hora de cierre debe ser después de la de inicio.");
    return { displayName, title, bio, specialties, workDays, workStart, workEnd, active };
  }
  async guardar(id, v) {
    const { rows } = await query(
      `UPDATE barbers SET display_name = $1, title = $2, bio = $3, specialties = $4,
              work_days = $5, work_start = $6, work_end = $7, active = $8
        WHERE id = $9 RETURNING *`,
      [v.displayName, v.title, v.bio, v.specialties, v.workDays, v.workStart, v.workEnd, v.active, id]
    );
    return rows[0];
  }
  responder(r) { return { barber: { ...publicBarber(r), active: r.active } }; }
}

router.put("/barbers/:id", wrap(async (req, res) => {
  res.json(await new ActualizarBarbero().ejecutar(int(req.params.id, "El barbero"), req.body));
}));

module.exports = router;
