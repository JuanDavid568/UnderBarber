// Formulario de reserva: servicio → barbero → fecha y hora
import { api } from "./api.js";
import { h, mount, formatPrice, formatTime, formatYmd, ymd, todayYmd, addDays, toast, setBusy, $ } from "./ui.js";

const MAX_DAYS = 60;
let root;
let services = [];
let barbers = [];
let getUser = () => null;
let askLogin = () => {};
const sel = { serviceId: null, barberId: null, date: todayYmd(), startsAt: null, notes: "", recommendedId: null };
let slots = { state: "idle", list: [], message: "" }; // idle | loading | ready | error
let autoAdvance = true; // si hoy ya no hay horarios, salta al primer día con cupo (hasta que el cliente elija fecha)

export function initBooking(container, data) {
  root = container;
  services = data.services;
  barbers = data.barbers;
  getUser = data.getUser;
  askLogin = data.askLogin;
  if (!sel.serviceId && services[0]) sel.serviceId = services[0].id;
  render();
}

/** Preselecciona un barbero (por ejemplo, el del cuestionario) y lleva al formulario. */
export function preselectBarber(id, { recommended = false } = {}) {
  sel.barberId = id;
  sel.startsAt = null;
  if (recommended) sel.recommendedId = id;
  render();
  loadSlots();
  $("#reservar").scrollIntoView({ behavior: "smooth", block: "start" });
}

export function refreshBooking() {
  render();
}

async function loadSlots(attempt = 0) {
  sel.startsAt = null;
  if (!sel.serviceId || !sel.barberId || !sel.date) {
    slots = { state: "idle", list: [], message: "" };
    return render();
  }
  slots = { state: "loading", list: [], message: "" };
  renderSlots();
  const { serviceId, barberId, date } = sel;
  try {
    const res = await api.get(`/availability?barberId=${barberId}&serviceId=${serviceId}&date=${date}`);
    if (serviceId !== sel.serviceId || barberId !== sel.barberId || date !== sel.date) return; // llegó tarde
    if (!res.slots.length && autoAdvance && attempt < 7) {
      sel.date = addDays(sel.date, 1);
      const input = $("#booking-date");
      if (input) input.value = sel.date;
      return loadSlots(attempt + 1);
    }
    slots = { state: "ready", list: res.slots, message: "" };
  } catch (err) {
    slots = { state: "error", list: [], message: err.message };
  }
  renderSlots();
}

function render() {
  const maxDate = addDays(todayYmd(), MAX_DAYS);
  const barber = barbers.find((b) => b.id === sel.barberId);
  const service = services.find((s) => s.id === sel.serviceId);

  mount(
    root,
    h(
      "form",
      { class: "booking-form", novalidate: true, onsubmit: submit },
      h(
        "fieldset",
        {},
        h("legend", {}, "¿Qué te vas a hacer?"),
        h(
          "div",
          { class: "choice-grid" },
          services.map((s) =>
            choice("service", s.id, sel.serviceId === s.id, () => {
              sel.serviceId = s.id;
              render();
              loadSlots();
            }, [h("strong", {}, s.name), h("span", { class: "muted" }, `${s.durationMin} min · ${formatPrice(s.price)}`)])
          )
        )
      ),
      h(
        "fieldset",
        {},
        h("legend", {}, "¿Con quién?"),
        h(
          "div",
          { class: "choice-grid" },
          barbers.map((b) =>
            choice("barber", b.id, sel.barberId === b.id, () => {
              sel.barberId = b.id;
              render();
              loadSlots();
            }, [
              h("strong", {}, b.name),
              h("span", { class: "muted" }, b.title),
              sel.recommendedId === b.id && h("span", { class: "tag" }, "Recomendado para ti"),
            ])
          )
        )
      ),
      h(
        "fieldset",
        {},
        h("legend", {}, "¿Cuándo?"),
        h(
          "label",
          { class: "date-field" },
          "Fecha",
          h("input", {
            type: "date",
            id: "booking-date",
            value: sel.date,
            min: todayYmd(),
            max: maxDate,
            required: true,
            onchange: (e) => {
              sel.date = e.target.value;
              autoAdvance = false;
              loadSlots();
            },
          })
        ),
        h("div", { id: "slots", "aria-live": "polite" }),
        barber && service && sel.date && h("p", { class: "muted small" }, `${barber.name} atiende ${formatDaysShort(barber)}.`)
      ),
      h(
        "label",
        {},
        "Notas para el barbero ",
        h("span", { class: "muted" }, "(opcional)"),
        h("textarea", { id: "booking-notes", maxlength: "300", rows: "2", placeholder: "Ej. quiero un fade bajo y la barba perfilada", oninput: (e) => (sel.notes = e.target.value) }, sel.notes)
      ),
      h("p", { class: "form-error", id: "booking-error", role: "alert", hidden: true }),
      h("button", { class: "btn", type: "submit", id: "booking-submit" }, getUser() ? "Confirmar cita" : "Entrar y confirmar cita")
    )
  );
  renderSlots();
}

