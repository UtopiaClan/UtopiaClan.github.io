// Chamadas à API do bot (via túnel da Cloudflare). Só leitura.
(function () {
  const cfg = window.TAH_CONFIG || {};

  async function get(path, params) {
    if (!cfg.API_BASE || cfg.API_BASE.includes("SEU-DOMINIO")) {
      throw new Error("API_BASE não configurada em js/config.js");
    }
    const url = new URL(cfg.API_BASE.replace(/\/$/, "") + path);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  window.TahApi = {
    health: () => get("/api/health"),
    dashboard: () => get("/api/dashboard"),
    members: () => get("/api/members"),
    history: () => get("/api/history"),
    mirror: (id) => get("/api/history/mirror", { id })
  };
})();
