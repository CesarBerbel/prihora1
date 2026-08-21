import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Erro 404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        Não encontramos esta página
      </h1>
      <p className="mt-3 max-w-md text-ink-500">
        A morada pode ter mudado ou o perfil não esta mais disponível.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          Voltar para a home
        </Link>
        <Link href="/buscar" className="btn-secondary">
          Procurar profissionais
        </Link>
      </div>
    </div>
  );
}
