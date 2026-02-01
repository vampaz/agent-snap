import { readImageFiles } from '@/utils/attachments';
import { t } from '@/utils/i18n';
import { applyInlineStyles } from '@/utils/styles';

export type PopupConfig = {
  element: string;
  timestamp?: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  initialAttachments?: string[];
  submitLabel?: string;
  copyLabel?: string;
  onSubmit: (text: string, attachments: string[]) => void;
  onCopy?: (text: string, attachments: string[]) => void | Promise<void>;
  onCancel: () => void;
  accentColor?: string;
  lightMode?: boolean;
  style?: Partial<CSSStyleDeclaration>;
  screenshot?: string;
};

export type PopupInstance = {
  root: HTMLDivElement;
  shake: () => void;
  exit: (callback?: () => void) => void;
  destroy: () => void;
  updateScreenshot: (src: string) => void;
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

  function autoResize(): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  root.appendChild(textarea);
  setTimeout(autoResize, 0);

  const attachmentsContainer = document.createElement('div');
  attachmentsContainer.className = 'as-popup-attachments';
  const attachmentsList = document.createElement('div');
  attachmentsList.className = 'as-popup-attachments-list';
  const dropzone = document.createElement('div');
  dropzone.className = 'as-popup-dropzone';
  dropzone.textContent = t('popup.dropzone');

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';

  attachmentsContainer.appendChild(attachmentsList);
  attachmentsContainer.appendChild(dropzone);
  attachmentsContainer.appendChild(fileInput);
  root.appendChild(attachmentsContainer);

  let attachments: string[] = config.initialAttachments || [];
  let isProcessingAttachments = false;

  function renderAttachments(): void {
    attachmentsList.innerHTML = '';
    attachments.forEach((src, index) => {
      const thumb = document.createElement('div');
      thumb.className = 'as-popup-attachment';
      const img = document.createElement('img');
      img.src = src;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'as-popup-attachment-remove';
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', () => {
        attachments.splice(index, 1);
        renderAttachments();
        updateDropzoneState();
      });
      thumb.appendChild(img);
      thumb.appendChild(removeBtn);
      attachmentsList.appendChild(thumb);
    });
  }

  function updateDropzoneState(): void {
    if (attachments.length >= 5) {
      dropzone.classList.add('as-disabled');
      dropzone.textContent = t('popup.dropzoneFull');
    } else {
      dropzone.classList.remove('as-disabled');
      dropzone.textContent = t('popup.dropzone');
    }
  }

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || isProcessingAttachments) return;
    const remaining = 5 - attachments.length;
    if (remaining <= 0) return;
    const toProcess = Array.from(files);
    isProcessingAttachments = true;

    try {
      const newAttachments = await readImageFiles(toProcess, remaining);
      attachments = attachments.concat(newAttachments);
    } finally {
      isProcessingAttachments = false;
      fileInput.value = '';
      renderAttachments();
      updateDropzoneState();
    }
  }

  dropzone.addEventListener('click', () => {
    if (attachments.length >= 5 || isProcessingAttachments) return;
    fileInput.click();
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (attachments.length < 5 && !isProcessingAttachments) {
      dropzone.classList.add('as-dragover');
    }
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('as-dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('as-dragover');
    if (attachments.length < 5 && !isProcessingAttachments) {
      handleFiles(e.dataTransfer?.files || null);
    }
  });

  renderAttachments();
  updateDropzoneState();

  const previewContainer = document.createElement('div');
  previewContainer.className = 'as-popup-screenshot-preview';
  previewContainer.style.display = 'none';
  const previewImg = document.createElement('img');
  previewImg.style.width = '100%';
  previewImg.style.display = 'block';
  previewImg.style.borderRadius = '4px';
  previewImg.style.border = '1px solid rgba(0,0,0,0.1)';
  previewContainer.appendChild(previewImg);
  root.appendChild(previewContainer);

  function updateScreenshot(src: string): void {
    if (src) {
      previewImg.src = src;
      previewContainer.style.display = 'block';
    } else {
      previewContainer.style.display = 'none';
    }
  }

  if (config.screenshot) {
    updateScreenshot(config.screenshot);
  }

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
      void config.onCopy?.(value, attachments);
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
  textarea.addEventListener('input', () => {
    updateSubmitState();
    autoResize();
  });

  submitButton.addEventListener('click', function handleSubmit() {
    const value = textarea.value.trim();
    if (!value) return;
    config.onSubmit(value, attachments);
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
    updateScreenshot,
  };
}
