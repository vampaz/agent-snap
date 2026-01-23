import { t } from '@/utils/i18n';

export type PopupConfig = {
  element: string;
  timestamp?: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  accentColor?: string;
  lightMode?: boolean;
  style?: Partial<CSSStyleDeclaration>;
};

export type PopupInstance = {
  root: HTMLDivElement;
  shake: () => void;
  exit: (callback?: () => void) => void;
  destroy: () => void;
};

function applyInlineStyles(
  element: HTMLElement,
  styles?: Partial<CSSStyleDeclaration>,
): void {
  if (!styles) return;
  Object.entries(styles).forEach(function applyStyle([key, value]) {
    if (typeof value === 'string') {
      element.style.setProperty(key, value);
    }
  });
}

function setButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
  button.style.opacity = enabled ? '1' : '0.4';
}

export function createAnnotationPopup(config: PopupConfig): PopupInstance {
  const root = document.createElement('div');
  root.className = 'ua-popup';
  root.dataset.uiAnnotator = 'true';

  if (config.lightMode) {
    root.classList.add('ua-light');
  }

  applyInlineStyles(root, config.style);

  const header = document.createElement('div');
  header.className = 'ua-popup-header';
  const elementLabel = document.createElement('span');
  elementLabel.className = 'ua-popup-element';
  elementLabel.textContent = config.element;
  header.appendChild(elementLabel);

  if (config.timestamp) {
    const timestamp = document.createElement('span');
    timestamp.className = 'ua-popup-timestamp';
    timestamp.textContent = config.timestamp;
    header.appendChild(timestamp);
  }

  root.appendChild(header);

  if (config.selectedText) {
    const quote = document.createElement('div');
    quote.className = 'ua-popup-quote';
    const snippet = config.selectedText.slice(0, 80);
    quote.textContent = `"${snippet}${config.selectedText.length > 80 ? '...' : ''}"`;
    root.appendChild(quote);
  }

  const textarea = document.createElement('textarea');
  textarea.className = 'ua-popup-textarea';
  textarea.rows = 2;
  textarea.placeholder = config.placeholder || t('popup.placeholder');
  textarea.value = config.initialValue || '';
  if (config.accentColor) {
    textarea.addEventListener('focus', function handleFocus() {
      textarea.style.borderColor = config.accentColor || '';
    });
    textarea.addEventListener('blur', function handleBlur() {
      textarea.style.borderColor = '';
    });
  }

  root.appendChild(textarea);

  const actions = document.createElement('div');
  actions.className = 'ua-popup-actions';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'ua-popup-cancel';
  cancelButton.type = 'button';
  cancelButton.textContent = t('popup.cancel');
  cancelButton.addEventListener('click', function handleCancel() {
    config.onCancel();
  });

  const submitButton = document.createElement('button');
  submitButton.className = 'ua-popup-submit';
  submitButton.type = 'button';
  submitButton.textContent = config.submitLabel || t('popup.submit');
  if (config.accentColor) {
    submitButton.style.backgroundColor = config.accentColor;
  }

  function updateSubmitState(): void {
    const hasText = textarea.value.trim().length > 0;
    setButtonEnabled(submitButton, hasText);
  }

  updateSubmitState();
  textarea.addEventListener('input', updateSubmitState);

  submitButton.addEventListener('click', function handleSubmit() {
    const value = textarea.value.trim();
    if (!value) return;
    config.onSubmit(value);
  });

  textarea.addEventListener('keydown', function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitButton.click();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      config.onCancel();
    }
  });

  actions.appendChild(cancelButton);
  actions.appendChild(submitButton);
  root.appendChild(actions);

  function animateEnter(): void {
    root.classList.add('ua-enter');
    requestAnimationFrame(function addEntered() {
      root.classList.add('ua-entered');
    });
    setTimeout(function focusTextarea() {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      textarea.scrollTop = textarea.scrollHeight;
    }, 50);
  }

  animateEnter();

  function shake(): void {
    root.classList.add('ua-shake');
    setTimeout(function stopShake() {
      root.classList.remove('ua-shake');
      textarea.focus();
    }, 250);
  }

  function exit(callback?: () => void): void {
    root.classList.remove('ua-entered');
    root.classList.add('ua-exit');
    setTimeout(function finishExit() {
      if (callback) callback();
    }, 150);
  }

  function destroy(): void {
    root.remove();
  }

  return {
    root,
    shake,
    exit,
    destroy,
  };
}
