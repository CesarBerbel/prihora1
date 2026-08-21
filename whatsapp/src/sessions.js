/**
 * Uma sessao de WhatsApp por profissional.
 *
 * O Baileys guarda as credenciais em ficheiros: cada profissional tem a sua
 * pasta dentro do volume, o que mantem as contas separadas e faz a ligacao
 * sobreviver ao reinicio do container. Ninguem ve o QR de outra pessoa porque
 * o backend so entrega o da sessao do proprio.
 */

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import baileys from "@whiskeysockets/baileys";
import QRCode from "qrcode";

const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } =
  baileys;

const RAIZ = process.env.SESSIONS_DIR || "/data/sessions";
/** O QR do WhatsApp expira sozinho; nao vale a pena guardar mais do que isto. */
const VALIDADE_QR_MS = 60_000;

/** Estado em memoria, por profissional. */
const sessoes = new Map();

function novoEstado(id) {
  return {
    id,
    status: "disconnected",
    qr: null,
    qrExpiraEm: 0,
    telefone: null,
    ligadoEm: null,
    ultimoErro: null,
    socket: null,
    // Impede que dois pedidos simultaneos abram dois sockets para a mesma conta.
    aAbrir: false,
  };
}

export function obterEstado(id) {
  const s = sessoes.get(id) ?? novoEstado(id);
  const qrValido = s.qr && Date.now() < s.qrExpiraEm;

  return {
    id: s.id,
    status: s.status,
    qr: qrValido ? s.qr : null,
    phone_number: s.telefone,
    connected_at: s.ligadoEm,
    last_error: s.ultimoErro,
  };
}

function pasta(id) {
  // O id vem do backend e e sempre numerico, mas nao custa impedir travessia.
  return path.join(RAIZ, String(id).replace(/[^0-9]/g, "") || "0");
}

/**
 * Abre a ligacao. Se ja houver credenciais guardadas, liga sem pedir QR;
 * caso contrario emite o QR para o profissional ler com o telemovel.
 */
export async function ligar(id, logger) {
  let s = sessoes.get(id);
  if (!s) {
    s = novoEstado(id);
    sessoes.set(id, s);
  }

  if (s.status === "connected") return obterEstado(id);
  if (s.aAbrir) return obterEstado(id);

  s.aAbrir = true;
  s.ultimoErro = null;
  s.status = "connecting";

  try {
    const dir = pasta(id);
    await mkdir(dir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      auth: state,
      // O QR passa pelo nosso evento; imprimi-lo no terminal so poluiria o log.
      printQRInTerminal: false,
      logger: logger.child({ sessao: id }),
      browser: ["prihora", "Chrome", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    s.socket = socket;

    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", async (u) => {
      if (u.qr) {
        s.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 });
        s.qrExpiraEm = Date.now() + VALIDADE_QR_MS;
        s.status = "qr";
      }

      if (u.connection === "open") {
        s.status = "connected";
        s.qr = null;
        s.ligadoEm = new Date().toISOString();
        s.ultimoErro = null;
        s.telefone = socket.user?.id?.split(":")[0] ?? null;
        logger.info({ sessao: id, telefone: s.telefone }, "sessao ligada");
      }

      if (u.connection === "close") {
        const codigo = u.lastDisconnect?.error?.output?.statusCode;
        s.socket = null;
        s.aAbrir = false;

        // Sessao terminada no telemovel: as credenciais deixaram de servir.
        if (codigo === DisconnectReason.loggedOut) {
          s.status = "disconnected";
          s.telefone = null;
          s.ultimoErro = "Sessão terminada no telemóvel. Leia o código outra vez.";
          await rm(pasta(id), { recursive: true, force: true }).catch(() => {});
          logger.info({ sessao: id }, "sessao terminada no telemovel");
          return;
        }

        // Qualquer outra queda e transitoria: voltamos a ligar sozinhos.
        s.status = "connecting";
        s.ultimoErro = u.lastDisconnect?.error?.message ?? null;
        logger.warn({ sessao: id, codigo }, "ligacao caiu, a repor");
        setTimeout(() => ligar(id, logger).catch(() => {}), 3_000);
      }
    });
  } catch (erro) {
    s.status = "disconnected";
    s.ultimoErro = erro.message;
    logger.error({ sessao: id, erro: erro.message }, "falha a abrir a sessao");
  } finally {
    s.aAbrir = false;
  }

  return obterEstado(id);
}

/** Termina a sessao e apaga as credenciais guardadas. */
export async function desligar(id, logger) {
  const s = sessoes.get(id);
  if (s?.socket) {
    try {
      await s.socket.logout();
    } catch {
      s.socket.end?.();
    }
  }
  sessoes.delete(id);
  await rm(pasta(id), { recursive: true, force: true }).catch(() => {});
  logger.info({ sessao: id }, "sessao removida");
  return { id, status: "disconnected" };
}

/** Numero em JID do WhatsApp. Assume Portugal quando falta o indicativo. */
export function paraJid(numero) {
  let digitos = String(numero ?? "").replace(/\D/g, "");
  if (!digitos) return null;

  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  // Nove digitos e um numero nacional; o indicativo tem de ser acrescentado.
  if (digitos.length === 9) digitos = "351" + digitos;

  // Curto demais para ser um numero de telefone.
  if (digitos.length < 11) return null;
  return `${digitos}@s.whatsapp.net`;
}

export async function enviar(id, numero, texto) {
  const s = sessoes.get(id);
  if (!s || s.status !== "connected" || !s.socket) {
    const erro = new Error("WhatsApp não está ligado. Leia o código para ligar.");
    erro.status = 409;
    throw erro;
  }

  const jid = paraJid(numero);
  if (!jid) {
    const erro = new Error("Número de telefone inválido.");
    erro.status = 400;
    throw erro;
  }

  const resultado = await s.socket.sendMessage(jid, { text: texto });
  return { id: resultado?.key?.id ?? null, to: jid };
}

/**
 * Retoma as sessoes que ja tinham credenciais guardadas.
 *
 * Sem isto, um reinicio do container deixava as contas ligadas no telemovel
 * mas mudas do lado do servidor: o envio falhava com "nao esta ligado" ate
 * alguem abrir a pagina e carregar em ligar. As credenciais estao no volume,
 * por isso a religacao nao pede QR nenhum.
 */
export async function retomarSessoes(logger) {
  const { readdir } = await import("node:fs/promises");

  let pastas = [];
  try {
    pastas = await readdir(RAIZ, { withFileTypes: true });
  } catch {
    return 0; // primeira execucao: ainda nao ha nada para retomar
  }

  const ids = pastas
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => d.name);

  let retomadas = 0;
  for (const id of ids) {
    try {
      const { readdir: ler } = await import("node:fs/promises");
      const ficheiros = await ler(path.join(RAIZ, id));
      // Sem creds.json nunca chegou a haver emparelhamento.
      if (!ficheiros.includes("creds.json")) continue;

      await ligar(id, logger);
      retomadas += 1;
    } catch (erro) {
      logger.warn({ sessao: id, erro: erro.message }, "nao consegui retomar a sessao");
    }
  }

  if (retomadas) logger.info({ retomadas }, "sessoes retomadas do disco");
  return retomadas;
}
