/** Testes do progresso do onboarding. Correm com: npm test */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeProgress } from "./onboarding.ts";
import type { ProfessionalPrivate } from "./types.ts";

/** Perfil mínimo, com tudo por fazer. */
function perfil(patch: Partial<ProfessionalPrivate> = {}): ProfessionalPrivate {
  return {
    id: 1,
    slug: "teste",
    display_name: "Teste",
    rating_avg: 0,
    rating_count: 0,
    is_verified: false,
    is_featured: false,
    serves_at_home: false,
    serves_at_studio: true,
    categories: [],
    home_service_radius_km: 10,
    timezone: "Europe/Lisbon",
    min_notice_hours: 2,
    max_advance_days: 60,
    completed_bookings: 0,
    services: [],
    availabilities: [],
    created_at: "2026-01-01T00:00:00Z",
    user_id: 1,
    status: "pending",
    slot_interval_min: 30,
    auto_confirm: false,
    profile_views: 0,
    ...patch,
  } as ProfessionalPrivate;
}

const servico = { id: 1, name: "Manicure", duration_min: 45, price_cents: 1400, is_active: true, sort_order: 10 };
const horario = { id: 1, weekday: 0, start_time: "09:00:00", end_time: "18:00:00" };

describe("progresso do onboarding", () => {
  it("perfil acabado de registar não tem nenhum passo feito", () => {
    const p = computeProgress(perfil());

    assert.equal(p.concluidos, 0);
    assert.equal(p.total, 5);
    assert.equal(p.percentagem, 0);
    assert.equal(p.completo, false);
    assert.equal(p.proximo?.id, "perfil");
  });

  it("cada passo conta assim que a condição é satisfeita", () => {
    assert.equal(computeProgress(perfil({ bio: "Trabalho com gel." })).concluidos, 1);
    assert.equal(computeProgress(perfil({ city: "Braga" })).concluidos, 1);
    assert.equal(computeProgress(perfil({ services: [servico] })).concluidos, 1);
    assert.equal(computeProgress(perfil({ availabilities: [horario] })).concluidos, 1);
    assert.equal(computeProgress(perfil({ status: "active" })).concluidos, 1);
  });

  it("bio só com espaços não conta", () => {
    assert.equal(computeProgress(perfil({ bio: "   " })).concluidos, 0);
  });

  it("serviço desativado não conta como serviço", () => {
    const inativo = { ...servico, is_active: false };
    assert.equal(computeProgress(perfil({ services: [inativo] })).concluidos, 0);
  });
});
