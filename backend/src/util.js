"use strict";
// Utilidades: errores HTTP, validaciones y formato.
// Aquí también viven varios PATRONES DE DISEÑO (busca «PATRÓN»; la lista completa está en el README).
const { EventEmitter } = require("events");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// PATRÓN Decorator (estructural): envuelve un handler async y le añade el reenvío de errores a Express
// sin modificar el handler original.
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

// PATRÓN Adapter (estructural): publicBarber, publicService y shapeAppointment adaptan la interfaz de la
// base de datos (filas en snake_case, columnas internas) a la interfaz que espera el frontend (JSON en camelCase).
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


// ================================ PATRONES DE DISEÑO ================================

// ---- PATRÓN Builder (creacional) ---------------------------------------------------
// Construye y valida paso a paso los datos de una cita. build() entrega el objeto final o lanza HttpError.
class CitaBuilder {
  barbero(v) { this._barbero = v; return this; }
  servicio(v) { this._servicio = v; return this; }
  notas(v) { this._notas = v; return this; }
  inicio(v) { this._inicio = v; return this; }
  build() {
    const barberId = int(this._barbero, "El barbero");
    const serviceId = int(this._servicio, "El servicio");
    const notes = str(this._notas, "Las notas", { max: 300, optional: true });
    const startsAt = new Date(typeof this._inicio === "string" ? this._inicio : NaN);
    if (Number.isNaN(startsAt.getTime())) throw new HttpError(400, "El horario no es válido.");
    return { barberId, serviceId, notes, startsAt };
  }
}

// ---- PATRÓN State (comportamiento) ---------------------------------------------------
// Cada estado de una cita sabe a qué estados puede pasar. Evita tablas y «if» repartidos por el código.
class EstadoCita {
  constructor(nombre, siguientes = []) {
    this.nombre = nombre;
    this.siguientes = siguientes;
  }
  puedePasarA(otro) { return this.siguientes.includes(otro); }
  get cancelable() { return this.puedePasarA("cancelled"); }
  static de(nombre) {
    const estados = {
      pending: new EstadoCita("pending", ["confirmed", "cancelled"]),
      confirmed: new EstadoCita("confirmed", ["completed", "cancelled"]),
      completed: new EstadoCita("completed"),
      cancelled: new EstadoCita("cancelled"),
    };
    return estados[nombre] || new EstadoCita(String(nombre));
  }
}

// ---- PATRÓN Chain of Responsibility (comportamiento) ------------------------------------
// Cada eslabón valida una regla y, si todo va bien, pasa el contexto al siguiente. Si falla, lanza HttpError
// y la cadena se corta. Los eslabones concretos de la reserva están en routes/appointments.js.
class ManejadorReserva {
  siguiente(manejador) {
    this._siguiente = manejador;
    return manejador; // permite encadenar: a.siguiente(b).siguiente(c)
  }
  async manejar(ctx) {
    await this.validar(ctx);
    if (this._siguiente) await this._siguiente.manejar(ctx);
  }
  async validar() {
    throw new Error("validar() debe implementarse en cada eslabón");
  }
}

// ---- PATRÓN Template Method (comportamiento) --------------------------------------------------
// ejecutar() define el esqueleto fijo de «actualizar un recurso»: cargar → 404 si no existe → validar → guardar →
// responder. Cada subclase solo implementa los pasos que cambian (cargar, validar, guardar, responder).
class ActualizarRecurso {
  constructor(noExiste) { this.noExiste = noExiste; }
  async ejecutar(id, body) {
    const actual = await this.cargar(id);
    if (!actual) throw new HttpError(404, this.noExiste);
    const valores = this.validar(body || {}, actual);
    const fila = await this.guardar(id, valores);
    return this.responder(fila);
  }
  async cargar() { throw new Error("cargar() debe implementarse"); }
  validar() { throw new Error("validar() debe implementarse"); }
  async guardar() { throw new Error("guardar() debe implementarse"); }
  responder() { throw new Error("responder() debe implementarse"); }
}

// ---- PATRÓN Proxy (estructural) ------------------------------------------------------------------
// conCache(cargar) devuelve un sustituto con la misma interfaz que «cargar», pero que reutiliza el último
// resultado durante ttlMs. Las listas públicas (barberos, servicios) casi no cambian y se piden en cada visita.
const cachesPublicos = [];
function conCache(cargar, ttlMs = 30000) {
  let valor;
  let expira = 0;
  const proxy = async () => {
    if (Date.now() < expira) return valor;
    valor = await cargar();
    expira = Date.now() + ttlMs;
    return valor;
  };
  proxy.limpiar = () => { expira = 0; };
  cachesPublicos.push(proxy);
  return proxy;
}
/** Se llama cuando el administrador o un barbero editan datos públicos. */
const limpiarCachesPublicos = () => cachesPublicos.forEach((c) => c.limpiar());

// ---- PATRÓN Factory Method (creacional) --------------------------------------------------------
// Cada fábrica decide qué tipo de notificador crear; quien lo usa solo conoce la interfaz notificar(mensaje).
class NotificadorConsola { notificar(mensaje) { console.log(`[notificación] ${mensaje}`); } }
class NotificadorMemoria {
  constructor() { this.mensajes = []; }
  notificar(mensaje) { this.mensajes.push(mensaje); }
}
class NotificadorSilencioso { notificar() {} }

class FabricaNotificador {
  crear() { throw new Error("crear() debe implementarse en cada fábrica"); }
  static para(canal) {
    const fabricas = {
      consola: new (class extends FabricaNotificador { crear() { return new NotificadorConsola(); } })(),
      memoria: new (class extends FabricaNotificador { crear() { return new NotificadorMemoria(); } })(),
      silencio: new (class extends FabricaNotificador { crear() { return new NotificadorSilencioso(); } })(),
    };
    const fabrica = fabricas[canal];
    if (!fabrica) throw new Error(`Canal de notificación desconocido: ${canal}`);
    return fabrica;
  }
}

// ---- PATRÓN Observer (comportamiento) + Singleton (creacional) -------------------------------------
// Un único bus de eventos para toda la app (Singleton: un solo objeto por módulo). Las rutas publican hechos
// («cita:creada», «cita:cancelada», «cita:estado») y los observadores reaccionan sin que las rutas los conozcan.
const bus = new EventEmitter();

/** Publica un evento. Un observador que falle no debe tumbar la petición del cliente. */
function publicar(evento, datos) {
  try {
    bus.emit(evento, datos);
  } catch (err) {
    console.error(`[eventos] un observador de «${evento}» falló:`, err.message);
  }
}

const hora = (fecha) => new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" });

/** Suscribe al notificador a los eventos de las citas. */
function registrarObservadores(notificador) {
  bus.removeAllListeners();
  bus.on("cita:creada", (c) => notificador.notificar(`Nueva cita #${c.id}: ${c.service.name} con ${c.barber.name}, ${hora(c.startsAt)}`));
  bus.on("cita:cancelada", (c) => notificador.notificar(`Cita #${c.id} cancelada por el cliente`));
  bus.on("cita:estado", (c) => notificador.notificar(`Cita #${c.id} ahora está «${c.status}»`));
}

module.exports = {
  CitaBuilder, EstadoCita, ManejadorReserva, ActualizarRecurso, conCache, limpiarCachesPublicos,
  FabricaNotificador, NotificadorMemoria, bus, publicar, registrarObservadores,
  HttpError, wrap, str, email, password, int, time, weekdays, tags, hhmm,
  publicBarber, publicService, shapeAppointment, APPOINTMENT_SELECT, DATE_RE,
};
