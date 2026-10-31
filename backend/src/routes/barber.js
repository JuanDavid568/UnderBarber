"use strict";
// Panel del barbero: su agenda, estados de citas y su perfil. El administrador también puede usarlo.
const express = require("express");
const { query } = require("../db");
const { config } = require("../config");
const { requireRole } = require("../middleware/auth");
const { isValidDate, shopDateOf, dayBounds } = require("../services/slots");
const {
  HttpError, wrap, int, str, time, weekdays, tags, publicBarber, shapeAppointment, APPOINTMENT_SELECT,
} = require("../util");

const router = express.Router();
router.use(requireRole("barber", "admin"));

/** Barbero asociado a la sesión. El admin puede indicar ?barberId= (o ninguno = todos en la agenda). */
async function resolveBarberId(req, { required }) {
  if (req.user.role === "admin") {
    if (req.query.barberId === undefined) {
      if (required) throw new HttpError(400, "Indica el barbero (barberId).");
      return null;
    }
    return int(req.query.barberId, "El barbero");
  }
  const { rows } = await query("SELECT id FROM barbers WHERE user_id = $1", [req.user.id]);
  if (!rows[0]) throw new HttpError(404, "Tu usuario no tiene un perfil de barbero.");
  return rows[0].id;
}

router.get("/appointments", wrap(async (req, res) => {
  const barberId = await resolveBarberId(req, { required: false });
  const date = req.query.date ? String(req.query.date) : shopDateOf(new Date(), config.shopUtcOffset);
  if (!isValidDate(date)) throw new HttpError(400, "La fecha no es válida (usa AAAA-MM-DD).");
  const days = req.query.days === undefined ? 1 : int(req.query.days, "Los días", { min: 1, max: 31 });

  const from = dayBounds(date, config.shopUtcOffset).start;
  const to = new Date(from.getTime() + days * 86400000);
  const params = [from, to];
  let where = "WHERE a.starts_at >= $1 AND a.starts_at < $2";
  if (barberId) {
    params.push(barberId);
    where += " AND a.barber_id = $3";
  }
  const { rows } = await query(`${APPOINTMENT_SELECT} ${where} ORDER BY a.starts_at`, params);
  res.json({ date, days, appointments: rows.map(shapeAppointment) });
}));

const TRANSITIONS = { pending: ["confirmed", "cancelled"], confirmed: ["completed", "cancelled"] };

router.patch("/appointments/:id/status", wrap(async (req, res) => {
  const id = int(req.params.id, "La cita");
  const next = (req.body || {}).status;
  if (!["confirmed", "completed", "cancelled"].includes(next)) throw new HttpError(400, "El estado no es válido.");

  const params = [id];
  let where = "WHERE id = $1";
  if (req.user.role === "barber") {
    const mine = await query("SELECT id FROM barbers WHERE user_id = $1", [req.user.id]);
    if (!mine.rows[0]) throw new HttpError(404, "Tu usuario no tiene un perfil de barbero.");
    params.push(mine.rows[0].id);
    where += " AND barber_id = $2";
  }
  const { rows } = await query(`SELECT status, starts_at FROM appointments ${where}`, params);
  const appt = rows[0];
  if (!appt) throw new HttpError(404, "No encontramos esa cita.");
  if (!(TRANSITIONS[appt.status] || []).includes(next)) {
    throw new HttpError(409, "No se puede pasar esa cita de «" + appt.status + "» a «" + next + "».");
  }
  if (next === "completed" && appt.starts_at > new Date()) {
    throw new HttpError(409, "Solo puedes marcarla como completada cuando ya empezó.");
  }
  await query("UPDATE appointments SET status = $1 WHERE id = $2", [next, id]);
  res.json({ ok: true, status: next });
}));

// --- Perfil -----------------------------------------------------------------------

router.get("/profile", wrap(async (req, res) => {
  const barberId = await resolveBarberId(req, { required: true });
  const { rows } = await query("SELECT * FROM barbers WHERE id = $1", [barberId]);
  if (!rows[0]) throw new HttpError(404, "Ese barbero no existe.");
  res.json({ barber: publicBarber(rows[0]) });
}));

router.patch("/profile", wrap(async (req, res) => {
  const barberId = await resolveBarberId(req, { required: true });
  const { rows } = await query("SELECT * FROM barbers WHERE id = $1", [barberId]);
  const cur = rows[0];
  if (!cur) throw new HttpError(404, "Ese barbero no existe.");

  const body = req.body || {};
  const bio = body.bio === undefined ? cur.bio : str(body.bio, "La biografía", { max: 600, optional: true });
  const specialties = body.specialties === undefined ? cur.specialties : tags(body.specialties);
  const workDays = body.workDays === undefined ? cur.work_days : weekdays(body.workDays);
  const workStart = body.workStart === undefined ? cur.work_start.slice(0, 5) : time(body.workStart, "La hora de inicio");
  const workEnd = body.workEnd === undefined ? cur.work_end.slice(0, 5) : time(body.workEnd, "La hora de cierre");
  if (workEnd <= workStart) throw new HttpError(400, "La hora de cierre debe ser después de la de inicio.");

  const upd = await query(
    `UPDATE barbers SET bio = $1, specialties = $2, work_days = $3, work_start = $4, work_end = $5
      WHERE id = $6 RETURNING *`,
    [bio, specialties, workDays, workStart, workEnd, barberId]
  );
  res.json({ barber: publicBarber(upd.rows[0]) });
}));

module.exports = router;
