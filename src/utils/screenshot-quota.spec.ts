import { describe, expect, it } from 'vitest';

import { getDailyScreenshotQuota } from '@/utils/screenshot-quota';

describe('getDailyScreenshotQuota', function () {
  it('counts screenshots within the current day', function () {
    const now = new Date('2026-02-04T12:00:00.000Z').getTime();
    const startOfDay = new Date('2026-02-04T00:00:00.000Z').getTime();
    const prevDay = new Date('2026-02-03T23:59:59.000Z').getTime();

    const quota = getDailyScreenshotQuota({
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
          screenshot: 'data:image/png;base64,a',
        },
        {
          id: 'b',
          x: 0,
          y: 0,
          comment: '',
          element: 'div',
          elementPath: 'div',
          timestamp: prevDay,
          screenshot: 'data:image/png;base64,b',
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

    expect(quota).toEqual({ used: 1, total: 10 });
  });
});
