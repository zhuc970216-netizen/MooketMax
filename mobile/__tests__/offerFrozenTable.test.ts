import {
  formatOfferTablePrice,
  getOfferTableValues,
} from '../src/components/home/OfferFrozenTable';

describe('OfferFrozenTable formatters', () => {
  it('maps the four scrollable fields and prefers goodsLocation', () => {
    expect(
      getOfferTableValues({
        feedingType: '草饲',
        weight: '20吨',
        goodsLocation: '上海港',
        region: '华东',
        tags: '现货',
      } as never),
    ).toEqual(['上海港', '现货', '草饲', '20吨']);
  });

  it('falls back to region and uses dashes for missing fields', () => {
    expect(getOfferTableValues({region: '华南'} as never)).toEqual([
      '华南',
      '-',
      '-',
      '-',
    ]);
  });

  it('formats single prices, ranges, and negotiated offers', () => {
    expect(formatOfferTablePrice(54.5, 54.5)).toBe('54.5');
    expect(formatOfferTablePrice(54.5, 54.9)).toBe('54.5~54.9');
    expect(formatOfferTablePrice()).toBe('协商报价');
  });
});
