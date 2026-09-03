import type {
  CountryFactoryProductDetail,
  HomeCardItem,
  HomeHotSku,
  MerchantOfferGroup,
} from '../src/types/api';
import type {PlateSnapshot} from '../src/utils/plateFollowStore';
import {
  buildDiscoveryRecommendations,
  getDiscoveryDetailRequestKeys,
  getDiscoverySkuKey,
} from '../src/utils/discoveryRecommendations';

function buildTrend(values: number[]) {
  return values.map((avgPrice, index) => ({
    date: `2026-08-${String(index + 10).padStart(2, '0')}`,
    avgPrice,
    offerCount: 12 + index,
  }));
}

function buildDailyHistory(values: number[]) {
  return values.map((avgPrice, index) => {
    const day = `2026-08-${String(index + 10).padStart(2, '0')}`;
    return {
      date: day.slice(5),
      fullDate: day,
      avgPrice,
      offerCount: 12 + index,
    };
  });
}

function buildHotSku({
  country = '巴西',
  factoryNo,
  productName,
  priceMin = 50,
  priceMax = 51,
  offerCount = 20,
  merchantCount = 8,
  trend = [50, 50.2, 50.4],
}: {
  country?: string;
  factoryNo: string;
  productName: string;
  priceMin?: number;
  priceMax?: number;
  offerCount?: number;
  merchantCount?: number;
  trend?: number[];
}): HomeHotSku {
  return {
    country,
    factoryNo,
    productName,
    productId: 1,
    priceMin,
    priceMax,
    offerCount,
    merchantCount,
    trendPoints: buildTrend(trend),
  };
}

function buildSelfSelect({
  country = '巴西',
  factoryNo,
  productName,
  createTime = '2026-08-16 12:00:00',
  priceMin = 50,
  priceMax = 51,
}: {
  country?: string;
  factoryNo: string;
  productName: string;
  createTime?: string;
  priceMin?: number;
  priceMax?: number;
}): HomeCardItem {
  return {
    cardType: 'factoryProduct',
    country,
    factoryNo,
    productName,
    productId: 1,
    createTime,
    priceMin,
    priceMax,
  };
}

function buildIntentPlate({
  country = '巴西',
  factoryNo,
  productName,
  createdAt = 1_723_773_600_000,
  price = 50,
  priceMax = 51,
}: {
  country?: string;
  factoryNo: string;
  productName: string;
  createdAt?: number;
  price?: number;
  priceMax?: number;
}): PlateSnapshot {
  return {
    key: `offer|${country}|${factoryNo}|${productName}`,
    type: 'offer',
    title: `${productName} ${country}${factoryNo}`,
    country,
    factoryNo,
    productName,
    merchantName: '收藏商家',
    price,
    priceMax,
    createdAt,
  };
}

function buildMerchantOffer(
  merchantId: number | string | null,
  merchantName: string,
  offerCount = 1,
): MerchantOfferGroup {
  return {
    merchantId,
    merchantName,
    offerCount,
    employeeOffers: [],
  };
}

function buildDetail({
  country = '巴西',
  factoryNo,
  productName,
  priceMin = 50,
  priceMax = 51,
  offerCount = 18,
  merchantCount = 6,
  trend = [50, 50.2, 50.4],
  merchantOffers = [],
}: {
  country?: string;
  factoryNo: string;
  productName: string;
  priceMin?: number;
  priceMax?: number;
  offerCount?: number;
  merchantCount?: number;
  trend?: number[];
  merchantOffers?: MerchantOfferGroup[];
}): CountryFactoryProductDetail {
  return {
    country,
    factoryNo,
    productId: 1,
    productName,
    priceMin,
    priceMax,
    offerCount,
    inquiryCount: 0,
    merchantCount,
    priceHistory7Days: buildDailyHistory(trend),
    priceHistory30Days: [],
    merchantOffers,
    totalCount: offerCount,
  };
}

function buildDetailMap(...details: CountryFactoryProductDetail[]) {
  return new Map(
    details.map(detail => [
      getDiscoverySkuKey(detail)!,
      detail,
    ]),
  );
}

