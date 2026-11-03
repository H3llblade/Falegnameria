/**
 * Configurazione PM2 per la sola Falegnameria.
 * Avvio iniziale:  pm2 start ecosystem.config.cjs && pm2 save
 * Il nome del processo e la porta si leggono da .env (PM2_NAME, PORT).
 */
const fs = require("node:fs");
const path = require("node:path");

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const env = readEnv(path.join(__dirname, ".env"));
const port = env.PORT || "3100";

module.exports = {
  apps: [
    {
      name: env.PM2_NAME || "falegnameria",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${port} -H 127.0.0.1`,
      exec_mode: "fork", // un solo processo: il rate limiting del login è in memoria
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      kill_timeout: 8000,
      time: true,
      env: { NODE_ENV: "production", PORT: port },
    },
  ],
};
