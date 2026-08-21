import ProfessionalCardItem from "@/components/ProfessionalCard";
import { IconPin, IconSparkles } from "@/components/Icons";
import type { ProfessionalCard, SearchGroup } from "@/lib/types";

interface Props {
  items: ProfessionalCard[];
  /** Frase pronta com preposição: "em Braga" ou "perto de si". */
  where: string | null;
}

const ORDEM: SearchGroup[] = ["region", "elsewhere", "featured"];

/**
 * Mostra o resultado em camadas: primeiro quem atende a localidade pedida,
 * depois quem está mais perto noutras localidades, e por fim os destaques.
 *
 * Os cabeçalhos vêm do que a página recebeu, não do total: numa segunda página
 * só de destaques, é esse o único título que aparece.
 */
export default function SearchResults({ items, where }: Props) {
  if (items.length === 0) return null;

  const rotulos: Record<SearchGroup, { titulo: string; nota: string; destaque: boolean }> = {
    region: {
      titulo: where ? `Disponíveis ${where}` : "Profissionais disponíveis",
      nota: "",
      destaque: false,
    },
    elsewhere: {
      titulo: "Noutras localidades",
      nota: "Do mais perto para o mais longe.",
      destaque: false,
    },
    featured: {
      titulo: "Em destaque",
      nota: "Perfis destacados, também por proximidade.",
      destaque: true,
    },
  };

  const seccoes = ORDEM.map((grupo) => ({
    grupo,
    ...rotulos[grupo],
    profissionais: items.filter((pro) => (pro.group ?? "region") === grupo),
  })).filter((seccao) => seccao.profissionais.length > 0);

  // Uma única camada nesta página dispensa cabeçalho: seria um título a
  // anunciar aquilo que a página inteira já é.
  const mostrarCabecalhos = seccoes.length > 1;

  return (
    <div className="mt-6 space-y-9">
      {seccoes.map(({ grupo, titulo, nota, destaque, profissionais }) => (
        <section key={grupo}>
          {mostrarCabecalhos && (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              {destaque ? (
                <IconSparkles className="h-4 w-4 shrink-0 translate-y-0.5 text-brand-500" />
              ) : (
                <IconPin className="h-4 w-4 shrink-0 translate-y-0.5 text-ink-400" />
              )}
              <h2 className="font-bold text-ink-900">{titulo}</h2>
              <span className="text-sm text-ink-400">
                {profissionais.length === 1 ? "1 perfil" : `${profissionais.length} perfis`}
              </span>
              {nota && <p className="w-full text-sm text-ink-400 sm:w-auto">{nota}</p>}
            </div>
          )}

          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${mostrarCabecalhos ? "mt-4" : ""}`}>
            {profissionais.map((pro) => (
              <ProfessionalCardItem key={pro.id} pro={pro} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
