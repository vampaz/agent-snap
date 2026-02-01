import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAnnotationPopup } from '@/ui/popup';

describe('annotation popup', function () {
  beforeEach(function () {
    if (!globalThis.requestAnimationFrame) {
      globalThis.requestAnimationFrame = function requestAnimationFrame(callback) {
        callback(0);
        return 0;
      };
    }
  });

  it('renders and submits text', function () {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const popup = createAnnotationPopup({
      element: 'button "Save"',
      timestamp: '@0.2s',
      selectedText: 'Save changes',
      onSubmit: onSubmit,
      onCancel: onCancel,
      accentColor: '#3c82f7',
      lightMode: true,
      style: { left: '10px' },
    });

    document.body.appendChild(popup.root);

    const textarea = popup.root.querySelector('.as-popup-textarea') as HTMLTextAreaElement;
    const submit = popup.root.querySelector('.as-popup-submit') as HTMLButtonElement;

    expect(textarea).not.toBeNull();
    expect(submit.disabled).toBe(true);

    textarea.dispatchEvent(new FocusEvent('focus'));
    textarea.dispatchEvent(new FocusEvent('blur'));

    submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSubmit).not.toHaveBeenCalled();

    textarea.value = 'Update the label';
    textarea.dispatchEvent(new Event('input'));
    expect(submit.disabled).toBe(false);

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onSubmit).toHaveBeenCalledWith('Update the label', []);
    expect(onCancel).toHaveBeenCalled();
  });

  it('shakes and exits', function () {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const popup = createAnnotationPopup({
      element: 'card',
      onSubmit: onSubmit,
      onCancel: onCancel,
    });

    popup.shake();
    vi.advanceTimersByTime(250);

    const onExit = vi.fn();
    popup.exit(onExit);
    vi.advanceTimersByTime(150);
    expect(onExit).toHaveBeenCalled();
    popup.exit();
    vi.advanceTimersByTime(150);
    popup.destroy();
  });

  it('uses default labels and handles cancel actions', function () {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const popup = createAnnotationPopup({
      element: 'card',
      onSubmit: onSubmit,
      onCancel: onCancel,
    });

    document.body.appendChild(popup.root);

    const textarea = popup.root.querySelector('.as-popup-textarea') as HTMLTextAreaElement;
    const submit = popup.root.querySelector('.as-popup-submit') as HTMLButtonElement;
    const cancel = popup.root.querySelector('.as-popup-cancel') as HTMLButtonElement;

    expect(textarea.placeholder).toBe('Any thoughts?');
    expect(submit.textContent).toBe('Create');

    cancel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    textarea.value = 'Needs more contrast';
    textarea.dispatchEvent(new Event('input'));
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, shiftKey: true }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('prevents navigation keys from bubbling', function () {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const popup = createAnnotationPopup({
      element: 'card',
      onSubmit: onSubmit,
      onCancel: onCancel,
    });

    document.body.appendChild(popup.root);

    const textarea = popup.root.querySelector('.as-popup-textarea') as HTMLTextAreaElement;
    const onDocumentKeyDown = vi.fn();
    document.addEventListener('keydown', onDocumentKeyDown);

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

    navigationKeys.forEach(function dispatchKey(key) {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true }));
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: key,
          bubbles: true,
          ctrlKey: true,
        }),
      );
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: key,
          bubbles: true,
          metaKey: true,
        }),
      );
    });

    expect(onDocumentKeyDown).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onDocumentKeyDown);
  });

  it('truncates selected text in the quote preview', function () {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const longText = 'a'.repeat(90);
    const popup = createAnnotationPopup({
      element: 'card',
      selectedText: longText,
      onSubmit: onSubmit,
      onCancel: onCancel,
    });

    document.body.appendChild(popup.root);

    const quote = popup.root.querySelector('.as-popup-quote') as HTMLDivElement;
    expect(quote.textContent).toBe(`\"${'a'.repeat(80)}...\"`);
  });

  it('copies text when copy action is provided', function () {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const onCopy = vi.fn();
    const popup = createAnnotationPopup({
      element: 'card',
      onSubmit: onSubmit,
      onCancel: onCancel,
      onCopy: onCopy,
    });

    document.body.appendChild(popup.root);

    const textarea = popup.root.querySelector('.as-popup-textarea') as HTMLTextAreaElement;
    const copy = popup.root.querySelector('.as-popup-copy') as HTMLButtonElement;

    expect(copy.disabled).toBe(true);

    textarea.value = 'Copy this note';
    textarea.dispatchEvent(new Event('input'));
    copy.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onCopy).toHaveBeenCalledWith('Copy this note', []);
  });
});
