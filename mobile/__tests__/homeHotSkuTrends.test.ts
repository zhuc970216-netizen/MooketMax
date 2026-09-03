import {buildHotSkuTrendFromDailyPrices, formatHotSkuPriceRange} from '../src/utils/homeHotSkuTrends';

describe('homeHotSkuTrends', () => {
  it('uses detail-page daily average prices in their original order', () => {
    const trend = buildHotSkuTrendFromDailyPrices([
      {avgPrice: 49},
      {avgPrice: 50},
      {avgPrice: 50},
      {avgPrice: 50.8},
      {avgPrice: 49.9},
    ]);

    expect(trend).toEqual([49, 50, 50, 50.8, 49.9]);
  });

  it('duplicates a single point so the chart is visible', () => {
    expect(buildHotSkuTrendFromDailyPrices([{avgPrice: 50.8}])).toEqual([50.8, 50.8]);
  });

  it('ignores invalid values', () => {
    expect(buildHotSkuTrendFromDailyPrices([{avgPrice: 0}, null, {avgPrice: '49.5'}, {avgPrice: 'bad'}])).toEqual([49.5, 49.5]);
  });

  it('formats hot sku price ranges', () => {
    expect(formatHotSkuPriceRange(49, 50.8)).toBe('49-50.8');
    expect(formatHotSkuPriceRange(50, 50)).toBe('50');
    expect(formatHotSkuPriceRange(null, 50)).toBeUndefined();
  });
});
