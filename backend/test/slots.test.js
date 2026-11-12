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
