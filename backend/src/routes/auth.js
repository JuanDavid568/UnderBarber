"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { query, tx } = require("../db");
const { config } = require("../config");
const { signToken, requireAuth } = require("../middleware/auth");
const { HttpError, wrap, str, email, password, hashToken, nuevoTokenRestablecer, crearCorreo } = require("../util");

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

// Recuperar contraseña: límites más estrictos porque cada intento puede mandar un correo
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." },
});
const correo = crearCorreo(config.smtp); // consola en desarrollo; SMTP si SMTP_HOST está configurado
const RESET_MINUTES = 60;

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

router.post("/register", limiter, wrap(async (req, res) => {
  const body = req.body || {};
  const name = str(body.name, "El nombre", { min: 2, max: 100 });
  const mail = email(body.email);
  const phone = str(body.phone, "El teléfono", { min: 7, max: 20, optional: true });
  if (phone && !/^[0-9+\-\s()]+$/.test(phone)) throw new HttpError(400, "El teléfono no es válido.");
  const pwd = password(body.password);
  // Ley 1581 de 2012 (protección de datos personales): sin autorización expresa no se crea la cuenta
  if (body.consent !== true) throw new HttpError(400, "Debes aceptar el tratamiento de tus datos personales para crear la cuenta.");

  const hash = await bcrypt.hash(pwd, config.bcryptRounds);
  let user;
  try {
    const { rows } = await query(
      `INSERT INTO users (name, email, phone, password_hash, role, data_consent_at)
       VALUES ($1, $2, $3, $4, 'client', now()) RETURNING id, name, email, phone, role`,
      [name, mail, phone || null, hash]
    );
    user = rows[0];
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, "Ya existe una cuenta con ese correo.");
    throw err;
  }
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

// Pide el enlace. Siempre responde lo mismo, exista o no el correo, para no revelar quién tiene cuenta.
router.post("/forgot", resetLimiter, wrap(async (req, res) => {
  const mail = email((req.body || {}).email);
  const { rows } = await query("SELECT id, name FROM users WHERE lower(email) = $1", [mail]);
  const user = rows[0];
  if (user) {
    const { token, hash } = nuevoTokenRestablecer();
    await tx(async (client) => {
      await client.query("DELETE FROM password_resets WHERE user_id = $1 AND used_at IS NULL", [user.id]); // solo vale el último enlace
      await client.query("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)", [
        user.id, hash, new Date(Date.now() + RESET_MINUTES * 60000),
      ]);
    });
    const enlace = `${config.publicUrl}/#/restablecer?token=${token}`;
    try {
      await correo.enviar({
        para: mail,
        asunto: "Restablece tu contraseña de UnderBarber",
        texto: `Hola ${user.name.split(" ")[0]},\n\nPara crear una contraseña nueva entra a este enlace (vale ${RESET_MINUTES} minutos y solo se puede usar una vez):\n${enlace}\n\nSi no fuiste tú, ignora este mensaje: tu contraseña no cambia.`,
      });
    } catch (err) {
      console.error("[correo] no se pudo enviar el enlace de recuperación:", err.message); // no se le cuenta al cliente
    }
  }
  res.json({ ok: true, message: `Si ese correo está registrado, te enviamos un enlace para crear una contraseña nueva. Vale ${RESET_MINUTES} minutos.` });
}));

// Cambia la contraseña con el token del enlace (de un solo uso).
router.post("/reset", resetLimiter, wrap(async (req, res) => {
  const body = req.body || {};
  const token = str(body.token, "El enlace", { max: 200 });
  const pwd = password(body.password);
  const newHash = await bcrypt.hash(pwd, config.bcryptRounds);
  const ok = await tx(async (client) => {
    const r = await client.query(
      "SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE",
      [hashToken(token)]
    );
    if (!r.rows[0]) return false;
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, r.rows[0].user_id]);
    await client.query("UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL", [r.rows[0].user_id]);
    return true;
  });
  if (!ok) throw new HttpError(400, "El enlace no es válido o ya venció. Pide uno nuevo.");
  res.json({ ok: true });
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
