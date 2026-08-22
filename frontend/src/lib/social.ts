/**
 * Ligacoes para as redes e contactos do profissional.
 *
 * Sem dependencias: sao funcoes que constroem enderecos a partir de campos que
 * as pessoas preenchem a mao, de dez maneiras diferentes, e por isso precisam
 * de testes que lhes cheguem sem montar a aplicacao.
 */

// Portugal: 9 digitos, indicativo 351.
const COUNTRY_CODE = "351";
const NATIONAL_LENGTH = 9;

function apenasDigitos(telefone?: string | null): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  if (digitos.startsWith(`00${COUNTRY_CODE}`)) return digitos.slice(2 + COUNTRY_CODE.length);
  if (digitos.startsWith(COUNTRY_CODE) && digitos.length > NATIONAL_LENGTH) {
    return digitos.slice(COUNTRY_CODE.length);
  }
  return digitos;
}

/** Conversa no WhatsApp, ou null quando o numero nao chega para uma. */
export function whatsappLink(phone?: string | null): string | null {
  const digitos = apenasDigitos(phone);
  if (digitos.length < NATIONAL_LENGTH) return null;
  return `https://wa.me/${COUNTRY_CODE}${digitos}`;
}

/**
 * Endereço do perfil de Instagram, a partir do que o profissional escreveu.
 *
 * Aceita as três formas que as pessoas usam — "@nome", "nome" e o endereço
 * inteiro colado da barra do navegador — porque o campo é livre e todas elas
 * aparecem. Devolve null quando não sobra um nome de utilizador plausível.
 */
export function instagramUrl(valor?: string | null): string | null {
  const limpo = (valor ?? "").trim();
  if (!limpo) return null;

  const semEndereco = limpo
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^@/, "");

  const utilizador = semEndereco.split(/[/?#]/)[0].trim();
  // O Instagram permite letras, números, ponto e underscore, até 30.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(utilizador)) return null;

  return `https://instagram.com/${utilizador}`;
}

/** "@nome", para mostrar. */
export function instagramHandle(valor?: string | null): string | null {
  const url = instagramUrl(valor);
  return url ? `@${url.split("/").pop()}` : null;
}
