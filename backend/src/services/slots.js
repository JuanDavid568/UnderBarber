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

module.exports = {
  STEP_MIN, offsetMinutes, isValidDate, shopDateOf, isoWeekday, shopInstant, dayBounds, generateSlots,
};
