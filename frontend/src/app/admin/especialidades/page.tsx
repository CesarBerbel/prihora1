"use client";

/**
 * O catálogo de especialidades, editável.
 *
 * É a lista que aparece na pesquisa, no perfil e no registo — mudá-la mexe em
 * todo o site de uma vez. Por isso a página mostra sempre quantos perfis usam
 * cada uma antes de a deixar mexer, e o slug — que é o endereço de pesquisa
 * que as pessoas guardam — só muda quando alguém o escreve de propósito.
 */

import { useCallback, useEffect, useState } from "react";

import DashboardShell from "@/components/DashboardShell";
import Modal from "@/components/Modal";
import { ADMIN_NAV } from "@/components/PanelNav";
import { ApiError, api } from "@/lib/api";

interface AdminCategory {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  professional_count: number;
}

const VAZIO = {
  name: "",
  slug: "",
  description: "",
  sort_order: 100,
  is_active: true,
};

export default function EspecialidadesPage() {
  const [categorias, setCategorias] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [aEditar, setAEditar] = useState<AdminCategory | null>(null);
  const [aCriar, setACriar] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setCategorias(await api.get<AdminCategory[]>("/admin/categories", { auth: true }));
    } catch (err) {
      setMensagem({
        kind: "erro",
        text: err instanceof ApiError ? err.message : "Não foi possível carregar.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alternar(categoria: AdminCategory) {
    try {
      await api.put(
        `/admin/categories/${categoria.id}`,
        {
          name: categoria.name,
          slug: categoria.slug,
          description: categoria.description,
          icon: categoria.icon,
          sort_order: categoria.sort_order,
          is_active: !categoria.is_active,
        },
        { auth: true },
      );
      await carregar();
    } catch (err) {
      setMensagem({
        kind: "erro",
        text: err instanceof ApiError ? err.message : "Não foi possível atualizar.",
      });
    }
  }

  return (
    <DashboardShell
      title="Especialidades"
      subtitle="A lista que aparece na pesquisa, nos perfis e no registo."
      nav={ADMIN_NAV}
      allow={["admin"]}
      actions={
        <button onClick={() => setACriar(true)} className="btn-primary btn-sm">
          Nova especialidade
        </button>
      }
    >
      {mensagem && (
        <p
          className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            mensagem.kind === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {mensagem.text}
        </p>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl2 bg-ink-100" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3">Especialidade</th>
                  <th className="px-5 py-3">Perfis</th>
                  <th className="px-5 py-3">Ordem</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {categorias.map((categoria) => (
                  <tr key={categoria.id} className={categoria.is_active ? "" : "opacity-60"}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink-900">{categoria.name}</p>
                      {categoria.description && (
                        <p className="mt-0.5 max-w-sm text-xs text-ink-500">
                          {categoria.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-ink-600">{categoria.professional_count}</td>
                    <td className="px-5 py-4 text-ink-500">{categoria.sort_order}</td>
                    <td className="px-5 py-4">
                      <Interruptor
                        ligado={categoria.is_active}
                        onMudar={() => void alternar(categoria)}
                        rotulo={`${categoria.is_active ? "Desligar" : "Ligar"} ${categoria.name}`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      {/* Sem apagar: o interruptor já tira a especialidade da
                          pesquisa sem a arrancar dos perfis que a escolheram,
                          e é isso que se quer em quase todos os casos. */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => setAEditar(categoria)}
                          className="btn-secondary btn-sm"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(aCriar || aEditar) && (
        <Formulario
          categoria={aEditar}
          onFechar={() => {
            setACriar(false);
            setAEditar(null);
          }}
          onFeito={async (texto) => {
            setACriar(false);
            setAEditar(null);
            setMensagem({ kind: "ok", text: texto });
            await carregar();
          }}
        />
      )}
    </DashboardShell>
  );
}

/**
 * Interruptor de ligado/desligado.
 *
 * `role="switch"` e nao um botao qualquer: e o que diz a um leitor de ecra que
 * isto tem dois estados e em qual deles esta. O rotulo vem de fora porque
 * "ligar" sozinho nao chega — numa tabela de quinze linhas, e preciso saber
 * ligar o que.
 */
function Interruptor({
  ligado,
  onMudar,
  rotulo,
}: {
  ligado: boolean;
  onMudar: () => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={onMudar}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
        ligado ? "bg-emerald-500" : "bg-ink-200"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          ligado ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Formulario({
  categoria,
  onFechar,
  onFeito,
}: {
  categoria: AdminCategory | null;
  onFechar: () => void;
  onFeito: (texto: string) => void;
}) {
  const [form, setForm] = useState(() =>
    categoria
      ? {
          name: categoria.name,
          slug: categoria.slug,
          description: categoria.description ?? "",
          sort_order: categoria.sort_order,
          is_active: categoria.is_active,
        }
      : VAZIO,
  );
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setAGuardar(true);
    setErro(null);
    try {
      const corpo = {
        name: form.name.trim(),
        slug: form.slug.trim() || null,
        description: form.description.trim() || null,
        sort_order: form.sort_order,
        is_active: form.is_active,
      };
      if (categoria) await api.put(`/admin/categories/${categoria.id}`, corpo, { auth: true });
      else await api.post("/admin/categories", corpo, { auth: true });
      onFeito(categoria ? "Especialidade atualizada." : "Especialidade criada.");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível guardar.");
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Modal
      title={categoria ? `Editar ${categoria.name}` : "Nova especialidade"}
      subtitle="Aparece na pesquisa, nos perfis e no registo de profissionais."
      size="md"
      onClose={onFechar}
    >
      <form onSubmit={guardar}>
        {erro && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

        <div>
          <label className="label" htmlFor="cat-nome">
            Nome *
          </label>
          <input
            id="cat-nome"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Micropigmentação"
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="cat-slug">
            Endereço de pesquisa
          </label>
          <input
            id="cat-slug"
            className="input font-mono text-sm"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder={categoria ? categoria.slug : "deixado em branco, sai do nome"}
          />
          <p className="field-hint">
            {categoria
              ? "Mudá-lo parte as ligações guardadas para esta especialidade. Em branco, fica como está."
              : "Em branco, é gerado a partir do nome."}
          </p>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="cat-descricao">
            Descrição
          </label>
          <textarea
            id="cat-descricao"
            className="input min-h-20 resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cat-ordem">
              Ordem na lista
            </label>
            <input
              id="cat-ordem"
              type="number"
              min={0}
              max={999}
              className="input"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
            <p className="field-hint">Menor aparece primeiro.</p>
          </div>
          {/* O mesmo interruptor da tabela: dois sítios, um gesto. */}
          <div className="flex items-center gap-2.5 self-end pb-2">
            <Interruptor
              ligado={form.is_active}
              onMudar={() => setForm({ ...form, is_active: !form.is_active })}
              rotulo={form.is_active ? "Esconder do site" : "Mostrar no site"}
            />
            <span className="text-sm text-ink-600">
              {form.is_active ? "Visível no site" : "Escondida do site"}
            </span>
          </div>
        </div>

        {categoria && categoria.professional_count > 0 && (
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
            {categoria.professional_count} perfis usam esta especialidade. Desligá-la tira-a das
            pesquisas, mas não a arranca dos perfis.
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="submit"
            disabled={aGuardar || form.name.trim().length < 2}
            className="btn-primary flex-1"
          >
            {aGuardar ? "A guardar..." : "Guardar"}
          </button>
          <button type="button" onClick={onFechar} className="btn-ghost">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
