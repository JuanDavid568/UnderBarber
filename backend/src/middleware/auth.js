"use strict";
const jwt = require("jsonwebtoken");
const { config } = require("../config");
const { HttpError } = require("../util");

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    algorithm: "HS256",
  });
}

function readToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  try {
    const p = jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
    return { id: Number(p.sub), role: p.role, name: p.name };
  } catch {
    return null;
  }
}

/** Exige sesión válida. */
function requireAuth(req, _res, next) {
  const user = readToken(req);
  if (!user) return next(new HttpError(401, "Inicia sesión para continuar."));
  req.user = user;
  next();
}

/** Si hay sesión válida la usa, si no continúa como visitante. */
function optionalAuth(req, _res, next) {
  req.user = readToken(req);
  next();
}

/** Exige sesión y uno de los roles indicados. */
const requireRole = (...roles) => [
  requireAuth,
  (req, _res, next) => (roles.includes(req.user.role) ? next() : next(new HttpError(403, "No tienes permiso para esto."))),
];

module.exports = { signToken, requireAuth, optionalAuth, requireRole };
