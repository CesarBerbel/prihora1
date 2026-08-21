import Link from "next/link";

import SearchBar from "@/components/SearchBar";
import { IconCalendar, IconCheck, IconSearch, IconSparkles, IconStar } from "@/components/Icons";

export const metadata = {
  title: "Como funciona",
  description:
    "Como encontrar um profissional de estética perto de si, ver os horários livres e marcar em segundos.",
};

const PASSOS = [
  {
    icon: IconSearch,
    title: "Procure perto de si",
    text:
      "Diga o serviço que precisa e a sua zona. Mostramos quem atende ali, ordenado por " +
      "distância — e, se não houver ninguém na freguesia, quem está mais perto a seguir.",
  },
  {
    icon: IconStar,
    title: "Compare com calma",
    text:
      "Cada perfil mostra o trabalho feito, os preços de cada serviço, a morada e as " +
      "avaliações de quem já lá foi. Sem ter de pedir orçamento por mensagem.",
  },
  {
    icon: IconCalendar,
    title: "Veja os horários livres",
    text:
      "A agenda de cada profissional é pública e está sempre certa. O que aparece livre " +
      "está mesmo livre, à hora que quiser marcar.",
  },
  {
    icon: IconCheck,
    title: "Marque em segundos",
    text:
      "Escolhe o horário, deixa o nome e o telemóvel, e recebe um código de acompanhamento. " +
      "Não precisa sequer de criar conta.",
  },
];

const FAQ = [
  {
    q: "Preciso de criar conta para marcar?",
    a:
      "Não. Basta o nome e o telemóvel. A conta serve apenas para guardar o histórico " +
      "e voltar a marcar mais depressa.",
  },
  {
    q: "O prihora cobra alguma coisa?",
    a: "Para si, nada. Procurar e marcar é gratuito, e o valor do serviço é combinado com o profissional.",
  },
  {
    q: "Como pago o atendimento?",
    a:
      "Diretamente ao profissional, no dia, da forma que ele aceitar. O prihora não recebe " +
      "pagamentos nem fica com comissão.",
  },
  {
    q: "A marcação fica logo confirmada?",
    a:
      "Depende do profissional: uns confirmam automaticamente, outros preferem confirmar à mão. " +
      "Em ambos os casos é avisado por WhatsApp quando o estado mudar.",
  },
  {
    q: "E se precisar de desmarcar?",
    a:
      "Abra a sua marcação com o código que recebeu e cancele por lá. Avisar cedo ajuda o " +
      "profissional a dar a vaga a outra pessoa.",
  },
  {
    q: "Onde consulto a marcação que fiz?",
    a: "Na página de consulta, com o código que lhe demos no fim — ou na sua conta, se criou uma.",
  },
];

export default function ComoFuncionaPage() {
  return (
    <div className="bg-ink-50 pb-20">
      <section className="bg-gradient-to-b from-brand-50 to-ink-50 py-16">
        <div className="container-page text-center">
          <span className="chip mx-auto bg-white text-brand-700 ring-brand-200">
            <IconSparkles className="h-3.5 w-3.5" />
            Para quem procura
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Marcar leva menos de um minuto
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-500">
            Sem trocas de mensagens para saber se há vaga, sem esperar por resposta.
            Vê o que está livre e reserva.
          </p>
        </div>
      </section>

      <section className="container-page py-14">
        <ol className="grid gap-4 md:grid-cols-2">
          {PASSOS.map((passo, index) => (
            <li key={passo.title} className="flex gap-5 rounded-xl2 bg-white p-6 shadow-card">
              <div className="shrink-0">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <passo.icon className="h-5 w-5" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">
                  Passo {index + 1}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-ink-900">{passo.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{passo.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Quem chegou ate aqui ja percebeu: e altura de procurar. */}
      <section className="container-page pb-14">
        <div className="rounded-xl2 bg-white p-8 shadow-card sm:p-10">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Experimente agora
          </h2>
          <p className="mt-2 text-center text-ink-500">
            Diga o que procura e onde. O resto aparece por ordem de proximidade.
          </p>
          <div className="mx-auto mt-6 max-w-3xl">
            <SearchBar />
          </div>
        </div>
      </section>

      <section className="container-page pb-14">
        <h2 className="text-center text-2xl font-bold tracking-tight">Perguntas frequentes</h2>
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-xl2 bg-white p-6 shadow-card">
              <h3 className="font-semibold text-ink-900">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/buscar" className="btn-primary">
            Procurar profissionais
          </Link>
          <Link href="/agendamento" className="btn-secondary">
            Consultar a minha marcação
          </Link>
        </div>
      </section>
    </div>
  );
}
