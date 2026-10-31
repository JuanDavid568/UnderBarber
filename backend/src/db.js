"use strict";
const { Pool } = require("pg");
const { config } = require("./config");

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

const query = (text, params) => pool.query(text, params);

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
