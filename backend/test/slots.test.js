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

// ======================= Patrones de diseño de util.js =======================
const {
  CitaBuilder, EstadoCita, ManejadorReserva, ActualizarRecurso, conCache, limpiarCachesPublicos,
  FabricaNotificador, publicar, registrarObservadores, HttpError,
} = require("../src/util");

test("Builder: arma una cita válida y rechaza datos malos", () => {
  const d = new CitaBuilder().barbero("1").servicio(2).notas("  tijera ").inicio("2030-01-01T15:00:00.000Z").build();
  assert.equal(d.barberId, 1);
  assert.equal(d.serviceId, 2);
  assert.equal(d.notes, "tijera");
  assert.equal(d.startsAt.toISOString(), "2030-01-01T15:00:00.000Z");
  assert.throws(() => new CitaBuilder().barbero("x").servicio(1).inicio("2030-01-01T15:00:00Z").build(), HttpError);
  assert.throws(() => new CitaBuilder().barbero(1).servicio(1).inicio("no es fecha").build(), /horario no es válido/);
});

test("State: cada estado sabe a cuáles puede pasar", () => {
  assert.ok(EstadoCita.de("pending").puedePasarA("confirmed"));
  assert.ok(EstadoCita.de("pending").cancelable);
  assert.ok(EstadoCita.de("confirmed").puedePasarA("completed"));
  assert.equal(EstadoCita.de("pending").puedePasarA("completed"), false);
  assert.equal(EstadoCita.de("completed").cancelable, false);
  assert.equal(EstadoCita.de("cancelled").puedePasarA("confirmed"), false);
  assert.equal(EstadoCita.de("raro").puedePasarA("confirmed"), false);
});

test("Chain of Responsibility: recorre los eslabones en orden y se corta en el primero que falla", async () => {
  const orden = [];
  const eslabon = (nombre, falla) => new (class extends ManejadorReserva {
    async validar() {
      orden.push(nombre);
      if (falla) throw new HttpError(409, nombre + " falló");
    }
  })();
  const a = eslabon("a");
  a.siguiente(eslabon("b")).siguiente(eslabon("c"));
  await a.manejar({});
  assert.deepEqual(orden, ["a", "b", "c"]);

  orden.length = 0;
  const x = eslabon("x");
  x.siguiente(eslabon("y", true)).siguiente(eslabon("z"));
  await assert.rejects(() => x.manejar({}), /y falló/);
  assert.deepEqual(orden, ["x", "y"]); // «z» nunca se ejecuta
});

test("Template Method: el esqueleto fija el orden y las subclases ponen los pasos", async () => {
  const pasos = [];
  class Demo extends ActualizarRecurso {
    constructor() { super("No existe."); }
    async cargar(id) { pasos.push("cargar"); return id === 1 ? { n: 1 } : undefined; }
    validar(body, cur) { pasos.push("validar"); return { n: body.n ?? cur.n }; }
    async guardar(id, v) { pasos.push("guardar"); return v; }
    responder(f) { pasos.push("responder"); return { ok: f.n }; }
  }
  assert.deepEqual(await new Demo().ejecutar(1, { n: 7 }), { ok: 7 });
  assert.deepEqual(pasos, ["cargar", "validar", "guardar", "responder"]);
  await assert.rejects(() => new Demo().ejecutar(2, {}), /No existe/);
});

test("Proxy: reutiliza el resultado hasta que se limpia o vence", async () => {
  let llamadas = 0;
  const lista = conCache(async () => ++llamadas, 60000);
  assert.equal(await lista(), 1);
  assert.equal(await lista(), 1); // viene del caché
  limpiarCachesPublicos();
  assert.equal(await lista(), 2); // se volvió a cargar
});

test("Factory Method: crea el notificador según el canal y rechaza canales desconocidos", () => {
  const n = FabricaNotificador.para("memoria").crear();
  n.notificar("hola");
  assert.deepEqual(n.mensajes, ["hola"]);
  assert.equal(typeof FabricaNotificador.para("consola").crear().notificar, "function");
  assert.equal(typeof FabricaNotificador.para("silencio").crear().notificar, "function");
  assert.throws(() => FabricaNotificador.para("paloma"), /desconocido/);
});

