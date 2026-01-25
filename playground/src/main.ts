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
      font-family: 'Space Grotesk', 'Helvetica Neue', sans-serif;
      color: #1b1d1f;
    }

    .shadow-shell {
      background: linear-gradient(140deg, rgba(255, 255, 255, 0.8), rgba(255, 246, 235, 0.9));
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(43, 47, 53, 0.15);
      box-shadow: 0 12px 28px rgba(20, 22, 30, 0.08);
      display: grid;
      gap: 10px;
    }

    .shadow-eyebrow {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: #7a6f66;
      margin: 0;
    }

    h4 {
      margin: 0;
      font-size: 1.1rem;
    }

    .shadow-copy {
      margin: 0;
      color: #5d636a;
      font-size: 0.9rem;
    }

    .shadow-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .shadow-primary,
    .shadow-ghost {
      border-radius: 999px;
      padding: 0.45rem 0.9rem;
      font-size: 0.85rem;
      border: 1px solid transparent;
      cursor: pointer;
      background: #ec6b2d;
      color: #fff;
    }

    .shadow-ghost {
      background: transparent;
      color: #2a2f35;
      border-color: rgba(43, 47, 53, 0.2);
    }

    .shadow-list {
      margin: 0;
      padding-left: 18px;
      color: #5d636a;
      font-size: 0.85rem;
      display: grid;
      gap: 6px;
    }
  `;

  const wrapper = document.createElement('div');
  wrapper.className = 'shadow-shell';
  wrapper.innerHTML = `
    <p class="shadow-eyebrow">Shadow DOM sample</p>
    <h4>Inline review capsule</h4>
    <p class="shadow-copy">Try annotating text and buttons inside this shadow root.</p>
    <div class="shadow-actions">
      <button class="shadow-primary">Approve</button>
      <button class="shadow-ghost">Needs edits</button>
    </div>
    <ul class="shadow-list">
      <li>Nested list item</li>
      <li>Secondary label</li>
      <li>Status: Waiting</li>
    </ul>
  `;

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

// Button handlers
const viewOutputBtn = document.getElementById('view-output');
const resetDemoBtn = document.getElementById('reset-demo');

if (viewOutputBtn) {
  viewOutputBtn.addEventListener('click', async () => {
    if (annotator) {
      const output = await annotator.copyOutput();
      if (output) {
        // Create a temporary modal or alert to show output
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = 'white';
        modal.style.padding = '24px';
        modal.style.borderRadius = '12px';
        modal.style.boxShadow = '0 20px 50px rgba(0,0,0,0.2)';
        modal.style.zIndex = '1000000';
        modal.style.maxWidth = '80vw';
        modal.style.maxHeight = '80vh';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.gap = '16px';

        const title = document.createElement('h3');
        title.textContent = 'Annotation Output';
        title.style.margin = '0';

        const textarea = document.createElement('textarea');
        textarea.value = output;
        textarea.style.width = '100%';
        textarea.style.minWidth = '400px';
        textarea.style.height = '300px';
        textarea.style.padding = '12px';
        textarea.style.borderRadius = '8px';
        textarea.style.border = '1px solid #ccc';

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
