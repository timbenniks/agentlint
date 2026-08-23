import type { AgentJourney, CategoryScore, ReportCheck, ScanReport } from "../types.ts";
import { actionableChecks, recommendationFor, renderRemediationPrompt } from "./prompt.ts";

export function renderHtml(report: ScanReport, remediationPrompt = renderRemediationPrompt(report)): string {
  const title = `Agentlint report · ${host(report.target.finalUrl)}`;
  const pending = report.reasoningTasks.filter((task) => task.status === "pending");
  const actionable = actionableChecks(report);
  const generated = formatDate(report.completedAt);
  const targetLabel = escapeHtml(host(report.target.finalUrl));
  const targetHref = escapeAttribute(report.target.finalUrl);
  const prompt = remediationPrompt.trim();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="Agentlint evidence-first website readiness report">
  <title>${escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
  <a class="skip-link" href="#report">Skip to report</a>
  <header class="site-head">
    <a class="brand" href="${targetHref}" target="_blank" rel="noreferrer">
      ${mark}
      <span>agentlint</span>
    </a>
    <div class="report-meta"><span>REPORT</span><span>${escapeHtml(report.agentlintVersion)}</span></div>
  </header>

  <main id="report">
    <section class="report-head" aria-labelledby="report-title">
      <div class="report-intro">
        <p class="signal"><i aria-hidden="true"></i> Website readiness / measured</p>
        <h1 id="report-title">Evidence trace</h1>
        <a class="target-link" href="${targetHref}" target="_blank" rel="noreferrer" title="${targetHref}"><span>Target</span><b>${targetLabel}</b><i aria-hidden="true">↗</i></a>
        <p class="lede">A deterministic scan of the public surface, with bounded reasoning kept separate and every conclusion tied to evidence.</p>
        <dl class="run-meta">
          <div><dt>Scan</dt><dd>${escapeHtml(report.scanId)}</dd></div>
          <div><dt>Completed</dt><dd>${escapeHtml(generated)}</dd></div>
          <div><dt>Canonical</dt><dd>${escapeHtml(report.target.canonicalUrl ?? report.target.finalUrl)}</dd></div>
        </dl>
      </div>

      <div class="score-sheet" aria-label="Readiness score summary">
        <div class="sheet-cap"><span>READINESS / 100</span><span>${escapeHtml(report.score.label.toUpperCase())}</span></div>
        <div class="overall-score">
          <strong>${score(report.score.overall)}</strong>
          <div><b>overall readiness</b><span>surface ${score(report.score.surface)} · bounded ${score(report.score.taskSuccess, "pending")}</span></div>
        </div>
        <div class="status-ledger">
          ${metric("pass", report.score.passed, "passed")}
          ${metric("warning", report.score.warnings, "warnings")}
          ${metric("fail", report.score.failed, "failed")}
          ${metric("na", report.score.na, "not applicable")}
        </div>
        <div class="sheet-foot"><span>${pending.length} reasoning pending</span><span>${actionable.length} actionable</span></div>
      </div>
    </section>

    <section class="category-section" aria-labelledby="category-title">
      <header class="section-head"><span>01 / SCORE TRACE</span><h2 id="category-title">Where the score came from</h2></header>
      <div class="category-ledger">${report.score.categories.map(renderCategory).join("")}</div>
    </section>

    ${report.journeys.length ? renderJourneys(report.journeys) : ""}

    <section class="checks-section" aria-labelledby="checks-title">
      <header class="section-head checks-heading">
        <span>${report.journeys.length ? "03" : "02"} / CHECKS</span>
        <h2 id="checks-title">Evidence, check by check</h2>
        <p>Warnings and failures open first. Expand any check to inspect its source evidence and remediation.</p>
      </header>
      <div class="filters" role="group" aria-label="Filter checks">
        <button type="button" class="filter active" data-filter="all" aria-pressed="true">All <b>${report.checks.length}</b></button>
        <button type="button" class="filter" data-filter="action" aria-pressed="false">Action needed <b>${report.score.warnings + report.score.failed}</b></button>
        <button type="button" class="filter" data-filter="pass" aria-pressed="false">Pass <b>${report.score.passed}</b></button>
        <button type="button" class="filter" data-filter="na" aria-pressed="false">N/A <b>${report.score.na}</b></button>
      </div>
      <div class="check-groups">${report.score.categories.map((category) => renderCheckGroup(category, report.checks)).join("")}</div>
      <p class="filter-empty" hidden>No checks match this filter.</p>
    </section>

    ${renderReasoning(report)}
    ${renderCapabilities(report)}
    ${prompt ? renderPrompt(prompt, actionable.length, pending.length) : ""}
  </main>

  <footer>
    <span>Observe first. Reason only when necessary.</span>
    <span>Generated by Agentlint ${escapeHtml(report.agentlintVersion)}</span>
  </footer>
  <div class="toast" role="status" aria-live="polite"></div>
  ${prompt ? `<template id="fix-prompt">${escapeHtml(prompt)}</template>` : ""}
  <script>${script}</script>
</body>
</html>`;
}

function renderCategory(category: CategoryScore): string {
  const value = category.score === null ? "N/A" : String(category.score);
  const width = category.score === null ? 0 : Math.max(0, Math.min(100, category.score));
  return `<article class="category-row">
    <div><span>${escapeHtml(category.title)}</span><small>${category.passed} pass · ${category.warnings} warn · ${category.failed} fail · ${category.na} n/a</small></div>
    <div class="score-track" aria-hidden="true"><i style="width:${width}%"></i></div>
    <strong>${value}</strong>
  </article>`;
}

function renderJourneys(journeys: AgentJourney[]): string {
  return `<section class="journey-section" aria-labelledby="journey-title">
    <header class="section-head"><span>02 / BOUNDED MISSIONS</span><h2 id="journey-title">Can an agent complete the outcome?</h2></header>
    <div class="journey-grid">${journeys.map((journey) => `<article class="journey ${statusClass(journey.status)}">
      <div class="journey-cap"><span>${escapeHtml(journey.id)}</span>${badge(journey.status)}</div>
      <h3>${escapeHtml(journey.title)}</h3>
      <p>${escapeHtml(journey.summary)}</p>
      <dl>
        <div><dt>Score</dt><dd>${journey.score ?? "Pending"}</dd></div>
        <div><dt>Requests</dt><dd>${journey.metrics?.requestsPlanned ?? "—"}</dd></div>
        <div><dt>Evidence used</dt><dd>${journey.metrics?.evidenceItemsUsed ?? "—"}</dd></div>
      </dl>
    </article>`).join("")}</div>
  </section>`;
}

function renderCheckGroup(category: CategoryScore, checks: ReportCheck[]): string {
  const matching = checks.filter((check) => check.category === category.id);
  if (!matching.length) return "";
  return `<section class="check-group" data-group>
    <div class="group-label"><h3>${escapeHtml(category.title)}</h3><span>${matching.length} checks</span></div>
    <div>${matching.map(renderCheck).join("")}</div>
  </section>`;
}

function renderCheck(check: ReportCheck): string {
  const isAction = check.status === "warning" || check.status === "fail";
  const rec = isAction ? recommendationFor(check) : undefined;
  const points = check.status === "na" ? "N/A" : `${check.score ?? 0} / ${check.maxScore ?? 0}`;
  const open = isAction ? " open" : "";
  return `<details class="check ${statusClass(check.status)}" data-check data-status="${check.status}"${open}>
    <summary>
      <span class="status-mark" aria-hidden="true">${statusMark(check.status)}</span>
      <span class="check-name"><b>${escapeHtml(check.title)}</b><small>${escapeHtml(check.id)}</small></span>
      <span class="source">${escapeHtml(check.provenance)}</span>
      <span class="points">${escapeHtml(points)}</span>
      <span class="chevron" aria-hidden="true">＋</span>
    </summary>
    <div class="check-body">
      <p class="check-summary">${escapeHtml(check.summary)}</p>
      <div class="check-tags"><span>${escapeHtml(check.severity)}</span>${check.reasoningTaskId ? `<span>task · ${escapeHtml(check.reasoningTaskId)}</span>` : ""}</div>
      ${check.naReason ? `<p class="na-reason"><b>Why N/A:</b> ${escapeHtml(check.naReason)}</p>` : ""}
      ${rec ? `<aside class="recommendation"><span>${rec.priority}</span><div><b>${escapeHtml(rec.problem)}</b><p>${escapeHtml(rec.remediation)}</p><small>Impact · ${escapeHtml(rec.impact)}</small></div></aside>` : ""}
      ${check.evidence.length ? `<details class="evidence"><summary>Inspect ${check.evidence.length} evidence item${check.evidence.length === 1 ? "" : "s"}</summary><pre>${escapeHtml(JSON.stringify(check.evidence, null, 2))}</pre></details>` : `<p class="no-evidence">No evidence items recorded.</p>`}
    </div>
  </details>`;
}

function renderReasoning(report: ScanReport): string {
  if (!report.reasoningTasks.length) return "";
  const sectionNumber = report.journeys.length ? "04" : "03";
  return `<section class="reasoning-section" aria-labelledby="reasoning-title">
    <header class="section-head"><span>${sectionNumber} / REASONING</span><h2 id="reasoning-title">Bounded judgment state</h2></header>
    <div class="reasoning-list">${report.reasoningTasks.map((task) => `<article>
      <div><code>${escapeHtml(task.id)}</code><h3>${escapeHtml(task.title)}</h3></div>
      ${badge(task.status)}
    </article>`).join("")}</div>
  </section>`;
}

function renderCapabilities(report: ScanReport): string {
  const api = report.capabilities.api;
  const items: [string, boolean][] = [
    ["Browser evidence", report.capabilities.hasBrowser],
    ["llms.txt", report.capabilities.hasLlmsTxt],
    ["Developer portal", report.capabilities.hasDeveloperPortal],
    ["OpenAPI", report.capabilities.hasOpenApi],
    ["MCP discovery", report.capabilities.hasMcp],
    ["JavaScript required", report.capabilities.jsRequired],
    ["API reads", api.hasReads],
    ["API writes", api.hasWrites],
    ["API delete", api.hasDelete],
    ["Pagination", api.hasPagination],
    ["Authentication", api.hasAuthenticatedOperations],
    ["Bulk operations", api.hasBulkOperations],
  ];
  return `<section class="capability-section" aria-labelledby="capability-title">
    <header class="section-head"><span>CAPABILITY MAP</span><h2 id="capability-title">What the scanner observed</h2></header>
    <div class="capability-grid">${items.map(([label, present]) => `<div class="${present ? "present" : "absent"}"><i aria-hidden="true"></i><span>${escapeHtml(label)}</span><b>${present ? "observed" : "not observed"}</b></div>`).join("")}</div>
  </section>`;
}

function renderPrompt(prompt: string, actionableCount: number, pendingCount: number): string {
  return `<section class="prompt-section" aria-labelledby="prompt-title">
    <div class="prompt-copy">
      <span>FIX LOOP / READY TO HAND OFF</span>
      <h2 id="prompt-title">Take the evidence back to the code.</h2>
      <p>${actionableCount} actionable finding${actionableCount === 1 ? "" : "s"}; ${pendingCount} reasoning task${pendingCount === 1 ? "" : "s"} pending. The prompt includes constraints, observed sources, work order, verification, and stopping conditions.</p>
      <button class="copy-prompt" type="button" data-copy-prompt>Copy fix prompt <span aria-hidden="true">↗</span></button>
    </div>
    <details class="prompt-details"><summary>Preview complete fix prompt</summary><pre>${escapeHtml(prompt)}</pre></details>
  </section>`;
}

function metric(kind: string, value: number, label: string): string {
  return `<div class="metric ${kind}"><strong>${value}</strong><span>${label}</span></div>`;
}

function badge(status: string): string {
  return `<span class="badge ${statusClass(status)}">${escapeHtml(status.toUpperCase())}</span>`;
}

function statusClass(status: string): string {
  return `is-${status === "warning" ? "warning" : status === "resolved" ? "pass" : status}`;
}

function statusMark(status: string): string {
  return status === "pass" ? "✓" : status === "fail" ? "×" : status === "warning" ? "!" : "—";
}

function score(value: number | null, empty = "N/A"): string {
  return value === null ? empty : String(value);
}

function host(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

const mark = `<svg class="mark" viewBox="0 0 64 64" role="img" aria-label="Agentlint evidence mark"><rect width="64" height="64" rx="12" fill="#1d4ed8"/><path d="M19 14h-7v36h7M45 14h7v36h-7" fill="none" stroke="#f4f6f0" stroke-width="5" stroke-linecap="square"/><path d="m23 33 6 6 13-15" fill="none" stroke="#67e8f9" stroke-width="5" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;

const styles = String.raw`
:root{--paper:#f4f6f0;--paper-2:#e9eee8;--lift:#fbfcf8;--ink:#17212b;--muted:#52606a;--rule:#c5d0cd;--blue:#1d4ed8;--blue-2:#17378f;--cyan:#67e8f9;--teal:#0e7490;--amber:#b45309;--red:#b42318;--mono:"IBM Plex Mono","SFMono-Regular",Consolas,monospace;--sans:"IBM Plex Sans","Avenir Next",Inter,system-ui,sans-serif;color-scheme:light dark}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.5}a{color:inherit}.skip-link{position:fixed;left:16px;top:-60px;z-index:10;padding:10px 14px;background:var(--ink);color:var(--paper)}.skip-link:focus{top:12px}.site-head{height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1240px)/2));border-bottom:1px solid var(--rule)}.brand{display:flex;align-items:center;gap:10px;font:500 15px var(--mono);text-decoration:none}.mark{width:29px;height:29px;color:var(--blue)}.report-meta{display:flex;gap:18px;color:var(--muted);font:11px var(--mono);letter-spacing:.1em}
main{max-width:1240px;margin:auto;padding:0 32px}.report-head{min-height:620px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(390px,.9fr);gap:80px;align-items:center;border-bottom:1px solid var(--rule)}.report-intro{min-width:0}.signal,.section-head>span,.prompt-copy>span{color:var(--muted);font:11px var(--mono);letter-spacing:.1em;text-transform:uppercase}.signal i{display:inline-block;width:8px;height:8px;margin-right:9px;background:var(--teal);box-shadow:0 0 0 4px color-mix(in srgb,var(--teal) 14%,transparent)}h1{margin:20px 0 18px;font-size:clamp(3rem,6.4vw,6rem);font-weight:680;line-height:.93;letter-spacing:-.065em}.target-link{display:inline-flex;max-width:100%;align-items:center;gap:10px;margin-bottom:24px;padding:8px 10px;border-left:3px solid var(--blue);background:var(--paper-2);font:12px var(--mono);text-decoration:none}.target-link span{color:var(--muted);font-size:9px;letter-spacing:.08em;text-transform:uppercase}.target-link b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}.target-link i{font-style:normal;color:var(--blue)}.target-link:hover b,.target-link:focus-visible b{text-decoration:underline;text-underline-offset:3px}.target-link:focus-visible{outline:3px solid color-mix(in srgb,var(--blue) 25%,transparent);outline-offset:3px}.lede{max-width:650px;color:var(--muted);font-size:1.2rem}.run-meta{display:grid;grid-template-columns:repeat(3,1fr);margin:38px 0 0;border-top:1px solid var(--ink);border-bottom:1px solid var(--rule)}.run-meta div{min-width:0;padding:14px 14px 14px 0}.run-meta dt{color:var(--muted);font:10px var(--mono);text-transform:uppercase}.run-meta dd{margin:4px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px var(--mono)}
.score-sheet{border:1px solid var(--ink);background:var(--lift);box-shadow:14px 14px 0 var(--blue);transform:rotate(1deg)}.sheet-cap,.sheet-foot{display:flex;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--rule);font:9px var(--mono);letter-spacing:.08em}.overall-score{display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center;padding:34px 24px;border-bottom:1px solid var(--rule)}.overall-score>strong{color:var(--blue);font-size:84px;line-height:.8;letter-spacing:-.08em}.overall-score div{display:flex;flex-direction:column}.overall-score span{color:var(--muted);font-size:13px}.status-ledger{display:grid;grid-template-columns:repeat(4,1fr)}.metric{display:flex;flex-direction:column;padding:20px 14px;border-right:1px solid var(--rule)}.metric:last-child{border:0}.metric strong{font:500 24px var(--mono)}.metric span{color:var(--muted);font-size:11px}.metric.pass strong{color:var(--teal)}.metric.warning strong{color:var(--amber)}.metric.fail strong{color:var(--red)}.sheet-foot{border:0;color:var(--muted)}
.category-section,.journey-section,.checks-section,.reasoning-section,.capability-section{padding:90px 0;border-bottom:1px solid var(--rule)}.section-head{display:grid;grid-template-columns:170px 1fr;align-items:start;margin-bottom:42px}.section-head h2,.prompt-copy h2{max-width:800px;margin:0;font-size:clamp(2.3rem,4.4vw,4.4rem);line-height:.98;letter-spacing:-.055em}.category-ledger{border-top:1px solid var(--ink)}.category-row{display:grid;grid-template-columns:minmax(180px,1fr) minmax(200px,1.3fr) 60px;gap:32px;align-items:center;padding:19px 0;border-bottom:1px solid var(--rule)}.category-row>div:first-child{display:flex;justify-content:space-between;gap:12px}.category-row small{color:var(--muted);font:10px var(--mono)}.score-track{height:5px;background:var(--paper-2)}.score-track i{display:block;height:100%;background:var(--blue)}.category-row>strong{text-align:right;font:500 25px var(--mono)}
.journey-grid{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid var(--ink)}.journey{min-height:250px;padding:24px;border-right:1px solid var(--ink);border-bottom:1px solid var(--ink)}.journey:nth-child(2n){border-right:0}.journey:nth-last-child(-n+2){border-bottom:0}.journey-cap{display:flex;justify-content:space-between;gap:16px;font:10px var(--mono)}.journey h3{margin:42px 0 10px;font-size:1.5rem;letter-spacing:-.03em}.journey p{color:var(--muted)}.journey dl{display:flex;gap:32px;margin-top:30px}.journey dl div{display:flex;flex-direction:column}.journey dt{color:var(--muted);font:9px var(--mono);text-transform:uppercase}.journey dd{margin:2px 0;font:13px var(--mono)}.badge{display:inline-flex;align-items:center;width:max-content;padding:4px 7px;border:1px solid currentColor;color:var(--muted);font:9px var(--mono);letter-spacing:.06em}.badge.is-pass{color:var(--teal)}.badge.is-warning,.badge.is-pending{color:var(--amber)}.badge.is-fail,.badge.is-invalid{color:var(--red)}
.checks-heading{grid-template-columns:170px 1fr minmax(220px,.55fr)}.checks-heading p{margin:4px 0 0;color:var(--muted)}.filters{display:flex;flex-wrap:wrap;border-top:1px solid var(--ink);border-bottom:1px solid var(--rule)}.filter{padding:13px 18px;border:0;border-right:1px solid var(--rule);background:transparent;color:var(--muted);font:12px var(--mono);cursor:pointer}.filter b{margin-left:7px}.filter:hover,.filter:focus-visible,.filter.active{background:var(--ink);color:var(--paper);outline:0}.check-group{display:grid;grid-template-columns:170px 1fr;padding-top:44px}.group-label{padding-right:28px}.group-label h3{margin:0;font-size:1.05rem}.group-label span{color:var(--muted);font:10px var(--mono)}.check{border-top:1px solid var(--rule)}.check:last-child{border-bottom:1px solid var(--rule)}.check[hidden],.check-group[hidden]{display:none}.check>summary{display:grid;grid-template-columns:30px 1fr 86px 70px 24px;gap:14px;align-items:center;padding:16px 4px;cursor:pointer;list-style:none}.check>summary::-webkit-details-marker{display:none}.status-mark{display:grid;place-items:center;width:23px;height:23px;border:1px solid currentColor;font:12px var(--mono)}.is-pass .status-mark{color:var(--teal)}.is-warning .status-mark{color:var(--amber)}.is-fail .status-mark{color:var(--red)}.is-na .status-mark{color:var(--muted)}.check-name{display:flex;flex-direction:column}.check-name small,.source,.points{color:var(--muted);font:10px var(--mono)}.points{text-align:right}.chevron{text-align:right;font:16px var(--mono)}.check[open] .chevron{transform:rotate(45deg)}.check-body{padding:4px 38px 28px}.check-summary{max-width:760px;font-size:1.06rem}.check-tags{display:flex;gap:7px;margin:14px 0}.check-tags span{padding:3px 6px;background:var(--paper-2);font:9px var(--mono);text-transform:uppercase}.recommendation{display:grid;grid-template-columns:55px 1fr;gap:18px;margin:22px 0;padding:20px;border-left:3px solid var(--amber);background:color-mix(in srgb,var(--amber) 8%,var(--lift))}.is-fail .recommendation{border-color:var(--red)}.recommendation>span{font:500 13px var(--mono)}.recommendation b{font-size:1.05rem}.recommendation p{margin:5px 0}.recommendation small{color:var(--muted)}.na-reason,.no-evidence{color:var(--muted)}.evidence{margin-top:18px}.evidence summary,.prompt-details summary{width:max-content;cursor:pointer;border-bottom:1px solid currentColor;font:500 12px var(--mono)}pre{max-width:100%;overflow:auto;padding:18px;background:#101820;color:#e7efeb;font:12px/1.6 var(--mono);white-space:pre}.filter-empty{text-align:center;color:var(--muted)}
.reasoning-list{border-top:1px solid var(--ink)}.reasoning-list article{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:18px 0;border-bottom:1px solid var(--rule)}.reasoning-list article>div{display:flex;align-items:center;gap:28px}.reasoning-list code{color:var(--blue);font:11px var(--mono)}.reasoning-list h3{margin:0;font-size:1rem}.capability-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--ink)}.capability-grid>div{display:grid;grid-template-columns:10px 1fr auto;gap:12px;align-items:center;padding:15px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}.capability-grid>div:nth-child(3n){border-right:0}.capability-grid>div:nth-last-child(-n+3){border-bottom:0}.capability-grid i{width:8px;height:8px;background:var(--muted)}.capability-grid .present i{background:var(--teal)}.capability-grid b{color:var(--muted);font:9px var(--mono);font-weight:400}
.prompt-section{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(0,1.2fr);gap:70px;margin:90px 0;padding:58px;border-top:8px solid var(--blue);background:var(--paper-2);overflow:hidden}.prompt-copy,.prompt-details{min-width:0}.prompt-copy p{max-width:540px;color:var(--muted)}.copy-prompt{margin-top:18px;padding:14px 18px;border:0;background:var(--blue);color:white;font:600 14px var(--sans);cursor:pointer}.copy-prompt:hover,.copy-prompt:focus-visible{background:var(--blue-2);outline:3px solid color-mix(in srgb,var(--blue) 25%,transparent);outline-offset:3px}.prompt-details{max-width:100%;align-self:start}.prompt-details summary{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.prompt-details pre{width:100%;max-height:430px;margin:14px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}.toast{position:fixed;right:24px;bottom:24px;z-index:5;transform:translateY(20px);opacity:0;padding:12px 16px;background:var(--ink);color:var(--paper);font:12px var(--mono);transition:.18s ease}.toast.show{transform:none;opacity:1}footer{display:flex;justify-content:space-between;gap:20px;padding:28px max(24px,calc((100vw - 1176px)/2));border-top:1px solid var(--rule);color:var(--muted);font:10px var(--mono)}
@media(prefers-color-scheme:dark){:root{--paper:#111920;--paper-2:#172129;--lift:#1b2730;--ink:#edf3ef;--muted:#a5b4b7;--rule:#33454d;--blue:#79a7ff;--blue-2:#9ec0ff;--teal:#67c6d4;--amber:#f0a44b;--red:#ff7b72}.copy-prompt{color:#111920}pre{background:#0a1015}}
@media(max-width:900px){.report-head{grid-template-columns:1fr;padding:76px 0}.score-sheet{max-width:620px}.section-head,.checks-heading{grid-template-columns:120px 1fr}.checks-heading p{grid-column:2}.check-group{grid-template-columns:120px 1fr}.journey-grid{grid-template-columns:1fr}.journey{border-right:0}.journey:nth-last-child(-n+2){border-bottom:1px solid var(--ink)}.journey:last-child{border-bottom:0}.capability-grid{grid-template-columns:repeat(2,1fr)}.capability-grid>div:nth-child(3n){border-right:1px solid var(--rule)}.capability-grid>div:nth-child(2n){border-right:0}.capability-grid>div:nth-last-child(-n+3){border-bottom:1px solid var(--rule)}.capability-grid>div:nth-last-child(-n+2){border-bottom:0}.prompt-section{grid-template-columns:minmax(0,1fr)}}
@media(max-width:620px){main{padding:0 20px}.site-head{padding:0 20px}.report-head{gap:58px}.report-intro,.score-sheet{min-width:0}.report-head h1{font-size:clamp(2.8rem,14vw,4.3rem)}.run-meta{grid-template-columns:1fr}.run-meta div{border-bottom:1px solid var(--rule)}.score-sheet{width:calc(100% - 10px);transform:none;box-shadow:8px 8px 0 var(--blue)}.overall-score{padding:28px 18px}.overall-score>strong{font-size:66px}.status-ledger{grid-template-columns:repeat(2,1fr)}.metric:nth-child(2){border-right:0}.metric:nth-child(-n+2){border-bottom:1px solid var(--rule)}.section-head,.checks-heading{grid-template-columns:1fr;gap:15px}.checks-heading p{grid-column:1}.category-row{grid-template-columns:1fr 48px;gap:12px}.category-row>div:first-child{grid-column:1}.score-track{grid-column:1}.category-row>strong{grid-column:2;grid-row:1/3}.category-row small{display:none}.check-group{grid-template-columns:1fr}.group-label{display:flex;justify-content:space-between;margin-bottom:12px}.check>summary{grid-template-columns:28px 1fr 50px 20px}.source{display:none}.check-body{padding-left:0;padding-right:0}.recommendation{grid-template-columns:1fr}.journey dl{gap:18px}.capability-grid{grid-template-columns:1fr}.capability-grid>div,.capability-grid>div:nth-child(3n),.capability-grid>div:nth-child(2n){border-right:0;border-bottom:1px solid var(--rule)}.capability-grid>div:nth-last-child(-n+2){border-bottom:1px solid var(--rule)}.capability-grid>div:last-child{border-bottom:0}.prompt-section{margin-inline:-20px;padding:42px 20px}.reasoning-list article>div{align-items:flex-start;flex-direction:column;gap:4px}footer{align-items:flex-start;flex-direction:column;padding-inline:20px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.toast{transition:none}}
`;

const script = String.raw`
(() => {
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const checks = [...document.querySelectorAll('[data-check]')];
  const groups = [...document.querySelectorAll('[data-group]')];
  const empty = document.querySelector('.filter-empty');
  buttons.forEach((button) => button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    buttons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    checks.forEach((check) => {
      const status = check.dataset.status;
      check.hidden = !(filter === 'all' || filter === status || (filter === 'action' && (status === 'warning' || status === 'fail')));
    });
    groups.forEach((group) => group.hidden = !group.querySelector('[data-check]:not([hidden])'));
    empty.hidden = checks.some((check) => !check.hidden);
  }));

  const copyButton = document.querySelector('[data-copy-prompt]');
  copyButton?.addEventListener('click', async () => {
    const template = document.querySelector('#fix-prompt');
    const value = template?.content?.textContent || '';
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      const field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      copied = document.execCommand('copy');
      field.remove();
    }
    const toast = document.querySelector('.toast');
    toast.textContent = copied ? 'Fix prompt copied' : 'Copy failed — open the prompt preview';
    toast.classList.add('show');
    copyButton.textContent = copied ? 'Fix prompt copied ✓' : 'Copy fix prompt ↗';
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  });
})();
`;
