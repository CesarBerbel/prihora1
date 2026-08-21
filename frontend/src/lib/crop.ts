/**
 * Matematica do recorte quadrado do avatar.
 *
 * Invariante que sustenta a tela: o pedaco da imagem visivel na janela de
 * recorte e exatamente o pedaco gravado no arquivo final. Tudo aqui e funcao
 * pura justamente para poder ser verificado sem navegador.
 *
 * Sistema de coordenadas: a janela e um quadrado de lado `view`, com origem no
 * canto superior esquerdo. `offset` e a posicao do canto da imagem desenhada,
 * em pixels de tela, normalmente negativa.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export interface CropRect {
  /** Canto do recorte, em pixels reais da imagem. */
  sx: number;
  sy: number;
  /** Lado do recorte, em pixels reais da imagem. */
  size: number;
}

/** Escala em que a imagem cobre a janela inteira, sem sobrar canto vazio. */
export function baseScale(natural: Size, view: number): number {
  const smaller = Math.min(natural.width, natural.height);
  if (smaller <= 0) return 1;
  return view / smaller;
}

/** Escala efetiva, ja com o zoom escolhido pelo usuario. */
export function effectiveScale(natural: Size, view: number, zoom: number): number {
  return baseScale(natural, view) * zoom;
}

/** Tamanho da imagem desenhada na tela. */
export function drawnSize(natural: Size, view: number, zoom: number): Size {
  const scale = effectiveScale(natural, view, zoom);
  return { width: natural.width * scale, height: natural.height * scale };
}

/**
 * Impede que a imagem seja arrastada para fora, deixando faixa vazia na janela.
 * Se a imagem for menor que a janela - o que nao deve acontecer com zoom >= 1 -
 * ela e centralizada.
 */
export function clampAxis(value: number, drawn: number, view: number): number {
  const min = view - drawn;
  if (min >= 0) return min / 2;
  return Math.min(0, Math.max(min, value));
}

export function clampOffset(offset: Offset, natural: Size, view: number, zoom: number): Offset {
  const drawn = drawnSize(natural, view, zoom);
  return {
    x: clampAxis(offset.x, drawn.width, view),
    y: clampAxis(offset.y, drawn.height, view),
  };
}

/** Offset que centraliza a imagem na janela. */
export function centeredOffset(natural: Size, view: number, zoom = 1): Offset {
  const drawn = drawnSize(natural, view, zoom);
  return { x: (view - drawn.width) / 2, y: (view - drawn.height) / 2 };
}

/**
 * Converte o que esta visivel na janela para o retangulo de origem do
 * drawImage. Um ponto da tela `screen` corresponde a `(screen - offset) / escala`
 * na imagem; aplicando isso as bordas 0 e `view` chega-se ao recorte abaixo.
 *
 * O resultado e preso aos limites da imagem: erro de arredondamento poderia
 * pedir um pixel inexistente e sujar a borda do avatar.
 */
export function cropRect(natural: Size, view: number, zoom: number, offset: Offset): CropRect {
  const scale = effectiveScale(natural, view, zoom);
  const safe = clampOffset(offset, natural, view, zoom);

  const size = Math.min(view / scale, natural.width, natural.height);
  const maxX = Math.max(0, natural.width - size);
  const maxY = Math.max(0, natural.height - size);

  return {
    sx: Math.min(Math.max(-safe.x / scale, 0), maxX),
    sy: Math.min(Math.max(-safe.y / scale, 0), maxY),
    size,
  };
}
