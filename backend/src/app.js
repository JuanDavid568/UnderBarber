"use strict";
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { config } = require("./config");
const { query } = require("./db");
const { HttpError, wrap } = require("./util");

const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // detrás del proxy del hosting (Render, Railway…) para IP real y rate limit

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.isProd ? [] : null,
        },
      },
    })
  );
  if (config.corsOrigin) app.use(cors({ origin: config.corsOrigin.split(",").map((s) => s.trim()) }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/health", wrap(async (_req, res) => {
    await query("SELECT 1");
    res.json({ status: "ok" });
  }));

  app.use("/api/auth", require("./routes/auth"));
  app.use("/api", require("./routes/public"));
  app.use("/api/appointments", require("./routes/appointments"));
  app.use("/api/barber", require("./routes/barber"));
  app.use("/api/admin", require("./routes/admin"));
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Ruta no encontrada.")));

  app.use(express.static(FRONTEND_DIR, { maxAge: config.isProd ? "1h" : 0, extensions: ["html"] }));
  app.get("*", (_req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

  // Manejo de errores
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "El JSON enviado no es válido." });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "La petición es demasiado grande." });
    console.error("[error]", err);
    res.status(500).json({ error: "Ocurrió un error inesperado. Inténtalo de nuevo." });
  });

  return app;
}

module.exports = { createApp };
