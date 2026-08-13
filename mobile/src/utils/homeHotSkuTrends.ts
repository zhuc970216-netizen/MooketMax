export type DailyPriceLike = {
  avgPrice?: unknown;
};

export function buildHotSkuTrendFromDailyPrices(history?: Array<DailyPriceLike | null | undefined> | null): number[] {
  const trend = (history ?? [])
    .map(point => Number(point?.avgPrice))
    .filter((value): value is number => Number.isFinite(value) && value > 0);

  return trend.length === 1 ? [trend[0], trend[0]] : trend;
}

export function formatHotSkuPriceRange(priceMin?: number | string | null, priceMax?: number | string | null): string | undefined {
  const min = toPositiveNumber(priceMin);
  const max = toPositiveNumber(priceMax) ?? min;

  if (min == null || max == null) {
    return undefined;
  }

  return min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`;
}

function toPositiveNumber(value?: number | string | null) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, '');
}
