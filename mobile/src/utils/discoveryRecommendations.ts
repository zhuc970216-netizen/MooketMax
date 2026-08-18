import {
  canonicalizeDiscoveryProductName,
  getDiscoveryLadderTierInfo,
  getDiscoveryLadderTiers,
  getDiscoveryTierIndex,
  type DiscoveryLadderGroup,
  type DiscoveryLadderTier,
} from '../data/discoverySkuLadder';
import type {
  CountryFactoryProductDetail,
  HomeCardItem,
  HomeHotSku,
  HomeHotSkuTrendPoint,
  MerchantOfferGroup,
} from '../types/api';
import {normalizeFactoryNoOrNull} from './factoryNo';
import type {PlateSnapshot} from './plateFollowStore';

export type DiscoveryRecommendationRelation =
  | 'ladder_peer'
  | 'ladder_budget'
  | 'ladder_premium'
  | 'merchant_peer'
  | 'merchant_premium'
  | 'market_down'
  | 'market_hot';

export type DiscoveryRecommendationTemplate = 'compare' | 'merchant' | 'market';

export type DiscoveryMerchantSignal = {
  merchantId?: number | string | null;
  merchantName?: string | null;
  merchantShortName?: string | null;
};

export type DiscoveryMerchantEvidence = {
  key: string;
  name: string;
  merchantId?: string | null;
};

export type DiscoveryRecommendation = {
  key: string;
  country: string;
  factoryNo: string;
  productId: number | null;
  productName: string;
  canonicalProductName: string | null;
  priceMin: number | null;
  priceMax: number | null;
  offerCount: number;
  merchantCount: number;
  trendPoints: HomeHotSkuTrendPoint[];
  relationType: DiscoveryRecommendationRelation;
  template: DiscoveryRecommendationTemplate;
  seedSkuKey: string | null;
  seedProductName: string | null;
  seedFactoryNo: string | null;
  seedTier: DiscoveryLadderTier | null;
  candidateTier: DiscoveryLadderTier | null;
  priceDelta: number | null;
  priceDeltaRate: number | null;
  matchedFollowedMerchants: DiscoveryMerchantEvidence[];
  merchantNames: string[];
  reasonBadge: string;
  reasonText: string;
  evidenceText: string;
  reason: string;
  score: number;
  needsDetail: boolean;
};

export type BuildDiscoveryRecommendationsInput = {
  hotSkus?: Array<HomeHotSku | null | undefined> | null;
  recentSelfSelects?: Array<HomeCardItem | null | undefined> | null;
  intentPlates?: Array<PlateSnapshot | null | undefined> | null;
  followedMerchants?: Array<DiscoveryMerchantSignal | null | undefined> | null;
  detailsBySkuKey?:
    | Map<string, CountryFactoryProductDetail | null | undefined>
    | Record<string, CountryFactoryProductDetail | null | undefined>
    | null;
  limit?: number;
};

type SkuIdentity = {
  country: string;
  factoryNo: string;
  productName: string;
};

type DiscoverySeed = SkuIdentity & {
  key: string;
  sourceType: 'intent' | 'selfSelect';
  productId: number | null;
  createdAt: number;
  priceMin: number | null;
  priceMax: number | null;
  canonicalProductName: string | null;
};

type CandidateRecommendation = DiscoveryRecommendation & {
  provisionalBudget: boolean;
};

type RankedRecommendation = CandidateRecommendation & {
  inputOrder: number;
};

type FollowedMerchant = {
  key: string;
  merchantId: string | null;
  displayName: string;
  nameKeys: string[];
};

type FollowedMerchantIndex = {
  byId: Map<string, FollowedMerchant>;
  byName: Map<string, FollowedMerchant>;
};

type SkuLookup = {
  hotExact: Map<string, HomeHotSku>;
  hotCanonical: Map<string, HomeHotSku>;
  detailExact: Map<string, CountryFactoryProductDetail>;
  detailCanonical: Map<string, CountryFactoryProductDetail>;
};

type ResolvedSkuSnapshot = {
  productId: number | null;
  productName: string;
  priceMin: number | null;
  priceMax: number | null;
  offerCount: number;
  merchantCount: number;
  trendPoints: HomeHotSkuTrendPoint[];
  hasDetail: boolean;
  merchantOffers: MerchantOfferGroup[];
  merchantNames: string[];
};

const RELATION_PRIORITY: Record<DiscoveryRecommendationRelation, number> = {
  merchant_peer: 7,
  ladder_peer: 6,
  merchant_premium: 5,
  ladder_budget: 4,
  ladder_premium: 3,
  market_down: 2,
  market_hot: 1,
};

