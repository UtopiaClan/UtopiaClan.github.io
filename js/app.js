// Comportamento do site: abas, atualização, contagens regressivas, filtros e paginação.
(function () {
  const cfg = window.TAH_CONFIG || {};
  const R = window.TahRender, API = window.TahApi;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const ui = { mirrorsOpen: false, openBases: new Set(), raidCard: false, membersView: "geral", membersSort: "default", raidOpen: new Set(), openMembers: new Set() };
  const memberCache = {}; // tag -> { at, data } (ranqueada de cada membro, nada é guardado no servidor)

  // Best de cada membro guardado no navegador (localStorage): aparece na hora ao abrir e só é buscado de novo quando
  // passa de BEST_TTL. Se o navegador bloquear o armazenamento, tudo continua funcionando, só sem esse atalho.
  const BEST_KEY = "utopia.best.v1", BEST_TTL = 6 * 3600 * 1000;
  const bestStore = (() => {
    try { const o = JSON.parse(localStorage.getItem(BEST_KEY) || "{}"); return o && typeof o === "object" ? o : {}; }
    catch (e) { return {}; }
  })();
  let bestSaveTimer = 0;
  function rememberBest(tag, best) {
    bestStore[tag] = { at: Date.now(), best: best || null };
    clearTimeout(bestSaveTimer);
    bestSaveTimer = setTimeout(() => {
      try {
        const keep = new Set((state.members || []).map((m) => m.tag)), out = {};
        Object.keys(bestStore).forEach((t) => { if (!keep.size || keep.has(t)) out[t] = bestStore[t]; });
        localStorage.setItem(BEST_KEY, JSON.stringify(out));
      } catch (e) { /* sem armazenamento: segue sem cache */ }
    }, 800);
  }
  const storedBest = (tag) => (bestStore[tag] && bestStore[tag].best) || null;
  const bestIsFresh = (tag) => !!bestStore[tag] && Date.now() - bestStore[tag].at < BEST_TTL;
  const pending = {};     // tag -> promessa em andamento (evita pedir a mesma ranqueada duas vezes)
  const state = { members: [], ranks: null }; // ranks: Map tag -> liga (vem de outra rota, chega depois)
  const loaded = { members: 0, ranks: 0, history: 0 };
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

  // Troca o escudo do cabeçalho pelo emblema do clã. Só entra depois de carregar; se falhar, fica o escudo.
  let badgeTried = "";
  function applyBadge(url) {
    const mark = $(".clan-badge-mark");
    if (!mark || !/^https:\/\//.test(url || "") || url === badgeTried) return;
    badgeTried = url;
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.onload = () => { mark.replaceChildren(img); mark.classList.add("has-img"); };
    img.src = url;
  }

  function applyClan(clan) {
    if (!clan) return;
    applyBadge(clan.badge_url);
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
  const search = $("#memberSearch"), roleFilter = $("#memberRoleFilter"), cvFilter = $("#memberCvFilter"), sortSel = $("#memberSort");
  // A linha de detalhes só aparece se o membro está visível no filtro E aberto.
  function syncDetail(row, visible) {
    const d = row.nextElementSibling;
    if (d && d.hasAttribute("data-member-detail-row")) d.classList.toggle("hidden", !(visible && row.dataset.open === "1"));
  }

  function filterMembers() {
    const t = norm(search.value.trim()), r = roleFilter.value, cv = cvFilter.value;
    let n = 0;
    $$("[data-member-row]").forEach((row) => {
      const ok = (!t || norm(row.dataset.memberName).includes(t)) && (!r || row.dataset.memberRole === r) && (!cv || row.dataset.memberCv === cv);
      row.classList.toggle("hidden", !ok);
      syncDetail(row, ok);
      if (ok) n++;
    });
    $("#membersVisibleCount").textContent = n;
    $("#membersEmpty").classList.toggle("hidden", n > 0 || !$$("[data-member-row]").length);
  }
  search.addEventListener("input", filterMembers);
  roleFilter.addEventListener("change", filterMembers);
  cvFilter.addEventListener("change", filterMembers);

  // Ordenação: cada visão tem as suas opções. Quem não tem o dado (ex.: sem guerra) vai para o fim.
  const ratio = (s) => (s && s.total ? s.played / s.total : null);
  const starsSum = (s) => (s && s.stars && s.stars.some(Boolean) ? s.avg : null);
  const att = (view) => (m) => (view === "cwl" ? m.cwl : m.war);
  const COMMON = [
    ["default", "Rank (padrão)", null, -1, "liga e troféus"],
    ["name", "Nome (A–Z)", (m) => m.name.toLocaleLowerCase("pt-BR"), 1, "nome"],
    ["cv", "CV (maior)", (m) => m.town_hall, -1, "CV, do maior ao menor"],
    ["cvAsc", "CV (menor)", (m) => m.town_hall, 1, "CV, do menor ao maior"],
    ["since", "Desde (mais antigo)", (m) => (m.since ? Date.parse(m.since) : null), 1, "entrada, do mais antigo"],
    ["sinceDesc", "Desde (mais recente)", (m) => (m.since ? Date.parse(m.since) : null), -1, "entrada, do mais recente"],
  ];
  function sortOptions(view) {
    if (view === "geral") return [...COMMON,
      ["best", "Best (maior liga)", (m) => (m.best && m.best.tier ? m.best.tier.rank : null), -1, "melhor liga"]];
    if (view === "raid") return [COMMON[0], COMMON[1],
      ["part", "Participação (maior)", (m) => ratio(m.raids), -1, "participação em raids"],
      ["partAsc", "Participação (menor)", (m) => ratio(m.raids), 1, "participação em raids, da menor"],
      ["loot", "Melhor saque (maior)", (m) => m.raids.best_loot || null, -1, "melhor saque de raid"]];
    const s = att(view);
    return [COMMON[0], COMMON[1],
      ["part", "Participação (maior)", (m) => ratio(s(m)), -1, "participação"],
      ["partAsc", "Participação (menor)", (m) => ratio(s(m)), 1, "participação, da menor"],
      ["avg", "Média (maior)", (m) => starsSum(s(m)), -1, "média de estrelas, da maior"],
      ["avgAsc", "Média (menor)", (m) => starsSum(s(m)), 1, "média de estrelas, da menor"],
      ["three", "⭐⭐⭐ (mais)", (m) => (s(m).stars ? s(m).stars[0] : null), -1, "mais 3 estrelas"],
      ["missed", "Faltas (maior)", (m) => s(m).missed, -1, "faltas, da maior"],
      ["missedAsc", "Faltas (menor)", (m) => s(m).missed, 1, "faltas, da menor"],
      ["bonus", "Bônus (maior)", (m) => s(m).bonus, -1, "bônus, do maior"]];
  }
  function buildSortSelect() {
    const opts = sortOptions(ui.membersView);
    if (!opts.some((o) => o[0] === ui.membersSort)) ui.membersSort = "default";
    sortSel.innerHTML = opts.map((o) => `<option value="${o[0]}">${o[1]}</option>`).join("");
    sortSel.value = ui.membersSort;
    $("#membersSortText").textContent = opts.find((o) => o[0] === ui.membersSort)[4];
  }
  sortSel.addEventListener("change", () => { ui.membersSort = sortSel.value; buildSortSelect(); renderMembers(); });
  function buildCvFilter() {
    const keep = cvFilter.value, cvs = [...new Set(state.members.map((m) => m.town_hall).filter(Boolean))].sort((a, b) => b - a);
    cvFilter.innerHTML = '<option value="">Todos os CV</option>' + cvs.map((v) => `<option value="${v}">CV ${v}</option>`).join("");
    cvFilter.value = cvs.map(String).includes(keep) ? keep : "";
  }

  // Liga de um jogador na rota /ranqueada/atual. `trophies` só vem se a API informar.
  function rankOf(p) {
    const t = p && p.current_tier;
    if (!t) return null;
    const tro = p.trophies != null ? p.trophies : p.league_trophies;
    return { tier: t.rank, label: t.label, short: t.short, icon: t.emoji_name, trophies: tro == null ? null : tro, best: p.best || null, last: p.last || null };
  }

  // Padrão: liga mais alta primeiro e, na mesma liga, mais troféus. Sem a liga, mantém a ordem da API.
  function orderedMembers() {
    const ranks = state.ranks;
    // Best/Last vêm da lista da ranqueada; sem isso, entram (aos poucos) quando o membro é expandido.
    const list = state.members.map((m) => {
      const r = ranks ? ranks.get(m.tag) || null : null, c = memberCache[m.tag] && memberCache[m.tag].data;
      return { ...m, rank: r, best: (r && r.best) || (c && c.best) || storedBest(m.tag) };
    });
    const tier = (m) => (m.rank ? m.rank.tier : -1), tro = (m) => (m.rank && m.rank.trophies != null ? m.rank.trophies : -1);
    if (ranks) list.sort((a, b) => tier(b) - tier(a) || tro(b) - tro(a)); // padrão: liga e troféus (sort é estável)
    const opt = sortOptions(ui.membersView).find((o) => o[0] === ui.membersSort);
    if (!opt || !opt[2]) return list;
    const [, , val, dir] = opt;
    return list.sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }

  function renderMembers() {
    buildCvFilter(); buildSortSelect();
    $("#membersHead").innerHTML = R.membersHead(ui.membersView);
    $("#membersBody").innerHTML = orderedMembers().map((m) => R.memberRow(m, ui.membersView)).join("");
    $("#membersTotal").textContent = state.members.length;
    $$("[data-member-row]").forEach((row) => { // reabre quem estava aberto antes da atualização
      const btn = $("[data-member-toggle]", row);
      if (!btn || !ui.openMembers.has(row.dataset.memberTag)) return; // só o Geral tem detalhe
      row.dataset.open = "1";
      btn.setAttribute("aria-expanded", "true");
      loadMemberDetail(row);
    });
    filterMembers();
  }

  async function loadRanks() {
    if (Date.now() - loaded.ranks < 60000) return;
    loaded.ranks = Date.now();
    try {
      const d = await API.ranked(), map = new Map();
      (d.players || []).forEach((p) => { const r = rankOf(p); if (r) map.set(p.tag, r); });
      state.ranks = map;
      renderMembers();
    } catch (e) { loaded.ranks = 0; /* a lista segue sem a coluna de rank e tenta de novo na próxima visita */ }
    loadStandings();
  }

  // Best/Last de todos os membros, sem precisar expandir: o que a lista da ranqueada não trouxer vem da rota de cada
  // jogador, aos poucos (3 por vez) e em segundo plano. Cada linha é atualizada no lugar quando o dado chega.
  const STANDINGS_PARALLEL = 3;
  let standingsRun = false;
  const hasStanding = (tag) => { const r = state.ranks && state.ranks.get(tag); return !!(memberCache[tag] || (r && r.best) || bestIsFresh(tag)); };
  function fillStanding(tag) {
    if (ui.membersView !== "geral") return;
    const row = $('[data-member-row][data-member-tag="' + tag + '"]'), c = memberCache[tag] && memberCache[tag].data;
    if (!row || !c) return;
    const td = $('[data-st="best"]', row);
    if (td) td.outerHTML = R.standingCell(c.best, "best");
  }
  function loadStandings() {
    if (standingsRun) return;
    const queue = state.members.map((m) => m.tag).filter((t) => !hasStanding(t));
    if (!queue.length) return;
    standingsRun = true;
    let active = 0;
    const next = () => {
      if (!queue.length) {
        if (!active) { standingsRun = false; if (ui.membersSort === "best") renderMembers(); }
        return;
      }
      const tag = queue.shift();
      active++;
      fetchDetail(tag).then(() => fillStanding(tag), () => {}).finally(() => { active--; next(); });
    };
    for (let i = 0; i < STANDINGS_PARALLEL; i++) next();
  }

  async function loadMembers() {
    if (Date.now() - loaded.members < 60000) return;
    try {
      const d = await API.members();
      loaded.members = Date.now();
      state.members = d.members;
      renderMembers();
      setStatus("");
      loadRanks(); // não espera: a lista aparece já e a liga entra quando chegar
    } catch (e) { fail(e); }
  }

  const detailBox = (tag) => { const row = $('[data-member-row][data-member-tag="' + tag + '"]'); return row && $("[data-member-detail]", row.nextElementSibling); };
  const fetchDetail = (tag) => (pending[tag] = pending[tag] || API.memberRanked(tag)
    .then((data) => { memberCache[tag] = { at: Date.now(), data }; rememberBest(tag, data && data.best); return data; })
    .finally(() => { delete pending[tag]; }));

  // Relatório da semana anterior (todos os membros de uma vez): carrega uma vez e vale por 10 min.
  const prevWeek = { at: 0, season: null, map: null, promise: null };
  function fetchPrevWeek() {
    if (prevWeek.map && Date.now() - prevWeek.at < 600000) return Promise.resolve();
    if (prevWeek.promise) return prevWeek.promise;
    prevWeek.promise = (async () => {
      const id = ((await API.rankedWeeks()).semanas || [])[0];
      if (!id) throw new Error("sem semanas");
      const rep = await API.rankedWeek(id), map = new Map();
      ["promoted", "stayed", "demoted", "inactive"].forEach((cat) => (rep[cat] || []).forEach((p) => map.set(p.tag, { p, cat })));
      prevWeek.map = map; prevWeek.season = rep.season_id || id; prevWeek.at = Date.now();
    })().finally(() => { prevWeek.promise = null; });
    return prevWeek.promise;
  }
  const prevFor = (tag) => (prevWeek.map ? { found: prevWeek.map.get(tag) || null, season: prevWeek.season } : null);

  async function loadMemberDetail(row) {
    const tag = row.dataset.memberTag, cached = memberCache[tag];
    const draw = () => { const box = detailBox(tag), c = memberCache[tag]; if (box && c) box.innerHTML = R.rankDetail(c.data, prevFor(tag), !prevWeek.map && !!prevWeek.promise); };
    const box0 = detailBox(tag);
    if (!box0) return;
    if (cached) draw(); else box0.innerHTML = '<p class="rk-loading">Carregando ranqueada…</p>';
    fetchPrevWeek().then(draw, draw); // sem o relatório, a semana anterior mostra só o resumo
    if (cached && Date.now() - cached.at < 60000) return;
    try {
      await fetchDetail(tag);
      draw();
    } catch (e) {
      const box = detailBox(tag);
      if (box && !cached) box.innerHTML = '<p class="rk-loading">Não foi possível carregar a ranqueada agora. Feche e abra de novo para tentar outra vez.</p>';
    }
  }

  /* ---------- histórico + paginação ---------- */
  const PAGE_WINDOW = 9; // no máximo 9 números; com mais páginas o 10º botão é o "…" (escolher a página)
  function paginate(list) {
    const size = +list.dataset.histPageSize || 10, pager = list.parentElement.querySelector("[data-hist-pager]");
    const items = Array.from(list.children).filter((e) => e.classList.contains("hist-item"));
    const pages = Math.ceil(items.length / size);
    let cur = 1;
    const go = (page) => { cur = Math.min(pages, Math.max(1, page)); draw(); };
    const mk = (label, page, active, disabled, aria) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "hist-page" + (active ? " is-active" : ""); b.textContent = label; b.disabled = !!disabled; b.setAttribute("aria-label", aria);
      if (active) b.setAttribute("aria-current", "page");
      b.addEventListener("click", () => go(page));
      return b;
    };
    function jumpPicker() {
      const box = document.createElement("div");
      box.className = "hist-jump"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Escolher página");
      box.innerHTML = '<p class="hist-jump-title">Ir para a página</p><div class="hist-jump-grid"></div>';
      const grid = $(".hist-jump-grid", box);
      for (let p = 1; p <= pages; p++) grid.appendChild(mk(p, p, p === cur, false, "Ir para a página " + p));
      return box;
    }
    function draw() {
      items.forEach((it, i) => it.classList.toggle("hidden", Math.floor(i / size) + 1 !== cur));
      pager.classList.toggle("hidden", pages < 2);
      pager.innerHTML = "";
      if (pages < 2) return;
      pager.appendChild(mk("‹", cur - 1, false, cur === 1, "Página anterior"));
      const start = pages > PAGE_WINDOW ? Math.min(Math.max(1, cur - Math.floor(PAGE_WINDOW / 2)), pages - PAGE_WINDOW + 1) : 1;
      const end = pages > PAGE_WINDOW ? start + PAGE_WINDOW - 1 : pages;
      for (let p = start; p <= end; p++) pager.appendChild(mk(p, p, p === cur, false, "Página " + p));
      if (pages > PAGE_WINDOW) {
        const more = document.createElement("button");
        more.type = "button"; more.className = "hist-page hist-jump-toggle"; more.textContent = "…"; more.setAttribute("data-hist-jump", "");
        more.setAttribute("aria-label", "Escolher uma página"); more.setAttribute("aria-haspopup", "dialog"); more.setAttribute("aria-expanded", "false");
        more.addEventListener("click", (e) => {
          e.stopPropagation();
          const open = $(".hist-jump", pager);
          if (open) { open.remove(); more.setAttribute("aria-expanded", "false"); return; }
          pager.appendChild(jumpPicker()); more.setAttribute("aria-expanded", "true");
        });
        pager.appendChild(more);
      }
      pager.appendChild(mk("›", cur + 1, false, cur === pages, "Próxima página"));
    }
    draw();
  }

  // Fecha o seletor de páginas ao clicar fora ou apertar Esc.
  const closeJumps = () => $$(".hist-jump").forEach((x) => { const t = x.parentElement.querySelector("[data-hist-jump]"); if (t) t.setAttribute("aria-expanded", "false"); x.remove(); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".hist-jump")) closeJumps(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeJumps(); });

  // Ícone de liga que não carrega: tenta o próximo endereço (local) e, por fim, só esconde a imagem.
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("rank-icon")) return;
    const rest = (img.dataset.fb || "").split(" ").filter(Boolean);
    if (!rest.length) { img.classList.add("is-broken"); const cell = img.closest(".rank-cell"); if (cell) cell.classList.add("no-icon"); return; }
    img.dataset.fb = rest.slice(1).join(" ");
    img.src = rest[0];
  }, true);

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
    if ((el = hit("[data-raid-btn]"))) {
      const key = el.dataset.raidBtn;
      toggle(el, $('[data-raid-body="' + key + '"]', el.closest("[data-raid]"))) ? ui.raidOpen.add(key) : ui.raidOpen.delete(key);
    } else if ((el = hit("[data-acc-btn]"))) {
      const item = el.closest("[data-acc]");
      ui.raidCard = toggle(el, $("[data-acc-body]", item));
      item.classList.toggle("is-open", ui.raidCard);
    } else if ((el = hit("[data-mirrors-btn]"))) {
      ui.mirrorsOpen = toggle(el, $("[data-mirrors-body]"));
      $("[data-mirrors-label]", el).textContent = ui.mirrorsOpen ? "Ocultar" : "Detalhes";
    } else if ((el = hit("[data-mirror-btn]"))) {
      const item = el.closest("[data-mirror-item]"), open = toggle(el, $("[data-mirror-detail]", item));
      if (item.closest("[data-mirrors-body]")) open ? ui.openBases.add(+item.dataset.pos) : ui.openBases.delete(+item.dataset.pos);
    } else if ((el = hit("[data-mview]"))) {
      ui.membersView = el.dataset.mview;
      $("#membersTable").dataset.view = ui.membersView;
      $$("[data-mview]").forEach((b) => { const on = b === el; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
      renderMembers();
    } else if ((el = hit("[data-member-toggle]"))) {
      const row = el.closest("[data-member-row]"), tag = row.dataset.memberTag, open = el.getAttribute("aria-expanded") !== "true";
      el.setAttribute("aria-expanded", open);
      row.dataset.open = open ? "1" : "0";
      open ? ui.openMembers.add(tag) : ui.openMembers.delete(tag);
      syncDetail(row, true);
      if (open) loadMemberDetail(row);
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
