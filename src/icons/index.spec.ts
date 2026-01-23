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
});
