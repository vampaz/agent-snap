import { createAgentSnap } from '@/index';
import type { Annotation, AgentSnapInstance } from '@/index';
import './main.css';

// Variable to hold the annotator instance
let annotator: AgentSnapInstance | null = null;

function handleAnnotationAdd(annotation: Annotation): void {
  console.log('[preview] annotation added', annotation);
}

function handleAnnotationDelete(annotation: Annotation): void {
  console.log('[preview] annotation deleted', annotation);
}

function handleAnnotationUpdate(annotation: Annotation): void {
  console.log('[preview] annotation updated', annotation);
}

function handleAnnotationsClear(annotations: Annotation[]): void {
  console.log('[preview] annotations cleared', annotations);
}

function handleCopy(markdown: string): void {
  console.log('[preview] output copied', markdown);
}

function mountAnnotator(): void {
  // Only mount if not already mounted
  if (annotator) return;

  annotator = createAgentSnap({
    settings: {
      annotationColor: '#ec6b2d',
      autoClearAfterCopy: false,
      blockInteractions: false,
      outputDetail: 'standard',
    },
    copyToClipboard: true,
    onAnnotationAdd: handleAnnotationAdd,
    onAnnotationDelete: handleAnnotationDelete,
    onAnnotationUpdate: handleAnnotationUpdate,
    onAnnotationsClear: handleAnnotationsClear,
    onCopy: handleCopy,
  });
}

function setupShadowDomHost(): void {
  const host = document.getElementById('shadow-host');
  if (!host || host.shadowRoot) return;

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: block;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #e8e8e8;
    }

    .shadow-shell {
      background: #141414;
      border-radius: 10px;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: grid;
      gap: 12px;
    }

    .shadow-eyebrow {
      font-size: 0.7rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #ec6b2d;
      margin: 0;
    }

    h4 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #e8e8e8;
    }

    .shadow-copy {
      margin: 0;
      color: #888;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .shadow-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .shadow-primary,
    .shadow-ghost {
      font-family: inherit;
      border-radius: 6px;
      padding: 8px 14px;
      font-size: 0.8rem;
      font-weight: 500;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s;
    }

    .shadow-primary {
      background: #ec6b2d;
      color: #fff;
    }

    .shadow-primary:hover {
      background: #d45f28;
    }

    .shadow-ghost {
      background: transparent;
      color: #888;
      border-color: rgba(255, 255, 255, 0.15);
    }

    .shadow-ghost:hover {
      color: #e8e8e8;
      border-color: #888;
    }

    .shadow-list {
      margin: 0;
      padding-left: 18px;
      color: #555;
      font-size: 0.8rem;
      display: grid;
      gap: 4px;
    }

    .shadow-list li {
      color: #888;
    }
  `;

  // Build shadow DOM content using safe DOM methods
  const wrapper = document.createElement('div');
  wrapper.className = 'shadow-shell';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'shadow-eyebrow';
  eyebrow.textContent = 'Shadow DOM';

  const heading = document.createElement('h4');
  heading.textContent = 'Inline review capsule';

  const copy = document.createElement('p');
  copy.className = 'shadow-copy';
  copy.textContent = 'Try annotating text and buttons inside this shadow root.';

  const actions = document.createElement('div');
  actions.className = 'shadow-actions';

  const approveBtn = document.createElement('button');
  approveBtn.className = 'shadow-primary';
  approveBtn.textContent = 'Approve';

  const editBtn = document.createElement('button');
  editBtn.className = 'shadow-ghost';
  editBtn.textContent = 'Needs edits';

  actions.appendChild(approveBtn);
  actions.appendChild(editBtn);

  const list = document.createElement('ul');
  list.className = 'shadow-list';

  const items = ['Nested list item', 'Secondary label', 'Status: Waiting'];
  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });

  wrapper.appendChild(eyebrow);
  wrapper.appendChild(heading);
  wrapper.appendChild(copy);
  wrapper.appendChild(actions);
  wrapper.appendChild(list);

  shadow.appendChild(style);
  shadow.appendChild(wrapper);
}

function setupEmbeddedContexts(): void {
  setupShadowDomHost();
}

function destroyAnnotator(): void {
  annotator?.destroy();
  annotator = null;
}

// Initialize on load
mountAnnotator();
setupEmbeddedContexts();

// Add cleanup for HMR or page unload
window.addEventListener('beforeunload', destroyAnnotator);

// Copy install command
const copyInstallBtn = document.getElementById('copy-install');
if (copyInstallBtn) {
  copyInstallBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText('npm install agent-snap');
    copyInstallBtn.style.color = '#3fb950';
    setTimeout(() => {
      copyInstallBtn.style.color = '';
    }, 1500);
  });
}

// Button handlers
const viewOutputBtn = document.getElementById('view-output');
const resetDemoBtn = document.getElementById('reset-demo');

if (viewOutputBtn) {
  viewOutputBtn.addEventListener('click', async () => {
    if (annotator) {
      const output = await annotator.copyOutput();
      if (output) {
        // Create a temporary modal to show output
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #1a1a1a;
          padding: 24px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
          z-index: 1000000;
          max-width: 80vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          gap: 16px;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Annotation Output';
        title.style.cssText = 'margin: 0; color: #e8e8e8; font-size: 1.1rem;';

        const textarea = document.createElement('textarea');
        textarea.value = output;
        textarea.style.cssText = `
          width: 100%;
          min-width: 400px;
          height: 300px;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #0d0d0d;
          color: #e8e8e8;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.8rem;
          resize: vertical;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.className = 'primary';
        closeBtn.onclick = () => document.body.removeChild(modal);

        modal.appendChild(title);
        modal.appendChild(textarea);
        modal.appendChild(closeBtn);
        document.body.appendChild(modal);
      } else {
        alert('No annotations to export.');
      }
    }
  });
}

if (resetDemoBtn) {
  resetDemoBtn.addEventListener('click', () => {
    destroyAnnotator();
    localStorage.removeItem('agent-snap-' + window.location.pathname);
    mountAnnotator();
    alert('Demo reset (annotations cleared).');
  });
}
