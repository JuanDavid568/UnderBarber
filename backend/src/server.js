"use strict";
const { config, validate } = require("./config");

async function main() {
  validate();
  const { pool } = require("./db");
  const { initDb } = require("./init");
  const { createApp } = require("./app");

  await initDb();
  const server = createApp().listen(config.port, () => {
    console.log(`UnderBarber escuchando en el puerto ${config.port} (${config.isProd ? "producción" : "desarrollo"})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} recibido: cerrando…`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("No se pudo iniciar la aplicación:", err.message);
  process.exit(1);
});