export function buildDiscoveryRecommendations({
  hotSkus,
  recentSelfSelects,
  intentPlates,
  followedMerchants,
  detailsBySkuKey,
  limit,
}: BuildDiscoveryRecommendationsInput): DiscoveryRecommendation[] {
  const safeHotSkus = toArray(hotSkus).filter((item): item is HomeHotSku => item != null);
  const safeRecentSelfSelects = toArray(recentSelfSelects).filter(
    (item): item is HomeCardItem => item != null,
  );
  const safeIntentPlates = toArray(intentPlates).filter(
    (item): item is PlateSnapshot => item != null,
  );
  const safeFollowedMerchants = toArray(followedMerchants).filter(
    (item): item is DiscoveryMerchantSignal => item != null,
  );
  const detailMap = toDetailMap(detailsBySkuKey);
  const hasDetailData = detailMap.size > 0;
  const followedIndex = buildFollowedMerchantIndex(safeFollowedMerchants);
  const lookup = buildSkuLookup(safeHotSkus, detailMap);
  const seeds = buildSeedSkus(safeIntentPlates, safeRecentSelfSelects);
  const selectedSkuKeys = new Set(seeds.map(item => item.key));

  const candidates = new Map<string, RankedRecommendation>();
  let inputOrder = 0;

  seeds.forEach(seed => {
    const ladderCandidates = buildLadderCandidatesForSeed(
      seed,
      lookup,
      followedIndex,
      hasDetailData,
    );
    ladderCandidates.forEach(candidate => {
      upsertCandidate(candidates, {...candidate, inputOrder: inputOrder++});
    });
  });

  buildMarketCandidates(safeHotSkus, selectedSkuKeys, lookup).forEach(candidate => {
    upsertCandidate(candidates, {...candidate, inputOrder: inputOrder++});
  });

  const result = Array.from(candidates.values())
    .filter(item => !(hasDetailData && item.provisionalBudget))
    .sort(compareDiscoveryRecommendations)
    .map(({inputOrder: _inputOrder, provisionalBudget: _provisionalBudget, ...item}) => item);

  return limit == null ? result : result.slice(0, Math.max(0, limit));
}

export function getDiscoveryDetailRequestKeys(
  items: DiscoveryRecommendation[],
  maxCount = 12,
) {
  return items
    .filter(item => item.needsDetail)
    .slice(0, Math.max(0, maxCount))
    .map(item => item.key);
}

export function getDiscoverySkuKey(
  value: Pick<HomeHotSku, 'country' | 'factoryNo' | 'productName'>,
) {
  const identity = toSkuIdentity(value);
  return identity ? getSkuKey(identity) : null;
}

function buildSeedSkus(intentPlates: PlateSnapshot[], selfSelects: HomeCardItem[]) {
  const seeds = new Map<string, DiscoverySeed>();

  intentPlates.forEach(item => {
    const identity = toSkuIdentity(item);
    if (!identity) {
      return;
    }
    const seed: DiscoverySeed = {
      ...identity,
      key: getSkuKey(identity),
      sourceType: 'intent',
      productId: null,
      createdAt: item.createdAt ?? parseLocalDateTime(item.publishTime),
      priceMin: toNullableNumber(item.price),
      priceMax: toNullableNumber(item.priceMax ?? item.price),
      canonicalProductName: canonicalizeDiscoveryProductName(
        identity.country,
        identity.productName,
      ),
    };
    mergeSeed(seeds, seed);
  });

  selfSelects.forEach(item => {
    const normalizedCardType = normalizeText(item.cardType ?? '');
    if (normalizedCardType !== 'factoryproduct') {
      return;
    }
    const identity = toSkuIdentity(item);
    if (!identity) {
      return;
    }
    const seed: DiscoverySeed = {
      ...identity,
      key: getSkuKey(identity),
      sourceType: 'selfSelect',
      productId: item.productId ?? null,
      createdAt: parseLocalDateTime(item.createTime),
      priceMin: toNullableNumber(item.priceMin),
      priceMax: toNullableNumber(item.priceMax),
      canonicalProductName: canonicalizeDiscoveryProductName(
        identity.country,
        identity.productName,
      ),
    };
    mergeSeed(seeds, seed);
  });

  return Array.from(seeds.values()).sort(
    (left, right) => right.createdAt - left.createdAt || left.key.localeCompare(right.key),
  );
}

function mergeSeed(target: Map<string, DiscoverySeed>, candidate: DiscoverySeed) {
  const existing = target.get(candidate.key);
  if (!existing || candidate.createdAt > existing.createdAt) {
    target.set(candidate.key, candidate);
    return;
  }

  target.set(candidate.key, {
    ...existing,
    priceMin: existing.priceMin ?? candidate.priceMin,
    priceMax: existing.priceMax ?? candidate.priceMax,
    productId: existing.productId ?? candidate.productId,
  });
}

