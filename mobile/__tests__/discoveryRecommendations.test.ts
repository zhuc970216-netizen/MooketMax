import type {HomeCardItem, HomeHotSku, SubstituteProduct} from '../src/types/api';
import {
  buildDiscoveryRecommendations,
  getDiscoverySkuKey,
} from '../src/utils/discoveryRecommendations';

const selected: HomeCardItem[] = [
  {
    cardType: 'factoryProduct',
    country: '巴西',
    factoryNo: ' sif 411 ',
    productName: '牛前八件套',
    productId: 11,
    createTime: '2026-08-12 10:00:00',
  },
];

const hotSkus: HomeHotSku[] = [
  {
    country: '巴西',
    factoryNo: 'SIF3941',
    productName: '牛前八件套',
    priceMin: 57,
    priceMax: 58.2,
    offerCount: 20,
    merchantCount: 5,
    trendPoints: [{date: '08-12', avgPrice: 57.5}],
  },
  {
    country: '澳大利亚',
    factoryNo: '486',
    productName: '背骨',
    offerCount: 100,
    merchantCount: 8,
  },
];

const substitute: SubstituteProduct = {
  category: '牛',
  productName: '牛前八件套',
  currentFactoryNo: 'SIF411',
  offerCount: 25,
  merchantCount: 5,
  factories: [
    {
      factoryNo: 'sif 411',
      offerCount: 25,
      merchantCount: 5,
      isSelected: true,
    },
    {
      factoryNo: ' sif-3941 ',
      priceMin: 56.5,
      priceMax: 58,
      offerCount: 6,
      merchantCount: 2,
      isSelected: false,
    },
  ],
};

describe('buildDiscoveryRecommendations', () => {
  it('prioritizes substitutes, merges hot data, and preserves the substitute reason', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        ...hotSkus,
        {
          ...hotSkus[0],
          factoryNo: 'SIF-3941',
          offerCount: 30,
          merchantCount: 7,
        },
      ],
      recentSelfSelects: selected,
      substitutes: [{selected: selected[0], substitute}],
    });

    expect(result[0]).toMatchObject({
      country: '巴西',
      factoryNo: 'SIF-3941',
      productName: '牛前八件套',
      source: 'substitute',
      reason: '你关注的 SIF411 牛前八件套 的替代品',
      offerCount: 30,
      merchantCount: 7,
    });
    expect(result[0].trendPoints).toEqual([{date: '08-12', avgPrice: 57.5}]);
  });

  it('keeps substitutes ahead of preference candidates regardless of score size', () => {
    const manyPreferences = Array.from({length: 50}, (_, index) => ({
      ...selected[0],
      historyId: index + 1,
    }));
    const result = buildDiscoveryRecommendations({
      hotSkus,
      recentSelfSelects: manyPreferences,
      substitutes: [{selected: selected[0], substitute}],
    });

    expect(result[0].source).toBe('substitute');
    expect(result[1].source).toBe('preference');
  });

  it('filters the complete selected SKU but does not filter related SKUs', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        {
          country: '巴西',
          factoryNo: 'SIF411',
          productName: '牛前八件套',
          offerCount: 999,
        },
        ...hotSkus,
      ],
      recentSelfSelects: selected,
    });

    expect(result.map(item => item.factoryNo)).not.toContain('SIF411');
    expect(result.map(item => item.factoryNo)).toContain('SIF3941');
  });

  it('weights product, country, and factory preferences and emits Chinese reasons', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        ...hotSkus,
        {
          country: '乌拉圭',
          factoryNo: 'SIF411',
          productName: '胸肉',
          offerCount: 1,
          merchantCount: 1,
        },
      ],
      recentSelfSelects: selected,
    });

    expect(result[0]).toMatchObject({
      factoryNo: 'SIF3941',
      source: 'preference',
      reason: '与你关注的巴西牛前八件套相近',
    });
    expect(result[1]).toMatchObject({
      factoryNo: 'SIF411',
      source: 'preference',
      reason: '你常关注的 SIF411 厂号',
    });
    expect(result.at(-1)).toMatchObject({
      source: 'hot',
      reason: '多家商家正在报价',
    });
  });

  it('deduplicates candidates and keeps input order when scores are equal', () => {
    const first = {...hotSkus[1], country: '新西兰', factoryNo: 'ME21'};
    const second = {...hotSkus[1], country: '澳大利亚', factoryNo: '486'};
    const result = buildDiscoveryRecommendations({
      hotSkus: [first, second, {...first}],
      recentSelfSelects: [],
    });

    expect(result).toHaveLength(2);
    expect(result.map(item => item.factoryNo)).toEqual(['ME21', '486']);
  });

  it('ignores incomplete inputs, supports limits, and creates normalized keys', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [{country: '巴西', factoryNo: null, productName: '牛腩'}, ...hotSkus],
      recentSelfSelects: [],
      limit: 1,
    });

    expect(result).toHaveLength(1);
    expect(getDiscoverySkuKey({
      country: ' 巴西 ',
      factoryNo: ' sif 411 ',
      productName: ' 牛前八件套 ',
    })).toBe('巴西|sif411|牛前八件套');
  });

  it('treats null API arrays as empty lists instead of throwing', () => {
    expect(() =>
      buildDiscoveryRecommendations({
        hotSkus: null,
        recentSelfSelects: null,
        substitutes: null,
      }),
    ).not.toThrow();

    expect(
      buildDiscoveryRecommendations({
        hotSkus: null,
        recentSelfSelects: null,
        substitutes: null,
      }),
    ).toEqual([]);
  });

  it('skips substitute inputs with null factories and sanitizes null trend points', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [{...hotSkus[0], trendPoints: null}],
      recentSelfSelects: selected,
      substitutes: [
        {
          selected: selected[0],
          substitute: {...substitute, factories: null as unknown as SubstituteProduct['factories']},
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      factoryNo: 'SIF3941',
      source: 'preference',
    });
    expect(result[0].trendPoints).toEqual([]);
  });
});
