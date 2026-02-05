import type { Annotation } from '@/types';

export type ScreenshotQuota = {
  used: number;
  total: number;
};

const DEFAULT_DAILY_SCREENSHOT_LIMIT = 50;

export function getDailyScreenshotQuota(options: {
  annotations: Annotation[];
  now?: number;
  dailyLimit?: number;
}): ScreenshotQuota {
  const { annotations } = options;
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const dailyLimit =
    typeof options.dailyLimit === 'number' ? options.dailyLimit : DEFAULT_DAILY_SCREENSHOT_LIMIT;

  const limit = Math.max(dailyLimit, 0);
  if (limit === 0) return { used: 0, total: 0 };

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startTimestamp = startOfDay.getTime();
  const endTimestamp = startTimestamp + 24 * 60 * 60 * 1000;

  let used = 0;
  for (const annotation of annotations) {
    if (!annotation.screenshot) continue;
    if (annotation.timestamp < startTimestamp) continue;
    if (annotation.timestamp >= endTimestamp) continue;
    used += 1;
  }

  return { used: used, total: limit };
}