function buildLadderCandidatesForSeed(
  seed: DiscoverySeed,
  lookup: SkuLookup,
  followedMerchants: FollowedMerchantIndex,
  hasDetailData: boolean,
): CandidateRecommendation[] {
  const tierInfo = getDiscoveryLadderTierInfo(seed.country, seed.productName, seed.factoryNo);
  if (!tierInfo) {
    return [];
  }

  const tiers = getDiscoveryLadderTiers();
  const seedTierIndex = getDiscoveryTierIndex(tierInfo.tier);
  const seedSnapshot = resolveSkuSnapshot(
    lookup,
    seed.country,
    seed.factoryNo,
    seed.productName,
    seed.canonicalProductName,
  );
  const seedMedianPrice = getMedianPrice(seed.priceMin ?? seedSnapshot.priceMin, seed.priceMax ?? seedSnapshot.priceMax);
  const results: CandidateRecommendation[] = [];

  const sameTierEntries = rankTierEntries(
    tierInfo.group,
    tierInfo.tier,
    seed,
    lookup,
  )
    .filter(item => item.entryFactoryNo !== seed.factoryNo)
    .slice(0, 2);

  sameTierEntries.forEach(item => {
    const candidate = buildLadderRecommendation({
      seed,
      group: tierInfo.group,
      relationType: 'ladder_peer',
      candidateTier: tierInfo.tier,
      candidateFactoryNo: item.entryFactoryNo,
      snapshot: item.snapshot,
      seedMedianPrice,
      matchedMerchants: collectMatchedFollowedMerchants(item.snapshot.merchantOffers, followedMerchants),
    });
    if (candidate) {
      results.push(candidate);
    }
  });

  const lowerTierNames = tiers.slice(seedTierIndex + 1, Math.min(seedTierIndex + 3, tiers.length));
  const budgetCandidate = pickBudgetCandidate(
    lowerTierNames,
    tierInfo.group,
    seed,
    lookup,
    followedMerchants,
    seedMedianPrice,
    hasDetailData,
  );
  if (budgetCandidate) {
    results.push(budgetCandidate);
  }

  if (seedTierIndex > 0) {
    const higherTierNames = tiers
      .slice(Math.max(0, seedTierIndex - 2), seedTierIndex)
      .reverse();
    const premiumCandidate = pickPremiumCandidate(
      higherTierNames,
      tierInfo.group,
      seed,
      lookup,
      followedMerchants,
      seedMedianPrice,
    );
    if (premiumCandidate) {
      results.push(premiumCandidate);
    }
  }

  return results;
}

function pickBudgetCandidate(
  tiers: DiscoveryLadderTier[],
  group: DiscoveryLadderGroup,
  seed: DiscoverySeed,
  lookup: SkuLookup,
  followedMerchants: FollowedMerchantIndex,
  seedMedianPrice: number | null,
  hasDetailData: boolean,
): CandidateRecommendation | null {
  let provisional: CandidateRecommendation | null = null;

  for (const tier of tiers) {
    const rankedEntries = rankTierEntries(group, tier, seed, lookup).sort((left, right) => {
      const leftMedian = left.medianPrice ?? Number.POSITIVE_INFINITY;
      const rightMedian = right.medianPrice ?? Number.POSITIVE_INFINITY;
      if (leftMedian !== rightMedian) {
        return leftMedian - rightMedian;
      }
      if (left.activityScore !== right.activityScore) {
        return right.activityScore - left.activityScore;
      }
      return left.entryFactoryNo.localeCompare(right.entryFactoryNo);
    });

    for (const item of rankedEntries) {
      if (item.entryFactoryNo === seed.factoryNo) {
        continue;
      }
      const matchedMerchants = collectMatchedFollowedMerchants(
        item.snapshot.merchantOffers,
        followedMerchants,
      );
      const candidate = buildLadderRecommendation({
        seed,
        group,
        relationType: 'ladder_budget',
        candidateTier: tier,
        candidateFactoryNo: item.entryFactoryNo,
        snapshot: item.snapshot,
        seedMedianPrice,
        matchedMerchants,
        provisionalBudget:
          seedMedianPrice == null || item.medianPrice == null || item.medianPrice >= seedMedianPrice,
      });
      if (!candidate) {
        continue;
      }
      if (candidate.provisionalBudget) {
        if (!hasDetailData && !provisional) {
          provisional = candidate;
        }
        continue;
      }
      return candidate;
    }
  }

  return provisional;
}

