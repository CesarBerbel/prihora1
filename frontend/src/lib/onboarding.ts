/**
 * Passos que levam um perfil profissional do registo ao ar.
 *
 * Vive à parte das páginas porque duas coisas dependem dele: o guia em
 * /painel/comecar e o cartão de progresso na visão geral, que desaparece
 * quando já não há nada por fazer. Sendo função pura, dá para testar sem
 * navegador.
 */

import type { ProfessionalPrivate } from "@/lib/types";

export type StepId = "perfil" | "local" | "servicos" | "horarios" | "publicar";

export interface Step {
  id: StepId;
  titulo: string;
  resumo: string;
  /** Página onde o passo se resolve por inteiro. */
  href: string;
  concluido: boolean;
}

/** Nada de opcionais aqui: só entra o que é mesmo preciso para receber marcações. */
export function buildSteps(profile: ProfessionalPrivate | null): Step[] {
  const bio = (profile?.bio ?? "").trim();
  const cidade = (profile?.city ?? "").trim();
  const servicosAtivos = (profile?.services ?? []).filter((s) => s.is_active);
  const horarios = profile?.availabilities ?? [];

  return [
    {
      id: "perfil",
      titulo: "Apresente o seu trabalho",
      resumo: "Uma frase de destaque e alguns parágrafos sobre o que faz.",
      href: "/painel/perfil",
      concluido: bio.length > 0,
    },
    {
      id: "local",
      titulo: "Diga onde atende",
      resumo: "A localidade decide em que pesquisas aparece.",
      href: "/painel/perfil",
      concluido: cidade.length > 0,
    },
    {
      id: "servicos",
      titulo: "Registe os seus serviços",
      resumo: "Nome, duração e preço. Pelo menos um para poder receber marcações.",
      href: "/painel/servicos",
      concluido: servicosAtivos.length > 0,
    },
    {
      id: "horarios",
      titulo: "Defina os seus horários",
      resumo: "A grade semanal em que aceita marcações.",
      href: "/painel/agenda",
      concluido: horarios.length > 0,
    },
    {
      id: "publicar",
      titulo: "Publique o perfil",
      resumo: "A partir daqui aparece nas pesquisas e recebe marcações.",
      href: "/painel/perfil",
      concluido: profile?.status === "active",
    },
  ];
}

export interface Progress {
  steps: Step[];
  concluidos: number;
  total: number;
  percentagem: number;
  completo: boolean;
  /** O primeiro por fazer, para onde a interface aponta a seguir. */
  proximo: Step | null;
  /** Perfil suspenso: publicar não depende de quem o usa. */
  bloqueado: boolean;
}

export function computeProgress(profile: ProfessionalPrivate | null): Progress {
  const steps = buildSteps(profile);
  const concluidos = steps.filter((s) => s.concluido).length;

  return {
    steps,
    concluidos,
    total: steps.length,
    percentagem: Math.round((concluidos / steps.length) * 100),
    // Sem perfil carregado ainda, nada está completo: o cartão não pode
    // desaparecer por causa de um carregamento em curso.
    completo: profile !== null && concluidos === steps.length,
    proximo: steps.find((s) => !s.concluido) ?? null,
    bloqueado: profile?.status === "suspended",
  };
}