test("Observer: los eventos de citas llegan al notificador y un observador roto no tumba al publicador", () => {
  const n = FabricaNotificador.para("memoria").crear();
  registrarObservadores(n);
  publicar("cita:creada", { id: 5, service: { name: "Fade" }, barber: { name: "Santi" }, startsAt: new Date("2030-01-01T15:00:00Z") });
  publicar("cita:cancelada", { id: 5 });
  publicar("cita:estado", { id: 5, status: "confirmed" });
  assert.equal(n.mensajes.length, 3);
  assert.match(n.mensajes[0], /Nueva cita #5: Fade con Santi/);
  assert.match(n.mensajes[1], /cancelada/);
  assert.match(n.mensajes[2], /confirmed/);

  registrarObservadores({ notificar() { throw new Error("falla"); } });
  const log = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => publicar("cita:cancelada", { id: 9 }));
  } finally {
    console.error = log;
  }
});

// ======================= Estadísticas del dashboard =======================
test("lastDates: devuelve los últimos N días terminando hoy", () => {
  assert.deepEqual(S.lastDates("2030-03-02", 3), ["2030-02-28", "2030-03-01", "2030-03-02"]);
});

test("buildDashboard: cuenta por día, servicio, barbero, día de la semana y hora (hora de Bogotá)", () => {
  const dates = S.lastDates("2030-01-08", 7); // 2030-01-02 … 2030-01-08
  const rows = [
    { starts_at: new Date("2030-01-07T15:00:00Z"), status: "completed", barber_id: 1, service_id: 10, price: 30000 }, // lun 10:00
    { starts_at: new Date("2030-01-07T16:00:00Z"), status: "confirmed", barber_id: 1, service_id: 11, price: 20000 }, // lun 11:00
    { starts_at: new Date("2030-01-08T04:00:00Z"), status: "pending", barber_id: 2, service_id: 10, price: 30000 },   // lun 23:00 (aún es 7 en Bogotá)
    { starts_at: new Date("2030-01-07T17:00:00Z"), status: "cancelled", barber_id: 2, service_id: 10, price: 30000 }, // cancelada
    { starts_at: new Date("2029-12-20T15:00:00Z"), status: "completed", barber_id: 1, service_id: 10, price: 30000 }, // fuera del periodo
  ];
  const d = S.buildDashboard({
    rows,
    dates,
    services: [{ id: 10, name: "Fade", active: true }, { id: 11, name: "Barba", active: true }, { id: 12, name: "Viejo", active: false }],
    barbers: [{ id: 1, display_name: "Santi", active: true }, { id: 2, display_name: "Andrés", active: true }],
    offset: OFFSET,
  });
  assert.deepEqual(d.totals, { booked: 3, completed: 1, cancelled: 1, revenue: 30000, cancelRate: 25, avgTicket: 30000 });
  assert.equal(d.byDay.find((x) => x.date === "2030-01-07").count, 3); // incluye la de las 23:00 de Bogotá
  assert.equal(d.byDay.find((x) => x.date === "2030-01-08").count, 0);
  assert.equal(d.byWeekday[0].count, 3); // lunes
  assert.equal(d.byHour[10].count, 1);
  assert.equal(d.byHour[23].count, 1);
  assert.deepEqual(d.byService.map((x) => [x.name, x.count, x.revenue]), [["Fade", 2, 30000], ["Barba", 1, 0]]); // «Viejo» inactivo y sin citas no aparece
  assert.deepEqual(d.byBarber.map((x) => [x.name, x.count]), [["Santi", 2], ["Andrés", 1]]);
});

test("buildDashboard: sin citas devuelve ceros sin dividir entre cero", () => {
  const d = S.buildDashboard({ rows: [], dates: S.lastDates("2030-01-08", 7), services: [], barbers: [], offset: OFFSET });
  assert.deepEqual(d.totals, { booked: 0, completed: 0, cancelled: 0, revenue: 0, cancelRate: 0, avgTicket: 0 });
  assert.equal(d.byDay.length, 7);
});

