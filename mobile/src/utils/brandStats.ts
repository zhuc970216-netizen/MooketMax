import type {BrandProductSummary} from '../types/api';

type BrandStatsSource = {
  todayOfferCount?: number | string | null;
  yesterdayOfferCount?: number | string | null;
  totalOfferCount?: number | string | null;
  todayInquiryCount?: number | string | null;
  yesterdayInquiryCount?: number | string | null;
  totalInquiryCount?: number | string | null;
  summaries?: BrandProductSummary[] | null;
};

export function getRecentBrandOfferCount(source?: Partial<BrandStatsSource> | null) {
  if (!source) return null;
  const total = normalizeNumber(source.totalOfferCount);
  if (total != null && total > 0) return total;

  const today = normalizeNumber(source.todayOfferCount);
  const yesterday = normalizeNumber(source.yesterdayOfferCount);
  if (today != null || yesterday != null) {
    const count = (today ?? 0) + (yesterday ?? 0);
    if (count > 0) return count;
  }

  return sumSummaryCount(source.summaries, 'offerCount');
}

export function getRecentBrandInquiryCount(source?: Partial<BrandStatsSource> | null) {
  if (!source) return null;
  const total = normalizeNumber(source.totalInquiryCount);
  if (total != null && total > 0) return total;

  const today = normalizeNumber(source.todayInquiryCount);
  const yesterday = normalizeNumber(source.yesterdayInquiryCount);
  if (today != null || yesterday != null) {
    const count = (today ?? 0) + (yesterday ?? 0);
    if (count > 0) return count;
  }

  return sumSummaryCount(source.summaries, 'inquiryCount');
}

function sumSummaryCount(
  summaries?: BrandProductSummary[] | null,
  key: 'offerCount' | 'inquiryCount',
) {
  if (!summaries?.length) return null;
  const total = summaries.reduce(
    (sum, item) => sum + (normalizeNumber((item as Record<string, unknown>)[key] as number | string | null) ?? 0),
    0,
  );
  return total > 0 ? total : null;
}

function normalizeNumber(value?: number | string | null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
