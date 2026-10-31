"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { query } = require("../db");
const { config } = require("../config");
const { signToken, requireAuth } = require("../middleware/auth");
const { HttpError, wrap, str, email, password } = require("../util");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
});

// Se compara contra este hash cuando el correo no existe, para que ambos casos tarden parecido
const DUMMY_HASH = bcrypt.hashSync("no-existe", config.bcryptRounds);

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

router.post("/register", limiter, wrap(async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, "El nombre", { min: 2, max: 100 });
  const mail = email(body.email);
  const phone = str(body.phone, "El teléfono", { min: 7, max: 20, optional: true });
  if (phone && !/^[0-9+\-\s()]+$/.test(phone)) throw new HttpError(400, "El teléfono no es válido.");
  const pwd = password(body.password);

  const hash = await bcrypt.hash(pwd, config.bcryptRounds);
  let user;
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'client') RETURNING id, name, email, phone, role`,
      [name, mail, phone || null, hash]
    );
    user = rows[0];
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ya existe una cuenta con ese correo.");
    throw err;
  }
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post("/login", limiter, wrap(async (req, res) => {
  const body = req.body || {};
  const mail = email(body.email);
  if (typeof body.password !== "string" || !body.password) throw new HttpError(400, "La contraseña es obligatoria.");

  const { rows } = await query(
    "SELECT id, name, email, phone, role, password_hash FROM users WHERE lower(email) = $1",
    [mail]
  );
  const user = rows[0];
  const ok = await bcrypt.compare(body.password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, "Correo o contraseña incorrectos.");
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get("/me", requireAuth, wrap(async (req, res) => {
  const { rows } = await query("SELECT id, name, email, phone, role FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0]) throw new HttpError(401, "Tu sesión ya no es válida.");
  res.json({ user: publicUser(rows[0]) });
}));

router.patch("/password", requireAuth, limiter, wrap(async (req, res) => {
  const body = req.body || {};
  if (typeof body.currentPassword !== "string" || !body.currentPassword) {
    throw new HttpError(400, "Escribe tu contraseña actual.");
  }
  const next = password(body.newPassword, "La nueva contraseña");
  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(body.currentPassword, rows[0].password_hash))) {
    throw new HttpError(400, "La contraseña actual no es correcta.");
  }
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    await bcrypt.hash(next, config.bcryptRounds),
    req.user.id,
  ]);
  res.json({ ok: true });
}));

module.exports = router;
