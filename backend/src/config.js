"use strict";
// Toda la configuración sale de variables de entorno (ver .env.example).
require("dotenv").config();

const env = process.env;
const isProd = env.NODE_ENV === "production";

function bool(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

// PATRÓN Singleton (creacional): este objeto se crea una sola vez; Node guarda el módulo en caché y todos los
// archivos que hacen require("./config") reciben la misma instancia. Object.freeze impide modificarlo después.
const config = {
  isProd,
  port: Number(env.PORT) || 3000,
  databaseUrl: env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/underbarber",
  // Render (conexión externa), Railway, Neon, Supabase, etc. suelen exigir SSL: DATABASE_SSL=true
  databaseSsl: bool(env.DATABASE_SSL, false),
  jwtSecret: env.JWT_SECRET || "dev-secret-solo-para-desarrollo-no-usar-en-produccion",
  jwtExpiresIn: env.JWT_EXPIRES_IN || "7d",
  corsOrigin: env.CORS_ORIGIN || "",
  // Zona horaria de la barbería (Colombia = UTC-05:00, sin horario de verano)
  shopUtcOffset: env.SHOP_UTC_OFFSET || "-05:00",
  minLeadMinutes: Number(env.MIN_LEAD_MINUTES) || 30,
  maxDaysAhead: Number(env.MAX_DAYS_AHEAD) || 60,
  adminEmail: (env.ADMIN_EMAIL || "admin@underbarber.com").trim().toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD || "",
  barberDefaultPassword: env.BARBER_DEFAULT_PASSWORD || "",
  bcryptRounds: 10,
  // Canal de las notificaciones de citas: consola | memoria | silencio (ver FabricaNotificador en util.js)
  notifyChannel: env.NOTIFY_CHANNEL || "consola",
};
Object.freeze(config);

function validate() {
  if (!/^[+-]\d{2}:\d{2}$/.test(config.shopUtcOffset)) {
    throw new Error("SHOP_UTC_OFFSET debe tener el formato +HH:MM o -HH:MM (ej. -05:00)");
  }
  if (isProd) {
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      throw new Error("En producción JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.");
    }
    if (!env.DATABASE_URL) {
      throw new Error("En producción DATABASE_URL es obligatorio.");
    }
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) {
      throw new Error("En producción ADMIN_PASSWORD es obligatorio (mínimo 8 caracteres).");
    }
  }
}

module.exports = { config, validate };
