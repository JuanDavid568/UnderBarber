"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreQuiz } = require("../src/services/quiz");

// Mini cuestionario de 2 preguntas, 3 barberos (1 = fade, 2 = clásico, 3 = creativo)
const barbers = [{ id: 1 }, { id: 2 }, { id: 3 }];
const questions = [
  {
    id: 10, text: "Estilo",
    options: [
      { id: 101, label: "Urbano", points: { 1: 3, 3: 1 } },
      { id: 102, label: "Clásico", points: { 2: 3, 1: 1 } },
      { id: 103, label: "Creativo", points: { 3: 3, 1: 1 } },
    ],
  },
  {
    id: 20, text: "Largo",
    options: [
      { id: 201, label: "Corto", points: { 1: 3, 2: 1 } },
      { id: 202, label: "Medio", points: { 2: 3, 1: 1 } },
      { id: 203, label: "Largo", points: { 3: 3, 2: 1 } },
    ],
  },
];
const ans = (a, b) => [{ questionId: 10, optionId: a }, { questionId: 20, optionId: b }];

test("recomienda al barbero con más puntos y calcula la compatibilidad", () => {
  const r = scoreQuiz(questions, barbers, ans(101, 201));
  assert.equal(r.winnerId, 1);
  assert.equal(r.scores[1], 6);
  assert.equal(r.ranking[0].percent, 100);
  assert.equal(r.ranking[0].barberId, 1);
  // 101 -> b1:3, b3:1 ; 201 -> b1:3, b2:1  =>  b1:6, b2:1, b3:1 (empate de segundo: gana el de menor posición)
  assert.equal(r.runnerUpId, 2);
});

test("barbero clásico y creativo ganan con sus respuestas", () => {
  assert.equal(scoreQuiz(questions, barbers, ans(102, 202)).winnerId, 2);
  assert.equal(scoreQuiz(questions, barbers, ans(103, 203)).winnerId, 3);
});

test("el empate se resuelve de forma determinista (mayor compatibilidad, luego menor posición)", () => {
  // 101 -> b1:3,b3:1 ; 203 -> b3:3,b2:1  => b1:3, b3:4 ... usamos otro empate real:
  // 102 (b2:3,b1:1) + 201 (b1:3,b2:1) => b1:4, b2:4. Máx b1 = 6, b2 = 6 -> mismo %, gana el de menor posición.
  const r = scoreQuiz(questions, barbers, ans(102, 201));
  assert.equal(r.scores[1], 4);
  assert.equal(r.scores[2], 4);
  assert.equal(r.winnerId, 1);
  const again = scoreQuiz(questions, barbers, ans(102, 201));
  assert.equal(again.winnerId, 1);
});

test("incluye motivos: respuestas que más puntos dieron al ganador", () => {
  const r = scoreQuiz(questions, barbers, ans(101, 201));
  assert.deepEqual(r.reasons.map((x) => x.answer), ["Urbano", "Corto"]);
});

test("rechaza respuestas incompletas, repetidas o ajenas", () => {
  assert.match(scoreQuiz(questions, barbers, [{ questionId: 10, optionId: 101 }]).error, /todas las preguntas/);
  assert.match(scoreQuiz(questions, barbers, [{ questionId: 10, optionId: 101 }, { questionId: 10, optionId: 102 }]).error, /dos veces/);
  assert.match(scoreQuiz(questions, barbers, ans(101, 101)).error, /no corresponde/);
  assert.match(scoreQuiz(questions, barbers, [{ questionId: 99, optionId: 1 }]).error, /no existe/);
  assert.match(scoreQuiz(questions, barbers, "x").error, /no son válidas/);
});
