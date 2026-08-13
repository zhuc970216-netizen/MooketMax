import type {
  HomeCardItem,
  HomeHotSku,
  HomeHotSkuTrendPoint,
  SubstituteProduct,
} from '../types/api';
import {normalizeFactoryNoOrNull} from './factoryNo';

export type DiscoveryRecommendationSource =
  | 'substitute'
  | 'preference'
  | 'hot';

export type DiscoveryRecommendation = {
  key: string;
  country: string;
  factoryNo: string;
  productId: number | null;
  productName: string;
  priceMin: number | null;
  priceMax: number | null;
  offerCount: number;
  merchantCount: number;
  trendPoints: HomeHotSkuTrendPoint[];
  source: DiscoveryRecommendationSource;
  reason: string;
  score: number;
};

export type SubstituteRecommendationInput = {
  selected?: HomeCardItem | null;
  substitute?: SubstituteProduct | null;
};

export type BuildDiscoveryRecommendationsInput = {
  hotSkus?: Array<HomeHotSku | null | undefined> | null;
  recentSelfSelects?: Array<HomeCardItem | null | undefined> | null;
  substitutes?: Array<SubstituteRecommendationInput | null | undefined> | null;
  limit?: number;
};

type SkuIdentity = {
  country: string;
  factoryNo: string;
  productName: string;
};

type RankedRecommendation = DiscoveryRecommendation & {
  inputOrder: number;
};

const SUBSTITUTE_SCORE = 1_000_000;
const PRODUCT_PREFERENCE_SCORE = 30_000;
const COUNTRY_PREFERENCE_SCORE = 10_000;
const FACTORY_PREFERENCE_SCORE = 20_000;

export function buildDiscoveryRecommendations({
  hotSkus,
  recentSelfSelects,
  substitutes = [],
  limit,
}: BuildDiscoveryRecommendationsInput): DiscoveryRecommendation[] {
  const safeHotSkus = toArray(hotSkus).filter((item): item is HomeHotSku => item != null);
  const safeRecentSelfSelects = toArray(recentSelfSelects).filter(
    (item): item is HomeCardItem => item != null,
  );
  const safeSubstitutes = toArray(substitutes).filter(
    (item): item is SubstituteRecommendationInput => item != null,
  );
  const selectedSkus = new Set(
    safeRecentSelfSelects
      .map(toSkuIdentity)
      .filter((item): item is SkuIdentity => item != null)
      .map(getSkuKey),
  );
  const candidates = new Map<string, RankedRecommendation>();
  let inputOrder = 0;

  safeSubstitutes.forEach(input => {
    const selected = toSkuIdentity(input.selected);
    if (!selected) {
      return;
    }

    toArray(input.substitute?.factories).forEach(factory => {
      const factoryNo = normalizeFactoryNoOrNull(factory.factoryNo);
      if (!factoryNo || factoryNo === selected.factoryNo) {
        return;
      }

      const identity = {...selected, factoryNo};
      const key = getSkuKey(identity);
      if (selectedSkus.has(key) || candidates.has(key)) {
        return;
      }

      candidates.set(key, {
        key,
        ...identity,
        productId: input.selected.productId ?? null,
        priceMin: toNullableNumber(factory.priceMin),
        priceMax: toNullableNumber(factory.priceMax),
        offerCount: toCount(factory.offerCount),
        merchantCount: toCount(factory.merchantCount),
        trendPoints: [],
        source: 'substitute',
        reason: `你关注的 ${selected.factoryNo} ${selected.productName} 的替代品`,
        score:
          SUBSTITUTE_SCORE +
          getActivityScore(factory.offerCount, factory.merchantCount),
        inputOrder: inputOrder++,
      });
    });
  });

  safeHotSkus.forEach(hotSku => {
    const identity = toSkuIdentity(hotSku);
    if (!identity) {
      return;
    }

    const key = getSkuKey(identity);
    if (selectedSkus.has(key)) {
      return;
    }

    const preference = getPreference(identity, safeRecentSelfSelects);
    const source: DiscoveryRecommendationSource = preference.score > 0
      ? 'preference'
      : 'hot';
    const candidate: RankedRecommendation = {
      key,
      ...identity,
      productId: hotSku.productId ?? null,
      priceMin: toNullableNumber(hotSku.priceMin),
      priceMax: toNullableNumber(hotSku.priceMax),
      offerCount: toCount(hotSku.offerCount),
      merchantCount: toCount(hotSku.merchantCount),
      trendPoints: sanitizeTrendPoints(hotSku.trendPoints),
      source,
      reason: preference.reason ?? getHotReason(hotSku),
      score:
        preference.score +
        getActivityScore(hotSku.offerCount, hotSku.merchantCount),
      inputOrder: inputOrder++,
    };

    const existing = candidates.get(key);
    if (!existing) {
      candidates.set(key, candidate);
      return;
    }

    candidates.set(key, mergeRecommendation(existing, candidate));
  });

  const sorted = Array.from(candidates.values()).sort((left, right) => {
    const sourceDifference =
      getSourcePriority(right.source) - getSourcePriority(left.source);
    if (sourceDifference !== 0) {
      return sourceDifference;
    }
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.offerCount !== right.offerCount) {
      return right.offerCount - left.offerCount;
    }
    if (left.merchantCount !== right.merchantCount) {
      return right.merchantCount - left.merchantCount;
    }
    return left.inputOrder - right.inputOrder;
  });

  const result = sorted.map(({inputOrder: _inputOrder, ...item}) => item);
  return limit == null ? result : result.slice(0, Math.max(0, limit));
}

