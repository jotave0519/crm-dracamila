import express from "express";
import path from "path";
import { env } from "./config/env";
import { handleWhatsAppWebhook } from "./controllers/webhookController";
import { handleHealthCheck } from "./controllers/healthController";
import { apiRouter } from "./routes/api";
import { reconcilePendingSyncs } from "./services/schedulingService";
import { logger } from "./utils/logger";

const WEB_DIST_DIR = path.join(__dirname, "..", "web-dist");
const CALENDAR_SYNC_INTERVAL_MS = 5 * 60_000;

const app = express();
app.use(express.json());

app.post("/webhook/:secret", (req, res, next) => {
  if (!env.webhookSecret || req.params.secret !== env.webhookSecret) {
    res.status(401).json({ error: "Segredo do webhook invalido." });
    return;
  }
  next();
}, handleWhatsAppWebhook);
app.get("/health", handleHealthCheck);
app.use("/api/v1", apiRouter);

// CRM web (build do Vite) servido como estatico pelo mesmo servico.
app.use(express.static(WEB_DIST_DIR));
app.get("*", (_req, res) => {
  res.sendFile(path.join(WEB_DIST_DIR, "index.html"));
});

app.listen(env.port, () => {
  console.log(`Agente rodando na porta ${env.port}`);
});

// Reconciliacao automatica com o Google Calendar: normaliza sozinha as sessoes
// que ficaram "pending" enquanto o Google estava indisponivel, sem depender
// de alguem clicar em "Sincronizar agora" no CRM. Falhas ficam so em log -
// nunca devem derrubar o servidor.
setInterval(() => {
  reconcilePendingSyncs().catch((err) => logger.error("server", "Falha na reconciliacao automatica do Google Calendar", err));
}, CALENDAR_SYNC_INTERVAL_MS);
