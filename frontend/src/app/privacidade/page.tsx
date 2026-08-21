export const metadata = { title: "Política de privacidade" };

const SECTIONS = [
  {
    title: "Dados que coletamos",
    body: "Nome, e-mail, telefone e, no caso de profissionais, dados do perfil público como bio, serviços, preços, morada de atendimento e coordenadas aproximadas. Registramos também as marcações realizados.",
  },
  {
    title: "Como usamos",
    body: "Os dados servem para operar a plataforma: exibir perfis publicos, permitir pesquisas por proximidade, processar marcações e enviar comunicacoes sobre o serviço.",
  },
  {
    title: "Localização",
    body: "A localização do navegador só e usada quando você autoriza, e apenas para ordenar os resultados por distância. Não guardamos o histórico de localização dos visitantes.",
  },
  {
    title: "Compartilhamento",
    body: "Os dados do perfil profissional sao publicos por natureza. Dados de contato do cliente sao compartilhados apenas com o profissional do marcação correspondente. Não vendemos dados a terceiros.",
  },
  {
    title: "Seus direitos",
    body: "Você pode acessar, corrigir ou solicitar a exclusao dos seus dados a qualquer momento pelo painel ou pelos canais de contato.",
  },
  {
    title: "Seguranca",
    body: "Senhas sao armazenadas com hash bcrypt. O acesso a API e autenticado por token e o trafego deve ser servido sobre HTTPS em produção.",
  },
];

export default function PrivacidadePage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
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