// ======================= Bloqueos, calificaciones y tokens =======================
test("blockRange: día completo, varios días y por horas (hora de Bogotá)", () => {
  const dia = S.blockRange({ date: "2030-01-07", allDay: true }, OFFSET);
  assert.equal(dia.start.toISOString(), "2030-01-07T05:00:00.000Z");
  assert.equal(dia.end.toISOString(), "2030-01-08T05:00:00.000Z");
  const varios = S.blockRange({ date: "2030-01-07", endDate: "2030-01-09", allDay: true }, OFFSET);
  assert.equal(varios.end.toISOString(), "2030-01-10T05:00:00.000Z");
  const horas = S.blockRange({ date: "2030-01-07", startTime: "10:00", endTime: "12:30" }, OFFSET);
  assert.equal(horas.start.toISOString(), "2030-01-07T15:00:00.000Z");
  assert.equal(horas.end.toISOString(), "2030-01-07T17:30:00.000Z");
});

test("blockRange: rechaza fechas, horas y rangos inválidos", () => {
  assert.ok(S.blockRange({ date: "mañana", allDay: true }, OFFSET).error);
  assert.ok(S.blockRange({ date: "2030-01-07", endDate: "2030-01-05", allDay: true }, OFFSET).error);
  assert.ok(S.blockRange({ date: "2030-01-01", endDate: "2030-06-01", allDay: true }, OFFSET).error); // más de 60 días
  assert.ok(S.blockRange({ date: "2030-01-07", startTime: "12:00", endTime: "10:00" }, OFFSET).error);
  assert.ok(S.blockRange({ date: "2030-01-07", startTime: "25:00", endTime: "26:00" }, OFFSET).error);
  assert.ok(S.blockRange({ date: "2030-01-07", endDate: "2030-01-08", startTime: "10:00", endTime: "12:00" }, OFFSET).error);
});

test("un bloqueo funciona como horario ocupado en generateSlots", () => {
  const barber = { work_days: [1, 2, 3, 4, 5, 6], work_start: "09:00", work_end: "12:00" };
  const bloque = S.blockRange({ date: "2030-01-07", startTime: "09:00", endTime: "10:30" }, OFFSET);
  const base = { date: "2030-01-07", barber, durationMin: 30, now: new Date("2030-01-01T00:00:00Z"), offset: OFFSET };
  const libres = S.generateSlots({ ...base, busy: [] }).map((x) => x.time);
  const conBloqueo = S.generateSlots({ ...base, busy: [{ start: bloque.start, end: bloque.end }] }).map((x) => x.time);
  assert.ok(libres.includes("09:00") && libres.includes("10:00"));
  assert.deepEqual(conBloqueo.filter((t) => t < "10:30"), []); // nada antes de las 10:30
  assert.ok(conBloqueo.includes("10:30"));
});

test("attachRatings: promedio y cantidad por barbero, null si no hay reseñas", () => {
  const items = [{ id: 1, name: "A" }, { id: 2, name: "B" }];
  const out = S.attachRatings(items, [{ barber_id: 1, rating: 5 }, { barber_id: 1, rating: 4 }, { barber_id: 1, rating: 4 }], "barber_id");
  assert.deepEqual([out[0].ratingAvg, out[0].ratingCount], [4.3, 3]);
  assert.deepEqual([out[1].ratingAvg, out[1].ratingCount], [null, 0]);
});

test("Token de recuperación: aleatorio, y su hash es estable y distinto del token", () => {
  const { hashToken, nuevoTokenRestablecer, crearCorreo } = require("../src/util");
  const a = nuevoTokenRestablecer();
  const b = nuevoTokenRestablecer();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashToken(a.token));
  assert.equal(a.hash.length, 64);
  assert.notEqual(a.hash, a.token);
  assert.equal(typeof crearCorreo({ host: "" }).enviar, "function"); // sin SMTP: correo por consola
  assert.equal(crearCorreo({ host: "smtp.x.com" }).constructor.name, "CorreoSmtp");
});

test("State: una cita pendiente o confirmada se puede reprogramar; las demás no", () => {
  const { EstadoCita } = require("../src/util");
  assert.ok(EstadoCita.de("pending").reprogramable && EstadoCita.de("confirmed").reprogramable);
  assert.equal(EstadoCita.de("completed").reprogramable, false);
  assert.equal(EstadoCita.de("cancelled").reprogramable, false);
});
