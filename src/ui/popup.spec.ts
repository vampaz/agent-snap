import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAnnotationPopup } from '@/ui/popup';

describe('annotation popup', function () {
  beforeEach(function () {
    if (!globalThis.requestAnimationFrame) {
      globalThis.requestAnimationFrame = function requestAnimationFrame(
        callback,
      ) {
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

    const textarea = popup.root.querySelector(
      '.ua-popup-textarea',
    ) as HTMLTextAreaElement;
    const submit = popup.root.querySelector(
      '.ua-popup-submit',
    ) as HTMLButtonElement;

    expect(textarea).not.toBeNull();
    expect(submit.disabled).toBe(true);

    textarea.dispatchEvent(new FocusEvent('focus'));
    textarea.dispatchEvent(new FocusEvent('blur'));

    submit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSubmit).not.toHaveBeenCalled();

    textarea.value = 'Update the label';
    textarea.dispatchEvent(new Event('input'));
    expect(submit.disabled).toBe(false);

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(onSubmit).toHaveBeenCalledWith('Update the label');
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
});
