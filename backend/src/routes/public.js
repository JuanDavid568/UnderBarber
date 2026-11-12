"use strict";
const express = require("express");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { config } = require("../config");
const { optionalAuth } = require("../middleware/auth");
const { scoreQuiz } = require("../services/quiz");
const { generateSlots, isValidDate, shopDateOf, dayBounds } = require("../services/slots");
const { HttpError, wrap, int, publicBarber, publicService, conCache } = require("../util");

const router = express.Router();

const quizLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
});

const ACTIVE_BARBERS_SQL = "SELECT * FROM barbers WHERE active ORDER BY position, id";

// PATRÓN Proxy: estas dos funciones tienen la misma interfaz que consultar la base de datos, pero reutilizan el
// resultado 30 s (conCache, en util.js). Cuando el admin o un barbero editan datos, el caché se limpia solo.
const barberosActivos = conCache(async () => (await query(ACTIVE_BARBERS_SQL)).rows);
const serviciosActivos = conCache(async () => (await query("SELECT * FROM services WHERE active ORDER BY position, id")).rows);

router.get("/barbers", wrap(async (_req, res) => {
  res.json({ barbers: (await barberosActivos()).map(publicBarber) });
}));

router.get("/services", wrap(async (_req, res) => {
  res.json({ services: (await serviciosActivos()).map(publicService) });
}));

// --- Cuestionario ---------------------------------------------------------------

/** Carga preguntas, opciones y puntos. Los puntos solo se usan en el servidor. */
async function loadQuiz() {
  const { rows } = await query(
    `SELECT q.id AS qid, q.text, q.help, o.id AS oid, o.label, p.barber_id, p.points
       FROM quiz_questions q
       JOIN quiz_options o ON o.question_id = q.id
       LEFT JOIN quiz_option_points p ON p.option_id = o.id
      ORDER BY q.position, q.id, o.position, o.id`
  );
  const questions = [];
  const qIndex = new Map();
  const oIndex = new Map();
  for (const r of rows) {
    let q = qIndex.get(r.qid);
    if (!q) {
      q = { id: r.qid, text: r.text, help: r.help, options: [] };
      qIndex.set(r.qid, q);
      questions.push(q);
    }
    let o = oIndex.get(r.oid);
    if (!o) {
      o = { id: r.oid, label: r.label, points: {} };
      oIndex.set(r.oid, o);
      q.options.push(o);
    }
    if (r.barber_id) o.points[r.barber_id] = r.points;
  }
  return questions;
}

router.get("/quiz", wrap(async (_req, res) => {
  const questions = await loadQuiz();
  res.json({
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      help: q.help,
      options: q.options.map((o) => ({ id: o.id, label: o.label })), // sin puntajes
    })),
  });
}));

router.post("/quiz/submit", quizLimiter, optionalAuth, wrap(async (req, res) => {
  const answers = (req.body || {}).answers;
  const [questions, barbers] = await Promise.all([loadQuiz(), barberosActivos()]);

  const result = scoreQuiz(questions, barbers, answers);
  if (result.error) throw new HttpError(400, result.error);

  const byId = new Map(barbers.map((b) => [b.id, b]));
  const pct = new Map(result.ranking.map((r) => [r.barberId, r.percent]));

  await query(
    "INSERT INTO quiz_results (user_id, barber_id, answers, scores) VALUES ($1, $2, $3, $4)",
    [
      req.user ? req.user.id : null,
      result.winnerId,
      JSON.stringify(answers.map((a) => ({ questionId: Number(a.questionId), optionId: Number(a.optionId) }))),
      JSON.stringify(result.scores),
    ]
  );

  res.json({
    recommended: {
      barber: publicBarber(byId.get(result.winnerId)),
      percent: pct.get(result.winnerId),
      reasons: result.reasons,
    },
    alternative: result.runnerUpId
      ? { barber: publicBarber(byId.get(result.runnerUpId)), percent: pct.get(result.runnerUpId) }
      : null,
    ranking: result.ranking.map((r) => ({ barberId: r.barberId, percent: r.percent })),
  });
}));

// --- Disponibilidad ---------------------------------------------------------------

router.get("/availability", wrap(async (req, res) => {
  const barberId = int(req.query.barberId, "El barbero");
  const serviceId = int(req.query.serviceId, "El servicio");
  const date = String(req.query.date || "");
  if (!isValidDate(date)) throw new HttpError(400, "La fecha no es válida (usa AAAA-MM-DD).");

  const today = shopDateOf(new Date(), config.shopUtcOffset);
  const last = shopDateOf(new Date(Date.now() + config.maxDaysAhead * 86400000), config.shopUtcOffset);
  if (date < today || date > last) return res.json({ date, slots: [] });

  const [b, s] = await Promise.all([
    query("SELECT * FROM barbers WHERE id = $1 AND active", [barberId]),
    query("SELECT * FROM services WHERE id = $1 AND active", [serviceId]),
  ]);
  if (!b.rows[0]) throw new HttpError(404, "Ese barbero no existe.");
  if (!s.rows[0]) throw new HttpError(404, "Ese servicio no existe.");

  const { start, end } = dayBounds(date, config.shopUtcOffset);
  const { rows } = await query(
    `SELECT starts_at, ends_at FROM appointments
      WHERE barber_id = $1 AND status <> 'cancelled' AND starts_at < $3 AND ends_at > $2`,
    [barberId, start, end]
  );
  const slots = generateSlots({
    date,
    barber: b.rows[0],
    durationMin: s.rows[0].duration_min,
    busy: rows.map((r) => ({ start: r.starts_at, end: r.ends_at })),
    now: new Date(),
    offset: config.shopUtcOffset,
    minLeadMinutes: config.minLeadMinutes,
  });
  res.json({ date, slots });
}));

module.exports = router;
module.exports.loadQuiz = loadQuiz;
