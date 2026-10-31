"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/services/slots");

const OFFSET = "-05:00";
const barber = { work_days: [1, 2, 3, 4, 5, 6], work_start: "09:00:00", work_end: "12:00:00" };
// "ahora" = lunes 2026-11-02 08:00 hora Bogotá = 13:00 UTC
const now = new Date("2026-11-02T13:00:00Z");
const base = { barber, now, offset: OFFSET, minLeadMinutes: 30 };

test("offset, fechas y día de la semana", () => {
  assert.equal(S.offsetMinutes("-05:00"), -300);
  assert.equal(S.offsetMinutes("+05:30"), 330);
  assert.equal(S.isValidDate("2026-02-30"), false);
  assert.equal(S.isValidDate("2026-11-02"), true);
  assert.equal(S.isoWeekday("2026-11-02"), 1); // lunes
  assert.equal(S.isoWeekday("2026-11-08"), 7); // domingo
  // 2026-11-03 02:00 UTC sigue siendo 2 de noviembre 21:00 en Bogotá
  assert.equal(S.shopDateOf(new Date("2026-11-03T02:00:00Z"), OFFSET), "2026-11-02");
});

test("genera horarios cada 30 min y respeta que el servicio quepa antes del cierre", () => {
  const slots = S.generateSlots({ ...base, date: "2026-11-03", durationMin: 60, busy: [] });
  assert.deepEqual(slots.map((s) => s.time), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
  assert.equal(slots[0].startsAt, "2026-11-03T14:00:00.000Z"); // 09:00 Bogotá = 14:00 UTC
  assert.equal(slots[0].endsAt, "2026-11-03T15:00:00.000Z");
});

test("excluye horarios que se cruzan con citas existentes", () => {
  const busy = [{ start: new Date("2026-11-03T15:00:00Z"), end: new Date("2026-11-03T15:45:00Z") }]; // 10:00-10:45
  const slots = S.generateSlots({ ...base, date: "2026-11-03", durationMin: 30, busy });
  // 10:00 y 10:30 se cruzan con la cita de 10:00 a 10:45
  assert.deepEqual(slots.map((s) => s.time), ["09:00", "09:30", "11:00", "11:30"]);
});

test("no ofrece horarios pasados ni dentro del margen mínimo (hoy)", () => {
  // ahora 08:00; margen 30 min => primer horario válido 09:00 (>= 08:30)
  const today = S.generateSlots({ ...base, date: "2026-11-02", durationMin: 30, busy: [] });
  assert.equal(today[0].time, "09:00");
  const later = S.generateSlots({ ...base, now: new Date("2026-11-02T15:10:00Z"), date: "2026-11-02", durationMin: 30, busy: [] }); // 10:10 local
  // 10:10 + 30 min de margen = 10:40 -> el primer horario válido es 11:00
  assert.equal(later[0].time, "11:00");
  assert.deepEqual(S.generateSlots({ ...base, date: "2026-11-01", durationMin: 30, busy: [] }), []); // ayer
});

test("día no laborable o fecha inválida devuelven lista vacía", () => {
  assert.deepEqual(S.generateSlots({ ...base, date: "2026-11-08", durationMin: 30, busy: [] }), []); // domingo
  assert.deepEqual(S.generateSlots({ ...base, date: "hola", durationMin: 30, busy: [] }), []);
});

test("límites del día en la zona de la barbería", () => {
  const { start, end } = S.dayBounds("2026-11-03", OFFSET);
  assert.equal(start.toISOString(), "2026-11-03T05:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-04T05:00:00.000Z");
});
