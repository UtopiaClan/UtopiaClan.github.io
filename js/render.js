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
  const fdateTime = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
  const seasonLabel = (key) => { const [y, m] = key.split("-"); return `CWL ${MONTHS[+m - 1]} ${y}`; };
  const stars = (n, cls) => [1, 2, 3].map((i) => ic("star", i <= n ? "" : "is-empty")).join("");
  const starsWrap = (n, cls) => `<span class="${cls}">${stars(n)}</span>`;

  /* ---------- Dashboard ---------- */

  function side(name, s, enemy) {
    const e = enemy ? "-enemy" : "";
    return `<div class="war-team${enemy ? " war-team-enemy" : ""}">
      <span class="war-team-name">${enemy ? "💀 " : ""}${esc(name)}</span>
      <span class="war-score${enemy ? " war-score-enemy" : ""}">${ic("star")} ${s.stars}</span>
      <span class="war-bar"><span class="war-bar-fill${enemy ? " war-bar-fill-enemy" : ""}" style="width:${Math.min(100, s.destruction)}%"></span></span>
      <span class="war-team-sub">💥 ${pct(s.destruction)} · ⚔️ ${s.attacks_used}/${s.attacks_total}</span>
    </div>`;
  }

  function attackList(side, isEnemy) {
    if (!side || !side.attacks.length) return `<li class="esp-attack"><span class="esp-attack-target">—</span><span>Sem ataques</span></li>`;
    return side.attacks.map((a) => `<li class="esp-attack${isEnemy ? " is-enemy" : ""}">
      <span class="esp-attack-target">#${a.target_position ?? "?"}</span><span>${esc(a.target_name ?? "—")}</span>
      <span class="esp-attack-stars">${stars(a.stars)}</span><span class="esp-attack-result">- ${Math.round(a.destruction)}%</span></li>`).join("");
  }

  function mirrorItem(item, open, showLeft) {
    const o = item.ours || {}, e = item.enemy || {};
    const left = (s) => (showLeft && s.attacks_left > 0 ? `<span class="esp-left">${s.attacks_left} Atk</span>` : "");
    return `<li class="esp-item" data-mirror-item data-pos="${item.position}">
      <div class="esp-main"><div class="esp-info">
        <div class="esp-line">
          <div class="esp-side"><span class="esp-rank">#${item.position}</span><span class="esp-name">${esc(o.name ?? "—")}</span></div>
          <div class="esp-side esp-side-enemy"><span class="esp-name">${esc(e.name ?? "—")}</span><span class="esp-rank">#${item.position}</span></div>
        </div>
        <div class="esp-line esp-line-sub">
          <div class="esp-side">${starsWrap(o.stars || 0, "esp-stars")}${left(o)}</div>
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

  function warCard(war, ui) {
    if (!war) {
      return `<div class="acc-item"><div class="acc-btn acc-btn-static"><span class="acc-title">${ic("shield-halved")} Guerra</span><span class="acc-meta">Sem guerra no momento</span></div></div>`;
    }
    const prep = war.state === "preparation";
    const target = prep ? war.start_time : war.end_time;
    const meta = (war.type === "cwl" ? `CWL ${war.round}/${war.total_rounds}` : "Guerra normal") + (prep ? " · Preparação" : "");
    return `<div class="acc-item is-open">
      <div class="acc-btn acc-btn-static"><span class="acc-title">${ic("shield-halved")} Guerra</span><span class="acc-meta">${ic("trophy")} ${meta}</span></div>
      <div class="acc-body-content">
        <div class="war-board">${side(war.ours.name, war.ours, false)}
          <div class="war-center"><span class="war-vs">VS</span><span class="war-size">${war.team_size} vs ${war.team_size}</span></div>
          ${side(war.enemy.name, war.enemy, true)}</div>
        <div class="war-timer"><span class="war-timer-label">${prep ? "Começa em" : "Termina em"}</span>
          <span class="war-timer-value" data-countdown="${esc(target)}">--</span><span class="war-timer-note">${fdateTime(target)}</span></div>
        <button type="button" class="mirrors-toggle" data-mirrors-btn aria-expanded="${ui.mirrorsOpen}"><span data-mirrors-label>${ui.mirrorsOpen ? "Ocultar" : "Detalhes"}</span>${ic("chevron-down", "mirrors-toggle-chevron")}</button>
        <div class="${ui.mirrorsOpen ? "" : "hidden"}" data-mirrors-body>${mirrorList(war.mirror, ui.openBases, true)}</div>
      </div></div>`;
  }

  function raidCard(raid, ui) {
    if (!raid) return `<div class="acc-item"><div class="acc-btn acc-btn-static"><span class="acc-title">${ic("dungeon")} Raid</span><span class="acc-meta">indisponível</span></div></div>`;
    const on = raid.state === "ongoing";
    const target = on ? raid.end_time : raid.next_start_time;
    return `<div class="acc-item${ui.raidOpen ? " is-open" : ""}" data-acc>
      <button type="button" class="acc-btn" data-acc-btn aria-expanded="${ui.raidOpen}">
        <span class="acc-title">${ic("dungeon")} Raid</span>
        <span class="acc-meta">${ic("clock")} <span data-countdown="${esc(target)}">--</span>${ic("chevron-down", "acc-chevron")}</span></button>
      <div class="acc-body-content${ui.raidOpen ? "" : " hidden"}" data-acc-body>
        <div class="highlight"><span class="hl-label">${on ? "Termina em" : "Início em"}</span>
          <span class="hl-value" data-countdown="${esc(target)}">--</span><span class="hl-note">${fdateTime(target)}</span></div></div></div>`;
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

  function memberRow(m) {
    const role = ROLES[m.role] || ROLES.member;
    return `<tr data-member-row data-member-name="${esc(m.name)}" data-member-role="${role.label}">
      <td><div class="member-cell"><span class="member-avatar" data-role-tip data-role="${role.label}" tabindex="0" role="button" aria-label="Cargo: ${role.label}">${ic(role.icon)}<span class="role-tip" role="tooltip">${role.label}</span></span><span class="member-name">${esc(m.name)}</span></div></td>
      <td class="cell-center"><span class="target-chip">${m.town_hall ? "CV " + m.town_hall : "—"}</span></td>
      <td class="cell-center"><span class="join-date">${fdate(m.since)}</span></td>
      <td class="cell-center"><div class="lg-cell">
        <div class="lg-view lg-view-attack">${lgRow([["🏆", pair(m.cwl)], ["⭐", starRow(m.cwl.stars)], ["🌟", m.cwl.avg.toFixed(1)]])}${lgRow([["⚔️", pair(m.war)], ["⭐", starRow(m.war.stars)], ["🌟", m.war.avg.toFixed(1)]])}</div>
        <div class="lg-view lg-view-extra">${lgRow([["❌", p2(m.cwl.missed)], ["🪎", p2(m.cwl.bonus)]])}${lgRow([["❌", p2(m.war.missed)], ["🪎", p2(m.war.bonus)]])}</div>
      </div></td>
      <td class="cell-center"><div class="raids-cell"><span class="raid-chip"><span class="lg-emoji">🛡️</span>${p2(m.raids.played)}/${p2(m.raids.total)}</span></div></td></tr>`;
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
        ${s.rounds.map((r) => warRow(r, us, `<span class="hist-round">${seasonLabel(s.season).replace(" " + s.season.slice(0, 4), "")} - ${r.round}/${r.total_rounds}</span>`, true)).join("")}
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

  window.TahRender = { esc, dashboard, memberRow, history, mirrorList, ROLES };
})();
