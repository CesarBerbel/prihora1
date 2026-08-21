/**
 * Servico de WhatsApp do prihora.
 *
 * Nao e exposto na internet: vive na rede interna do compose e so o backend
 * fala com ele, com um segredo partilhado. A autorizacao — quem pode mexer em
 * que sessao — fica toda do lado do backend, que e quem conhece as contas.
 */

import express from "express";
import pino from "pino";

import { desligar, enviar, ligar, obterEstado, retomarSessoes } from "./sessions.js";

const PORTA = Number(process.env.PORT || 4000);
const SEGREDO = process.env.SERVICE_TOKEN || "";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const app = express();
app.use(express.json({ limit: "256kb" }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  // Sem segredo configurado o servico recusa tudo: falhar fechado e melhor do
  // que ficar aberto por esquecimento.
  if (!SEGREDO || req.get("X-Service-Token") !== SEGREDO) {
    return res.status(401).json({ detail: "Não autorizado." });
  }
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/sessions/:id", (req, res) => {
  res.json(obterEstado(req.params.id));
});

app.post("/sessions/:id/connect", async (req, res, next) => {
  try {
    res.json(await ligar(req.params.id, logger));
  } catch (erro) {
    next(erro);
  }
});

app.delete("/sessions/:id", async (req, res, next) => {
  try {
    res.json(await desligar(req.params.id, logger));
  } catch (erro) {
    next(erro);
  }
});

app.post("/sessions/:id/messages", async (req, res, next) => {
  try {
    const { to, text } = req.body ?? {};
    if (!to || !text) {
      return res.status(400).json({ detail: "Faltam o destinatário ou o texto." });
    }
    res.json(await enviar(req.params.id, to, text));
  } catch (erro) {
    next(erro);
  }
});

// eslint-disable-next-line no-unused-vars -- o Express exige os quatro argumentos
app.use((erro, _req, res, _next) => {
  const status = erro.status ?? 500;
  if (status >= 500) logger.error({ erro: erro.message }, "erro no serviço");
  res.status(status).json({ detail: erro.message || "Erro no serviço de WhatsApp." });
});

app.listen(PORTA, "0.0.0.0", async () => {
  logger.info({ porta: PORTA }, "serviço de WhatsApp no ar");
  // Religa quem já tinha emparelhado, antes de qualquer pedido chegar.
  await retomarSessoes(logger).catch((erro) =>
    logger.error({ erro: erro.message }, "falha ao retomar as sessões"),
  );
});
