// Monta o HTML de cada seção a partir do JSON da API (mesmas classes do layout original).
(function () {
  const ROLES = {
    leader: { label: "Líder", icon: "crown" },
    coLeader: { label: "Co-líder", icon: "shield-halved" },
    admin: { label: "Ancião", icon: "gem" },
    elder: { label: "Ancião", icon: "gem" },
    member: { label: "Membro", icon: "user" }
  };
  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (name, cls) => `<svg class="ic${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const p2 = (n) => String(n ?? 0).padStart(2, "0");
  const pct = (n) => (n == null ? "—" : Number(n).toFixed(1).replace(".", ",") + "%");
  const fdate = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
  const fday = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—");
  const fdateTime = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
  const seasonLabel = (key) => { const [y, m] = key.split("-"); return `CWL ${MONTHS[+m - 1]} ${y}`; };
  const stars = (n, cls) => [1, 2, 3].map((i) => ic("star", i <= n ? "" : "is-empty")).join("");
  const starsWrap = (n, cls) => `<span class="${cls}">${stars(n)}</span>`;

  /* ---------- Dashboard ---------- */

  function side(name, s, enemy) {
    const e = enemy ? "-enemy" : "";
    return `<div class="war-team${enemy ? " war-team-enemy" : ""}">
      <span class="war-team-name">${enemy ? "💀 " : "💫 "}${esc(name)}</span>
      <span class="war-score${enemy ? " war-score-enemy" : ""}">${ic("star")} ${s.stars ?? "—"}</span>
      <span class="war-bar"><span class="war-bar-fill${enemy ? " war-bar-fill-enemy" : ""}" style="width:${Math.min(100, s.destruction || 0)}%"></span></span>
      <span class="war-team-sub">💥 ${pct(s.destruction)} · ⚔️ ${s.attacks_used ?? "—"}/${s.attacks_total ?? "—"}</span>
    </div>`;
  }

  function attackList(side, isEnemy) {
    const attacks = side?.attacks;
    if (!Array.isArray(attacks)) return `<li class="esp-attack"><span class="esp-attack-target">—</span><span>Dados indisponíveis</span></li>`;
    if (!attacks.length) return `<li class="esp-attack"><span class="esp-attack-target">—</span><span>Sem ataques</span></li>`;
    return attacks.map((a) => `<li class="esp-attack${isEnemy ? " is-enemy" : ""}">
      <span class="esp-attack-target">#${a.target_position ?? "?"}</span><span>${esc(a.target_name ?? "—")}</span>
      <span class="esp-attack-stars">${stars(a.stars)}</span><span class="esp-attack-result">- ${Math.round(a.destruction)}%</span></li>`).join("");
  }

  function mirrorItem(item, open, showLeft) {
    const o = item.ours || {}, e = item.enemy || {};
    const left = (s) => (showLeft && s.attacks_left > 0 ? `<span class="esp-left">${s.attacks_left} Atk</span>` : "");
    const cv = (s) => (s.town_hall ? "CV" + s.town_hall : "CV—");
    return `<li class="esp-item" data-mirror-item data-pos="${item.position}">
      <div class="esp-main"><div class="esp-info">
        <div class="esp-line">
          <div class="esp-side"><span class="esp-rank">#${item.position}</span><span class="esp-name">${esc(o.name ?? "—")}</span></div>
          <div class="esp-side esp-side-enemy"><span class="esp-name">${esc(e.name ?? "—")}</span><span class="esp-rank">#${item.position}</span></div>
        </div>
        <div class="esp-line esp-line-sub">
          <div class="esp-side">${starsWrap(o.stars || 0, "esp-stars")}${left(o)}</div>
          <span class="esp-th" title="Centro de vila: nosso x inimigo"><b>${cv(o)}</b><i>vs</i><b class="is-enemy">${cv(e)}</b></span>
          <div class="esp-side esp-side-enemy">${left(e)}${starsWrap(e.stars || 0, "esp-stars esp-stars-enemy")}</div>
        </div>
      </div>
      <button type="button" class="esp-toggle" data-mirror-btn aria-expanded="${open}" aria-label="Ver ataques da posição ${item.position}">${ic("chevron-down")}</button></div>
      <div class="esp-detail${open ? "" : " hidden"}" data-mirror-detail><div class="esp-detail-cols">
        <div class="esp-detail-col"><p class="esp-detail-title">#${item.position} · ${esc(o.name ?? "—")}</p><ul class="esp-attack-list">${attackList(o, false)}</ul></div>
        <div class="esp-detail-col esp-detail-col-enemy"><p class="esp-detail-title">#${item.position} · ${esc(e.name ?? "—")}</p><ul class="esp-attack-list">${attackList(e, true)}</ul></div>
      </div></div></li>`;
  }

  function mirrorList(items, openBases, showLeft) {
    return `<ul class="esp-list">${items.map((i) => mirrorItem(i, openBases.has(i.position), showLeft)).join("")}</ul>`;
  }

  const WAR_RESULT = { won: ["Vitória", "is-won"], lost: ["Derrota", "is-lost"], tie: ["Empate", "is-tie"] };

  function warCard(war, ui) {
    if (!war) {
      return `<div class="acc-item"><div class="acc-btn acc-btn-static"><span class="acc-title">${ic("shield-halved")} Guerra</span><span class="acc-meta">Sem guerra no momento</span></div></div>`;
    }
    const prep = war.state === "preparation", ended = war.state === "ended";
    const target = prep ? war.start_time : war.end_time;
    const meta = (war.type === "cwl" ? `CWL ${war.round ?? "—"}/${war.total_rounds ?? "—"}` : "Guerra normal") + (prep ? " · Preparação" : ended ? " · Finalizada" : "");
    const [resultText, resultCls] = WAR_RESULT[war.result] || ["Finalizada", "is-tie"];
    const timer = ended
      ? `<div class="war-timer war-timer-ended"><span class="war-timer-label">Resultado</span>
          <span class="war-timer-value war-result ${resultCls}">${resultText}</span><span class="war-timer-note">Terminou em ${fdateTime(war.end_time) || "—"}</span></div>`
      : `<div class="war-timer"><span class="war-timer-label">${prep ? "Começa em" : "Termina em"}</span>
          <span class="war-timer-value" data-countdown="${esc(target)}">--</span><span class="war-timer-note">${fdateTime(target)}</span></div>`;
    const mirrors = Array.isArray(war.mirror) && war.mirror.length
      ? `<button type="button" class="mirrors-toggle" data-mirrors-btn aria-expanded="${ui.mirrorsOpen}"><span data-mirrors-label>${ui.mirrorsOpen ? "Ocultar" : "Detalhes"}</span>${ic("chevron-down", "mirrors-toggle-chevron")}</button>
        <div class="${ui.mirrorsOpen ? "" : "hidden"}" data-mirrors-body>${mirrorList(war.mirror, ui.openBases, !ended)}</div>`
      : "";
    return `<div class="acc-item is-open">
      <div class="acc-btn acc-btn-static"><span class="acc-title">${ic("shield-halved")} Guerra</span><span class="acc-meta">${ic("trophy")} ${meta}</span></div>
      <div class="acc-body-content">
        <div class="war-board">${side(war.ours.name, war.ours, false)}
          <div class="war-center"><span class="war-vs">VS</span><span class="war-size">${war.team_size ?? "—"} vs ${war.team_size ?? "—"}</span></div>
          ${side(war.enemy.name, war.enemy, true)}</div>
        ${timer}
        ${mirrors}
      </div></div>`;
  }

  // Dados de um raid: totais, ranking de saque e quem não atacou. Só aparece se a API mandar `members`.
  function raidDetails(raid) {
    const members = Array.isArray(raid.members) ? raid.members : [];
    if (!members.length) return "";
    const withLoot = members.some((m) => m.loot != null);
    const played = members.filter((m) => m.attacks_used > 0)
      .sort((a, b) => (b.loot || 0) - (a.loot || 0) || b.attacks_used - a.attacks_used || String(a.name).localeCompare(String(b.name)));
    const idle = members.filter((m) => !(m.attacks_used > 0));
    const used = raid.attacks_used || 0, total = raid.attacks_total || 0;
    const medal = ["🥇", "🥈", "🥉"];
    const row = (m, i) => {
      const done = m.attacks_total > 0 && m.attacks_used >= m.attacks_total;
      const pos = withLoot && i < 3 && m.loot > 0 ? medal[i] : i + 1;
      return `<li class="rd-row${done ? " is-done" : ""}"><span class="rd-pos">${pos}</span>
        <span class="rd-main"><span class="rd-name">${esc(m.name)}</span></span>
        <span class="rd-atk">${m.attacks_used}/${m.attacks_total}</span>${withLoot ? `<span class="rd-loot">${nf(m.loot || 0)}</span>` : ""}</li>`;
    };
    const period = raid.start_time && raid.end_time ? `<p class="rd-period">${fday(raid.start_time)} a ${fday(raid.end_time)}</p>` : "";
    return `${period}<div class="rd-sum">
        ${withLoot ? `<div class="rd-stat"><span class="rd-stat-label">💰 Saque</span><span class="rd-stat-value">${nf(raid.total_loot || 0)}</span></div>` : ""}
        <div class="rd-stat"><span class="rd-stat-label">⚔️ Ataques</span><span class="rd-stat-value">${used}/${total}</span></div>
        <div class="rd-stat"><span class="rd-stat-label">👥 Atacaram</span><span class="rd-stat-value">${played.length}/${members.length}</span></div>
      </div>
      ${played.length ? `<p class="rd-title">${withLoot ? "Ranking de saque" : "Quem atacou"}</p><ul class="rd-list">${played.map(row).join("")}</ul>` : ""}
      ${idle.length ? `<p class="rd-title">Sem ataques · ${idle.length}</p><div class="rd-chips">${idle.map((m) => `<span class="rd-chip">${esc(m.name)}</span>`).join("")}</div>` : ""}`;
  }

  // Raid: cronômetro e botões que abrem os dados. Em andamento, `raid.last` (se vier) é o último raid encerrado.
  function raidCard(raid, ui) {
    if (!raid) return `<div class="acc-item"><div class="acc-btn acc-btn-static"><span class="acc-title">${ic("dungeon")} Raid</span><span class="acc-meta">indisponível</span></div></div>`;
    const on = raid.state === "ongoing";
    const target = on ? raid.end_time : raid.next_start_time;
    const blocks = [];
    if (on) blocks.push({ key: "now", label: "Raid em andamento", html: raidDetails(raid) });
    const last = on ? raid.last : raid;
    if (last) blocks.push({ key: "last", label: "Último raid", html: raidDetails(last) });
    const buttons = blocks.filter((b) => b.html).map((b) => {
      const open = ui.raidOpen.has(b.key);
      return `<button type="button" class="mirrors-toggle" data-raid-btn="${b.key}" aria-expanded="${open}"><span>${b.label}</span>${ic("chevron-down", "mirrors-toggle-chevron")}</button>
        <div class="rd-body${open ? "" : " hidden"}" data-raid-body="${b.key}">${b.html}</div>`;
    }).join("");
    return `<div class="acc-item${ui.raidCard ? " is-open" : ""}" data-acc data-raid>
      <button type="button" class="acc-btn" data-acc-btn aria-expanded="${ui.raidCard}">
        <span class="acc-title">${ic("dungeon")} Raid</span>
        <span class="acc-meta">${ic("clock")} <span data-countdown="${esc(target)}">--</span>${ic("chevron-down", "acc-chevron")}</span></button>
      <div class="acc-body-content${ui.raidCard ? "" : " hidden"}" data-acc-body>
        <div class="highlight"><span class="hl-label">${on ? "Termina em" : "Início em"}</span>
          <span class="hl-value" data-countdown="${esc(target)}">--</span><span class="hl-note">${fdateTime(target)}</span></div>
        ${buttons}</div></div>`;
  }

  function gamesCard(g) {
    const target = g.active ? g.end_time : g.start_time;
    return `<div class="acc-item"><div class="acc-btn acc-btn-static"><span class="acc-title">${ic("gamepad")} Jogos do Clã</span>
      <span class="acc-meta">${ic("clock")} <span data-countdown="${esc(target)}" data-prefix="${g.active ? "Termina em " : "Começa em "}">--</span></span></div></div>`;
  }

  function dashboard(d, ui) {
    return warCard(d.war, ui) + raidCard(d.raid, ui) + gamesCard(d.clan_games);
  }

  /* ---------- Membros ---------- */

  const pair = (x) => `${p2(x.played)}/${p2(x.total)}`;
  const starRow = (list) => list.map(p2).join("/");
  const lgRow = (parts) => `<div class="lg-row">${parts.map(([e, v]) => `<span class="lg-part"><span class="lg-emoji">${e}</span>${v}</span>`).join('<span class="lg-dot">·</span>')}</div>`;

  /* ---------- Rank (liga) ---------- */

  // Ícone da liga: assets/leagues/<icon>.png (ou .webp), onde <icon> é o `emoji_name` da API
  // (ex.: Electro_Dragon_League, Legend_League_III). Sem arquivo, aparece só o texto. Ver app.js (erro de imagem).
  function rankIcon(tier) {
    if (!tier || !tier.icon) return "";
    const srcs = [tier.icon_url, `assets/leagues/${tier.icon}.png`, `assets/leagues/${tier.icon}.webp`].filter(Boolean);
    return `<img class="rank-icon" src="${esc(srcs[0])}" data-fb="${esc(srcs.slice(1).join(" "))}" alt="${esc(tier.label)}" title="${esc(tier.label)}" width="32" height="32">`;
  }
  const nf = (n) => (n == null ? "—" : Number(n).toLocaleString("pt-BR"));

  // `rank`: { tier (0–36), label, short, icon, trophies|null } — montado em app.js a partir da API.
  function rankCell(rank) {
    if (!rank) return `<span class="join-date">—</span>`;
    const trophy = rank.trophies == null ? "" : `🏆 ${nf(rank.trophies)}`;
    return `<div class="rank-cell">${rankIcon(rank)}<span class="rank-text"><span class="rank-num"><span class="rank-short">${esc(rank.short)}</span><span class="rank-label">${esc(rank.label)}</span></span><span class="rank-trophy">${trophy}</span></span></div>`;
  }

  // Melhor raid do membro: o fim de semana com mais saque (todos os ataques somados).
  function raidBest(raids) {
    if (!raids || !raids.best_loot) return "";
    return `<span class="raid-best" title="Melhor saque de um fim de semana de raid"><span class="lg-emoji">💰</span>${nf(raids.best_loot)}</span>`;
  }

  function memberRow(m) {
    const role = ROLES[m.role] || ROLES.member;
    return `<tr data-member-row data-member-tag="${esc(m.tag)}" data-member-name="${esc(m.name)}" data-member-role="${role.label}">
      <td><div class="member-cell"><span class="member-avatar" data-role-tip data-role="${role.label}" tabindex="0" role="button" aria-label="Cargo: ${role.label}">${ic(role.icon)}<span class="role-tip" role="tooltip">${role.label}</span></span><span class="member-name">${esc(m.name)}</span></div></td>
      <td class="cell-center">${rankCell(m.rank)}</td>
      <td class="cell-center"><span class="target-chip">${m.town_hall ? "CV " + m.town_hall : "—"}</span></td>
      <td class="cell-center"><span class="join-date">${fdate(m.since)}</span></td>
      <td class="cell-center"><div class="lg-cell">${lgRow([["🏆", pair(m.cwl)], ["⭐", starRow(m.cwl.stars)], ["🌟", m.cwl.avg.toFixed(1)]])}${lgRow([["⚔️", pair(m.war)], ["⭐", starRow(m.war.stars)], ["🌟", m.war.avg.toFixed(1)]])}</div></td>
      <td class="cell-center"><div class="lg-cell">${lgRow([["❌", p2(m.cwl.missed)], ["🪎", p2(m.cwl.bonus)]])}${lgRow([["❌", p2(m.war.missed)], ["🪎", p2(m.war.bonus)]])}</div></td>
      <td class="cell-center"><div class="raids-cell"><span class="raid-chip"><span class="lg-emoji">🛡️</span>${p2(m.raids.played)}/${p2(m.raids.total)}</span>${raidBest(m.raids)}</div></td>
      <td class="cell-toggle"><button type="button" class="hist-expand" data-member-toggle aria-expanded="false" aria-label="Ver ranqueada de ${esc(m.name)}">${ic("chevron-down")}</button></td></tr>
    <tr class="member-detail hidden" data-member-detail-row><td colspan="8"><div class="rk-wrap" data-member-detail></div></td></tr>`;
  }

  /* ---------- Ranqueada do membro (semana atual e anterior) ---------- */

  const pad3 = (n) => (n == null ? "---" : String(n).padStart(3, "0"));
  const signed = (n, neg) => `${neg ? "-" : "+"}${String(Math.abs(Math.round(n))).padStart(2, "0")}`;
  const avgTrophies = (v, neg) => (v == null ? "—" : `${neg || v < 0 ? "-" : "+"}${String(Math.abs(Math.round(v))).padStart(2, "0")}`);

  // Datas da CoC vêm como 20261109T120000.000Z.
  function cocDate(v) {
    if (!v) return null;
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/.exec(String(v));
    const t = Date.parse(m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : v);
    return Number.isNaN(t) ? null : t;
  }

  function ageText(v) {
    const t = cocDate(v);
    if (t == null) return "—";
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 3600) return String(Math.max(1, Math.floor(s / 60))).padStart(2, "0") + "m";
    if (s < 86400) return String(Math.floor(s / 3600)).padStart(2, "0") + "h";
    return String(Math.floor(s / 86400)).padStart(2, "0") + "d";
  }

  // Segunda a domingo da semana da ranqueada (calendário de São Paulo, como no !ficha do bot).
  // `season`: id da semana na CoC (segundos); sem ele, usa a semana de hoje + `offsetWeeks`.
  function weekLabel(offsetWeeks, season) {
    const secs = /^\d{10}$/.test(String(season || "")) ? Number(season) : null;
    const ref = secs ? new Date(secs * 1000) : new Date();
    const ymdSp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(ref);
    const [y, m, d] = ymdSp.split("-").map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7) + (secs ? 0 : offsetWeeks) * 7);
    const end = new Date(base); end.setUTCDate(end.getUTCDate() + 6);
    const f = (x) => `${String(x.getUTCDate()).padStart(2, "0")} ${MONTHS[x.getUTCMonth()]}`;
    return `${f(base)} - ${f(end)}`;
  }

  // Cortes de promoção/rebaixamento (mesma tabela do bot, em % do grupo).
  const PROMO = { 1: 50, 2: 50, 3: 50, 4: 50, 5: 50, 6: 50, 7: 50, 8: 50, 9: 40, 10: 35, 11: 50, 12: 40, 13: 35, 14: 50, 15: 40, 16: 35, 17: 50, 18: 40, 19: 35, 20: 50, 21: 40, 22: 30, 23: 50, 24: 40, 25: 30, 26: 50, 27: 40, 28: 30, 29: 25, 30: 25, 31: 20, 32: 20, 33: 15, 34: 5, 35: 3 };
  const demoPct = (r) => (r <= 1 ? 0 : r <= 9 ? 5 : r <= 21 ? 10 : r <= 35 ? 15 : 0);
  function cutoffs(rank, size) {
    if (!(rank >= 1 && rank <= 35)) return [null, null];
    const n = Math.max(1, size || 100), up = PROMO[rank], down = demoPct(rank);
    return [up ? Math.max(1, Math.floor(n * up / 100)) : null, down ? Math.max(1, n - Math.ceil(n * down / 100) + 1) : null];
  }

  const starSet = (n) => `<span class="rk-st">${[1, 2, 3].map((i) => ic("star", i <= n ? "" : "is-empty")).join("")}</span>`;
  const tierOf = (t) => (t ? { rank: t.rank, label: t.label, short: t.short, icon: t.emoji_name } : null);

  // Lenda I é diária: o "dia" da Lenda vira às 05:00 UTC (02:00 em São Paulo). `offset` -1 = dia anterior.
  function legendDay(offset) {
    const t = new Date(Date.now() - 5 * 3600 * 1000);
    t.setUTCDate(t.getUTCDate() + offset);
    return `${String(t.getUTCDate()).padStart(2, "0")} ${MONTHS[t.getUTCMonth()]}`;
  }
  const isLegendOne = (t) => !!t && t.rank === 36;

  // 🔥 Best e 📅 Last, no mesmo formato do /rank do Discord: liga + posição; na Lenda I, troféus + 🌍 global + 📍 local.
  const rankNo = (n) => `#${String(n).padStart(2, "0")}`;
  function standingValue(s) {
    const tier = s && s.tier ? tierOf(s.tier) : null;
    if (!tier) return `<span class="rk-mark-none">—</span>`;
    if (isLegendOne(tier)) {
      const parts = [];
      if (s.trophies != null) parts.push(`<span class="rk-mark-part">🏆 ${nf(s.trophies)}</span>`);
      if (s.global_rank) parts.push(`<span class="rk-mark-part" title="Posição global">🌍 ${rankNo(s.global_rank)}</span>`);
      if (s.local_rank) parts.push(`<span class="rk-mark-part" title="Posição local">📍 ${rankNo(s.local_rank)}</span>`);
      return `${rankIcon(tier)}<span class="rk-mark-tier">${esc(tier.short)}</span>${parts.join("")}`;
    }
    const place = s.placement ? `<span class="rk-mark-part">${rankNo3(s.placement)}</span>` : "";
    return `${rankIcon(tier)}<span class="rk-mark-tier">${esc(tier.short)}</span>${place}`;
  }
  const rankNo3 = (n) => `#${pad3(n)}`;
  function marks(d) {
    if (!d || (!d.best && !d.last)) return "";
    const mark = (emoji, label, s) => `<div class="rk-mark"><span class="rk-mark-label"><span class="lg-emoji">${emoji}</span>${label}</span><span class="rk-mark-val">${standingValue(s)}</span></div>`;
    return `<div class="rk-marks">${mark("🔥", "Best", d.best)}${mark("📅", "Last", d.last)}</div>`;
  }

  // Resume os ataques (ou defesas) de uma semana: distribuição de estrelas e médias.
  function sideOf(list, max, isDef, legendOne) {
    const b = (Array.isArray(list) ? list : []).map((x) => ({ trophies: x.trophies || 0, stars: x.stars || 0, destruction: x.destruction || 0, at: x.creation_time }));
    const n = b.length, negative = !!(isDef && legendOne);
    const trophyAvg = n ? b.reduce((a, x) => a + Math.abs(x.trophies), 0) / n : null;
    return {
      count: n, max, battles: b, negative,
      stars: [3, 2, 1, 0].map((s) => b.filter((x) => x.stars === s).length),
      avg_stars: n ? b.reduce((a, x) => a + x.stars, 0) / n : null,
      avg_trophies: trophyAvg == null ? null : (negative ? -trophyAvg : trophyAvg)
    };
  }

  function sumLine(side, label, isDef) {
    const dist = side.stars ? side.stars.map(p2).join("/") : "??/??/??/??";
    const avg = side.avg_stars == null ? "—" : side.avg_stars.toFixed(1);
    return `<li class="${isDef ? "is-def" : ""}"><span class="part">${label} ${p2(side.count)}/${p2(side.max)}</span><span class="sep">—</span>
      <span class="part"><span class="rk-st">${ic("star")}</span>${dist}</span><span class="sep">—</span>
      <span class="part">🌟 ${avg}</span><span class="sep">/</span><span class="part">🏆 ${avgTrophies(side.avg_trophies, side.negative)}</span></li>`;
  }

  function battleList(title, side, isDef, emptyText) {
    const rows = side.battles.length
      ? side.battles.map((b) => `<li class="rk-b${isDef ? " is-def" : ""}"><span class="tr${side.negative ? " neg" : ""}">${signed(b.trophies, side.negative)}</span>${starSet(b.stars)}<span class="pc">${b.destruction}%</span><span class="age">${ageText(b.at)}</span></li>`).join("")
      : `<li class="rk-none">${emptyText || "Nenhum registro ainda."}</li>`;
    return `<div class="rk-col${isDef ? " is-def" : ""}"><h5>${title}</h5><ul class="rk-list">${rows}</ul></div>`;
  }

  function currentWeek(d) {
    const day = isLegendOne(d.tier);
    const head = `<header class="rk-head"><h4 class="rk-title">${day ? "Dia atual" : "Semana atual"}</h4><span class="rk-range">${day ? legendDay(0) : weekLabel(0)}</span></header>`;
    if (!d.participating) return `<section class="rk-week">${head}<p class="rk-empty">Sem participação na ranqueada ${day ? "hoje" : "nesta semana"}.</p></section>`;
    const tier = tierOf(d.tier), legendOne = tier.rank === 36, max = d.max_battles || 0;
    const [up, down] = cutoffs(tier.rank, d.group_size);
    const cuts = legendOne ? "" : `<span class="rk-chip"><span class="rk-up">▲</span>${up == null ? "---" : pad3(up)} <span class="rk-down">▼</span>${down == null ? "---" : pad3(down)}</span>`;
    const place = legendOne ? "" : `<span class="rk-chip">#${d.placement ? pad3(d.placement) : "---"}</span>`;
    const trophies = d.league_trophies == null ? "" : `<span class="rk-chip">🏆 ${nf(d.league_trophies)}</span>`;
    const atk = sideOf(d.attacks, max, false, legendOne), def = sideOf(d.defenses, max, true, legendOne);
    return `<section class="rk-week">${head}
      <div class="rk-tier">${rankIcon(tier)}<span class="rk-tier-num">${esc(tier.short)}</span>${place}${cuts}${trophies}</div>
      <ul class="rk-sum">${sumLine(atk, "⚔️", false)}${sumLine(def, "🛡️", true)}</ul>
      <div class="rk-lists">${battleList("Ataques", atk, false)}${battleList("Defesas", def, true)}</div></section>`;
  }

  // Resumo agregado (a API só guarda a lista de batalhas da semana atual).
  function aggSide(count, max, dist, stars, trophyAvg, negative) {
    return {
      count: count || 0, max, battles: [], negative,
      stars: dist || null,
      avg_stars: count ? (stars || 0) / count : null,
      avg_trophies: trophyAvg == null ? null : (negative ? -trophyAvg : trophyAvg)
    };
  }

  // Máximo de batalhas por liga (mesma tabela do bot), usado quando só temos o resumo `last`.
  const maxBattles = (r) => (r >= 1 && r <= 6 ? 6 : r <= 12 ? 8 : r <= 18 ? 10 : r <= 27 ? 12 : r <= 30 ? 14 : r <= 33 ? 18 : r === 34 ? 24 : r === 35 ? 30 : r === 36 ? 8 : 0);

  // Batalhas da semana anterior (campos `previous_*` da rota do jogador). Só valem se forem da mesma semana do relatório.
  function prevBattles(d, prev) {
    const atk = d.previous_attacks || [], def = d.previous_defenses || [];
    const same = !prev || String(prev.season) === String(d.previous_season_id);
    return d.previous_season_id && same && (atk.length || def.length) ? { atk, def } : null;
  }
  const prevLists = (b, max, legendOne) => {
    const a = sideOf(b.atk, max, false, legendOne), f = sideOf(b.def, max, true, legendOne);
    return `<div class="rk-lists">${battleList("Ataques", a, false, "Nenhum registro.")}${battleList("Defesas", f, true, "Nenhum registro.")}</div>`;
  };

  // Semana anterior: relatório da semana (ataques/defesas agregados) quando disponível;
  // senão, só o resumo `last` (liga, colocação, troféus) da rota do jogador.
  // Se a rota do jogador mandar as batalhas da semana (`previous_*`), a lista aparece também.
  function previousWeek(d, prev, loading) {
    const found = prev && prev.found ? prev.found : null;
    // Na Lenda I o período é o dia: vale a liga da semana anterior (`found`) ou, sem ela, a do `last`.
    const day = found ? isLegendOne(found.p.previous_tier) : isLegendOne(d.last && d.last.tier);
    const range = day ? legendDay(-1) : prev ? weekLabel(-1, prev.season) : weekLabel(-1, d.previous_season_id);
    const head = `<header class="rk-head"><h4 class="rk-title">${day ? "Dia anterior" : "Semana anterior"}</h4><span class="rk-range">${range}</span></header>`;
    const none = `<section class="rk-week">${head}<p class="rk-empty">Sem participação na ranqueada ${day ? "neste dia" : "nesta semana"}.</p></section>`;
    // O relatório da semana ainda está chegando: o resumo `last` pode ser de uma semana mais antiga, então espera.
    if (!prev && loading) return `<section class="rk-week">${head}<p class="rk-loading">Carregando semana anterior…</p></section>`;
    const battles = prevBattles(d, prev);
    const noteOnly = `<p class="rk-note">A lista de batalhas só aparece ${day ? "no dia atual" : "na semana atual"}.</p>`;
    if (found) {
      const p = found.p;
      if (!p.group_tag && !p.attack_count && !p.defense_count) return none;
      const from = tierOf(p.previous_tier), to = tierOf(p.current_tier), legendOne = from.rank === 36;
      const moved = found.cat === "promoted" || found.cat === "demoted";
      const arrow = moved ? `<span class="rk-arrow ${found.cat === "promoted" ? "rk-up" : "rk-down"}">${found.cat === "promoted" ? "▲" : "▼"}</span>${rankIcon(to)}<span class="rk-tier-num">${esc(to.short)}</span>` : "";
      const place = p.placement ? `<span class="rk-chip">#${pad3(p.placement)}</span>` : "";
      const [up, down] = found.cat === "stayed" ? cutoffs(from.rank, p.group_size) : [null, null];
      const cuts = found.cat === "stayed" && !legendOne ? `<span class="rk-chip"><span class="rk-up">▲</span>${up == null ? "---" : pad3(up)} <span class="rk-down">▼</span>${down == null ? "---" : pad3(down)}</span>` : "";
      // Os troféus finais só entram se o `last` da rota do jogador for mesmo desta semana (mesma colocação).
      const l = d.last, same = l && l.trophies != null && p.placement && l.placement === p.placement;
      const tro = same ? `<span class="rk-chip">🏆 ${nf(l.trophies)}</span>` : "";
      const atk = aggSide(p.attack_count, p.max_battles, p.attack_distribution, p.attack_stars, p.attack_trophy_average, false);
      const def = aggSide(p.defense_count, p.max_battles, p.defense_distribution, p.defense_stars, p.defense_trophy_average, legendOne);
      return `<section class="rk-week">${head}
      <div class="rk-tier">${rankIcon(from)}<span class="rk-tier-num">${esc(from.short)}</span>${arrow}${place}${cuts}${tro}</div>
      <ul class="rk-sum">${sumLine(atk, "⚔️", false)}${sumLine(def, "🛡️", true)}</ul>
      ${battles ? prevLists(battles, p.max_battles, legendOne) : noteOnly}</section>`;
    }
    const l = d.last;
    if (!l || !l.tier) return none;
    const tier = tierOf(l.tier), legendOne = tier.rank === 36;
    const place = !legendOne && l.placement ? `<span class="rk-chip">#${pad3(l.placement)}</span>` : "";
    const trophies = l.trophies == null ? "" : `<span class="rk-chip">🏆 ${nf(l.trophies)}</span>`;
    if (battles) {
      const max = maxBattles(tier.rank), a = sideOf(battles.atk, max, false, legendOne), f = sideOf(battles.def, max, true, legendOne);
      return `<section class="rk-week">${head}
      <div class="rk-tier">${rankIcon(tier)}<span class="rk-tier-num">${esc(tier.short)}</span>${place}${trophies}</div>
      <ul class="rk-sum">${sumLine(a, "⚔️", false)}${sumLine(f, "🛡️", true)}</ul>
      ${prevLists(battles, max, legendOne)}</section>`;
    }
    return `<section class="rk-week">${head}
      <div class="rk-tier">${rankIcon(tier)}<span class="rk-tier-num">${esc(tier.short)}</span>${place}${trophies}</div>
      <p class="rk-note">Ataques e defesas só aparecem ${day ? "no dia atual" : "na semana atual"}.</p></section>`;
  }

  // `prev`: { found: { p, cat }|null, season } do relatório da semana anterior, ou null se não carregou.
  function rankDetail(d, prev, loadingPrev) {
    return `${marks(d)}<div class="rk">${currentWeek(d)}${previousWeek(d, prev, loadingPrev)}</div>`;
  }

  /* ---------- Histórico ---------- */

  const resultBadge = (r) => r === "won" ? `<span class="hist-badge hist-badge-win">Vitória</span>` : r === "lost" ? `<span class="hist-badge hist-badge-loss">Derrota</span>` : `<span class="hist-badge hist-badge-record">Empate</span>`;
  const expandBtn = (attrs, label) => `<button type="button" class="hist-expand" ${attrs} aria-expanded="false" aria-label="${esc(label)}">${ic("chevron-down")}</button>`;
  const matchup = (us, them) => `<span class="hist-matchup"><span class="hist-vs">${esc(us)} Vs 💀 ${esc(them)}</span></span>`;
  const score = (r) => `<span class="hist-stars">⭐ ${r.stars ?? "—"}${r.enemy_stars != null ? "-" + r.enemy_stars : ""}</span><span class="hist-pct">💥 ${pct(r.destruction)}</span>`;

  function warRow(r, us, extra, sub) {
    const btn = r.has_mirror ? expandBtn(`data-hist-expand data-mirror-id="${esc(r.id)}"`, "Ver espelho da guerra") : "";
    return `<li class="hist-item${sub ? " hist-subitem" : ""}" data-hist-row><div class="hist-row">${matchup(us, r.opponent)}
      <span class="hist-meta-cluster"><span class="hist-cell">${resultBadge(r.result)}</span>${extra}${score(r)}<span class="hist-date">${fdate(r.date)}</span></span>${btn}</div>
      ${r.has_mirror ? `<div class="hist-detail hidden" data-hist-detail></div>` : ""}</li>`;
  }

  function leagueRow(s, us) {
    const record = `${s.wins}V${s.ties ? "-" + s.ties + "E" : ""}-${s.losses}D`;
    return `<li class="hist-item hist-season" data-cwl-season><div class="hist-row">
      <span class="hist-matchup"><span class="hist-vs">🏆 ${seasonLabel(s.season)}</span></span>
      <span class="hist-meta-cluster"><span class="hist-cell"><span class="hist-badge hist-badge-record">${record}</span></span>
        <span class="hist-size">⚔️ ${s.team_size ? s.team_size + "x" + s.team_size : "—"}</span><span class="hist-stars">⭐ ${s.stars ?? "—"}</span><span class="hist-pct">💥 ${pct(s.destruction)}</span></span>
      ${expandBtn("data-cwl-season-btn", "Ver as rodadas de " + seasonLabel(s.season))}</div>
      <div class="hist-detail hidden" data-cwl-season-body><ul class="hist-list hist-sublist">
        ${s.rounds.map((r) => warRow(r, us, `<span class="hist-round">${seasonLabel(s.season).replace(" " + s.season.slice(0, 4), "")} - ${r.round ?? "—"}/${r.total_rounds ?? "—"}</span>`, true)).join("")}
      </ul></div></li>`;
  }

  const sizeCell = (r) => `<span class="hist-size">⚔️ ${r.team_size ? r.team_size + "x" + r.team_size : "—"}</span>`;
  const raidRow = (r) => `<li class="hist-item" data-hist-row><div class="hist-row"><span class="hist-matchup"><span class="hist-vs">🏰 Final de semana de Raide</span></span>
    <span class="hist-meta-cluster"><span class="hist-size">⚔️ ${r.attacks_used}/${r.attacks_available}</span><span class="hist-date">${fdate(r.date)}</span></span></div></li>`;
  const moveRow = (m) => {
    const role = (ROLES[m.role] || ROLES.member).label, joined = m.event === "joined";
    return `<li class="hist-item" data-hist-row><div class="hist-row"><span class="hist-matchup"><span class="hist-vs">${esc(m.name)}</span></span>
      <span class="hist-meta-cluster"><span class="hist-cell"><span class="hist-badge ${joined ? "hist-badge-win" : "hist-badge-loss"}">${joined ? "Entrou" : "Saiu"}</span></span>
      <span class="hist-role">${role}</span><span class="hist-date">${fdate(m.at)}</span></span></div></li>`;
  };

  const empty = (t) => `<li class="hist-empty">${t}</li>`;
  function history(h, us) {
    return {
      ligas: h.leagues.length ? h.leagues.map((s) => leagueRow(s, us)).join("") : empty("Nenhuma temporada de CWL registrada."),
      guerras: h.wars.length ? h.wars.map((r) => warRow(r, us, sizeCell(r), false)).join("") : empty("Nenhuma guerra registrada."),
      raids: h.raids.length ? h.raids.map(raidRow).join("") : empty("Nenhum raid registrado."),
      membros: h.members.length ? h.members.map(moveRow).join("") : empty("Nenhuma movimentação registrada.")
    };
  }

  window.TahRender = { esc, dashboard, memberRow, rankDetail, history, mirrorList, ROLES };
})();
