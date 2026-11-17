"use strict";
// Lógica pura de horarios (sin base de datos): fechas en la zona horaria de la barbería.

const STEP_MIN = 30;

/** "-05:00" -> -300 (minutos respecto a UTC) */
function offsetMinutes(offset) {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) throw new Error("Offset inválido");
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** ¿Es una fecha real con formato YYYY-MM-DD? */
function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Fecha (YYYY-MM-DD) que corresponde a un instante en la zona de la barbería. */
function shopDateOf(instant, offset) {
  return new Date(instant.getTime() + offsetMinutes(offset) * 60000).toISOString().slice(0, 10);
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
function isoWeekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

/** Instante UTC del día `dateStr` a los `minutes` minutos, hora de la barbería. */
function shopInstant(dateStr, minutes, offset) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${dateStr}T${hh}:${mm}:00${offset}`);
}

/** Inicio y fin (UTC) del día completo en la zona de la barbería. */
function dayBounds(dateStr, offset) {
  const start = shopInstant(dateStr, 0, offset);
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}

/**
 * Horarios de inicio posibles para un servicio de `durationMin` minutos.
 * @param {object} p
 * @param {string} p.date YYYY-MM-DD (hora de la barbería)
 * @param {{work_days:number[],work_start:string,work_end:string}} p.barber
 * @param {number} p.durationMin
 * @param {Array<{start:Date,end:Date}>} p.busy citas activas del barbero ese día
 * @param {Date} p.now
 * @param {string} p.offset
 * @param {number} [p.minLeadMinutes]
 * @returns {Array<{startsAt:string,endsAt:string,time:string}>}
 */
function generateSlots({ date, barber, durationMin, busy, now, offset, minLeadMinutes = 30 }) {
  if (!isValidDate(date)) return [];
  if (!barber.work_days.map(Number).includes(isoWeekday(date))) return [];

  const open = toMinutes(barber.work_start);
  const close = toMinutes(barber.work_end);
  const earliest = now.getTime() + minLeadMinutes * 60000;
  const slots = [];

  for (let t = open; t + durationMin <= close; t += STEP_MIN) {
    const start = shopInstant(date, t, offset);
    const end = new Date(start.getTime() + durationMin * 60000);
    if (start.getTime() < earliest) continue;
    const overlaps = busy.some((b) => start < b.end && end > b.start);
    if (overlaps) continue;
    slots.push({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      time: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
    });
  }
  return slots;
}

// ---------------- Estadísticas del administrador (lógica pura, sin base de datos) ----------------

/** Las últimas `days` fechas (YYYY-MM-DD) terminando en `today`, de la más antigua a la más reciente. */
function lastDates(today, days) {
  const base = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: days }, (_, i) => new Date(base - (days - 1 - i) * 86400000).toISOString().slice(0, 10));
}

/**
 * Agrega las citas de un periodo para el dashboard.
 * @param {{rows:Array<{starts_at:Date,status:string,barber_id:number,service_id:number,price:number}>,
 *          dates:string[], services:Array<{id,name,active}>, barbers:Array<{id,display_name,active}>, offset:string}} p
 * «count» = citas agendadas (todas menos las canceladas); «revenue» = suma de precios de las completadas.
 */
function buildDashboard({ rows, dates, services, barbers, offset }) {
  const shift = offsetMinutes(offset) * 60000;
  const inRange = new Set(dates);
  const byDay = new Map(dates.map((d) => [d, 0]));
  const byWeekday = Array.from({ length: 7 }, (_, i) => ({ day: i + 1, count: 0 }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const svc = new Map(services.map((x) => [x.id, { id: x.id, name: x.name, count: 0, revenue: 0, active: x.active }]));
  const bar = new Map(barbers.map((x) => [x.id, { id: x.id, name: x.display_name, count: 0, revenue: 0, active: x.active }]));
  const totals = { booked: 0, completed: 0, cancelled: 0, revenue: 0 };

  for (const r of rows) {
    const local = new Date(new Date(r.starts_at).getTime() + shift); // reloj de la barbería
    const date = local.toISOString().slice(0, 10);
    if (!inRange.has(date)) continue;
    if (r.status === "cancelled") {
      totals.cancelled += 1;
      continue;
    }
    totals.booked += 1;
    byDay.set(date, byDay.get(date) + 1);
    byWeekday[isoWeekday(date) - 1].count += 1;
    byHour[local.getUTCHours()].count += 1;
    const s = svc.get(r.service_id);
    const b = bar.get(r.barber_id);
    if (s) s.count += 1;
    if (b) b.count += 1;
    if (r.status === "completed") {
      totals.completed += 1;
      totals.revenue += Number(r.price) || 0;
      if (s) s.revenue += Number(r.price) || 0;
      if (b) b.revenue += Number(r.price) || 0;
    }
  }

  const ranked = (m) =>
    [...m.values()]
      .filter((x) => x.active || x.count > 0)
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue || a.id - b.id)
      .map(({ active, ...rest }) => rest);
  const all = totals.booked + totals.cancelled;
  return {
    range: { days: dates.length, from: dates[0], to: dates[dates.length - 1] },
    totals: {
      ...totals,
      cancelRate: all ? Math.round((totals.cancelled / all) * 100) : 0,
      avgTicket: totals.completed ? Math.round(totals.revenue / totals.completed) : 0,
    },
    byDay: dates.map((date) => ({ date, count: byDay.get(date) })),
    byService: ranked(svc),
    byBarber: ranked(bar),
    byWeekday,
    byHour,
  };
}

/**
 * Rango de un bloqueo de horario. Día(s) completo(s): de `date` a `endDate` (inclusive). Por horas: un solo día.
 * @returns {{error:string}|{start:Date,end:Date}}
 */
function blockRange({ date, endDate, allDay, startTime, endTime }, offset) {
  if (!isValidDate(String(date))) return { error: "La fecha no es válida (usa AAAA-MM-DD)." };
  const last = endDate ? String(endDate) : String(date);
  if (!isValidDate(last)) return { error: "La fecha final no es válida." };
  if (last < date) return { error: "La fecha final no puede ser anterior a la inicial." };
  const span = (new Date(`${last}T12:00:00Z`) - new Date(`${date}T12:00:00Z`)) / 86400000 + 1;
  if (span > 60) return { error: "Un bloqueo puede durar máximo 60 días." };
  if (allDay) return { start: dayBounds(date, offset).start, end: dayBounds(last, offset).end };

  if (last !== date) return { error: "Un bloqueo por horas es de un solo día." };
  const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!TIME.test(String(startTime)) || !TIME.test(String(endTime))) return { error: "Las horas deben tener el formato HH:MM." };
  if (toMinutes(endTime) <= toMinutes(startTime)) return { error: "La hora final debe ser después de la inicial." };
  return { start: shopInstant(date, toMinutes(startTime), offset), end: shopInstant(date, toMinutes(endTime), offset) };
}

/**
 * Añade la calificación promedio a una lista del dashboard (por barbero o por servicio).
 * @param {Array<{id:number}>} items  lista ya armada por buildDashboard
 * @param {Array<{barber_id:number,service_id:number,rating:number}>} reviews
 * @param {"barber_id"|"service_id"} key
 */
function attachRatings(items, reviews, key) {
  const acc = new Map();
  for (const r of reviews) {
    const cur = acc.get(r[key]) || { sum: 0, n: 0 };
    cur.sum += Number(r.rating);
    cur.n += 1;
    acc.set(r[key], cur);
  }
  return items.map((it) => {
    const a = acc.get(it.id);
    return { ...it, ratingAvg: a ? Math.round((a.sum / a.n) * 10) / 10 : null, ratingCount: a ? a.n : 0 };
  });
}

module.exports = {
  lastDates, buildDashboard, blockRange, attachRatings,
  STEP_MIN, offsetMinutes, isValidDate, shopDateOf, isoWeekday, shopInstant, dayBounds, generateSlots,
};
