"use strict";
// Utilidades: errores HTTP, validaciones y formato.

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(value, field, { min = 1, max = 200, optional = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (optional) return "";
    throw new HttpError(400, `${field} es obligatorio.`);
  }
  if (typeof value !== "string") throw new HttpError(400, `${field} no es válido.`);
  const v = value.trim();
  if (v.length < min) throw new HttpError(400, `${field} debe tener al menos ${min} caracteres.`);
  if (v.length > max) throw new HttpError(400, `${field} no puede superar ${max} caracteres.`);
  return v;
}

function email(value) {
  const v = str(value, "El correo", { max: 160 }).toLowerCase();
  if (!EMAIL_RE.test(v)) throw new HttpError(400, "El correo no es válido.");
  return v;
}

function password(value, field = "La contraseña") {
  if (typeof value !== "string" || value.length < 8) {
    throw new HttpError(400, `${field} debe tener al menos 8 caracteres.`);
  }
  if (value.length > 72) throw new HttpError(400, `${field} no puede superar 72 caracteres.`);
  return value;
}

function int(value, field, { min = 1, max = 1e9 } = {}) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${field} no es válido.`);
  return n;
}

function time(value, field) {
  if (typeof value !== "string" || !TIME_RE.test(value)) {
    throw new HttpError(400, `${field} debe tener el formato HH:MM.`);
  }
  return value;
}

function weekdays(value) {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, "Elige al menos un día laboral.");
  const days = [...new Set(value.map(Number))];
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw new HttpError(400, "Los días laborales no son válidos.");
  return days.sort((a, b) => a - b);
}

function tags(value, field = "Las especialidades") {
  if (!Array.isArray(value)) throw new HttpError(400, `${field} no son válidas.`);
  const list = [...new Set(value.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean))];
  if (list.length > 12) throw new HttpError(400, `${field}: máximo 12.`);
  if (list.some((t) => t.length > 40)) throw new HttpError(400, `${field}: cada una puede tener hasta 40 caracteres.`);
  return list;
}

const hhmm = (t) => String(t).slice(0, 5);

/** Forma pública de un barbero (sin datos privados). */
function publicBarber(row) {
  return {
    id: row.id,
    name: row.display_name,
    title: row.title,
    specialtyKey: row.specialty_key,
    bio: row.bio,
    specialties: row.specialties,
    workDays: row.work_days,
    workStart: hhmm(row.work_start),
    workEnd: hhmm(row.work_end),
  };
}

function publicService(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    durationMin: row.duration_min,
  };
}

/** Cita con sus datos relacionados (consulta con JOIN a barbers, services y users). */
function shapeAppointment(r) {
  return {
    id: r.id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
    notes: r.notes,
    barber: { id: r.barber_id, name: r.barber_name },
    service: { id: r.service_id, name: r.service_name, price: r.price, durationMin: r.duration_min },
    client: r.client_name === undefined ? undefined : { name: r.client_name, phone: r.client_phone },
  };
}

/** Columnas comunes para listar citas con JOIN. */
const APPOINTMENT_SELECT = `
  SELECT a.id, a.starts_at, a.ends_at, a.status, a.notes, a.barber_id, a.service_id,
         b.display_name AS barber_name, s.name AS service_name, s.price, s.duration_min,
         u.name AS client_name, u.phone AS client_phone
    FROM appointments a
    JOIN barbers  b ON b.id = a.barber_id
    JOIN services s ON s.id = a.service_id
    JOIN users    u ON u.id = a.client_id`;

module.exports = {
  HttpError, wrap, str, email, password, int, time, weekdays, tags, hhmm,
  publicBarber, publicService, shapeAppointment, APPOINTMENT_SELECT, DATE_RE,
};