function pickPremiumCandidate(
  tiers: DiscoveryLadderTier[],
  group: DiscoveryLadderGroup,
  seed: DiscoverySeed,
  lookup: SkuLookup,
  followedMerchants: FollowedMerchantIndex,
  seedMedianPrice: number | null,
): CandidateRecommendation | null {
  for (const tier of tiers) {
    const rankedEntries = rankTierEntries(group, tier, seed, lookup);
    const bestEntry = rankedEntries.find(item => item.entryFactoryNo !== seed.factoryNo);
    if (!bestEntry) {
      continue;
    }
    const matchedMerchants = collectMatchedFollowedMerchants(
      bestEntry.snapshot.merchantOffers,
      followedMerchants,
    );
    return buildLadderRecommendation({
      seed,
      group,
      relationType: 'ladder_premium',
      candidateTier: tier,
      candidateFactoryNo: bestEntry.entryFactoryNo,
      snapshot: bestEntry.snapshot,
      seedMedianPrice,
      matchedMerchants,
    });
  }

  return null;
}

function rankTierEntries(
  group: DiscoveryLadderGroup,
  tier: DiscoveryLadderTier,
  seed: DiscoverySeed,
  lookup: SkuLookup,
) {
  return group.tiers[tier]
    .map(entry => {
      const snapshot = resolveSkuSnapshot(
        lookup,
        seed.country,
        entry.factoryNo,
        seed.productName,
        group.canonicalProductName,
      );
      return {
        entryFactoryNo: entry.factoryNo,
        snapshot,
        medianPrice: getMedianPrice(snapshot.priceMin, snapshot.priceMax),
        activityScore: getActivityScore(snapshot.offerCount, snapshot.merchantCount),
      };
    })
    .sort((left, right) => {
      if (left.activityScore !== right.activityScore) {
        return right.activityScore - left.activityScore;
      }
      const leftMedian = left.medianPrice ?? Number.POSITIVE_INFINITY;
      const rightMedian = right.medianPrice ?? Number.POSITIVE_INFINITY;
      if (leftMedian !== rightMedian) {
        return leftMedian - rightMedian;
      }
      return left.entryFactoryNo.localeCompare(right.entryFactoryNo);
    });
}

function buildLadderRecommendation({
  seed,
  group,
  relationType,
  candidateTier,
  candidateFactoryNo,
  snapshot,
  seedMedianPrice,
  matchedMerchants,
  provisionalBudget = false,
}: {
  seed: DiscoverySeed;
  group: DiscoveryLadderGroup;
  relationType: 'ladder_peer' | 'ladder_budget' | 'ladder_premium';
  candidateTier: DiscoveryLadderTier;
  candidateFactoryNo: string;
  snapshot: ResolvedSkuSnapshot;
  seedMedianPrice: number | null;
  matchedMerchants: DiscoveryMerchantEvidence[];
  provisionalBudget?: boolean;
}): CandidateRecommendation | null {
  const candidateMedianPrice = getMedianPrice(snapshot.priceMin, snapshot.priceMax);
  const finalRelationType: DiscoveryRecommendationRelation =
    relationType === 'ladder_peer' && matchedMerchants.length > 0
      ? 'merchant_peer'
      : relationType === 'ladder_premium' && matchedMerchants.length > 0
        ? 'merchant_premium'
        : relationType;
  const reason = buildReasonCopy(
    finalRelationType,
    seed,
    matchedMerchants,
  );
  if (!reason) {
    return null;
  }

  const priceDelta =
    seedMedianPrice != null && candidateMedianPrice != null
      ? roundPrice(candidateMedianPrice - seedMedianPrice)
      : null;
  const priceDeltaRate =
    priceDelta != null && seedMedianPrice && seedMedianPrice > 0
      ? roundPrice(priceDelta / seedMedianPrice)
      : null;

  return {
    key: getSkuKey({
      country: seed.country,
      factoryNo: candidateFactoryNo,
      productName: snapshot.productName || seed.productName,
    }),
    country: seed.country,
    factoryNo: candidateFactoryNo,
    productId: snapshot.productId ?? seed.productId,
    productName: snapshot.productName || seed.productName || group.displayName,
    canonicalProductName: group.canonicalProductName,
    priceMin: snapshot.priceMin,
    priceMax: snapshot.priceMax,
    offerCount: snapshot.offerCount,
    merchantCount: snapshot.merchantCount,
    trendPoints: snapshot.trendPoints,
    relationType: finalRelationType,
    template: getDiscoveryTemplate(finalRelationType),
    seedSkuKey: seed.key,
    seedProductName: seed.productName,
    seedFactoryNo: seed.factoryNo,
    seedTier: getDiscoveryLadderTierInfo(seed.country, seed.productName, seed.factoryNo)?.tier ?? null,
    candidateTier,
    priceDelta,
    priceDeltaRate,
    matchedFollowedMerchants: matchedMerchants,
    merchantNames: snapshot.merchantNames,
    reasonBadge: reason.badge,
    reasonText: reason.text,
    evidenceText: reason.evidence,
    reason: reason.text,
    score: RELATION_PRIORITY[finalRelationType] * 1_000_000 + getActivityScore(snapshot.offerCount, snapshot.merchantCount),
    needsDetail: !snapshot.hasDetail,
    provisionalBudget,
  };
}