function getSourcePriority(source: DiscoveryRecommendationSource) {
  switch (source) {
    case 'substitute':
      return 3;
    case 'preference':
      return 2;
    case 'hot':
      return 1;
  }
}

export function getDiscoverySkuKey(
  value: Pick<HomeHotSku, 'country' | 'factoryNo' | 'productName'>,
) {
  const identity = toSkuIdentity(value);
  return identity ? getSkuKey(identity) : null;
}

function getPreference(identity: SkuIdentity, selfSelects: HomeCardItem[]) {
  let bestReason: string | null = null;
  let bestReasonWeight = 0;
  let score = 0;

  selfSelects.forEach(selected => {
    const productMatches = equalsText(identity.productName, selected.productName);
    const countryMatches = equalsText(identity.country, selected.country);
    const selectedFactoryNo = normalizeFactoryNoOrNull(selected.factoryNo);
    const factoryMatches = Boolean(
      selectedFactoryNo && selectedFactoryNo === identity.factoryNo,
    );

    if (productMatches) {
      score += PRODUCT_PREFERENCE_SCORE;
    }
    if (countryMatches) {
      score += COUNTRY_PREFERENCE_SCORE;
    }
    if (factoryMatches) {
      score += FACTORY_PREFERENCE_SCORE;
    }

    const reason = getPreferenceReason({
      identity,
      productMatches,
      countryMatches,
      factoryMatches,
    });
    if (reason && reason.weight > bestReasonWeight) {
      bestReason = reason.text;
      bestReasonWeight = reason.weight;
    }
  });

  return {score, reason: bestReason};
}

function getPreferenceReason({
  identity,
  productMatches,
  countryMatches,
  factoryMatches,
}: {
  identity: SkuIdentity;
  productMatches: boolean;
  countryMatches: boolean;
  factoryMatches: boolean;
}) {
  if (productMatches && factoryMatches) {
    return {text: `与你关注的 ${identity.factoryNo} ${identity.productName} 相近`, weight: 4};
  }
  if (productMatches && countryMatches) {
    return {text: `与你关注的${identity.country}${identity.productName}相近`, weight: 3};
  }
  if (productMatches) {
    return {text: `因为你关注${identity.productName}`, weight: 2};
  }
  if (factoryMatches) {
    return {text: `你常关注的 ${identity.factoryNo} 厂号`, weight: 2};
  }
  if (countryMatches) {
    return {text: `与你关注的${identity.country}产品相近`, weight: 1};
  }
  return null;
}

function getHotReason(hotSku: HomeHotSku) {
  if (toCount(hotSku.merchantCount) >= 2) {
    return '多家商家正在报价';
  }
  return '近期报盘活跃';
}

function mergeRecommendation(
  substitute: RankedRecommendation,
  hot: RankedRecommendation,
): RankedRecommendation {
  if (substitute.source !== 'substitute') {
    return substitute.score >= hot.score ? substitute : hot;
  }

  return {
    ...substitute,
    productId: hot.productId ?? substitute.productId,
    priceMin: hot.priceMin ?? substitute.priceMin,
    priceMax: hot.priceMax ?? substitute.priceMax,
    offerCount: Math.max(substitute.offerCount, hot.offerCount),
    merchantCount: Math.max(substitute.merchantCount, hot.merchantCount),
    trendPoints: hot.trendPoints.length ? hot.trendPoints : substitute.trendPoints,
    score:
      SUBSTITUTE_SCORE +
      Math.max(
        getActivityScore(substitute.offerCount, substitute.merchantCount),
        getActivityScore(hot.offerCount, hot.merchantCount),
      ),
  };
}

function toSkuIdentity(
  value?: Pick<HomeHotSku, 'country' | 'factoryNo' | 'productName'> | null,
): SkuIdentity | null {
  const country = value?.country?.trim();
  const factoryNo = normalizeFactoryNoOrNull(value?.factoryNo);
  const productName = value?.productName?.trim();
  if (!country || !factoryNo || !productName) {
    return null;
  }
  return {country, factoryNo, productName};
}

function getSkuKey(identity: SkuIdentity) {
  return [identity.country, identity.factoryNo, identity.productName]
    .map(normalizeText)
    .join('|');
}

function getActivityScore(
  offerCount?: number | null,
  merchantCount?: number | null,
) {
  return toCount(offerCount) * 100 + toCount(merchantCount);
}

function sanitizeTrendPoints(points?: HomeHotSkuTrendPoint[] | null) {
  return toArray(points).filter(
    point => typeof point.avgPrice === 'number' && Number.isFinite(point.avgPrice),
  );
}

function toArray<T>(value?: T[] | null) {
  return Array.isArray(value) ? value : [];
}

function toNullableNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toCount(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function equalsText(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeText(left ?? '');
  const normalizedRight = normalizeText(right ?? '');
  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase();
}