describe('buildDiscoveryRecommendations', () => {
  it('builds same-tier, merchant-peer, and budget recommendations from ladder seeds', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        buildHotSku({
          factoryNo: 'SIF2051',
          productName: '牛腩',
          priceMin: 54.5,
          priceMax: 55,
          offerCount: 88,
          merchantCount: 44,
          trend: [55.4, 55.2, 55],
        }),
        buildHotSku({
          factoryNo: 'SIF112',
          productName: '牛腩',
          priceMin: 54.6,
          priceMax: 55.1,
          offerCount: 72,
          merchantCount: 28,
          trend: [55.2, 55.1, 54.9],
        }),
        buildHotSku({
          factoryNo: 'SIF2437',
          productName: '牛腩',
          priceMin: 55.1,
          priceMax: 55.6,
          offerCount: 36,
          merchantCount: 14,
          trend: [55.8, 55.5, 55.3],
        }),
        buildHotSku({
          factoryNo: 'SIF3974',
          productName: '牛腩',
          priceMin: 48.5,
          priceMax: 49.1,
          offerCount: 60,
          merchantCount: 24,
          trend: [49.8, 49.2, 48.8],
        }),
      ],
      recentSelfSelects: [buildSelfSelect({factoryNo: 'SIF2051', productName: '牛腩', priceMin: 54.5, priceMax: 55})],
      followedMerchants: [{merchantId: 101, merchantName: '郑州帮你省供应链管理有限公司'}],
      detailsBySkuKey: buildDetailMap(
        buildDetail({
          factoryNo: 'SIF112',
          productName: '牛腩',
          priceMin: 54.6,
          priceMax: 55.1,
          offerCount: 28,
          merchantCount: 9,
          merchantOffers: [buildMerchantOffer(101, '郑州帮你省供应链管理有限公司')],
        }),
        buildDetail({
          factoryNo: 'SIF2437',
          productName: '牛腩',
          priceMin: 55.1,
          priceMax: 55.6,
          offerCount: 16,
          merchantCount: 5,
          merchantOffers: [buildMerchantOffer(202, '普通商家')],
        }),
      ),
      limit: 10,
    });

    expect(result.some(item => item.factoryNo === 'SIF2051')).toBe(false);
    expect(result.find(item => item.factoryNo === 'SIF112')).toMatchObject({
      relationType: 'merchant_peer',
      template: 'merchant',
      reasonBadge: '关注商家在卖',
    });
    expect(result.find(item => item.factoryNo === 'SIF2437')).toMatchObject({
      relationType: 'ladder_peer',
      template: 'compare',
      reasonBadge: '同级替代',
    });
    expect(result.find(item => item.factoryNo === 'SIF3974')).toMatchObject({
      relationType: 'ladder_budget',
      reasonBadge: '更省预算',
    });
    expect(
      result.some(
        item =>
          item.relationType === 'ladder_premium' ||
          item.relationType === 'merchant_premium',
      ),
    ).toBe(false);
  });

  it('upgrades premium recommendations when followed merchants match by normalized merchant name', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        buildHotSku({
          factoryNo: 'SIF3974',
          productName: '牛腩',
          priceMin: 50.5,
          priceMax: 51.2,
          offerCount: 84,
          merchantCount: 36,
        }),
        buildHotSku({
          factoryNo: 'SIF2051',
          productName: '牛腩',
          priceMin: 55.4,
          priceMax: 56.1,
          offerCount: 70,
          merchantCount: 18,
        }),
      ],
      recentSelfSelects: [buildSelfSelect({factoryNo: 'SIF3974', productName: '牛腩'})],
      followedMerchants: [{merchantName: '郑州帮你省供应链管理有限公司'}],
      detailsBySkuKey: buildDetailMap(
        buildDetail({
          factoryNo: 'SIF2051',
          productName: '牛腩',
          priceMin: 55.4,
          priceMax: 56.1,
          merchantOffers: [buildMerchantOffer(null, '郑州帮你省供应链（郑州）有限公司')],
        }),
      ),
      limit: 10,
    });

    expect(result.find(item => item.factoryNo === 'SIF2051')).toMatchObject({
      relationType: 'merchant_premium',
      template: 'merchant',
      reasonBadge: '商家可升级',
    });
  });

  it('does not emit ladder_budget when lower tiers are not confirmed cheaper after detail hydration', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [buildHotSku({factoryNo: 'SIF3974', productName: '牛腩', priceMin: 50, priceMax: 50.8})],
      recentSelfSelects: [buildSelfSelect({factoryNo: 'SIF3974', productName: '牛腩', priceMin: 50, priceMax: 50.8})],
      detailsBySkuKey: buildDetailMap(
        buildDetail({
          factoryNo: 'SIF2051',
          productName: '牛腩',
          priceMin: 55.2,
          priceMax: 55.9,
        }),
      ),
      limit: 10,
    });

    expect(result.some(item => item.relationType === 'ladder_budget')).toBe(false);
  });

  it('falls back to market recommendations when the seed sku is outside the ladder coverage', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        buildHotSku({
          country: '加拿大',
          factoryNo: 'P100',
          productName: '猪耳',
          priceMin: 29,
          priceMax: 30,
          offerCount: 20,
          merchantCount: 6,
          trend: [31, 30.5, 30],
        }),
        buildHotSku({
          country: '加拿大',
          factoryNo: 'P101',
          productName: '猪耳',
          priceMin: 27,
          priceMax: 28,
          offerCount: 32,
          merchantCount: 10,
          trend: [28.4, 28.2, 27.9],
        }),
        buildHotSku({
          country: '加拿大',
          factoryNo: 'P102',
          productName: '猪耳',
          priceMin: 31,
          priceMax: 32,
          offerCount: 42,
          merchantCount: 16,
          trend: [31, 31.4, 31.8],
        }),
      ],
      recentSelfSelects: [buildSelfSelect({country: '加拿大', factoryNo: 'P100', productName: '猪耳'})],
      limit: 10,
    });

    expect(result.map(item => item.factoryNo)).not.toContain('P100');
    expect(result).toHaveLength(2);
    expect(result.every(item => item.relationType === 'market_down' || item.relationType === 'market_hot')).toBe(true);
    expect(result[0]?.relationType).toBe('market_down');
  });

  it('matches product aliases in ladder rules and normalizes sku keys', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        buildHotSku({
          factoryNo: 'SIF3941',
          productName: '牛前件套',
          priceMin: 57,
          priceMax: 58.2,
          offerCount: 30,
          merchantCount: 12,
        }),
      ],
      recentSelfSelects: [buildSelfSelect({factoryNo: 'SIF411', productName: '牛前八件套'})],
      limit: 10,
    });

    expect(result.find(item => item.factoryNo === 'SIF3941')).toMatchObject({
      relationType: 'ladder_premium',
      canonicalProductName: '牛前件套',
    });
    expect(
      getDiscoverySkuKey({
        country: ' 巴西 ',
        factoryNo: ' sif 411 ',
        productName: ' 牛前八件套 ',
      }),
    ).toBe('巴西|sif411|牛前八件套');
  });

  it('returns only candidates that still need hydration from getDiscoveryDetailRequestKeys', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        buildHotSku({
          factoryNo: 'SIF2051',
          productName: '牛腩',
          priceMin: 54.5,
          priceMax: 55,
          offerCount: 88,
          merchantCount: 44,
        }),
        buildHotSku({
          factoryNo: 'SIF112',
          productName: '牛腩',
          priceMin: 54.6,
          priceMax: 55.1,
          offerCount: 72,
          merchantCount: 28,
        }),
      ],
      recentSelfSelects: [buildSelfSelect({factoryNo: 'SIF2051', productName: '牛腩'})],
      limit: 10,
    });

    expect(getDiscoveryDetailRequestKeys(result, 1)).toEqual([
      getDiscoverySkuKey({
        country: '巴西',
        factoryNo: 'SIF112',
        productName: '牛腩',
      }),
    ]);
  });

  it('deduplicates overlapping seeds and keeps the newest intent record', () => {
    const result = buildDiscoveryRecommendations({
      hotSkus: [
        buildHotSku({
          factoryNo: 'SIF112',
          productName: '牛腩',
          priceMin: 54.6,
          priceMax: 55.1,
          offerCount: 72,
          merchantCount: 28,
        }),
      ],
      intentPlates: [
        buildIntentPlate({factoryNo: 'SIF2051', productName: '牛腩', createdAt: 1_723_770_000_000}),
        buildIntentPlate({factoryNo: 'SIF2051', productName: '牛腩', createdAt: 1_723_780_000_000}),
      ],
      recentSelfSelects: [buildSelfSelect({factoryNo: 'SIF2051', productName: '牛腩', createTime: '2026-08-14 10:00:00'})],
      limit: 10,
    });

    expect(result[0]?.seedFactoryNo).toBe('SIF2051');
    expect(result[0]?.seedSkuKey).toBe('巴西|sif2051|牛腩');
  });
});
