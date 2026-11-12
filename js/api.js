// Chamadas à API do bot (via túnel da Cloudflare). Só leitura.
(function () {
  const cfg = window.TAH_CONFIG || {};

  async function get(path, params, timeout) {
    if (!cfg.API_BASE || cfg.API_BASE.includes("SEU-DOMINIO")) {
      throw new Error("API_BASE não configurada em js/config.js");
    }
    const url = new URL(cfg.API_BASE.replace(/\/$/, "") + path);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout || 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // As rotas /api/v1/... respondem {ok, dados, erro, meta}: devolve só `dados`.
  async function v1(path, params, timeout) {
    const body = await get(path, params, timeout);
    if (!body || body.ok === false) {
      const e = body && body.erro;
      throw new Error(typeof e === "string" ? e : (e && (e.mensagem || e.codigo || e.message)) || "erro na API");
    }
    return body.dados;
  }

  window.TahApi = {
    health: () => get("/api/health"),
    dashboard: () => get("/api/dashboard"),
    members: () => get("/api/members"),
    history: () => get("/api/history"),
    mirror: (id) => get("/api/history/mirror", { id }),
    // Liga de todos os membros (semana atual). Consulta 1 jogador por membro: pode demorar.
    ranked: () => v1("/api/v1/ranqueada/atual", null, 30000),
    // Ranqueada de um jogador: semana atual (ataques/defesas) + última semana concluída.
    memberRanked: (tag) => v1("/api/v1/jogadores/" + encodeURIComponent(tag) + "/ranqueada", null, 20000),
    // Semanas já concluídas (mais recente primeiro) e o relatório de uma semana (todos os membros).
    rankedWeeks: () => v1("/api/v1/ranqueada/semanas", null, 30000),
    rankedWeek: (id) => v1("/api/v1/ranqueada/semanas/" + encodeURIComponent(id), null, 30000)
  };
})();
