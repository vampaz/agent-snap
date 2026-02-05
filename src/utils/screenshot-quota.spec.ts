import { describe, expect, it } from 'vitest';

import { getDailyUploadQuota } from '@/utils/screenshot-quota';

describe('getDailyUploadQuota', function () {
  it('counts uploads within the current day', function () {
    const now = new Date('2026-02-04T12:00:00.000Z').getTime();
    const startOfDay = new Date('2026-02-04T00:00:00.000Z').getTime();
    const prevDay = new Date('2026-02-03T23:59:59.000Z').getTime();

    const quota = getDailyUploadQuota({
      now: now,
      dailyLimit: 10,
      annotations: [
        {
          id: 'a',
          x: 0,
          y: 0,
          comment: '',
          element: 'div',
          elementPath: 'div',
          timestamp: startOfDay,
          remoteScreenshot: 'https://example.com/a.png',
          remoteAttachments: ['https://example.com/b.png'],
        },
        {
          id: 'b',
          x: 0,
          y: 0,
          comment: '',
          element: 'div',
          elementPath: 'div',
          timestamp: prevDay,
          remoteScreenshot: 'https://example.com/c.png',
        },
        {
          id: 'c',
          x: 0,
          y: 0,
          comment: '',
          element: 'div',
          elementPath: 'div',
          timestamp: startOfDay + 1000,
        },
      ],
    });

    expect(quota).toEqual({ used: 2, total: 10 });
  });

  it('marks quota as unlimited when dailyLimit is null', function () {
    const quota = getDailyUploadQuota({
      dailyLimit: null,
      annotations: [],
    });

    expect(quota.isUnlimited).toBe(true);
  });
});
