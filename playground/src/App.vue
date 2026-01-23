<template>
  <div class="page">
    <header class="hero">
      <div class="hero-content">
        <p class="eyebrow">UI Annotator Playground</p>
        <h1>Capture feedback directly on the interface you are reviewing.</h1>
        <p class="subtitle">
          Use the floating toolbar to toggle annotation mode, drop notes, and
          export structured output. This layout is here to give you a mix of
          cards, form inputs, and lists to click through.
        </p>
        <div class="hero-actions">
          <button class="primary">Request review</button>
          <button class="ghost">Explore updates</button>
        </div>
        <div class="hero-meta">
          <div>
            <span class="meta-label">Build</span>
            <span class="meta-value">v0.1.0</span>
          </div>
          <div>
            <span class="meta-label">Status</span>
            <span class="meta-value">Ready for feedback</span>
          </div>
          <div>
            <span class="meta-label">Last sync</span>
            <span class="meta-value">Today, 9:12am</span>
          </div>
        </div>
      </div>
      <div class="hero-card">
        <div class="status">
          <span class="status-dot"></span>
          <span>Live prototype</span>
        </div>
        <h3>Shipping update</h3>
        <p>
          We have refined the review flow so teams can capture visuals, text
          snippets, and nearby context in a single pass.
        </p>
        <div class="stat-grid">
          <div>
            <span class="stat-label">Feedback loops</span>
            <span class="stat-value">2.3x faster</span>
          </div>
          <div>
            <span class="stat-label">Context depth</span>
            <span class="stat-value">Detailed+</span>
          </div>
          <div>
            <span class="stat-label">Retention</span>
            <span class="stat-value">94%</span>
          </div>
        </div>
      </div>
    </header>

    <section class="feature-grid">
      <article class="feature-card">
        <p class="feature-label">Annotate</p>
        <h3>Pin feedback on any element</h3>
        <p>
          Capture precise notes across headers, buttons, or full regions with
          multi-select annotations.
        </p>
        <div class="feature-footer">
          <span class="feature-meta">Shortcut: Shift + click</span>
          <button class="ghost small">Preview</button>
        </div>
      </article>
      <article class="feature-card">
        <p class="feature-label">Collect</p>
        <h3>Bundle notes with visual context</h3>
        <p>
          Each marker stores element data, nearby text, and computed styles for
          richer handoff.
        </p>
        <div class="feature-footer">
          <span class="feature-meta">Output: Structured</span>
          <button class="ghost small">Export</button>
        </div>
      </article>
      <article class="feature-card">
        <p class="feature-label">Review</p>
        <h3>Keep the team aligned</h3>
        <p>
          Track changes, add revisions, and see what has been acknowledged
          without leaving the page.
        </p>
        <div class="feature-footer">
          <span class="feature-meta">Shared workspace</span>
          <button class="ghost small">Invite</button>
        </div>
      </article>
    </section>

    <section class="workflow">
      <div class="panel">
        <div class="panel-header">
          <h2>Launch checklist</h2>
          <button class="ghost small">Export list</button>
        </div>
        <div class="checklist">
          <label class="check-item">
            <input type="checkbox" checked />
            <span>Verify navigation and header hierarchy</span>
          </label>
          <label class="check-item">
            <input type="checkbox" checked />
            <span>Confirm primary CTA copy</span>
          </label>
          <label class="check-item">
            <input type="checkbox" />
            <span>Review contrast and accessibility notes</span>
          </label>
          <label class="check-item">
            <input type="checkbox" />
            <span>Collect final stakeholder feedback</span>
          </label>
        </div>
        <div class="timeline">
          <div>
            <span class="timeline-time">09:00</span>
            <span class="timeline-event">Sprint review walkthrough</span>
          </div>
          <div>
            <span class="timeline-time">10:30</span>
            <span class="timeline-event">Capture notes from stakeholders</span>
          </div>
          <div>
            <span class="timeline-time">13:00</span>
            <span class="timeline-event">Finalize changes for launch</span>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <h2>Request a review</h2>
          <span class="panel-pill">2 open slots</span>
        </div>
        <form class="request-form">
          <label>
            Project name
            <input type="text" placeholder="Aurora redesign" />
          </label>
          <label>
            Review type
            <select>
              <option>Interface polish</option>
              <option>Accessibility audit</option>
              <option>Interaction critique</option>
            </select>
          </label>
          <label>
            Notes for reviewers
            <textarea rows="4" placeholder="Focus on layout balance and CTA clarity."></textarea>
          </label>
          <button class="primary full">Send request</button>
        </form>
      </div>
    </section>

    <footer class="footer">
      <p>Tip: click the floating icon to enable annotation mode.</p>
      <div class="footer-actions">
        <button class="ghost small">View output</button>
        <button class="ghost small">Reset demo</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { createUiAnnotator } from '@/index';
