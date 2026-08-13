import type {HomeCardItem, HomeHotSku, SubstituteProduct} from '../src/types/api';
import {buildDiscoveryRecommendations} from '../src/utils/discoveryRecommendations';

const selected: HomeCardItem = {
  cardType: 'factoryProduct',
  country: 'Brazil',
  factoryNo: 'SIF411',
  productName: 'Chuck roll',
  productId: 11,
};

const hotSku: HomeHotSku = {
  country: 'Brazil',
  factoryNo: 'SIF3941',
  productName: 'Chuck roll',
  offerCount: 20,
  merchantCount: 5,
  trendPoints: null,
};

const substituteWithNullFactories: SubstituteProduct = {
  category: 'beef',
  productName: 'Chuck roll',
  currentFactoryNo: 'SIF411',
  factories: null as unknown as SubstituteProduct['factories'],
};

describe('buildDiscoveryRecommendations null safety', () => {
  it('treats null top-level API arrays as empty lists', () => {
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
      hotSkus: [hotSku],
      recentSelfSelects: [selected],
      substitutes: [
        {
          selected,
          substitute: substituteWithNullFactories,
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
