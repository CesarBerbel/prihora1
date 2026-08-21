import Link from "next/link";

import SignupForm from "@/components/SignupForm";

export const metadata = {
  title: "Registar o meu trabalho",
  description:
    "Publique o seu perfil no prihora, receba marcações online e apareça para clientes da sua zona.",
};

export default function RegistoProfissionalPage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-center text-3xl font-bold tracking-tight">
          Registar o meu trabalho
        </h1>
        <p className="mt-2 text-center text-ink-500">
          Leva menos de um minuto e o plano inicial é gratuito. A seguir há um guia
          que o ajuda a montar o perfil passo a passo.
        </p>

        <div className="mt-10">
          <SignupForm papel="profissional" />
        </div>

        <p className="mt-8 text-center text-sm text-ink-400">
          Ainda a decidir?{" "}
          <Link
            href="/para-profissionais/como-funciona"
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            Veja como funciona
          </Link>{" "}
          ou{" "}
          <Link href="/planos" className="font-semibold text-brand-600 hover:text-brand-700">
            compare os planos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
