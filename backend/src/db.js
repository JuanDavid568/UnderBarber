"use strict";
const { Pool } = require("pg");
const { config } = require("./config");

// PATRÓN Singleton (creacional): un único pool de conexiones para toda la aplicación. Node cachea el módulo,
// así que cada require("./db") devuelve este mismo objeto y no se abren conexiones de más.
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  // Un cliente inactivo falló (p. ej. la BD se reinició). El pool crea otros nuevos.
  console.error("[db] error en cliente inactivo:", err.message);
});

// PATRÓN Decorator (estructural): envuelve una función y le añade comportamiento (aviso de consultas lentas)
// sin tocar la función original. Solo se registra el inicio del SQL, nunca los parámetros.
const conAvisoDeLentitud = (fn, limiteMs = 800) => async (...args) => {
  const inicio = Date.now();
  try {
    return await fn(...args);
  } finally {
    const ms = Date.now() - inicio;
    if (ms > limiteMs) console.warn(`[db] consulta lenta (${ms} ms): ${String(args[0]).replace(/\s+/g, " ").slice(0, 80)}`);
  }
};

const query = conAvisoDeLentitud((text, params) => pool.query(text, params));

/** Ejecuta fn(client) dentro de una transacción. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
