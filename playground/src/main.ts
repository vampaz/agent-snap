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

function destroyAnnotator(): void {
  annotator?.destroy();
  annotator = null;
}

// Initialize on load
mountAnnotator();

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