const SHORT = { 1: "lun", 2: "mar", 3: "mié", 4: "jue", 5: "vie", 6: "sáb", 7: "dom" };
function formatDaysShort(b) {
  return `${b.workDays.map((d) => SHORT[d]).join(", ")} de ${b.workStart} a ${b.workEnd}`;
}

function choice(name, value, checked, onChange, kids) {
  const id = `${name}-${value}`;
  return h(
    "div",
    { class: "choice" },
    h("input", { type: "radio", name, id, value, checked, onchange: onChange }),
    h("label", { for: id }, kids)
  );
}

function renderSlots() {
  const box = $("#slots");
  if (!box) return;
  if (slots.state === "idle") return mount(box, h("p", { class: "muted" }, "Elige un barbero para ver los horarios."));
  if (slots.state === "loading") return mount(box, h("p", { class: "muted" }, "Buscando horarios…"));
  if (slots.state === "error") return mount(box, h("p", { class: "form-error" }, slots.message));
  if (!slots.list.length) {
    return mount(box, h("p", { class: "muted" }, `No hay horarios libres el ${formatYmd(sel.date)}. Prueba otro día.`));
  }
  mount(
    box,
    h("p", { class: "muted small" }, `Horarios libres · ${formatYmd(sel.date)}`),
    h(
      "div",
      { class: "slots", role: "radiogroup", "aria-label": "Horarios disponibles" },
      slots.list.map((s) =>
        h(
          "button",
          {
            type: "button",
            class: "slot",
            role: "radio",
            "aria-checked": sel.startsAt === s.startsAt ? "true" : "false",
            onclick: () => {
              sel.startsAt = s.startsAt;
              renderSlots();
            },
          },
          formatTime(s.startsAt)
        )
      )
    )
  );
}

function showError(msg) {
  const el = $("#booking-error");
  el.textContent = msg;
  el.hidden = !msg;
}

async function submit(e) {
  e.preventDefault();
  showError("");
  if (!sel.serviceId) return showError("Elige un servicio.");
  if (!sel.barberId) return showError("Elige un barbero.");
  if (!sel.startsAt) return showError("Elige un horario.");
  if (!getUser()) {
    askLogin(() => submit(new Event("submit")));
    return;
  }
  const btn = $("#booking-submit");
  setBusy(btn, true, "Reservando…");
  try {
    const { appointment } = await api.post("/appointments", {
      barberId: sel.barberId,
      serviceId: sel.serviceId,
      startsAt: sel.startsAt,
      notes: sel.notes,
    });
    sel.startsAt = null;
    sel.notes = "";
    renderConfirmation(appointment);
  } catch (err) {
    setBusy(btn, false);
    showError(err.message);
    if (err.status === 409) loadSlots();
  }
}

function renderConfirmation(a) {
  const title = h("h3", { tabindex: "-1" }, "Cita reservada");
  mount(
    root,
    h(
      "div",
      { class: "confirmation", role: "status" },
      title,
      h("p", { class: "confirm-when" }, `${formatYmd(ymd(a.startsAt))} · ${formatTime(a.startsAt)}`),
      h("p", {}, `${a.service.name} con ${a.barber.name}. ${formatPrice(a.service.price)} · ${a.service.durationMin} min.`),
      h("p", { class: "muted" }, "Queda pendiente hasta que tu barbero la confirme. Puedes verla o cancelarla en Mis citas."),
      h(
        "div",
        { class: "hero-actions" },
        h("a", { class: "btn", href: "#/cuenta" }, "Ver mis citas"),
        h("button", { class: "btn btn-ghost", type: "button", onclick: () => { render(); loadSlots(); } }, "Reservar otra")
      )
    )
  );
  title.focus();
  toast("Cita reservada");
}
