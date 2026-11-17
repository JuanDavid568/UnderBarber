// Paneles: Mis citas (cliente), Mi agenda (barbero) y Administración (dueño)
import { api } from "./api.js";
import { h, mount, formatPrice, formatTime, formatDay, formatShortDay, formatYmd, ymd, todayYmd, addDays, statusBadge, STATUS_LABEL, DAY_NAMES, toast, setBusy, openDialog, starsText, ratingLine } from "./ui.js";

const loading = () => h("p", { class: "muted", role: "status" }, "Cargando…");
const failure = (err, retry) =>
  h("div", {}, h("p", { class: "form-error" }, err.message), h("button", { class: "btn btn-ghost", type: "button", onclick: retry }, "Reintentar"));

function pageHead(title, sub) {
  return h("div", { class: "section-head" }, h("h1", { class: "panel-title" }, title), sub && h("p", {}, sub));
}

function passwordForm() {
  const err = h("p", { class: "form-error", role: "alert", hidden: true });
  const form = h(
    "form",
    {
      class: "form form-inline",
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button");
        err.hidden = true;
        setBusy(btn, true, "Guardando…");
        try {
          await api.patch("/auth/password", {
            currentPassword: form.elements.currentPassword.value,
            newPassword: form.elements.newPassword.value,
          });
          form.reset();
          toast("Contraseña actualizada");
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
        }
        setBusy(btn, false);
      },
    },
    h("label", {}, "Contraseña actual", h("input", { type: "password", name: "currentPassword", autocomplete: "current-password", required: true })),
    h("label", {}, "Contraseña nueva", h("input", { type: "password", name: "newPassword", autocomplete: "new-password", minlength: "8", maxlength: "72", required: true })),
    err,
    h("button", { class: "btn btn-ghost", type: "submit" }, "Cambiar contraseña")
  );
  return h("details", { class: "box" }, h("summary", {}, "Cambiar mi contraseña"), form);
}

