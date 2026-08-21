export const metadata = { title: "Termos de uso" };

const SECTIONS = [
  {
    title: "1. O que e o prihora",
    body: "O prihora e uma plataforma que conecta profissionais liberais da área da estética a pessoas interessadas em seus serviços. Não prestamos os serviços anunciados, não empregamos os profissionais e não intermediamos pagamentos entre as partes.",
  },
  {
    title: "2. Registo",
    body: "As informações fornecidas no registo devem ser verdadeiras e atualizadas. Cada pessoa e responsável pela guarda da própria palavra-passe e por toda atividade realizada em a sua conta.",
  },
  {
    title: "3. Responsabilidade do profissional",
    body: "O profissional e o único responsável pelos serviços prestados, pelos preços anunciados, pela regularidade das habilitacoes exigidas pela sua atividade e pelo cumprimento dos horários agendados.",
  },
  {
    title: "4. Marcações",
    body: "A marcação realizada pela plataforma e um pedido de reserva. A confirmação depende do profissional, salvo quando ele ativa a confirmação automática. Cancelamentos e remarcacoes seguem a política de cada profissional.",
  },
  {
    title: "5. Avaliações",
    body: "Somente quem teve um atendimento concluído pode avaliar. Avaliações com conteudo ofensivo, discriminatorio ou comprovadamente falso podem ser removidas.",
  },
  {
    title: "6. Planos e cobranca",
    body: "Os planos pagos dao acesso a recursos adicionais para profissionais. O cancelamento pode ser feito a qualquer momento pelo painel, sem multa, e o perfil retorna ao plano gratuito.",
  },
  {
    title: "7. Suspensão de contas",
    body: "Contas que violem estes termos, prejudiquem outros utilizadores ou apresentem informações falsas podem ser suspensas ou removidas pela administracao da plataforma.",
  },
  {
    title: "8. Alterações",
    body: "Estes termos podem ser atualizados. Mudancas relevantes serao comunicadas pelos canais de contato registados.",
  },
];

export default function TermosPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Termos de uso</h1>
        <p className="mt-2 text-sm text-ink-400">
          Documento modelo. Adapte com apoio jurídico antes de operar comercialmente.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-bold text-ink-900">{section.title}</h2>
              <p className="mt-2 leading-relaxed text-ink-600">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
