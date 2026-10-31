"use strict";
// Crea las tablas si no existen y, solo si la base está vacía, carga datos iniciales y cuentas.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { pool } = require("./db");
const { config } = require("./config");

const DB_DIR = path.join(__dirname, "..", "..", "database");
const INIT_LOCK = 727272; // evita que dos instancias inicialicen a la vez

const BARBER_ACCOUNTS = {
  fade: { email: "santi@underbarber.com", name: "Santiago Rojas" },
  classic: { email: "andres@underbarber.com", name: "Andrés Mejía" },
  creative: { email: "camilo@underbarber.com", name: "Camilo Vargas" },
};

async function createAccounts(client) {
  const dev = !config.isProd;
  const adminPassword = config.adminPassword || (dev ? "admin12345" : "");
  let barberPassword = config.barberDefaultPassword || (dev ? "barbero123" : "");
  let generated = false;
  if (!barberPassword) {
    barberPassword = crypto.randomBytes(9).toString("base64url");
    generated = true;
  }
  const hash = (pwd) => bcrypt.hash(pwd, config.bcryptRounds);

  await client.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT DO NOTHING`,
    ["Administrador UnderBarber", config.adminEmail, await hash(adminPassword)]
  );

  const barberHash = await hash(barberPassword);
  const { rows: barbers } = await client.query("SELECT id, specialty_key FROM barbers");
  for (const b of barbers) {
    const acc = BARBER_ACCOUNTS[b.specialty_key];
    if (!acc) continue;
    const { rows } = await client.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'barber')
       ON CONFLICT DO NOTHING RETURNING id`,
      [acc.name, acc.email, barberHash]
    );
    if (rows[0]) await client.query("UPDATE barbers SET user_id = $1 WHERE id = $2", [rows[0].id, b.id]);
  }

  if (dev) {
    await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1, $2, $3, $4, 'client')
       ON CONFLICT DO NOTHING`,
      ["Cliente de prueba", "cliente@underbarber.com", "3000000000", await hash("cliente123")]
    );
    console.log("[init] Cuentas de desarrollo: admin@underbarber.com / admin12345, barberos (santi|andres|camilo)@underbarber.com / barbero123, cliente@underbarber.com / cliente123");
  } else if (generated) {
    console.log(`[init] Contraseña inicial generada para los barberos (cámbiala desde su panel): ${barberPassword}`);
  }
}

async function initDb() {
  const schema = fs.readFileSync(path.join(DB_DIR, "schema.sql"), "utf8");
  const seed = fs.readFileSync(path.join(DB_DIR, "seed.sql"), "utf8");
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [INIT_LOCK]);
    await client.query(schema);
    const { rows } = await client.query("SELECT count(*)::int AS n FROM barbers");
    if (rows[0].n === 0) {
      console.log("[init] Base de datos vacía: cargando datos iniciales…");
      await client.query("BEGIN");
      try {
        await client.query(seed);
        await createAccounts(client);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [INIT_LOCK]).catch(() => {});
    client.release();
  }
}

module.exports = { initDb };
