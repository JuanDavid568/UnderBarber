// Utilidades de interfaz. Todo el texto dinámico entra por textContent (nunca innerHTML) para evitar XSS.

export function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style") for (const [p, val] of Object.entries(v)) node.style.setProperty(p, val);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  append(node, kids);
  return node;
}

export function append(node, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === undefined || k === null || k === false) continue;
    node.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return node;
}

export function mount(container, ...kids) {
  container.replaceChildren();
  return append(container, kids);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---- Formato (zona horaria de la barbería) ------------------------------------------------
const TZ = "America/Bogota";
const money = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const formatPrice = (n) => money.format(n);

const fmtDay = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fmtTime = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const fmtShort = new Intl.DateTimeFormat("es-CO", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const fmtYmd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatDay = (d) => fmtDay.format(new Date(d));
export const formatShortDay = (d) => fmtShort.format(new Date(d));
export const formatTime = (d) => fmtTime.format(new Date(d)).replace(/\s?([ap])\.?\s?m\.?/i, (_, x) => ` ${x.toLowerCase()}. m.`);
export const ymd = (d) => fmtYmd.format(new Date(d));
export const todayYmd = () => ymd(new Date());

/** Suma días a una fecha AAAA-MM-DD (calendario, sin zonas horarias). */
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Muestra una fecha AAAA-MM-DD como «martes, 3 de noviembre». */
export const formatYmd = (s) => fmtDay.format(new Date(`${s}T12:00:00-05:00`));

export const DAY_NAMES = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo" };

export const STATUS_LABEL = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function statusBadge(status) {
  return h("span", { class: `badge badge-${status}` }, STATUS_LABEL[status] || status);
}

// ---- Avisos -------------------------------------------------------------------------------------
let toastTimer;
export function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4500);
}

// ---- Emblemas de especialidad (SVG estático, sin datos de usuarios) ----------------------------------
const EMBLEMS = {
  fade: `<svg viewBox="0 0 120 120" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => `<rect x="${8 + i * 14}" y="${12 + i * 6}" width="10" height="${96 - i * 12}" rx="2" opacity="${(1 - i * 0.1).toFixed(2)}"/>`)
    .join("")}</svg>`,
  classic: `<svg viewBox="0 0 120 120" aria-hidden="true"><rect x="8" y="22" width="104" height="14" rx="4"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((i) => `<rect x="${12 + i * 10}" y="40" width="4" height="${62 - (i % 3) * 5}" rx="2"/>`)
    .join("")}</svg>`,
  creative: `<svg viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"><path d="M60 60c0-9 14-9 14 0s-20 14-20-4 26-26 38-8 0 38-26 38-44-14-40-44"/><path d="M96 20c-8-8-22-8-30 2"/></svg>`,
};
export function emblem(key) {
  const wrap = h("span", { class: "emblem" });
  wrap.insertAdjacentHTML("beforeend", EMBLEMS[key] || EMBLEMS.fade); // contenido fijo, no proviene de usuarios
  return wrap;
}

/** Foto del barbero (frontend/img/barbers/<especialidad>.jpg). Si no existe, muestra el emblema. */
export function barberPhoto(barber, cls = "") {
  const fig = h("figure", { class: `barber-photo ${cls}`.trim() });
  const img = h("img", {
    src: `/img/barbers/${barber.specialtyKey}.jpg`,
    alt: `Foto de ${barber.name}`,
    width: "640",
    height: "800",
    loading: "lazy",
    decoding: "async",
    onerror: () => fig.replaceChildren(emblem(barber.specialtyKey)),
  });
  fig.append(img);
  return fig;
}

export function setBusy(button, busy, label) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    if (label) button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}
