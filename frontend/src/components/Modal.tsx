"use client";

/**
 * A janela que se sobrepoe a pagina.
 *
 * Ha tres coisas que uma caixa destas tem de fazer bem e que sao faceis de
 * esquecer quando se escreve a quarta copia dela — por isso ha uma so:
 *
 *  - **sair da arvore**. Desenhada colada ao body, nenhum `overflow` nem
 *    `backdrop-blur` de um antepassado a corta ou a prende. Ja aconteceu duas
 *    vezes neste projeto com menus.
 *  - **prender o foco**. Sem isso, o Tab sai da caixa e vai passear pelos
 *    campos da pagina por baixo, que o utilizador nem consegue ver.
 *  - **devolver o foco**. Ao fechar, volta ao botao que a abriu, para quem
 *    navega com o teclado nao ficar perdido no cimo do documento.
 */

import { useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

import { IconClose } from "@/components/Icons";

const LARGURAS = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

interface Props {
  title: string;
  /** Frase curta por baixo do titulo. */
  subtitle?: string;
  onClose: () => void;
  size?: keyof typeof LARGURAS;
  children: React.ReactNode;
}

/** Elementos que o Tab consegue alcancar dentro da caixa. */
const ALCANCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, subtitle, onClose, size = "lg", children }: Props) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  // Quem tinha o foco antes de abrir, para lho devolver no fim.
  const anterior = useRef<HTMLElement | null>(null);

  const fechar = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    anterior.current = document.activeElement as HTMLElement | null;

    // A página por trás não deve rolar enquanto isto está aberto.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // O primeiro campo do conteúdo, e não o X do cabeçalho: quem abriu um
    // formulário quer escrever, não fechá-lo. Sem campos nenhuns — uma
    // pergunta de sim/não — fica o primeiro botão que houver.
    const conteudo = corpoRef.current?.querySelector<HTMLElement>(ALCANCAVEIS);
    (conteudo ?? caixaRef.current?.querySelector<HTMLElement>(ALCANCAVEIS))?.focus();

    function teclado(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        fechar();
        return;
      }
      if (evento.key !== "Tab") return;

      const dentro = caixaRef.current?.querySelectorAll<HTMLElement>(ALCANCAVEIS);
      if (!dentro || dentro.length === 0) return;

      const primeiro = dentro[0];
      const ultimo = dentro[dentro.length - 1];
      const activo = document.activeElement;

      // O ciclo fecha-se sobre si próprio em vez de sair para a página.
      if (evento.shiftKey && activo === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && activo === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", teclado, true);
    return () => {
      document.removeEventListener("keydown", teclado, true);
      document.body.style.overflow = overflowAnterior;
      anterior.current?.focus?.();
    };
  }, [fechar]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 sm:p-8"
      onMouseDown={(evento) => {
        // `mousedown` e não `click`: arrastar do interior para fora ao
        // seleccionar texto não pode fechar a caixa por engano.
        if (evento.target === evento.currentTarget) fechar();
      }}
    >
      <div
        ref={caixaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`my-auto w-full ${LARGURAS[size]} rounded-xl2 bg-white shadow-lift`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-6 py-4">
          <div className="min-w-0">
            <h2 id={tituloId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        <div ref={corpoRef} className="px-6 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
