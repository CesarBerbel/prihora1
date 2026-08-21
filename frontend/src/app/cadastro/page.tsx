import { redirect } from "next/navigation";

import SignupForm from "@/components/SignupForm";

export const metadata = {
  title: "Criar conta",
  description: "Crie a sua conta no prihora e guarde as suas marcações num só sítio.",
};

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // O registo de profissional mudou-se para o lado profissional do site.
  // As ligacoes antigas — e os favoritos — continuam a chegar la.
  const params = await searchParams;
  if (params.tipo === "profissional") {
    const plano = typeof params.plano === "string" ? `?plano=${params.plano}` : "";
    redirect(`/para-profissionais/registo${plano}`);
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-center text-3xl font-bold tracking-tight">Criar conta no prihora</h1>
        <p className="mt-2 text-center text-ink-500">
          Para marcar mais depressa e ter as suas marcações sempre à mão.
        </p>

        <div className="mt-10">
          <SignupForm papel="cliente" />
        </div>
      </div>
    </div>
  );
}