function buildMarketCandidates(
  hotSkus: HomeHotSku[],
  selectedSkuKeys: Set<string>,
  lookup: SkuLookup,
): CandidateRecommendation[] {
  return hotSkus.flatMap(hotSku => {
    const identity = toSkuIdentity(hotSku);
    if (!identity) {
      return [];
    }
    const key = getSkuKey(identity);
    if (selectedSkuKeys.has(key)) {
      return [];
    }
    const snapshot = resolveSkuSnapshot(
      lookup,
      identity.country,
      identity.factoryNo,
      identity.productName,
      canonicalizeDiscoveryProductName(identity.country, identity.productName),
    );
    const relationType: 'market_down' | 'market_hot' = isTrendDown(snapshot.trendPoints)
      ? 'market_down'
      : 'market_hot';
    const reason = buildMarketReasonCopy(relationType, snapshot);
    return [
      {
        key,
        country: identity.country,
        factoryNo: identity.factoryNo,
        productId: snapshot.productId,
        productName: snapshot.productName || identity.productName,
        canonicalProductName: canonicalizeDiscoveryProductName(
          identity.country,
          identity.productName,
        ),
        priceMin: snapshot.priceMin,
        priceMax: snapshot.priceMax,
        offerCount: snapshot.offerCount,
        merchantCount: snapshot.merchantCount,
        trendPoints: snapshot.trendPoints,
        relationType,
        template: 'market' as DiscoveryRecommendationTemplate,
        seedSkuKey: null,
        seedProductName: null,
        seedFactoryNo: null,
        seedTier: null,
        candidateTier: null,
        priceDelta: null,
        priceDeltaRate: null,
        matchedFollowedMerchants: [],
        merchantNames: snapshot.merchantNames,
        reasonBadge: reason.badge,
        reasonText: reason.text,
        evidenceText: reason.evidence,
        reason: reason.text,
        score:
          RELATION_PRIORITY[relationType] * 1_000_000 +
          getActivityScore(snapshot.offerCount, snapshot.merchantCount),
        needsDetail:
          !snapshot.hasDetail &&
          ((snapshot.priceMin == null && snapshot.priceMax == null) ||
            snapshot.trendPoints.length === 0),
        provisionalBudget: false,
      },
    ];
  });
}

function buildReasonCopy(
  relationType: DiscoveryRecommendationRelation,
  seed: DiscoverySeed,
  matchedMerchants: DiscoveryMerchantEvidence[],
) {
  const seedLabel = seed.sourceType === 'intent' ? '你收藏的' : '你关注的';
  switch (relationType) {
    case 'ladder_peer':
      return {
        badge: '可替代',
        text: `与${seedLabel} ${seed.factoryNo} ${seed.productName}品质接近，可替代`,
        evidence: '适合放在一起比价，多个厂号一起看更直观',
      };
    case 'ladder_budget':
      return {
        badge: '更省一点',
        text: `比${seedLabel} ${seed.factoryNo}更省一些，适合控预算`,
        evidence: '更适合先看性价比，或者预算更紧的客户',
      };
    case 'ladder_premium':
      return {
        badge: '品质更好',
        text: `比${seedLabel} ${seed.factoryNo}品质更好，适合高要求客户`,
        evidence: '更适合对品质和出品稳定性要求更高的场景',
      };
    case 'merchant_peer': {
      const merchantName = matchedMerchants[0]?.name ?? '关注商家';
      return {
        badge: '商家也在卖',
        text: `这款${merchantName}也在卖`,
        evidence: '省去重新找货源的时间，沟通也更顺手',
      };
    }
    case 'merchant_premium':
      return {
        badge: '还有更好货',
        text: '你关注的商家手里还有品质更好的货可看',
        evidence: '不用换商家，也能继续看更好的选择',
      };
    default:
      return null;
  }
}

function buildMarketReasonCopy(
  relationType: 'market_down' | 'market_hot',
  snapshot: ResolvedSkuSnapshot,
) {
  if (relationType === 'market_down') {
    return {
      badge: '最近降价',
      text: '这款最近价格在往下走，现在看比较合适',
      evidence: `${getTrendChangeText(snapshot.trendPoints)} · ${Math.max(snapshot.offerCount, 1)}报盘可比价`,
    };
  }

  return {
    badge: '报价活跃',
    text: '最近报这款的商家比较多，适合快速比价',
    evidence: `${Math.max(snapshot.merchantCount, 1)}商家持续报价 · ${Math.max(snapshot.offerCount, 1)}报盘`,
  };
}