import type { UiAnnotatorInstance } from '@/index';

let annotator: UiAnnotatorInstance | null = null;

function mountAnnotator(): void {
  annotator = createUiAnnotator({
    initialTheme: 'light',
    settings: {
      annotationColor: '#ec6b2d',
      autoClearAfterCopy: false,
      blockInteractions: false,
      outputDetail: 'standard',
    },
  });
}

function destroyAnnotator(): void {
  annotator?.destroy();
  annotator = null;
}

onMounted(function onMountedHandler() {
  mountAnnotator();
});

onBeforeUnmount(function onBeforeUnmountHandler() {
  destroyAnnotator();
});
</script>

<style scoped>
.page {
  max-width: 1160px;
  margin: 0 auto;
  padding: 56px 24px 96px;
  display: flex;
  flex-direction: column;
  gap: 56px;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 32px;
  align-items: center;
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.72rem;
  color: var(--ink-muted);
  margin: 0;
}

h1 {
  font-family: 'Fraunces', 'Times New Roman', serif;
  font-size: clamp(2.4rem, 3vw + 1rem, 3.6rem);
  line-height: 1.05;
  margin: 0;
}

.subtitle {
  font-size: 1.05rem;
  color: var(--ink-muted);
  max-width: 32rem;
  margin: 0;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.primary,
.ghost {
  border-radius: 999px;
  padding: 0.85rem 1.6rem;
  font-size: 0.95rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.primary {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 16px 30px rgba(236, 107, 45, 0.25);
}

.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 40px rgba(236, 107, 45, 0.3);
}

.ghost {
  background: transparent;
  color: #2a2f35;
  border-color: rgba(43, 47, 53, 0.2);
}

.ghost:hover {
  transform: translateY(-1px);
}

.ghost.small {
  padding: 0.55rem 1.1rem;
  font-size: 0.85rem;
}

.primary.full {
  width: 100%;
}

.hero-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.meta-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--ink-muted);
}

.meta-value {
  display: block;
  font-weight: 600;
  margin-top: 6px;
}

.hero-card {
  background: var(--surface);
  border-radius: 24px;
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 24px 60px rgba(20, 22, 30, 0.12);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-card h3 {
  margin: 0;
  font-size: 1.3rem;
}

.hero-card p {
  margin: 0;
  color: var(--ink-muted);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--ink-muted);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 999px;
  padding: 6px 12px;
  width: fit-content;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #34c759;
  box-shadow: 0 0 0 3px rgba(52, 199, 89, 0.2);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink-muted);
}

.stat-value {
  display: block;
  font-weight: 600;
  margin-top: 6px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.feature-card {
  background: var(--surface-strong);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 18px 40px rgba(20, 22, 30, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 220px;
}

.feature-card h3 {
  margin: 0;
  font-size: 1.15rem;
}

.feature-card p {
  margin: 0;
  color: var(--ink-muted);
}

.feature-label {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  color: var(--accent-strong);
  margin: 0;
}

.feature-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.feature-meta {
  font-size: 0.85rem;
  color: var(--ink-muted);
}

.workflow {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.panel {
  background: var(--surface-strong);
  border-radius: 24px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 20px 40px rgba(20, 22, 30, 0.08);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.3rem;
}

.panel-pill {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  padding: 6px 10px;
  border-radius: 999px;
}

.checklist {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
}

.check-item input {
  accent-color: var(--accent);
  width: 18px;
  height: 18px;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(43, 47, 53, 0.1);
}

.timeline-time {
  font-weight: 600;
  margin-right: 8px;
}

.timeline-event {
  color: var(--ink-muted);
}

.request-form {
  display: grid;
  gap: 16px;
}

.request-form label {
  display: grid;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--ink-muted);
}

.request-form input,
.request-form select,
.request-form textarea {
  padding: 0.75rem 0.9rem;
  border-radius: 14px;
  border: 1px solid rgba(43, 47, 53, 0.2);
  background: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
  color: #1b1d1f;
  font-family: inherit;
}

.request-form textarea {
  resize: vertical;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(43, 47, 53, 0.1);
  color: var(--ink-muted);
}

.footer-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 980px) {
  .hero {
    grid-template-columns: 1fr;
  }

  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workflow {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .hero-meta {
    grid-template-columns: 1fr;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
