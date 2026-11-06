// Punto de entrada: navegación, sesión, datos públicos y módulos.
import { api, session, setUnauthorizedHandler } from "./api.js";
import { h, mount, $, $$, formatPrice, barberPhoto, DAY_NAMES, toast, setBusy } from "./ui.js";
import { initQuiz } from "./quiz.js";
import { initBooking, preselectBarber, refreshBooking } from "./booking.js";
import { renderAccount, renderBarber, renderAdmin } from "./panels.js";

const landing = $("#landing");
const panel = $("#panel");
const authDialog = $("#auth-dialog");
let afterLogin = null;
let publicData = { barbers: [], services: [] };

const currentUser = () => (session.get() ? session.get().user : null);

// ---------------- Cabecera ----------------
function renderNavUser() {
  const user = currentUser();
  const box = $("#nav-user");
  if (!user) {
    mount(box, h("button", { class: "link", type: "button", onclick: () => openAuth() }, "Entrar"));
    return;
  }
  const links = [h("a", { href: "#/cuenta" }, "Mis citas")];
  if (user.role === "barber") links.push(h("a", { href: "#/barbero" }, "Mi agenda"));
  if (user.role === "admin") links.push(h("a", { href: "#/admin" }, "Administración"));
  links.push(h("button", { class: "link", type: "button", onclick: logout }, "Salir"));
  mount(box, links);
}

function logout() {
  session.set(null);
  renderNavUser();
  refreshBooking();
  location.hash = "#/";
  toast("Sesión cerrada");
}

setUnauthorizedHandler(() => {
  if (!session.get()) return;
  session.set(null);
  renderNavUser();
  toast("Tu sesión venció. Inicia sesión de nuevo.");
  if (location.hash.startsWith("#/")) location.hash = "#/";
});