// ======================================================================================
// Cliente
// ======================================================================================
export async function renderAccount(panel, { user }) {
  mount(panel, pageHead(`Hola, ${user.name.split(" ")[0]}`, "Tus citas en UnderBarber."), loading());
  const body = h("div", {});
  async function load() {
    try {
      const { appointments } = await api.get("/appointments/mine");
      const now = Date.now();
      const upcoming = appointments
        .filter((a) => ["pending", "confirmed"].includes(a.status) && new Date(a.startsAt) > now)
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      const past = appointments.filter((a) => !upcoming.includes(a));
      mount(
        body,
        h("h2", {}, "Próximas"),
        upcoming.length
          ? h("ul", { class: "appt-list" }, upcoming.map((a) => apptItem(a, { onCancel: () => cancel(a), actions: rescheduleButton(a) })))
          : h("div", { class: "empty" }, h("p", {}, "No tienes citas próximas."), h("a", { class: "btn", href: "#reservar" }, "Reservar una cita")),
        past.length > 0 && [h("h2", {}, "Historial"), h("ul", { class: "appt-list muted-list" }, past.map((a) => apptItem(a, { actions: reviewAction(a) })))]
      );
    } catch (err) {
      mount(body, failure(err, load));
    }
  }
  const rescheduleButton = (a) =>
    h("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => rescheduleDialog(a, load) }, "Reprogramar");
  const reviewAction = (a) => {
    if (a.status !== "completed") return null;
    if (a.review) return h("span", { class: "rating", title: a.review.comment || "Tu calificación" }, starsText(a.review.rating));
    return h("button", { class: "btn btn-small", type: "button", onclick: () => reviewDialog(a, load) }, "Calificar");
  };
  async function cancel(a) {
    if (!window.confirm(`¿Cancelar tu cita del ${formatDay(a.startsAt)} a las ${formatTime(a.startsAt)}?`)) return;
    try {
      await api.patch(`/appointments/${a.id}/cancel`);
      toast("Cita cancelada");
      load();
    } catch (err) {
      toast(err.message);
    }
  }
  mount(panel, pageHead(`Hola, ${user.name.split(" ")[0]}`, "Tus citas en UnderBarber."), body, passwordForm());
  load();
}

// ---------------- Reprogramar y calificar (desde «Mis citas») ----------------
function rescheduleDialog(appt, onDone) {
  const state = { date: ymd(appt.startsAt) < todayYmd() ? todayYmd() : ymd(appt.startsAt), startsAt: null };
  const slotsBox = h("div", { "aria-live": "polite" });
  const error = h("p", { class: "form-error", role: "alert", hidden: true });
  const submit = h("button", { class: "btn", type: "submit", disabled: true }, "Mover mi cita");

  async function loadSlots() {
    state.startsAt = null;
    submit.disabled = true;
    mount(slotsBox, h("p", { class: "muted" }, "Buscando horarios…"));
    try {
      const res = await api.get(`/availability?barberId=${appt.barber.id}&serviceId=${appt.service.id}&date=${state.date}`);
      const draw = () =>
        mount(
          slotsBox,
          res.slots.length
            ? [
                h("p", { class: "muted small" }, `Horarios libres · ${formatYmd(state.date)}`),
                h("div", { class: "slots", role: "radiogroup", "aria-label": "Horarios disponibles" },
                  res.slots.map((s) =>
                    h("button", {
                      type: "button", class: "slot", role: "radio", "aria-checked": String(state.startsAt === s.startsAt),
                      onclick: () => { state.startsAt = s.startsAt; submit.disabled = false; draw(); },
                    }, formatTime(s.startsAt))
                  )),
              ]
            : h("p", { class: "muted" }, `No hay horarios libres el ${formatYmd(state.date)}. Prueba otro día.`)
        );
      draw();
    } catch (err) {
      mount(slotsBox, h("p", { class: "form-error" }, err.message));
    }
  }

  const dlg = openDialog(
    "Reprogramar cita",
    h("p", { class: "muted" }, `${appt.service.name} con ${appt.barber.name}. Ahora: ${formatDay(appt.startsAt)} a las ${formatTime(appt.startsAt)}`),
    h("form", { class: "form", novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          if (!state.startsAt) return;
          error.hidden = true;
          setBusy(submit, true, "Moviendo…");
          try {
            await api.patch(`/appointments/${appt.id}/reschedule`, { startsAt: state.startsAt });
            dlg.close();
            toast("Cita reprogramada. El barbero la confirmará de nuevo.");
            onDone();
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            setBusy(submit, false);
            loadSlots();
          }
        } },
      h("label", { class: "date-field" }, "Nueva fecha",
        h("input", { type: "date", value: state.date, min: todayYmd(), max: addDays(todayYmd(), 60), required: true,
          onchange: (e) => { if (e.target.value) { state.date = e.target.value; loadSlots(); } } })),
      slotsBox,
      h("p", { class: "muted small" }, "Al moverla, tu cita vuelve a quedar pendiente de confirmación."),
      error,
      submit)
  );
  loadSlots();
}

function reviewDialog(appt, onDone) {
  let rating = 0;
  const error = h("p", { class: "form-error", role: "alert", hidden: true });
  const stars = h("div", { class: "stars-input", role: "group", "aria-label": "Calificación" });
  const paint = () =>
    mount(stars, [1, 2, 3, 4, 5].map((n) =>
      h("button", { type: "button", class: `star ${n <= rating ? "on" : ""}`.trim(), "aria-label": `${n} ${n === 1 ? "estrella" : "estrellas"}`,
        "aria-pressed": String(n === rating), onclick: () => { rating = n; paint(); } }, "★")));
  paint();
  const comment = h("textarea", { maxlength: "300", rows: "3", placeholder: "Cuéntanos cómo te fue (opcional)" });
  const submit = h("button", { class: "btn", type: "submit" }, "Enviar calificación");
  const dlg = openDialog(
    "Califica tu cita",
    h("p", { class: "muted" }, `${appt.service.name} con ${appt.barber.name}, ${formatDay(appt.startsAt)}.`),
    h("form", { class: "form", novalidate: true,
        onsubmit: async (e) => {
          e.preventDefault();
          if (!rating) { error.textContent = "Elige de 1 a 5 estrellas."; error.hidden = false; return; }
          error.hidden = true;
          setBusy(submit, true, "Enviando…");
          try {
            await api.post(`/appointments/${appt.id}/review`, { rating, comment: comment.value });
            dlg.close();
            toast("¡Gracias por tu calificación!");
            onDone();
          } catch (err) {
            error.textContent = err.message;
            error.hidden = false;
            setBusy(submit, false);
          }
        } },
      stars, h("label", {}, "Comentario", comment), error, submit)
  );
}

