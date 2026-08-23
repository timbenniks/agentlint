<script setup lang="ts">
import { ref } from "vue";

const copied = ref(false);
const install = "npx @timbenniks/agentlint init https://example.com";

async function copyInstall() {
  await navigator.clipboard.writeText(install);
  copied.value = true;
  window.setTimeout(() => (copied.value = false), 1600);
}
</script>

<template>
  <main class="agent-home">
    <section class="hero-ledger" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="signal-label"><span aria-hidden="true"></span> Website readiness / measured</p>
        <h1 id="hero-title">Can an agent<br />actually use your site?</h1>
        <p class="hero-deck">
          Agentlint scans the public evidence, delegates only bounded judgment, and leaves a fix prompt your coding agent can execute.
        </p>
        <div class="install-line">
          <code>{{ install }}</code>
          <button type="button" :aria-label="copied ? 'Command copied' : 'Copy install command'" @click="copyInstall">
            {{ copied ? "Copied" : "Copy" }}
          </button>
        </div>
        <div class="hero-actions">
          <a class="action-primary" href="/guide/getting-started">Run the first scan <span aria-hidden="true">↗</span></a>
          <a class="action-secondary" href="/concepts/deterministic-first">Read the model</a>
        </div>
      </div>

      <div class="scan-sheet" aria-label="Example Agentlint scan result">
        <div class="sheet-head"><span>SCAN / 7F2A</span><span>PUBLIC · READ ONLY</span></div>
        <div class="score-row">
          <strong>98</strong>
          <div><span>overall readiness</span><small>evidence-backed</small></div>
          <i aria-label="passing">PASS</i>
        </div>
        <ol class="trace-list">
          <li class="pass"><b>01</b><span>Discovery surface</span><em>99</em></li>
          <li class="pass"><b>02</b><span>Bounded missions</span><em>94</em></li>
          <li class="warn"><b>03</b><span>Docs prerequisites</span><em>WARN</em></li>
          <li class="pass"><b>04</b><span>Safe tool plan</span><em>98</em></li>
        </ol>
        <div class="sheet-foot"><span>30 pass</span><span>2 warnings</span><span>0 fail</span><span>7 n/a</span></div>
      </div>
    </section>

    <section class="method-band" aria-labelledby="method-title">
      <div class="section-index">01 / METHOD</div>
      <div class="method-intro">
        <h2 id="method-title">A scanner and a reasoner,<br />with a hard boundary between them.</h2>
        <p>The CLI owns collection and scoring. Your agent handles only the structured tasks that need meaning.</p>
      </div>
      <ol class="method-steps">
        <li><b>Observe</b><span>HTTP, HTML, protocols, accessibility</span></li>
        <li><b>Reason</b><span>Schema-bound tasks using supplied evidence</span></li>
        <li><b>Test</b><span>Four safe, non-executed missions</span></li>
        <li><b>Fix</b><span>A prioritized prompt for the site repository</span></li>
      </ol>
    </section>

    <section class="proof-section" aria-labelledby="proof-title">
      <div class="section-index">02 / PROPERTIES</div>
      <h2 id="proof-title">The useful constraints are the product.</h2>
      <div class="proof-grid">
        <article>
          <span class="proof-code">E / 01</span>
          <h3>Every claim keeps its evidence</h3>
          <p>Checks link conclusions to headers, markup, protocol documents, browser observations, or task citations.</p>
          <a href="/concepts/deterministic-first">How evidence flows →</a>
        </article>
        <article>
          <span class="proof-code">S / 02</span>
          <h3>Only applicable checks count</h3>
          <p>A portfolio is not punished for lacking an API. N/A is explicit and never quietly scored as failure.</p>
          <a href="/concepts/scoring">Read the scoring model →</a>
        </article>
        <article>
          <span class="proof-code">A / 03</span>
          <h3>The agent gets a closed world</h3>
          <p>Reasoning instructions, evidence, and output schema travel together. Invented sources and mutating plans are rejected.</p>
          <a href="/concepts/reasoning-tasks">Inspect reasoning tasks →</a>
        </article>
      </div>
    </section>

    <section class="routes-section" aria-labelledby="routes-title">
      <div class="section-index">03 / ROUTES</div>
      <h2 id="routes-title">Choose your working mode.</h2>
      <div class="route-list">
        <a href="/guide/project-setup"><span>In a website repository</span><b>Initialize once, scan while you build</b><em>01</em></a>
        <a href="/integrations/coding-agents"><span>With Codex, Claude Code, or Cursor</span><b>Resolve tasks and apply the fix loop</b><em>02</em></a>
        <a href="/guide/ci-regressions"><span>In continuous integration</span><b>Protect an accepted readiness baseline</b><em>03</em></a>
        <a href="/guide/getting-started#scan-any-public-site"><span>From anywhere</span><b>Inspect any public website without setup</b><em>04</em></a>
      </div>
    </section>

    <section class="closing-callout">
      <p>One command to expose the gap between<br /><strong>machine-readable</strong> and <strong>agent-usable.</strong></p>
      <a href="/guide/getting-started">Start with a public URL <span aria-hidden="true">→</span></a>
    </section>
  </main>
</template>
