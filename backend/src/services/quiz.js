"use strict";
// Lógica pura del cuestionario (sin base de datos ni Express): fácil de probar.

// PATRÓN Strategy (comportamiento): el criterio de desempate es intercambiable. scoreQuiz recibe la estrategia
// como parámetro y no sabe cuál es; por defecto se usa «puntosPrimero» (el comportamiento original).
const ESTRATEGIAS_DESEMPATE = {
  // más puntos primero; si empatan, mayor compatibilidad; si siguen empatados, el de menor posición
  puntosPrimero: (a, b) => b.score - a.score || b.percent - a.percent || a.index - b.index,
  // mayor compatibilidad primero; si empatan, más puntos; luego menor posición
  compatibilidadPrimero: (a, b) => b.percent - a.percent || b.score - a.score || a.index - b.index,
};

/**
 * @param {Array<{id:number,text:string,options:Array<{id:number,label:string,points:Object<number,number>}>}>} questions
 * @param {Array<{id:number}>} barbers  barberos activos, en orden de posición
 * @param {Array<{questionId:number,optionId:number}>} answers
 * @param {(a:object,b:object)=>number} [estrategia] criterio de orden del ranking (ver ESTRATEGIAS_DESEMPATE)
 * @returns {{error:string}|{scores,maxScores,ranking,winnerId,runnerUpId,reasons}}
 */
function scoreQuiz(questions, barbers, answers, estrategia = ESTRATEGIAS_DESEMPATE.puntosPrimero) {
  if (!Array.isArray(answers)) return { error: "Las respuestas no son válidas." };
  if (!barbers.length) return { error: "No hay barberos disponibles." };

  const byQuestion = new Map(questions.map((q) => [q.id, q]));
  const chosen = new Map();
  for (const a of answers) {
    const qid = Number(a && a.questionId);
    const oid = Number(a && a.optionId);
    const q = byQuestion.get(qid);
    if (!q) return { error: "Hay una pregunta que no existe." };
    if (chosen.has(qid)) return { error: "Hay una pregunta respondida dos veces." };
    const option = q.options.find((o) => o.id === oid);
    if (!option) return { error: "Hay una respuesta que no corresponde a su pregunta." };
    chosen.set(qid, option);
  }
  if (chosen.size !== questions.length) return { error: "Responde todas las preguntas para ver tu recomendación." };

  const scores = {};
  const maxScores = {};
  for (const b of barbers) {
    scores[b.id] = 0;
    maxScores[b.id] = 0;
  }
  for (const q of questions) {
    for (const b of barbers) {
      maxScores[b.id] += Math.max(0, ...q.options.map((o) => o.points[b.id] || 0));
    }
    const option = chosen.get(q.id);
    for (const b of barbers) scores[b.id] += option.points[b.id] || 0;
  }

  const ranking = barbers
    .map((b, index) => {
      const max = maxScores[b.id] || 1;
      return {
        barberId: b.id,
        score: scores[b.id],
        percent: Math.max(0, Math.min(100, Math.round((scores[b.id] / max) * 100))),
        index,
      };
    })
    .sort(estrategia)
    .map(({ index, ...rest }) => rest);

  const winnerId = ranking[0].barberId;
  const runnerUpId = ranking[1] ? ranking[1].barberId : null;

  // Motivos: respuestas que más puntos le dieron al ganador (máx. 3)
  const reasons = questions
    .map((q, order) => {
      const option = chosen.get(q.id);
      return { question: q.text, answer: option.label, points: option.points[winnerId] || 0, order };
    })
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.order - b.order)
    .slice(0, 3)
    .map(({ question, answer }) => ({ question, answer }));

  return { scores, maxScores, ranking, winnerId, runnerUpId, reasons };
}

module.exports = { scoreQuiz, ESTRATEGIAS_DESEMPATE };
