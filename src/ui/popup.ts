import { t } from '@/utils/i18n';
import { applyInlineStyles } from '@/utils/styles';

export type PopupConfig = {
  element: string;
  timestamp?: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  copyLabel?: string;
  onSubmit: (text: string) => void;
  onCopy?: (text: string) => void | Promise<void>;
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

function setButtonEnabled(button: HTMLButtonElement, enabled: boolean): void {
  button.disabled = !enabled;
  button.style.opacity = enabled ? '1' : '0.4';
}

export function createAnnotationPopup(config: PopupConfig): PopupInstance {
  const root = document.createElement('div');
  root.className = 'as-popup';
  root.dataset.uiAnnotator = 'true';
  root.dataset.testid = 'popup-root';

  if (config.lightMode) {
    root.classList.add('as-light');
  }

  applyInlineStyles(root, config.style);

  const header = document.createElement('div');
  header.className = 'as-popup-header';
  const elementLabel = document.createElement('span');
  elementLabel.className = 'as-popup-element';
  elementLabel.textContent = config.element;
  header.appendChild(elementLabel);

  if (config.timestamp) {
    const timestamp = document.createElement('span');
    timestamp.className = 'as-popup-timestamp';
    timestamp.textContent = config.timestamp;
    header.appendChild(timestamp);
  }

  root.appendChild(header);

  if (config.selectedText) {
    const quote = document.createElement('div');
    quote.className = 'as-popup-quote';
    const snippet = config.selectedText.slice(0, 80);
    quote.textContent = `"${snippet}${config.selectedText.length > 80 ? '...' : ''}"`;
    root.appendChild(quote);
  }

  const textarea = document.createElement('textarea');
  textarea.className = 'as-popup-textarea';
  textarea.dataset.testid = 'popup-textarea';
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
  actions.className = 'as-popup-actions';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'as-popup-cancel';
  cancelButton.dataset.testid = 'popup-cancel';
  cancelButton.type = 'button';
  cancelButton.textContent = t('popup.cancel');
  cancelButton.addEventListener('click', function handleCancel() {
    config.onCancel();
  });

  const submitButton = document.createElement('button');
  submitButton.className = 'as-popup-submit';
  submitButton.dataset.testid = 'popup-submit';
  submitButton.type = 'button';
  submitButton.textContent = config.submitLabel || t('popup.submit');
  if (config.accentColor) {
    submitButton.style.backgroundColor = config.accentColor;
  }

  let copyButton: HTMLButtonElement | null = null;
  if (config.onCopy) {
    copyButton = document.createElement('button');
    copyButton.className = 'as-popup-copy';
    copyButton.dataset.testid = 'popup-copy';
    copyButton.type = 'button';
    copyButton.textContent = config.copyLabel || t('popup.copy');
    if (config.accentColor) {
      copyButton.style.borderColor = config.accentColor;
      copyButton.style.color = config.accentColor;
    }
    copyButton.addEventListener('click', function handleCopy() {
      const value = textarea.value.trim();
      if (!value) return;
      void config.onCopy?.(value);
    });
  }

  function updateSubmitState(): void {
    const hasText = textarea.value.trim().length > 0;
    setButtonEnabled(submitButton, hasText);
    if (copyButton) {
      setButtonEnabled(copyButton, hasText);
    }
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
    const navigationKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ];
    if (navigationKeys.includes(event.key)) {
      event.stopPropagation();
    }
  });

  actions.appendChild(cancelButton);
  if (copyButton) {
    actions.appendChild(copyButton);
  }
  actions.appendChild(submitButton);
  root.appendChild(actions);

  function animateEnter(): void {
    root.classList.add('as-enter');
    requestAnimationFrame(function addEntered() {
      root.classList.add('as-entered');
    });
    setTimeout(function focusTextarea() {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      textarea.scrollTop = textarea.scrollHeight;
    }, 50);
  }

  animateEnter();

  function shake(): void {
    root.classList.add('as-shake');
    setTimeout(function stopShake() {
      root.classList.remove('as-shake');
      textarea.focus();
    }, 250);
  }

  function exit(callback?: () => void): void {
    root.classList.remove('as-entered');
    root.classList.add('as-exit');
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
