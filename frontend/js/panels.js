// Paneles: Mis citas (cliente), Mi agenda (barbero) y Administración (dueño)
import { api } from "./api.js";
import {
  h, mount, formatPrice, formatTime, formatDay, formatShortDay, formatYmd, ymd, todayYmd, addDays,
  statusBadge, STATUS_LABEL, DAY_NAMES, toast, setBusy,
} from "./ui.js";

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
          ? h("ul", { class: "appt-list" }, upcoming.map((a) => apptItem(a, { onCancel: () => cancel(a) })))
          : h("div", { class: "empty" }, h("p", {}, "No tienes citas próximas."), h("a", { class: "btn", href: "#reservar" }, "Reservar una cita")),
        past.length > 0 && [h("h2", {}, "Historial"), h("ul", { class: "appt-list muted-list" }, past.map((a) => apptItem(a, {})))]
      );
    } catch (err) {
      mount(body, failure(err, load));
    }
  }
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
    ["Citas", adminAppointments],
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
