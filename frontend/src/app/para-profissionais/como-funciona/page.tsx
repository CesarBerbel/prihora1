import Link from "next/link";

import { IconCalendar, IconCheck, IconSearch, IconSparkles, IconStar } from "@/components/Icons";

export const metadata = {
  title: "Como funciona para profissionais",
  description:
    "Do registo à primeira marcação: como publicar o perfil, abrir a agenda e aparecer na pesquisa.",
};

const PASSOS = [
  {
    icon: IconSparkles,
    title: "Monte o seu perfil",
    text:
      "Foto, apresentação, especialidades e onde atende. Leva cinco minutos e fica no ar na hora. " +
      "Um guia de arranque acompanha-o campo a campo.",
  },
  {
    icon: IconCalendar,
    title: "Publique os seus horários",
    text:
      "Defina a grelha da semana e a duração de cada serviço. A agenda bloqueia sozinha " +
      "o que já foi reservado e as folgas que marcar.",
  },
  {
    icon: IconSearch,
    title: "Apareça nas pesquisas",
    text:
      "Os clientes da sua zona encontram-no por serviço, freguesia ou proximidade — " +
      "com o preço e o horário livre já à vista.",
  },
  {
    icon: IconCheck,
    title: "Receba e confirme",
    text:
      "Cada pedido chega ao painel e ao seu WhatsApp. Confirma, remarca ou cancela num clique, " +
      "e o cliente é avisado automaticamente.",
  },
  {
    icon: IconStar,
    title: "Construa reputação",
    text:
      "Cada atendimento concluído pode virar uma avaliação pública no seu perfil, " +
      "que pesa nos resultados da pesquisa.",
  },
];

const FAQ = [
  {
    q: "Preciso de pagar para começar?",
    a: "Não. O plano gratuito permite registar serviços, publicar o perfil e receber marcações.",
  },
  {
    q: "Ficam com uma parte do valor?",
    a: "Não cobramos comissão por atendimento. O pagamento é combinado diretamente com o cliente.",
  },
  {
    q: "Consigo atender ao domicílio?",
    a: "Sim. Basta marcar a opção no perfil e definir o raio de atendimento em quilómetros.",
  },
  {
    q: "E se precisar de tirar férias?",
    a: "Bloqueia o período na agenda e ele desaparece automaticamente dos horários disponíveis.",
  },
  {
    q: "Os avisos saem do meu número?",
    a:
      "Sim. Liga o seu WhatsApp uma vez, lendo um código QR no painel, e as mensagens " +
      "para os clientes saem do seu próprio número.",
  },
  {
    q: "Posso marcar por mim mesmo um cliente que apareceu na loja?",
    a:
      "Pode. A marcação feita pelo painel entra mesmo fora do horário publicado — " +
      "só não deixa sobrepor outro atendimento já confirmado.",
  },
];

export default function ComoFuncionaProfissionaisPage() {
  return (
    <div className="bg-ink-50 pb-20">
      <section className="bg-gradient-to-b from-brand-50 to-ink-50 py-16">
        <div className="container-page text-center">
          <span className="chip mx-auto bg-white text-brand-700 ring-brand-200">
            <IconSparkles className="h-3.5 w-3.5" />
            Para profissionais
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Do registo à primeira marcação
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-500">
            Cinco passos, nenhum deles complicado. Comece hoje e a agenda fica a
            trabalhar por si a partir de amanhã.
          </p>
        </div>
      </section>

      <section className="container-page py-14">
        <ol className="space-y-4">
          {PASSOS.map((passo, index) => (
            <li
              key={passo.title}
              className="flex gap-5 rounded-xl2 bg-white p-6 shadow-card sm:p-8"
            >
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
      </section>

      <section className="container-page">
        <div className="rounded-xl2 bg-ink-950 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Pronto para publicar o seu trabalho?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-300">
            O plano inicial é gratuito e não pedimos cartão.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/para-profissionais/registo" className="btn-primary">
              Registar o meu trabalho
            </Link>
            <Link
              href="/planos"
              className="btn border border-white/20 text-white hover:bg-white/10"
            >
              Ver planos
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