function getDiscoveryTemplate(relationType: DiscoveryRecommendationRelation) {
  switch (relationType) {
    case 'merchant_peer':
    case 'merchant_premium':
      return 'merchant';
    case 'market_down':
    case 'market_hot':
      return 'market';
    default:
      return 'compare';
  }
}

function buildFollowedMerchantIndex(followedMerchants: DiscoveryMerchantSignal[]): FollowedMerchantIndex {
  const byId = new Map<string, FollowedMerchant>();
  const byName = new Map<string, FollowedMerchant>();

  followedMerchants.forEach(item => {
    const merchantId = item.merchantId != null ? String(item.merchantId).trim() : '';
    const rawNames = [
      item.merchantShortName,
      item.merchantName,
    ]
      .map(value => clean(value))
      .filter((value): value is string => Boolean(value));
    if (!merchantId && rawNames.length === 0) {
      return;
    }
    const displayName = rawNames[0] ?? merchantId;
    const nameKeys = Array.from(
      new Set(
        rawNames.flatMap(value => getMerchantNameKeys(value)),
      ),
    );
    const key = merchantId ? `id:${merchantId}` : `name:${nameKeys[0] ?? normalizeText(displayName)}`;
    const signal: FollowedMerchant = {
      key,
      merchantId: merchantId || null,
      displayName,
      nameKeys,
    };
    if (merchantId) {
      byId.set(merchantId, signal);
    }
    nameKeys.forEach(nameKey => {
      if (!byName.has(nameKey)) {
        byName.set(nameKey, signal);
      }
    });
  });

  return {byId, byName};
}

function collectMatchedFollowedMerchants(
  merchantOffers: MerchantOfferGroup[],
  followedMerchants: FollowedMerchantIndex,
) {
  const matches = new Map<string, DiscoveryMerchantEvidence>();

  merchantOffers.forEach(group => {
    const merchantId = group.merchantId != null ? String(group.merchantId).trim() : '';
    if (merchantId) {
      const byId = followedMerchants.byId.get(merchantId);
      if (byId) {
        matches.set(byId.key, {
          key: byId.key,
          name: byId.displayName,
          merchantId,
        });
      }
    }

    getMerchantNameKeys(group.merchantName).forEach(nameKey => {
      const byName = followedMerchants.byName.get(nameKey);
      if (byName) {
        matches.set(byName.key, {
          key: byName.key,
          name: byName.displayName,
          merchantId: byName.merchantId,
        });
      }
    });
  });

  return Array.from(matches.values());
}

function buildSkuLookup(
  hotSkus: HomeHotSku[],
  detailMap: Map<string, CountryFactoryProductDetail>,
): SkuLookup {
  const hotExact = new Map<string, HomeHotSku>();
  const hotCanonical = new Map<string, HomeHotSku>();
  const detailExact = new Map<string, CountryFactoryProductDetail>();
  const detailCanonical = new Map<string, CountryFactoryProductDetail>();

  hotSkus.forEach(item => {
    const identity = toSkuIdentity(item);
    if (!identity) {
      return;
    }
    const exactKey = getSkuKey(identity);
    hotExact.set(exactKey, item);
    const canonical = canonicalizeDiscoveryProductName(identity.country, identity.productName);
    if (!canonical) {
      return;
    }
    const canonicalKey = getCanonicalSkuKey(identity.country, identity.factoryNo, canonical);
    const existing = hotCanonical.get(canonicalKey);
    if (!existing || getActivityScore(item.offerCount, item.merchantCount) > getActivityScore(existing.offerCount, existing.merchantCount)) {
      hotCanonical.set(canonicalKey, item);
    }
  });

  detailMap.forEach(item => {
    const identity = toSkuIdentity(item);
    if (!identity) {
      return;
    }
    const exactKey = getSkuKey(identity);
    detailExact.set(exactKey, item);
    const canonical = canonicalizeDiscoveryProductName(identity.country, identity.productName);
    if (canonical) {
      detailCanonical.set(getCanonicalSkuKey(identity.country, identity.factoryNo, canonical), item);
    }
  });

  return {hotExact, hotCanonical, detailExact, detailCanonical};
}

