/**
 * Localização do dispositivo, já traduzida em morada.
 *
 * Vive à parte porque duas páginas usam o mesmo botão — o guia de arranque e a
 * edição de perfil — e queremos que se comportem igual.
 */

import { api } from "@/lib/api";

export interface LocalizacaoResolvida {
  latitude: number;
  longitude: number;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  /** "nominatim" quando veio da morada real; "cidades" quando foi aproximado. */
  source: string;
}

export class LocalizacaoError extends Error {}

/** Coordenadas do navegador. Rejeita com uma mensagem já legível. */
function coordenadas(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new LocalizacaoError("Este navegador não sabe dar a localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (erro) => {
      // As mensagens do navegador são técnicas; estas dizem o que fazer.
      const porCodigo: Record<number, string> = {
        1: "Autorize o acesso à localização no navegador e tente de novo.",
        2: "Não foi possível determinar a sua localização agora.",
        3: "A localização demorou demasiado. Tente de novo.",
      };
      reject(new LocalizacaoError(porCodigo[erro.code] ?? "Não foi possível obter a localização."));
    }, { timeout: 10000, enableHighAccuracy: true });
  });
}

/**
 * Coordenadas e, quando possível, morada, localidade, distrito e código postal.
 *
 * Se a tradução para morada falhar, devolve na mesma as coordenadas: são elas
 * que fazem o perfil aparecer nas pesquisas por proximidade, e perder isso por
 * causa de um serviço externo seria o pior dos casos.
 */
export async function detetarLocalizacao(): Promise<LocalizacaoResolvida> {
  const posicao = await coordenadas();
  const latitude = Number(posicao.coords.latitude.toFixed(6));
  const longitude = Number(posicao.coords.longitude.toFixed(6));

  try {
    return await api.get<LocalizacaoResolvida>("/geocode/reverse", {
      params: { lat: latitude, lng: longitude },
      auth: true,
    });
  } catch {
    return { latitude, longitude, source: "coordenadas" };
  }
}
