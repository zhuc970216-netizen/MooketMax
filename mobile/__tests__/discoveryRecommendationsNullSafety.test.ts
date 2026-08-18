import type {HomeCardItem, HomeHotSku} from '../src/types/api';
import type {PlateSnapshot} from '../src/utils/plateFollowStore';
import {buildDiscoveryRecommendations} from '../src/utils/discoveryRecommendations';

describe('buildDiscoveryRecommendations null safety', () => {
  it('treats null top-level inputs as empty collections', () => {
    expect(() =>
      buildDiscoveryRecommendations({
        hotSkus: null,
        recentSelfSelects: null,
        intentPlates: null,
        followedMerchants: null,
        detailsBySkuKey: null,
      }),
    ).not.toThrow();

    expect(
      buildDiscoveryRecommendations({
        hotSkus: null,
        recentSelfSelects: null,
        intentPlates: null,
        followedMerchants: null,
        detailsBySkuKey: null,
      }),
    ).toEqual([]);
  });

  it('skips incomplete seeds and sanitizes null trend points without crashing', () => {
    const hotSkus: HomeHotSku[] = [
      {
        country: '加拿大',
        factoryNo: 'P101',
        productName: '猪耳',
        priceMin: 27,
        priceMax: 28,
        offerCount: 12,
        merchantCount: 3,
        trendPoints: [{date: '2026-08-10', avgPrice: null}, {date: '2026-08-11', avgPrice: 28}],
      },
    ];
    const recentSelfSelects: HomeCardItem[] = [
      {
        cardType: 'factoryProduct',
        country: '加拿大',
        factoryNo: null,
        productName: '猪耳',
      },
    ];
    const intentPlates: PlateSnapshot[] = [
      {
        key: 'broken',
        type: 'offer',
        title: 'broken',
        country: null,
        factoryNo: 'P100',
        productName: '猪耳',
      },
    ];

    const result = buildDiscoveryRecommendations({
      hotSkus,
      recentSelfSelects,
      intentPlates,
      followedMerchants: [{merchantId: null, merchantName: null}],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      factoryNo: 'P101',
      relationType: 'market_hot',
    });
    expect(result[0].trendPoints).toEqual([{date: '2026-08-11', avgPrice: 28}]);
  });
});