const menuToggle = $("#menu-toggle");
menuToggle.addEventListener("click", () => {
  const open = $("#site-nav").classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
$("#site-nav").addEventListener("click", (e) => {
  if (e.target.closest("a, button.link")) {
    $("#site-nav").classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

// ---------------- Inicio de sesión / registro ----------------
function openAuth(callback, tab = "login") {
  afterLogin = callback || null;
  setTab(tab);
  $$(".form-error", authDialog).forEach((e) => (e.hidden = true));
  if (!authDialog.open) authDialog.showModal();
  $(tab === "login" ? "#form-login input" : "#form-register input").focus();
}

function setTab(tab) {
  const login = tab === "login";
  $("#tab-login").setAttribute("aria-selected", String(login));
  $("#tab-register").setAttribute("aria-selected", String(!login));
  $("#form-login").hidden = !login;
  $("#form-register").hidden = login;
}
$("#tab-login").addEventListener("click", () => setTab("login"));
$("#tab-register").addEventListener("click", () => setTab("register"));

function authSubmit(formId, path, fields) {
  const form = $(formId);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $(".form-error", form);
    const btn = $("button[type=submit]", form);
    err.hidden = true;
    const body = Object.fromEntries(fields.map((f) => [f, form.elements[f].value]));
    setBusy(btn, true, "Un momento…");
    try {
      const res = await api.post(path, body);
      session.set({ token: res.token, user: res.user });
      form.reset();
      authDialog.close();
      renderNavUser();
      refreshBooking();
      toast(`Hola, ${res.user.name.split(" ")[0]}`);
      const cb = afterLogin;
      afterLogin = null;
      if (cb) cb();
      else if (location.hash.startsWith("#/")) route();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
    setBusy(btn, false);
  });
}
authSubmit("#form-login", "/auth/login", ["email", "password"]);
authSubmit("#form-register", "/auth/register", ["name", "email", "phone", "password"]);
authDialog.addEventListener("click", (e) => {
  if (e.target === authDialog) authDialog.close(); // clic en el fondo
});

// ---------------- Datos públicos ----------------
function renderServices() {
  const list = $("#services-list");
  mount(
    list,
    publicData.services.length
      ? publicData.services.map((s) =>
          h("li", { class: "menu-item" },
            h("div", { class: "menu-name" }, h("strong", {}, s.name), h("span", { class: "muted" }, s.description)),
            h("span", { class: "leader", "aria-hidden": "true" }),
            h("div", { class: "menu-price" }, h("strong", {}, formatPrice(s.price)), h("span", { class: "muted" }, `${s.durationMin} min`))
          )
        )
      : h("li", { class: "muted" }, "Pronto publicaremos los servicios.")
  );
}

function renderTeam() {
  mount(
    $("#team-list"),
    publicData.barbers.map((b) =>
      h("article", { class: `barber barber-${b.specialtyKey}` },
        barberPhoto(b),
        h("h3", {}, b.name),
        h("p", { class: "barber-title" }, b.title),
        h("p", {}, b.bio),
        h("ul", { class: "chips" }, b.specialties.map((s) => h("li", {}, s))),
        h("button", { class: "btn btn-ghost btn-small", type: "button", onclick: () => preselectBarber(b.id) }, `Reservar con ${b.name.split(" ")[0].replace(/"/g, "")}`)
      )
    )
  );
}

// Dice si un barbero está dentro de su horario en este momento (hora de Bogotá)
function atiendeAhora(b, ahora = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(ahora)
      .map((x) => [x.type, x.value])
  );
  const dia = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
  const hora = `${p.hour}:${p.minute}`;
  return b.workDays.includes(dia) && hora >= b.workStart.slice(0, 5) && hora < b.workEnd.slice(0, 5);
}

function renderHours() {
  mount(
    $("#hours-list"),
    publicData.barbers.map((b) =>
      h("li", {}, h("strong", {}, b.name.split(" ")[0].replace(/"/g, "")), ` · ${compactDays(b.workDays)}, ${b.workStart} a ${b.workEnd} `, atiendeAhora(b) && h("span", { class: "tag" }, "Atiende ahora"))
    )
  );
}

function compactDays(days) {
  const names = days.map((d) => DAY_NAMES[d].slice(0, 3).toLowerCase());
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  return consecutive && days.length > 2 ? `${names[0]} a ${names[names.length - 1]}` : names.join(", ");
}

async function loadPublic() {
  try {
    const [b, s] = await Promise.all([api.get("/barbers"), api.get("/services")]);
    publicData = { barbers: b.barbers, services: s.services };
  } catch (err) {
    $("#services-list").replaceChildren(h("li", { class: "form-error" }, err.message));
    $("#team-list").replaceChildren(h("p", { class: "form-error" }, err.message));
    return;
  }
  renderServices();
  renderTeam();
  renderHours();
  initBooking($("#booking-root"), { ...publicData, getUser: currentUser, askLogin: (cb) => openAuth(cb) });
  initQuiz($("#quiz-root"), { book: (id) => preselectBarber(id, { recommended: true }) });
}

// ---------------- Navegación ----------------
const PANELS = {
  "#/cuenta": { roles: ["client", "barber", "admin"], render: renderAccount },
  "#/barbero": { roles: ["barber"], render: renderBarber },
  "#/admin": { roles: ["admin"], render: renderAdmin },
};

function route() {
  const hash = location.hash || "#/";
  const def = PANELS[hash];
  if (def) {
    const user = currentUser();
    if (!user) {
      location.hash = "#/";
      openAuth(() => (location.hash = hash));
      return;
    }
    if (!def.roles.includes(user.role)) {
      location.hash = "#/cuenta";
      return;
    }
    landing.hidden = true;
    panel.hidden = false;
    document.title = "UnderBarber · Mi cuenta";
    mount(panel, h("p", { class: "muted", role: "status" }, "Cargando…"));
    def.render(panel, { user });
    window.scrollTo(0, 0);
    $("#contenido").focus({ preventScroll: true });
    return;
  }
  panel.hidden = true;
  landing.hidden = false;
  document.title = "UnderBarber · Barbería en Bogotá";
  const target = hash.length > 1 && !hash.startsWith("#/") ? document.getElementById(hash.slice(1)) : null;
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

// ---------------- Portada ----------------
const PAGE_PARTS = ["header.site-header", "#contenido", "footer.site-footer"].map((s) => $(s));
function initCover() {
  const cover = $("#cover");
  if (document.documentElement.classList.contains("no-cover")) return;
  PAGE_PARTS.forEach((el) => el.setAttribute("inert", ""));
  const start = $("#cover-start");
  start.focus();
  start.addEventListener("click", () => {
    try { sessionStorage.setItem("underbarber.cover", "1"); } catch { /* sin almacenamiento: solo esta carga */ }
    cover.classList.add("leaving");
    setTimeout(() => {
      document.documentElement.classList.add("no-cover");
      PAGE_PARTS.forEach((el) => el.removeAttribute("inert"));
      location.hash = "#reservar"; // abre la barbería directo en la reserva
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450);
  });
}

// ---------------- Arranque ----------------
$("#year").textContent = new Date().getFullYear();
renderNavUser();
initCover();
route();
loadPublic();

// Si hay sesión guardada, comprueba que siga siendo válida
if (currentUser()) {
  api.get("/auth/me").then(
    (res) => {
      session.set({ token: session.get().token, user: res.user });
      renderNavUser();
    },
    () => {} // el manejador de 401 ya limpia la sesión
  );
}