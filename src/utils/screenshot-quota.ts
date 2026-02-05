import type { Annotation } from '@/types';

export type ScreenshotQuota = {
  used: number;
  total: number;
  isUnlimited?: boolean;
};

const DEFAULT_DAILY_SCREENSHOT_LIMIT = 50;

export function getDailyUploadQuota(options: {
  annotations: Annotation[];
  now?: number;
  dailyLimit?: number | null;
}): ScreenshotQuota {
  const { annotations } = options;
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const dailyLimit =
    typeof options.dailyLimit === 'number' ? options.dailyLimit : DEFAULT_DAILY_SCREENSHOT_LIMIT;
  const isUnlimited = options.dailyLimit === null;

  const limit = isUnlimited ? 0 : Math.max(dailyLimit, 0);
  if (!isUnlimited && limit === 0) return { used: 0, total: 0 };

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startTimestamp = startOfDay.getTime();
  const endTimestamp = startTimestamp + 24 * 60 * 60 * 1000;

  let used = 0;
  for (const annotation of annotations) {
    if (annotation.timestamp < startTimestamp) continue;
    if (annotation.timestamp >= endTimestamp) continue;
    if (annotation.remoteScreenshot) {
      used += 1;
    }
    if (annotation.remoteAttachments && annotation.remoteAttachments.length > 0) {
      used += annotation.remoteAttachments.length;
    }
  }

  return { used: used, total: limit, isUnlimited: isUnlimited || undefined };
}
