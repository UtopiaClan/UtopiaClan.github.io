// Comportamento do site: abas, atualização, contagens regressivas, filtros e paginação.
(function () {
  const cfg = window.TAH_CONFIG || {};
  const R = window.TahRender, API = window.TahApi;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const ui = { mirrorsOpen: false, openBases: new Set(), raidOpen: false };
  const loaded = { members: 0, history: 0 };
  let clanName = cfg.CLAN_NAME || "";
  let lastDash = 0;

  /* ---------- status ---------- */
  const status = $("#apiStatus");
  function setStatus(msg) {
    status.textContent = msg || "";
    status.classList.toggle("hidden", !msg);
  }
  const fail = (e) => setStatus("Não foi possível falar com o bot agora (" + (e && e.message ? e.message : "erro") + "). Tentando de novo…");

  /* ---------- abas ---------- */
  const tabs = $$("[data-tab]"), panels = $$("[data-panel]");
  function show(name) {
    tabs.forEach((b) => { const on = b.dataset.tab === name; b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on); });
    panels.forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== name));
    if (name === "membros") loadMembers();
    if (name === "historico") loadHistory();
  }
  tabs.forEach((b) => b.addEventListener("click", () => {
    show(b.dataset.tab);
    try { history.replaceState(null, "", "#" + b.dataset.tab); } catch (e) { /* ignora */ }
    window.scrollTo(0, 0);
  }));

  /* ---------- copiar etiqueta ---------- */
  const copyBtn = $("#copyClanTag");
  copyBtn.addEventListener("click", () => {
    const tag = copyBtn.dataset.clanTag, old = copyBtn.textContent;
    const done = () => { copyBtn.textContent = "Copiado!"; copyBtn.classList.add("is-copied"); setTimeout(() => { copyBtn.textContent = old; copyBtn.classList.remove("is-copied"); }, 1500); };
    const legacy = () => { const a = document.createElement("textarea"); a.value = tag; a.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (e) { /* ignora */ } a.remove(); done(); };
    navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(tag).then(done, legacy) : legacy();
  });

  /* ---------- dashboard ---------- */
  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const p = (n) => String(n).padStart(2, "0");
    return (d ? d + "d " : "") + (d || h ? p(h) + "h " : "") + p(m) + "m " + p(x) + "s";
  }
  function tick() {
    let expired = false;
    $$("[data-countdown]").forEach((el) => {
      const left = Date.parse(el.dataset.countdown) - Date.now();
      el.textContent = (el.dataset.prefix || "") + (left > 0 ? fmt(left) : "agora");
      if (left <= 0) expired = true;
    });
    if (expired && Date.now() - lastDash > 10000) loadDashboard();
  }

  function applyClan(clan) {
    if (!clan) return;
    clanName = clan.name || clanName;
    const logo = $("#clanName"); if (logo) logo.textContent = clanName;
    if (clan.tag) { copyBtn.dataset.clanTag = clan.tag; if (!copyBtn.classList.contains("is-copied")) copyBtn.textContent = clan.tag; }
    document.title = clanName + " | Dashboard de Guerras";
  }

  async function loadDashboard() {
    lastDash = Date.now();
    try {
      const d = await API.dashboard();
      applyClan(d.clan);
      $("#dashboardRoot").innerHTML = R.dashboard(d, ui);
      setStatus(d.errors && d.errors.length ? "Alguns dados do jogo estão temporariamente indisponíveis (" + d.errors.join(", ") + ")." : "");
      tick();
    } catch (e) {
      fail(e);
      const root = $("#dashboardRoot");
      if (root.querySelector(".loading")) root.innerHTML = '<p class="loading">Sem conexão com o bot.</p>';
    }
  }

  /* ---------- membros ---------- */
  const search = $("#memberSearch"), roleFilter = $("#memberRoleFilter");
  function filterMembers() {
    const t = norm(search.value.trim()), r = roleFilter.value;
    let n = 0;
    $$("[data-member-row]").forEach((row) => {
      const ok = (!t || norm(row.dataset.memberName).includes(t)) && (!r || row.dataset.memberRole === r);
      row.classList.toggle("hidden", !ok);
      if (ok) n++;
    });
    $("#membersVisibleCount").textContent = n;
    $("#membersEmpty").classList.toggle("hidden", n > 0 || !$$("[data-member-row]").length);
  }
  search.addEventListener("input", filterMembers);
  roleFilter.addEventListener("change", filterMembers);

  async function loadMembers() {
    if (Date.now() - loaded.members < 60000) return;
    try {
      const d = await API.members();
      loaded.members = Date.now();
      $("#membersBody").innerHTML = d.members.map(R.memberRow).join("");
      $("#membersTotal").textContent = d.count;
      filterMembers();
      setStatus("");
    } catch (e) { fail(e); }
  }

  /* ---------- histórico + paginação ---------- */
  function paginate(list) {
    const size = +list.dataset.histPageSize || 10, pager = list.parentElement.querySelector("[data-hist-pager]");
    const items = Array.from(list.children).filter((e) => e.classList.contains("hist-item"));
    const pages = Math.ceil(items.length / size);
    let cur = 1;
    const mk = (label, page, active, disabled, aria) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "hist-page" + (active ? " is-active" : ""); b.textContent = label; b.disabled = !!disabled; b.setAttribute("aria-label", aria);
      b.addEventListener("click", () => { cur = page; draw(); });
      pager.appendChild(b);
    };
    function draw() {
      items.forEach((it, i) => it.classList.toggle("hidden", Math.floor(i / size) + 1 !== cur));
      pager.classList.toggle("hidden", pages < 2);
      pager.innerHTML = "";
      if (pages < 2) return;
      mk("‹", cur - 1, false, cur === 1, "Página anterior");
      for (let p = 1; p <= pages; p++) mk(p, p, p === cur, false, "Página " + p);
      mk("›", cur + 1, false, cur === pages, "Próxima página");
    }
    draw();
  }

  async function loadHistory() {
    if (Date.now() - loaded.history < 300000) return;
    try {
      const html = R.history(await API.history(), clanName);
      loaded.history = Date.now();
      Object.keys(html).forEach((k) => {
        const list = $('[data-hist-panel="' + k + '"] [data-hist-list]');
        list.innerHTML = html[k];
        paginate(list);
      });
      setStatus("");
    } catch (e) { fail(e); }
  }

  $$("[data-hist-tab]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-hist-tab]").forEach((x) => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-selected", on); });
    $$("[data-hist-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.histPanel !== b.dataset.histTab));
  }));

  async function openHistMirror(btn) {
    const row = btn.closest("[data-hist-row]"), box = $("[data-hist-detail]", row);
    if (box.dataset.loaded) return;
    box.textContent = "Carregando espelho…";
    try {
      const d = await API.mirror(btn.dataset.mirrorId);
      box.dataset.loaded = "1";
      box.innerHTML = d.available && d.mirror.length ? R.mirrorList(d.mirror, new Set(), false) : "Espelho desta guerra não disponível.";
    } catch (e) { box.textContent = "Não foi possível carregar o espelho."; }
  }

  /* ---------- cliques (delegação: o conteúdo é re-renderizado) ---------- */
  function toggle(btn, target) {
    const open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", open);
    target.classList.toggle("hidden", !open);
    return open;
  }

  document.addEventListener("click", (e) => {
    const t = e.target, hit = (s) => t.closest(s);
    let el;
    if ((el = hit("[data-acc-btn]"))) {
      const item = el.closest("[data-acc]");
      ui.raidOpen = toggle(el, $("[data-acc-body]", item));
      item.classList.toggle("is-open", ui.raidOpen);
    } else if ((el = hit("[data-mirrors-btn]"))) {
      ui.mirrorsOpen = toggle(el, $("[data-mirrors-body]"));
      $("[data-mirrors-label]", el).textContent = ui.mirrorsOpen ? "Ocultar" : "Detalhes";
    } else if ((el = hit("[data-mirror-btn]"))) {
      const item = el.closest("[data-mirror-item]"), open = toggle(el, $("[data-mirror-detail]", item));
      if (item.closest("[data-mirrors-body]")) open ? ui.openBases.add(+item.dataset.pos) : ui.openBases.delete(+item.dataset.pos);
    } else if ((el = hit("[data-lg-toggle]"))) {
      const table = $("[data-lg-table]"), extra = table.dataset.lgView === "attack";
      table.dataset.lgView = extra ? "extra" : "attack";
      el.setAttribute("aria-pressed", extra);
      $("[data-lg-toggle-label]").textContent = extra ? "Faltas / Bônus" : "Ligas / Guerras";
    } else if ((el = hit("[data-cwl-season-btn]"))) {
      toggle(el, $("[data-cwl-season-body]", el.closest("[data-cwl-season]")));
    } else if ((el = hit("[data-hist-expand]"))) {
      if (toggle(el, $("[data-hist-detail]", el.closest("[data-hist-row]")))) openHistMirror(el);
    }
    const tip = hit("[data-role-tip]");
    $$("[data-role-tip].is-open").forEach((x) => { if (x !== tip) x.classList.remove("is-open"); });
    if (tip) tip.classList.toggle("is-open");
  });

  /* ---------- início ---------- */
  const start = location.hash.slice(1);
  show(panels.some((p) => p.dataset.panel === start) ? start : "dashboard");
  loadDashboard();
  setInterval(loadDashboard, cfg.REFRESH_MS || 30000);
  setInterval(tick, 1000);
})();