function resolveSkuSnapshot(
  lookup: SkuLookup,
  country: string,
  factoryNo: string,
  productName: string,
  canonicalProductName: string | null,
): ResolvedSkuSnapshot {
  const exactKey = getSkuKey({country, factoryNo, productName});
  const canonicalKey =
    canonicalProductName == null
      ? null
      : getCanonicalSkuKey(country, factoryNo, canonicalProductName);
  const detail =
    lookup.detailExact.get(exactKey) ??
    (canonicalKey ? lookup.detailCanonical.get(canonicalKey) : undefined);
  const hot =
    lookup.hotExact.get(exactKey) ??
    (canonicalKey ? lookup.hotCanonical.get(canonicalKey) : undefined);

  return {
    productId: detail?.productId ?? hot?.productId ?? null,
    productName: clean(detail?.productName) || clean(hot?.productName) || productName,
    priceMin: toNullableNumber(detail?.priceMin) ?? toNullableNumber(hot?.priceMin),
    priceMax: toNullableNumber(detail?.priceMax) ?? toNullableNumber(hot?.priceMax),
    offerCount: Math.max(toCount(detail?.offerCount), toCount(hot?.offerCount)),
    merchantCount: Math.max(toCount(detail?.merchantCount), toCount(hot?.merchantCount)),
    trendPoints:
      sanitizeDailyTrend(detail?.priceHistory7Days) ||
      sanitizeTrendPoints(hot?.trendPoints),
    hasDetail: detail != null,
    merchantOffers: detail?.merchantOffers ?? [],
    merchantNames: extractMerchantNames(detail?.merchantOffers ?? []),
  };
}

function extractMerchantNames(merchantOffers: MerchantOfferGroup[]) {
  return merchantOffers
    .map(item => clean(item.merchantName))
    .filter((item): item is string => Boolean(item))
    .map(item => simplifyMerchantName(item))
    .filter(Boolean)
    .slice(0, 3);
}

function sanitizeDailyTrend(
  points?: Array<{date?: string | null; avgPrice?: number | null; offerCount?: number | null}> | null,
) {
  const result = toArray(points)
    .filter(point => typeof point.avgPrice === 'number' && Number.isFinite(point.avgPrice))
    .map(point => ({
      date: point.date ?? null,
      avgPrice: point.avgPrice ?? null,
      offerCount: point.offerCount ?? null,
    }));
  return result.length > 0 ? result : null;
}

function sanitizeTrendPoints(points?: HomeHotSkuTrendPoint[] | null) {
  return toArray(points).filter(
    point => typeof point.avgPrice === 'number' && Number.isFinite(point.avgPrice),
  );
}

function upsertCandidate(
  target: Map<string, RankedRecommendation>,
  candidate: RankedRecommendation,
) {
  const existing = target.get(candidate.key);
  if (!existing) {
    target.set(candidate.key, candidate);
    return;
  }
  target.set(candidate.key, mergeRecommendation(existing, candidate));
}

function mergeRecommendation(
  existing: RankedRecommendation,
  incoming: RankedRecommendation,
): RankedRecommendation {
  const preferred =
    compareDiscoveryRecommendations(incoming, existing) < 0 ? incoming : existing;
  const fallback = preferred === incoming ? existing : incoming;
  return {
    ...preferred,
    productId: preferred.productId ?? fallback.productId,
    priceMin: preferred.priceMin ?? fallback.priceMin,
    priceMax: preferred.priceMax ?? fallback.priceMax,
    offerCount: Math.max(preferred.offerCount, fallback.offerCount),
    merchantCount: Math.max(preferred.merchantCount, fallback.merchantCount),
    trendPoints: preferred.trendPoints.length > 0 ? preferred.trendPoints : fallback.trendPoints,
    matchedFollowedMerchants:
      preferred.matchedFollowedMerchants.length > 0
        ? preferred.matchedFollowedMerchants
        : fallback.matchedFollowedMerchants,
    merchantNames:
      preferred.merchantNames.length > 0 ? preferred.merchantNames : fallback.merchantNames,
    needsDetail: preferred.needsDetail || fallback.needsDetail,
    provisionalBudget: preferred.provisionalBudget && fallback.provisionalBudget,
  };
}

function compareDiscoveryRecommendations(
  left: RankedRecommendation,
  right: RankedRecommendation,
) {
  const relationDiff =
    RELATION_PRIORITY[right.relationType] - RELATION_PRIORITY[left.relationType];
  if (relationDiff !== 0) {
    return relationDiff;
  }

  if (left.matchedFollowedMerchants.length !== right.matchedFollowedMerchants.length) {
    return right.matchedFollowedMerchants.length - left.matchedFollowedMerchants.length;
  }

  const leftTierDistance = getTierDistance(left.seedTier, left.candidateTier);
  const rightTierDistance = getTierDistance(right.seedTier, right.candidateTier);
  if (leftTierDistance !== rightTierDistance) {
    return leftTierDistance - rightTierDistance;
  }

  if (
    left.relationType === 'ladder_budget' &&
    right.relationType === 'ladder_budget' &&
    left.priceDelta != null &&
    right.priceDelta != null &&
    left.priceDelta !== right.priceDelta
  ) {
    return left.priceDelta - right.priceDelta;
  }

  if (left.offerCount !== right.offerCount) {
    return right.offerCount - left.offerCount;
  }
  if (left.merchantCount !== right.merchantCount) {
    return right.merchantCount - left.merchantCount;
  }
  if (left.score !== right.score) {
    return right.score - left.score;
  }
  return left.inputOrder - right.inputOrder;
}

