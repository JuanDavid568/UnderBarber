// Cuestionario «Encuentra tu barbero»
import { api } from "./api.js";
import { h, mount, barberPhoto, toast, $ } from "./ui.js";

let root;
let questions = [];
let answers = []; // [{questionId, optionId}]
let step = 0;
let onBook = () => {};

export async function initQuiz(container, { book }) {
  root = container;
  onBook = book;
  mount(root, h("p", { class: "muted" }, "Cargando preguntas…"));
  try {
    questions = (await api.get("/quiz")).questions;
    start();
  } catch (err) {
    mount(root, h("p", { class: "form-error" }, err.message), h("button", { class: "btn btn-ghost", type: "button", onclick: () => initQuiz(container, { book }) }, "Reintentar"));
  }
}

function start() {
  answers = [];
  step = 0;
  renderQuestion();
}

function progress() {
  // Escala como las guardas de la máquina: una barra por pregunta, creciendo
  return h(
    "ol",
    { class: "guards", "aria-label": `Pregunta ${step + 1} de ${questions.length}` },
    questions.map((_, i) =>
      h("li", { class: i < step ? "done" : i === step ? "current" : "", style: { "--h": `${14 + i * 5}px` } })
    )
  );
}

function renderQuestion() {
  const q = questions[step];
  const current = answers.find((a) => a.questionId === q.id);
  const title = h("h3", { tabindex: "-1", class: "quiz-question" }, q.text);
  mount(
    root,
    progress(),
    title,
    q.help && h("p", { class: "muted" }, q.help),
    h(
      "div",
      { class: "options", role: "group", "aria-label": q.text },
      q.options.map((o) =>
        h(
          "button",
          {
            type: "button",
            class: "option",
            "aria-pressed": current && current.optionId === o.id ? "true" : "false",
            onclick: () => choose(q, o),
          },
          o.label
        )
      )
    ),
    h("div", { class: "quiz-nav" }, step > 0 && h("button", { type: "button", class: "btn btn-text", onclick: back }, "Volver"))
  );
  if (step > 0) title.focus({ preventScroll: true });
}

function choose(q, option) {
  answers = answers.filter((a) => a.questionId !== q.id);
  answers.push({ questionId: q.id, optionId: option.id });
  if (step < questions.length - 1) {
    step += 1;
    renderQuestion();
  } else {
    submit();
  }
}

function back() {
  step = Math.max(0, step - 1);
  renderQuestion();
}

async function submit() {
  mount(root, h("p", { class: "muted", role: "status" }, "Buscando a tu barbero…"));
  try {
    const result = await api.post("/quiz/submit", { answers });
    renderResult(result);
  } catch (err) {
    toast(err.message);
    step = questions.length - 1;
    renderQuestion();
  }
}

function renderResult({ recommended, alternative }) {
  const b = recommended.barber;
  const first = b.name.split(" ")[0].replace(/"/g, "");
  const heading = h("h3", { tabindex: "-1", class: "result-name" }, b.name);
  mount(
    root,
    h(
      "div",
      { class: "result" },
      h(
        "div",
        { class: "result-main" },
        h("p", { class: "result-kicker" }, "Tu barbero ideal"),
        heading,
        h("p", { class: "result-title" }, b.title),
        h(
          "div",
          { class: "meter", role: "img", "aria-label": `Compatibilidad: ${recommended.percent} por ciento` },
          h("span", { class: "meter-label" }, `${recommended.percent}% de compatibilidad`),
          h("span", { class: "meter-track" }, h("span", { class: "meter-fill", style: { "--p": `${recommended.percent}%` } }))
        ),
        h("p", { class: "result-bio" }, b.bio),
        h("ul", { class: "chips" }, b.specialties.map((s) => h("li", {}, s))),
        h(
          "div",
          { class: "hero-actions" },
          h("button", { class: "btn", type: "button", onclick: () => onBook(b.id) }, `Reservar con ${first}`),
          h("button", { class: "btn btn-ghost", type: "button", onclick: start }, "Repetir cuestionario")
        )
      ),
      h(
        "aside",
        { class: "result-side" },
        barberPhoto(b, "barber-photo-result"),
        recommended.reasons.length > 0 &&
          h(
            "div",
            {},
            h("h4", {}, "Te lo recomendamos porque"),
            h(
              "ul",
              { class: "reasons" },
              recommended.reasons.map((r) => h("li", {}, h("span", { class: "muted" }, r.question), h("strong", {}, r.answer)))
            )
          ),
        alternative &&
          h(
            "p",
            { class: "muted alt" },
            "También podría gustarte ",
            h("button", { class: "link", type: "button", onclick: () => onBook(alternative.barber.id) }, alternative.barber.name),
            ` (${alternative.percent}%).`
          )
      )
    )
  );
  heading.focus({ preventScroll: true });
  $("#encuentra-tu-barbero").scrollIntoView({ behavior: "smooth", block: "start" });
}
