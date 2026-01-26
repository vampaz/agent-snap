import { describe, expect, it } from 'vitest';

import {
  createIconCheckSmallAnimated,
  createIconClose,
  createIconCopyAnimated,
  createIconEyeAnimated,
  createIconGear,
  createIconHelp,
  createIconListSparkle,
  createIconMoon,
  createIconPausePlayAnimated,
  createIconPlus,
  createIconSun,
  createIconTrash,
  createIconXmark,
  createIconXmarkLarge,
} from '@/icons';

describe('icon factory', function () {
  it('creates svg elements', function () {
    const icons = [
      createIconListSparkle(),
      createIconPausePlayAnimated(),
      createIconPausePlayAnimated({ isPaused: true }),
      createIconEyeAnimated(),
      createIconEyeAnimated({ isOpen: false }),
      createIconCopyAnimated(),
      createIconCopyAnimated({ copied: true }),
      createIconTrash(),
      createIconGear(),
      createIconXmarkLarge(),
      createIconSun(),
      createIconMoon(),
      createIconHelp(),
      createIconCheckSmallAnimated(),
      createIconPlus(),
      createIconXmark(),
      createIconClose(),
    ];

    icons.forEach(function verifyIcon(icon) {
      expect(icon.nodeName.toLowerCase()).toBe('svg');
      expect(icon.getAttribute('viewBox')).not.toBeNull();
    });
  });

  it('toggles pause/play visibility based on state', function () {
    const paused = createIconPausePlayAnimated({ isPaused: true });
    const playing = createIconPausePlayAnimated({ isPaused: false });

    const pausedPlay = paused.querySelector('.play-triangle') as SVGGElement;
    const pausedPause = paused.querySelector('.pause-bar') as SVGGElement;
    const playingPlay = playing.querySelector('.play-triangle') as SVGGElement;
    const playingPause = playing.querySelector('.pause-bar') as SVGGElement;

    expect(pausedPlay.getAttribute('style')).toContain('opacity: 1');
    expect(pausedPause.getAttribute('style')).toContain('opacity: 0');
    expect(playingPlay.getAttribute('style')).toContain('opacity: 0');
    expect(playingPause.getAttribute('style')).toContain('opacity: 1');
  });

  it('toggles copy/check visibility based on copied state', function () {
    const copied = createIconCopyAnimated({ copied: true });
    const idle = createIconCopyAnimated({ copied: false });

    const copiedCheck = copied.querySelector('.check-icon') as SVGGElement;
    const copiedCopy = copied.querySelector('.copy-icon') as SVGGElement;
    const idleCheck = idle.querySelector('.check-icon') as SVGGElement;
    const idleCopy = idle.querySelector('.copy-icon') as SVGGElement;

    expect(copiedCheck.getAttribute('style')).toContain('opacity: 1');
    expect(copiedCopy.getAttribute('style')).toContain('opacity: 0');
    expect(idleCheck.getAttribute('style')).toContain('opacity: 0');
    expect(idleCopy.getAttribute('style')).toContain('opacity: 1');
  });

  it('toggles eye visibility based on open state', function () {
    const open = createIconEyeAnimated({ isOpen: true });
    const closed = createIconEyeAnimated({ isOpen: false });

    const openGroup = open.querySelector('.eye-open') as SVGGElement;
    const closedGroup = open.querySelector('.eye-closed') as SVGGElement;
    const closedOpen = closed.querySelector('.eye-open') as SVGGElement;
    const closedClosed = closed.querySelector('.eye-closed') as SVGGElement;

    expect(openGroup.getAttribute('style')).toContain('opacity: 1');
    expect(closedGroup.getAttribute('style')).toContain('opacity: 0');
    expect(closedOpen.getAttribute('style')).toContain('opacity: 0');
    expect(closedClosed.getAttribute('style')).toContain('opacity: 1');
  });
});