function getTierDistance(
  seedTier: DiscoveryLadderTier | null,
  candidateTier: DiscoveryLadderTier | null,
) {
  if (!seedTier || !candidateTier) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.abs(getDiscoveryTierIndex(seedTier) - getDiscoveryTierIndex(candidateTier));
}

function isTrendDown(points: HomeHotSkuTrendPoint[]) {
  const values = points
    .map(point => toNullableNumber(point.avgPrice))
    .filter((value): value is number => value != null);
  if (values.length < 2) {
    return false;
  }
  return values[values.length - 1] < values[0];
}

function getTrendChangeText(points: HomeHotSkuTrendPoint[]) {
  const values = points
    .map(point => toNullableNumber(point.avgPrice))
    .filter((value): value is number => value != null);
  if (values.length < 2) {
    return '走势待补齐';
  }
  const first = values[0];
  const last = values[values.length - 1];
  const diff = Math.abs(last - first);
  if (last < first) {
    return `较7日前低 ${formatNumber(diff)}`;
  }
  if (last > first) {
    return `较7日前高 ${formatNumber(diff)}`;
  }
  return '价格持平';
}

function getActivityScore(
  offerCount?: number | null,
  merchantCount?: number | null,
) {
  return toCount(offerCount) * 100 + toCount(merchantCount);
}

function getMedianPrice(min?: number | null, max?: number | null) {
  const safeMin = toNullableNumber(min);
  const safeMax = toNullableNumber(max);
  if (safeMin == null && safeMax == null) {
    return null;
  }
  if (safeMin != null && safeMax != null) {
    return (safeMin + safeMax) / 2;
  }
  return safeMin ?? safeMax;
}

function getCanonicalSkuKey(
  country: string,
  factoryNo: string,
  canonicalProductName: string,
) {
  return [country, factoryNo, canonicalProductName].map(normalizeText).join('|');
}

function toSkuIdentity(
  value?: Pick<HomeHotSku, 'country' | 'factoryNo' | 'productName'> | null,
): SkuIdentity | null {
  const country = clean(value?.country);
  const factoryNo = normalizeFactoryNoOrNull(value?.factoryNo);
  const productName = clean(value?.productName);
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

function parseLocalDateTime(value?: string | null) {
  if (!value) {
    return 0;
  }
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ).getTime();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDetailMap(
  value?:
    | Map<string, CountryFactoryProductDetail | null | undefined>
    | Record<string, CountryFactoryProductDetail | null | undefined>
    | null,
) {
  if (value instanceof Map) {
    const next = new Map<string, CountryFactoryProductDetail>();
    value.forEach((detail, key) => {
      if (detail) {
        next.set(key, detail);
      }
    });
    return next;
  }

  const next = new Map<string, CountryFactoryProductDetail>();
  Object.entries(value ?? {}).forEach(([key, detail]) => {
    if (detail) {
      next.set(key, detail);
    }
  });
  return next;
}

function getMerchantNameKeys(value?: string | null) {
  const cleaned = clean(value);
  if (!cleaned) {
    return [];
  }
  const variants = new Set<string>();
  const simplified = simplifyMerchantName(cleaned);
  [cleaned, simplified].forEach(item => {
    const normalized = normalizeMerchantText(item);
    if (normalized) {
      variants.add(normalized);
    }
  });
  return Array.from(variants);
}

function simplifyMerchantName(value: string) {
  let result = value.trim();
  result = result.replace(/[（(][^）)]*[）)]/g, '');
  const suffixes = [
    '供应链管理有限公司',
    '国际供应链管理有限公司',
    '供应链有限公司',
    '有限责任公司',
    '管理有限公司',
    '贸易有限公司',
    '商贸有限公司',
    '食品有限公司',
    '冻品商行',
    '供应链',
    '有限公司',
    '商行',
  ];
  suffixes.forEach(suffix => {
    if (result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
    }
  });
  return result.trim();
}

function normalizeMerchantText(value: string) {
  return simplifyMerchantName(value)
    .replace(/[\s·•,，.。()（）\-_/]/g, '')
    .toLowerCase();
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function clean(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
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

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}