// ---------------- Bloqueos de horario (barbero y administrador) ----------------
const hm = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));

function describeBlock(b) {
  const start = new Date(b.startsAt), end = new Date(b.endsAt);
  const allDay = hm(start) === "00:00" && (end - start) % 86400000 === 0;
  if (!allDay) return `${formatYmd(ymd(start))}, de ${hm(start)} a ${hm(end)}`;
  const last = ymd(new Date(end.getTime() - 1));
  return ymd(start) === last ? `${formatYmd(ymd(start))} (todo el día)` : `${formatYmd(ymd(start))} al ${formatYmd(last)} (todo el día)`;
}

/** Formulario + lista de bloqueos. Si `barbers` viene (administrador) se puede elegir barbero o toda la barbería. */
function blocksSection({ barbers } = {}) {
  const list = h("div", { "aria-live": "polite" });
  const error = h("p", { class: "form-error", role: "alert", hidden: true });
  const submit = h("button", { class: "btn", type: "submit" }, "Bloquear");
  const mode = { allDay: true };

  const barberSelect = barbers && h("select", { name: "barberId", required: true },
    h("option", { value: "all" }, "Toda la barbería"),
    barbers.map((b) => h("option", { value: String(b.id) }, b.name)));
  const date = h("input", { type: "date", name: "date", value: todayYmd(), min: todayYmd(), required: true });
  const endDate = h("input", { type: "date", name: "endDate", min: todayYmd() });
  const start = h("input", { type: "time", name: "startTime", value: "09:00" });
  const end = h("input", { type: "time", name: "endTime", value: "12:00" });
  const reason = h("input", { type: "text", name: "reason", maxlength: "120", placeholder: "Ej. vacaciones, festivo, cita médica" });
  const timesRow = h("div", { class: "form-row", hidden: true }, h("label", {}, "Desde", start), h("label", {}, "Hasta", end));
  const endRow = h("label", {}, "Hasta el día ", h("span", { class: "muted" }, "(opcional, para varios días)"), endDate);
  const setMode = (allDay) => { mode.allDay = allDay; timesRow.hidden = allDay; endRow.hidden = !allDay; };

  async function load() {
    mount(list, h("p", { class: "muted" }, "Cargando…"));
    try {
      const { blocks } = await api.get("/barber/blocks");
      mount(list, blocks.length
        ? h("ul", { class: "plain block-list" }, blocks.map((b) =>
            h("li", {},
              h("div", {}, h("strong", {}, describeBlock(b)),
                h("span", { class: "muted small" }, [b.global ? "Toda la barbería" : barbers ? b.barberName : null, b.reason].filter(Boolean).join(" · "))),
              (barbers || !b.global) && h("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => remove(b) }, "Quitar"))))
        : h("p", { class: "muted" }, "No hay bloqueos próximos."));
    } catch (err) {
      mount(list, h("p", { class: "form-error" }, err.message));
    }
  }
  async function remove(b) {
    if (!window.confirm("¿Quitar este bloqueo? Esas horas volverán a poder reservarse.")) return;
    try { await api.del(`/barber/blocks/${b.id}`); toast("Bloqueo quitado"); load(); } catch (err) { toast(err.message); }
  }

  const form = h("form", { class: "form block-form", novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        error.hidden = true;
        const body = { date: date.value, allDay: mode.allDay, reason: reason.value };
        if (barberSelect) body.barberId = barberSelect.value;
        if (mode.allDay) { if (endDate.value) body.endDate = endDate.value; } else { body.startTime = start.value; body.endTime = end.value; }
        setBusy(submit, true, "Bloqueando…");
        try {
          await api.post("/barber/blocks", body);
          toast("Horario bloqueado");
          reason.value = ""; endDate.value = "";
          load();
        } catch (err) { error.textContent = err.message; error.hidden = false; }
        setBusy(submit, false);
      } },
    barberSelect && h("label", {}, "Barbero", barberSelect),
    h("fieldset", { class: "inline-choice" }, h("legend", {}, "¿Qué bloquear?"),
      h("label", { class: "inline-check" }, h("input", { type: "radio", name: "blk-mode", checked: true, onchange: () => setMode(true) }), "Días completos"),
      h("label", { class: "inline-check" }, h("input", { type: "radio", name: "blk-mode", onchange: () => setMode(false) }), "Solo unas horas")),
    h("label", {}, "Día", date), endRow, timesRow,
    h("label", {}, "Motivo ", h("span", { class: "muted" }, "(opcional)"), reason),
    error, submit);

  const box = h("section", { class: "blocks" },
    h("p", { class: "muted" }, "Las horas bloqueadas dejan de aparecer para reservar. Si ya hay citas en ese horario, primero cancélalas o pide que las reprogramen."),
    form, h("h3", {}, "Bloqueos próximos"), list);
  load();
  return box;
}

async function adminBlocks(box) {
  try {
    const { barbers } = await api.get("/barbers");
    mount(box, blocksSection({ barbers }));
  } catch (err) {
    mount(box, failure(err, () => adminBlocks(box)));
  }
}

function apptItem(a, { onCancel, actions, showClient } = {}) {
  return h(
    "li",
    { class: `appt appt-${a.status}` },
    h("div", { class: "appt-when" }, h("strong", {}, formatTime(a.startsAt)), h("span", { class: "muted" }, formatShortDay(a.startsAt))),
    h(
      "div",
      { class: "appt-what" },
      h("strong", {}, a.service.name),
      h("span", {}, showClient && a.client ? `${a.client.name}` : `con ${a.barber.name}`),
      showClient && a.client && a.client.phone && h("a", { class: "muted", href: `tel:${a.client.phone.replace(/[^0-9+]/g, "")}` }, a.client.phone),
      a.notes && h("span", { class: "muted small" }, `«${a.notes}»`),
      h("span", { class: "muted small" }, `${a.service.durationMin} min · ${formatPrice(a.service.price)}`)
    ),
    h("div", { class: "appt-actions" }, statusBadge(a.status), onCancel && h("button", { class: "btn btn-small btn-ghost", type: "button", onclick: onCancel }, "Cancelar"), actions)
  );
}

// ======================================================================================
// Barbero
// ======================================================================================
export async function renderBarber(panel, { user }) {
  const state = { date: todayYmd(), days: 1 };
  const agenda = h("div", { "aria-live": "polite" });
  const profileBox = h("div", {});

  async function loadAgenda() {
    mount(agenda, loading());
    try {
      const res = await api.get(`/barber/appointments?date=${state.date}&days=${state.days}`);
      const byDay = new Map();
      for (const a of res.appointments) {
        const key = ymd(a.startsAt);
        if (!byDay.has(key)) byDay.set(key, []);
        byDay.get(key).push(a);
      }
      const dayKeys = state.days === 1 ? [state.date] : [...byDay.keys()].sort();
      mount(
        agenda,
        !res.appointments.length
          ? h("div", { class: "empty" }, h("p", {}, state.days === 1 ? "No tienes citas este día." : "No tienes citas en estos días."))
          : dayKeys.map((k) =>
              h(
                "section",
                { class: "day-group" },
                state.days > 1 && h("h3", {}, formatYmd(k)),
                h("ul", { class: "appt-list" }, (byDay.get(k) || []).map((a) => apptItem(a, { showClient: true, actions: barberActions(a) })))
              )
            )
      );
    } catch (err) {
      mount(agenda, failure(err, loadAgenda));
    }
  }

  function barberActions(a) {
    const btn = (label, status, ghost) =>
      h("button", { class: `btn btn-small ${ghost ? "btn-ghost" : ""}`, type: "button", onclick: () => setStatus(a, status, label) }, label);
    if (a.status === "pending") return [btn("Confirmar", "confirmed"), btn("Cancelar", "cancelled", true)];
    if (a.status === "confirmed") {
      const started = new Date(a.startsAt) <= new Date();
      return [started && btn("Completar", "completed"), btn("Cancelar", "cancelled", true)];
    }
    return null;
  }

  async function setStatus(a, status, label) {
    if (status === "cancelled" && !window.confirm(`¿Cancelar la cita de ${a.client ? a.client.name : "este cliente"}?`)) return;
    try {
      await api.patch(`/barber/appointments/${a.id}/status`, { status });
      toast(`Cita ${STATUS_LABEL[status].toLowerCase()}`);
      loadAgenda();
    } catch (err) {
      toast(err.message);
    }
  }

  const dateInput = h("input", {
    type: "date", value: state.date, "aria-label": "Fecha de la agenda",
    onchange: (e) => { if (e.target.value) { state.date = e.target.value; loadAgenda(); } },
  });
  const shift = (n) => { state.date = addDays(state.date, n * state.days); dateInput.value = state.date; loadAgenda(); };
  const toolbar = h(
    "div",
    { class: "toolbar" },
    h("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => shift(-1) }, "Anterior"),
    h("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => { state.date = todayYmd(); dateInput.value = state.date; loadAgenda(); } }, "Hoy"),
    h("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => shift(1) }, "Siguiente"),
    dateInput,
    h("label", { class: "inline-check" }, h("input", { type: "checkbox", onchange: (e) => { state.days = e.target.checked ? 7 : 1; loadAgenda(); } }), "Ver 7 días")
  );

  mount(
    panel,
    pageHead(`Agenda de ${user.name.split(" ")[0]}`, "Confirma, completa o cancela las citas de tus clientes."),
    toolbar,
    agenda,
    h("h2", {}, "Bloquear horarios"),
    blocksSection(),
    h("h2", {}, "Mi perfil"),
    profileBox,
    passwordForm()
  );
  loadAgenda();

  try {
    const { barber } = await api.get("/barber/profile");
    mount(profileBox, profileForm(barber, (data) => api.patch("/barber/profile", data), { withIdentity: false }));
  } catch (err) {
    mount(profileBox, failure(err, () => renderBarber(panel, { user })));
  }
}

/** Formulario de perfil de barbero. En el panel de admin también edita nombre, título y estado. */
function profileForm(barber, save, { withIdentity }) {
  const err = h("p", { class: "form-error", role: "alert", hidden: true });
  const days = h(
    "fieldset",
    { class: "days" },
    h("legend", {}, "Días que trabajas"),
    Object.entries(DAY_NAMES).map(([n, label]) =>
      h("label", { class: "inline-check" }, h("input", { type: "checkbox", name: "day", value: n, checked: barber.workDays.includes(Number(n)) }), label)
    )
  );
  const form = h(
    "form",
    {
      class: "form box",
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        err.hidden = true;
        const f = form.elements;
        const data = {
          bio: f.bio.value,
          specialties: f.specialties.value.split(",").map((s) => s.trim()).filter(Boolean),
          workDays: [...form.querySelectorAll("input[name=day]:checked")].map((i) => Number(i.value)),
          workStart: f.workStart.value,
          workEnd: f.workEnd.value,
        };
        if (withIdentity) Object.assign(data, { name: f.name.value, title: f.title.value, active: f.active.checked });
        const btn = form.querySelector("button[type=submit]");
        setBusy(btn, true, "Guardando…");
        try {
          await save(data);
          toast("Cambios guardados");
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
        }
        setBusy(btn, false);
      },
    },
    withIdentity && h("label", {}, "Nombre", h("input", { name: "name", value: barber.name, required: true, maxlength: "120" })),
    withIdentity && h("label", {}, "Título", h("input", { name: "title", value: barber.title, required: true, maxlength: "120" })),
    h("label", {}, "Biografía", h("textarea", { name: "bio", rows: "3", maxlength: "600" }, barber.bio)),
    h("label", {}, "Especialidades ", h("span", { class: "muted" }, "(separadas por comas)"), h("input", { name: "specialties", value: barber.specialties.join(", ") })),
    days,
    h("div", { class: "row" },
      h("label", {}, "Entrada", h("input", { type: "time", name: "workStart", value: barber.workStart, required: true })),
      h("label", {}, "Salida", h("input", { type: "time", name: "workEnd", value: barber.workEnd, required: true }))
    ),
    withIdentity && h("label", { class: "inline-check" }, h("input", { type: "checkbox", name: "active", checked: barber.active !== false }), "Visible para los clientes"),
    err,
    h("button", { class: "btn", type: "submit" }, "Guardar cambios")
  );
  return form;
}

// ======================================================================================
// Administración
// ======================================================================================
export async function renderAdmin(panel) {
  const content = h("div", {});
  const tabs = [
    ["Resumen", adminStats],
    ["Dashboard", adminDashboard],
    ["Citas", adminAppointments],
    ["Bloqueos", adminBlocks],
    ["Servicios", adminServices],
    ["Barberos", adminBarbers],
  ];
  const tabBar = h("div", { class: "tabs", role: "tablist", "aria-label": "Administración" });
  const buttons = tabs.map(([label, fn], i) => {
    const b = h("button", { role: "tab", "aria-selected": i === 0 ? "true" : "false", onclick: () => select(i) }, label);
    tabBar.append(b);
    return b;
  });
  function select(i) {
    buttons.forEach((b, j) => b.setAttribute("aria-selected", i === j ? "true" : "false"));
    mount(content, loading());
    tabs[i][1](content);
  }
  mount(panel, pageHead("Administración", "Resumen del negocio y gestión de servicios y barberos."), tabBar, content, passwordForm());
  select(0);
}

async function adminStats(box) {
  try {
    const s = await api.get("/admin/stats");
    const tile = (label, value) => h("div", { class: "stat" }, h("strong", {}, value), h("span", {}, label));
    const maxQuiz = Math.max(1, ...s.quizByBarber.map((b) => b.n));
    mount(
      box,
      h("div", { class: "stats" },
        tile("Citas hoy", s.appointmentsToday),
        tile("Citas próximas", s.appointmentsUpcoming),
        tile("Clientes registrados", s.clients),
        tile("Cuestionarios respondidos", s.quizTotal),
        tile("Ingresos de citas completadas", formatPrice(s.revenueCompleted))
      ),
      h("div", { class: "two-col" },
        h("div", {}, h("h2", {}, "Citas por estado"),
          h("ul", { class: "plain" }, Object.entries(s.appointmentsByStatus).map(([k, n]) => h("li", { class: "kv" }, statusBadge(k), h("strong", {}, n))))),
        h("div", {}, h("h2", {}, "A quién recomienda el cuestionario"),
          h("ul", { class: "plain bars" }, s.quizByBarber.map((b) =>
            h("li", {}, h("span", {}, b.name), h("span", { class: "bar" }, h("span", { class: "bar-fill", style: { "--p": `${(b.n / maxQuiz) * 100}%` } })), h("strong", {}, b.n))
          )))
      )
    );
  } catch (err) {
    mount(box, failure(err, () => adminStats(box)));
  }
}

// ---------------- Dashboard: estadísticas con gráficas (SVG dibujado a mano, sin librerías) ----------------
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const kid of kids) node.append(kid);
  return node;
}

/** Paso «bonito» para el eje vertical: 1, 2, 5, 10, 20, 50… con máximo ~4 líneas. */
function niceStep(max) {
  const raw = Math.max(1, max) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((st) => st >= raw);
}

/** Gráfica de barras verticales. data: [{ label, value, tip }]. Cada barra lleva un <title> con su valor. */
function barChart(data, { ariaLabel, labelEvery = 1, showValues = false }) {
  const W = 560, H = 220, L = 34, R = 8, T = 16, B = 28;
  const step = niceStep(Math.max(...data.map((d) => d.value)));
  const top = Math.max(step, Math.ceil(Math.max(...data.map((d) => d.value)) / step) * step);
  const plotW = W - L - R, plotH = H - T - B;
  const slot = plotW / data.length;
  const y = (v) => T + plotH - (v / top) * plotH;
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": ariaLabel, preserveAspectRatio: "xMidYMid meet" });
  for (let v = 0; v <= top; v += step) {
    svg.append(svgEl("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "chart-grid" }));
    svg.append(svgEl("text", { x: L - 6, y: y(v) + 4, class: "chart-axis", "text-anchor": "end" }, document.createTextNode(String(v))));
  }
  data.forEach((d, i) => {
    const bw = Math.max(2, slot * 0.68);
    const x = L + i * slot + (slot - bw) / 2;
    const bar = svgEl("rect", { x, y: y(d.value), width: bw, height: Math.max(0, plotH - (y(d.value) - T)), class: "chart-bar" }, svgEl("title", {}, document.createTextNode(d.tip || `${d.label}: ${d.value}`)));
    svg.append(bar);
    if (showValues && d.value > 0) svg.append(svgEl("text", { x: x + bw / 2, y: y(d.value) - 4, class: "chart-value", "text-anchor": "middle" }, document.createTextNode(String(d.value))));
    if (i % labelEvery === 0) svg.append(svgEl("text", { x: x + bw / 2, y: H - 8, class: "chart-axis", "text-anchor": "middle" }, document.createTextNode(d.label)));
  });
  return svg;
}

/** Lista con barras horizontales: nombre, barra, cantidad e ingresos. */
function rankList(items, unit) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return h("ul", { class: "plain bars bars-rich" }, items.map((i) =>
    h("li", {},
      h("span", {}, i.name, i.ratingCount > 0 && h("span", { class: "rating small" }, ` ★ ${i.ratingAvg.toFixed(1)}`)),
      h("span", { class: "bar" }, h("span", { class: "bar-fill", style: { "--p": `${(i.count / max) * 100}%` } })),
      h("strong", { title: unit }, i.count),
      h("span", { class: "muted" }, formatPrice(i.revenue))
    )
  ));
}

async function adminDashboard(box, days = 30) {
  try {
    const d = await api.get(`/admin/dashboard?days=${days}`);
    const tile = (label, value) => h("div", { class: "stat" }, h("strong", {}, value), h("span", {}, label));
    const period = h("div", { class: "period", role: "group", "aria-label": "Periodo" },
      [7, 30, 90].map((n) => h("button", {
        class: `btn btn-small ${n === days ? "" : "btn-ghost"}`.trim(), type: "button", "aria-pressed": String(n === days),
        onclick: () => { mount(box, loading()); adminDashboard(box, n); },
      }, `${n} días`)));
    const empty = d.totals.booked + d.totals.cancelled === 0;

    // Horas: solo el rango con citas (±1 hora) para que la gráfica no quede llena de ceros
    const used = d.byHour.filter((x) => x.count > 0).map((x) => x.hour);
    const h0 = used.length ? Math.max(0, Math.min(...used) - 1) : 8;
    const h1 = used.length ? Math.min(23, Math.max(...used) + 1) : 19;
    const hours = d.byHour.filter((x) => x.hour >= h0 && x.hour <= h1);
    const every = d.byDay.length > 40 ? 15 : d.byDay.length > 10 ? 5 : 1;

    mount(
      box,
      h("div", { class: "dash-head" },
        h("p", { class: "muted" }, `Del ${formatYmd(d.range.from)} al ${formatYmd(d.range.to)}. Las citas canceladas no se cuentan como agendadas.`),
        period),
      h("div", { class: "stats" },
        tile("Citas agendadas", d.totals.booked),
        tile("Completadas", d.totals.completed),
        tile(`Canceladas (${d.totals.cancelRate}%)`, d.totals.cancelled),
        tile("Ingresos (completadas)", formatPrice(d.totals.revenue)),
        tile("Ticket promedio", formatPrice(d.totals.avgTicket)),
        tile(d.totals.ratingCount ? `Calificación (${d.totals.ratingCount} ${d.totals.ratingCount === 1 ? "reseña" : "reseñas"})` : "Calificación", d.totals.ratingCount ? `★ ${d.totals.ratingAvg.toFixed(1)}` : "—")
      ),
      empty
        ? h("p", { class: "muted" }, "Todavía no hay citas en este periodo. Cuando los clientes reserven, aquí verás las gráficas.")
        : h("div", {},
            h("h2", {}, "Citas por día"),
            barChart(d.byDay.map((x) => ({ label: x.date.slice(8) + "/" + x.date.slice(5, 7), value: x.count, tip: `${formatYmd(x.date)}: ${x.count} citas` })),
              { ariaLabel: `Citas agendadas por día, últimos ${days} días`, labelEvery: every }),
            h("div", { class: "two-col" },
              h("div", {}, h("h2", {}, "Cortes y servicios más pedidos"), rankList(d.byService, "citas")),
              h("div", {}, h("h2", {}, "Citas por barbero"), rankList(d.byBarber, "citas"))),
            h("div", { class: "two-col" },
              h("div", {}, h("h2", {}, "Día de la semana"),
                barChart(d.byWeekday.map((x) => ({ label: DAY_NAMES[x.day].slice(0, 3), value: x.count, tip: `${DAY_NAMES[x.day]}: ${x.count} citas` })),
                  { ariaLabel: "Citas agendadas por día de la semana", showValues: true })),
              h("div", {}, h("h2", {}, "Horas con más citas"),
                barChart(hours.map((x) => ({ label: `${x.hour}h`, value: x.count, tip: `${x.hour}:00 – ${x.hour}:59: ${x.count} citas` })),
                  { ariaLabel: "Citas agendadas por hora del día", showValues: true }))))
    );
  } catch (err) {
    mount(box, failure(err, () => adminDashboard(box, days)));
  }
}

async function adminAppointments(box) {
  const status = h("select", { "aria-label": "Filtrar por estado", onchange: load },
    h("option", { value: "" }, "Todos los estados"),
    Object.entries(STATUS_LABEL).map(([k, v]) => h("option", { value: k }, v)));
  const list = h("div", {});
  async function load() {
    mount(list, loading());
    try {
      const { appointments } = await api.get(`/admin/appointments${status.value ? `?status=${status.value}` : ""}`);
      mount(list, appointments.length
        ? h("div", { class: "table-wrap" }, h("table", {},
            h("thead", {}, h("tr", {}, ["Fecha", "Hora", "Cliente", "Servicio", "Barbero", "Estado"].map((t) => h("th", { scope: "col" }, t)))),
            h("tbody", {}, appointments.map((a) => h("tr", {},
              h("td", {}, formatShortDay(a.startsAt)), h("td", {}, formatTime(a.startsAt)),
              h("td", {}, a.client ? a.client.name : ""), h("td", {}, a.service.name), h("td", {}, a.barber.name), h("td", {}, statusBadge(a.status))))))
          )
        : h("div", { class: "empty" }, h("p", {}, "No hay citas con ese filtro.")));
    } catch (err) {
      mount(list, failure(err, load));
    }
  }
  mount(box, h("div", { class: "toolbar" }, status), list);
  load();
}

async function adminServices(box) {
  async function load() {
    try {
      const { services } = await api.get("/admin/services");
      mount(
        box,
        h("h2", {}, "Servicios"),
        h("ul", { class: "edit-list" }, services.map((s) => serviceForm(s, load))),
        h("h2", {}, "Agregar servicio"),
        serviceForm(null, load)
      );
    } catch (err) {
      mount(box, failure(err, load));
    }
  }
  load();
}

function serviceForm(s, reload) {
  const err = h("p", { class: "form-error", role: "alert", hidden: true });
  const form = h(
    "form",
    {
      class: "form box",
      novalidate: true,
      onsubmit: async (e) => {
        e.preventDefault();
        err.hidden = true;
        const f = form.elements;
        const data = {
          name: f.name.value, description: f.description.value, price: Number(f.price.value),
          durationMin: Number(f.durationMin.value), active: f.active.checked,
        };
        try {
          if (s) await api.put(`/admin/services/${s.id}`, data);
          else await api.post("/admin/services", data);
          toast(s ? "Servicio guardado" : "Servicio agregado");
          reload();
        } catch (ex) {
          err.textContent = ex.message;
          err.hidden = false;
        }
      },
    },
    h("div", { class: "row" },
      h("label", {}, "Nombre", h("input", { name: "name", value: s ? s.name : "", required: true, maxlength: "120" })),
      h("label", {}, "Precio (COP)", h("input", { name: "price", type: "number", min: "0", step: "1000", value: s ? s.price : "", required: true })),
      h("label", {}, "Duración (min)", h("input", { name: "durationMin", type: "number", min: "15", max: "240", step: "5", value: s ? s.durationMin : "30", required: true }))
    ),
    h("label", {}, "Descripción", h("input", { name: "description", value: s ? s.description : "", maxlength: "300" })),
    h("label", { class: "inline-check" }, h("input", { type: "checkbox", name: "active", checked: s ? s.active : true }), "Visible para los clientes"),
    err,
    h("button", { class: "btn btn-small", type: "submit" }, s ? "Guardar" : "Agregar servicio")
  );
  return s ? h("li", {}, form) : form;
}

async function adminBarbers(box) {
  async function load() {
    try {
      const { barbers } = await api.get("/admin/barbers");
      mount(box, h("h2", {}, "Barberos"), barbers.map((b) =>
        h("div", { class: "edit-barber" }, h("h3", {}, b.name), profileForm(b, (data) => api.put(`/admin/barbers/${b.id}`, data), { withIdentity: true }))
      ));
    } catch (err) {
      mount(box, failure(err, load));
    }
  }
  load();
}
