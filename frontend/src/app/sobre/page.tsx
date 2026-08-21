import Link from "next/link";

import { IconSparkles } from "@/components/Icons";

export const metadata = {
  title: "Sobre",
  description: "O prihora conecta profissionais liberais da estética a clientes da sua região.",
};

export default function SobrePage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white">
          <IconSparkles className="h-6 w-6" />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">Sobre o prihora</h1>

        <div className="mt-6 space-y-4 leading-relaxed text-ink-600">
          <p>
            O prihora nasceu de uma constatacao simples: quem trabalha com estética passa boa
            parte do dia respondendo mensagem para dizer que horário esta livre, quanto custa e
            onde fica o atendimento.
          </p>
          <p>
            Do outro lado, quem procura um serviço precisa abrir varios perfis, mandar mensagem
            para cada um e esperar resposta para descobrir o básico.
          </p>
          <p>
            A gente juntou as duas pontas em um lugar só. O profissional pública serviços, preços
            e horários uma única vez. O cliente pesquisa pela região, ve tudo pronto e reserva na
            hora, sem conversa preliminar.
          </p>
          <p>
            Não cobramos comissão por atendimento. O que fica entre o profissional e o cliente
            e assunto dos dois.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/para-profissionais" className="btn-primary">
            Sou profissional
          </Link>
          <Link href="/buscar" className="btn-secondary">
            Quero marcar
          </Link>
        </div>
      </div>
    </div>
  );
}
