import {mooketApi} from '../api/mooketApi';
import type {HomeCardItem, OfferFeedItem, SearchHistory} from '../types/api';
import {getRecentBrandOfferCount} from './brandStats';
import {normalizeFactoryNoOrNull} from './factoryNo';
import {getHomeCardEntityKey} from './homeFallbackCards';

const SEARCH_TYPE_PRODUCT = '\u4ea7\u54c1';
const SEARCH_TYPE_COUNTRY = '\u56fd\u5bb6';
const SEARCH_TYPE_BRAND = '\u54c1\u724c';
const SEARCH_TYPE_MERCHANT = '\u5546\u5bb6';
const SEARCH_TYPE_FACTORY = '\u56fd\u5bb6\u5382\u53f7';
const SEARCH_TYPE_COUNTRY_PRODUCT = '\u56fd\u5bb6\u4ea7\u54c1';
const SEARCH_TYPE_FACTORY_PRODUCT = '\u56fd\u5bb6\u5382\u53f7\u4ea7\u54c1';
const SEARCH_TYPE_BRAND_PRODUCT = '\u54c1\u724c\u4ea7\u54c1';

function parseLocalDateTime(value?: string | null) {
  if (!value) return 0;
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const [, y, m, d, h = '0', min = '0', s = '0'] = match;
    return new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(h),
      Number(min),
      Number(s),
    ).getTime();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortSelfSelectCardsByCreateTime(
  cards: HomeCardItem[],
  histories: SearchHistory[] = [],
) {
  const historyById = new Map(histories.map(item => [item.historyId, item]));

  return cards
    .map((card, index) => {
      const history =
        card.historyId == null ? undefined : historyById.get(card.historyId);
      const createTime = card.createTime ?? history?.createTime ?? null;
      return {
        card: createTime ? {...card, createTime} : card,
        index,
        createdAt: parseLocalDateTime(createTime),
      };
    })
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      const aId = a.card.historyId ?? 0;
      const bId = b.card.historyId ?? 0;
      if (aId !== bId) return bId - aId;
      return a.index - b.index;
    })
    .map(item => item.card);
}

export function mergeSelfSelectCardsWithHistories(
  cards: HomeCardItem[],
  histories: SearchHistory[] = [],
) {
  const seen = new Set<string>();
  const result: HomeCardItem[] = [];
  const historyById = new Map(histories.map(history => [history.historyId, history]));

  cards.forEach(card => {
    const history = card.historyId == null ? undefined : historyById.get(card.historyId);
    const hydratedCard = hydrateSelfSelectCard(card, history);
    const normalizedCard = normalizeSelfSelectCard(
      hydratedCard,
      history?.searchWord ?? null,
    );
    collectCardKeys(normalizedCard).forEach(key => seen.add(key));
    result.push(normalizedCard);
  });

  histories.forEach(history => {
    if (history.isSelfSelect !== 1) return;
    const card = buildSelfSelectCardFromHistory(history);
    if (!card) return;

    const normalizedCard = normalizeSelfSelectCard(card, history.searchWord ?? null);
    const keys = collectCardKeys(normalizedCard);
    if (keys.some(key => seen.has(key))) return;

    keys.forEach(key => seen.add(key));
    result.push(normalizedCard);
  });

  return result;
}

function hydrateSelfSelectCard(
  card: HomeCardItem,
  history?: SearchHistory,
): HomeCardItem {
  if (card.cardType === 'factory') {
    const factoryNo = normalizeFactoryNoOrNull(
      card.factoryNo ??
        history?.factoryNo ??
        inferFactoryNo(
          card.searchWord ?? history?.searchWord ?? null,
          card.country ?? history?.country ?? null,
        ),
    );
    return {
      ...card,
      searchWord: card.searchWord ?? history?.searchWord,
      country: card.country ?? history?.country ?? null,
      factoryNo: factoryNo || null,
    };
  }

  if (card.cardType === 'countryProduct') {
    const productName =
      card.productName ??
      history?.productName ??
      inferCountryProductName(
        card.searchWord ?? history?.searchWord ?? null,
        card.country ?? history?.country ?? null,
      );
    return {
      ...card,
      searchWord: card.searchWord ?? history?.searchWord,
      country: card.country ?? history?.country ?? null,
      productName: productName || null,
    };
  }

  if (card.cardType === 'factoryProduct') {
    return normalizeSelfSelectCard(
      {
        ...card,
        searchWord: card.searchWord ?? history?.searchWord,
        country: card.country ?? history?.country ?? null,
        factoryNo:
          normalizeFactoryNoOrNull(card.factoryNo ?? history?.factoryNo ?? null) || null,
        productName: card.productName ?? history?.productName ?? null,
      } as HomeCardItem & {searchWord?: string | null},
      history?.searchWord ?? null,
    );
  }

  if (!history) return card;
  if (card.cardType !== 'brandProduct') return card;
  const productName = card.productName ?? history.productName ?? null;
  const brandName =
    card.brandName ??
    (productName ? inferBrandName(history.searchWord, productName) : history.searchWord);
  return {
    ...card,
    searchWord: card.searchWord ?? history.searchWord,
    brandId: card.brandId ?? history.brandId ?? null,
    brandName: brandName || null,
    productName,
  };
}

export async function enrichSelfSelectCards(
  category: string,
  cards: HomeCardItem[],
) {
  return Promise.all(
    cards.map(card =>
      needsMerchantOfferEnrichment(card)
        ? enrichMerchantSelfSelectCard(category, card).catch(() => card)
        : needsFactoryEnrichment(card)
          ? enrichFactorySelfSelectCard(category, card).catch(() => card)
        : needsFactoryProductEnrichment(card)
          ? enrichFactoryProductSelfSelectCard(category, card).catch(() => card)
        : needsCountryProductEnrichment(card)
          ? enrichCountryProductSelfSelectCard(category, card).catch(() => card)
        : needsBrandEnrichment(card)
          ? enrichBrandSelfSelectCard(category, card).catch(() => card)
        : needsBrandProductEnrichment(card)
          ? enrichBrandProductSelfSelectCard(category, card).catch(() => card)
        : Promise.resolve(card),
    ),
  );
}

function collectCardKeys(card: HomeCardItem) {
  const keys = new Set<string>();
  if (card.historyId != null) keys.add(`history:${card.historyId}`);
  const entityKey = getHomeCardEntityKey(card);
  if (entityKey) keys.add(`entity:${normalizeText(entityKey)}`);

  switch (card.cardType) {
    case 'product':
      addCardKey(keys, ['product', card.productName]);
      break;
    case 'country':
      addCardKey(keys, ['country', card.country]);
      break;
    case 'brand':
      addCardKey(keys, ['brand', card.brandName]);
      break;
    case 'merchant':
      addCardKey(keys, [
        'merchant',
        card.merchantId == null ? card.merchantName : String(card.merchantId),
      ]);
      addCardKey(keys, ['merchant-name', card.merchantName]);
      addCardKey(keys, ['merchant-name', card.merchantShortName]);
      break;
    case 'factory':
      addCardKey(keys, ['factory', card.country, card.factoryNo]);
      break;
    case 'countryProduct':
      addCardKey(keys, ['countryProduct', card.country, card.productName]);
      break;
    case 'factoryProduct':
      addCardKey(keys, ['factoryProduct', card.country, card.factoryNo, card.productName]);
      break;
    case 'brandProduct':
      addCardKey(keys, ['brandProduct', card.brandName, card.productName]);
      if (card.brandId != null) {
        addCardKey(keys, ['brandProductId', String(card.brandId), card.productName]);
      }
      break;
    default:
      break;
  }
  return Array.from(keys);
}

function addCardKey(keys: Set<string>, parts: Array<string | null | undefined>) {
  const normalized = parts.map(item => normalizeText(item ?? ''));
  if (normalized.every(Boolean)) keys.add(`semantic:${normalized.join(':')}`);
}

function buildSelfSelectCardFromHistory(history: SearchHistory): HomeCardItem | null {
  const searchType = history.searchType.trim();
  const base = {
    historyId: history.historyId,
    createTime: history.createTime,
    searchWord: history.searchWord,
  };

  switch (searchType) {
    case SEARCH_TYPE_PRODUCT: {
      const productName = history.productName || history.searchWord;
      if (!productName) return null;
      return {
        ...base,
        cardType: 'product',
        productId: history.productId ?? null,
        productName,
      };
    }
    case SEARCH_TYPE_COUNTRY:
      if (!history.country && !history.searchWord) return null;
      return {
        ...base,
        cardType: 'country',
        country: history.country || history.searchWord,
      };
    case SEARCH_TYPE_BRAND:
      if (!history.searchWord) return null;
      return {
        ...base,
        cardType: 'brand',
        brandId: history.brandId ?? null,
        brandName: history.searchWord,
      };
    case SEARCH_TYPE_MERCHANT:
      if (!history.searchWord && history.merchantId == null) return null;
      return {
        ...base,
        cardType: 'merchant',
        merchantId: history.merchantId ?? null,
        merchantName: history.searchWord || null,
        merchantShortName: history.searchWord || null,
      };
    case SEARCH_TYPE_FACTORY: {
      const country = history.country?.trim() || null;
      const factoryNo = normalizeFactoryNoOrNull(
        history.factoryNo ?? inferFactoryNo(history.searchWord ?? null, country),
      );
      if (!country || !factoryNo) return null;
      return {
        ...base,
        cardType: 'factory',
        country,
        factoryNo,
      };
    }
    case SEARCH_TYPE_COUNTRY_PRODUCT: {
      const country = history.country?.trim() || null;
      const productName =
        history.productName?.trim() ||
        inferCountryProductName(history.searchWord ?? null, country);
      if (!country || !productName) return null;
      return {
        ...base,
        cardType: 'countryProduct',
        country,
        productName,
      };
    }
    case SEARCH_TYPE_FACTORY_PRODUCT: {
      const country = history.country?.trim() || null;
      if (!country) return null;
      return normalizeSelfSelectCard(
        {
          ...base,
          cardType: 'factoryProduct',
          country,
          factoryNo: normalizeFactoryNoOrNull(history.factoryNo) ?? null,
          productName: history.productName?.trim() || null,
          searchWord: history.searchWord,
        } as HomeCardItem & {searchWord?: string | null},
        history.searchWord ?? null,
      );
    }
    case SEARCH_TYPE_BRAND_PRODUCT: {
      if (!history.productName) return null;
      const brandName = inferBrandName(history.searchWord, history.productName);
      return {
        ...base,
        cardType: 'brandProduct',
        brandId: history.brandId ?? null,
        brandName,
        productName: history.productName,
      };
    }
    default:
      return null;
  }
}

function normalizeSelfSelectCard(
  card: HomeCardItem,
  searchWordOverride?: string | null,
) {
  if (card.cardType === 'factory') {
    const normalizedFactoryNo = normalizeFactoryNoOrNull(card.factoryNo);
    if (normalizedFactoryNo && normalizedFactoryNo !== card.factoryNo) {
      return {
        ...card,
        factoryNo: normalizedFactoryNo,
      };
    }
    return card;
  }

  if (card.cardType !== 'factoryProduct') return card;

  const normalizedFactoryNo = normalizeFactoryNoOrNull(card.factoryNo);
  const country = card.country?.trim() || '';
  const searchWord = searchWordOverride?.trim() || getCardSearchWord(card);
  if (!country || !searchWord || !searchWord.startsWith(country)) {
    if (normalizedFactoryNo && normalizedFactoryNo !== card.factoryNo) {
      return {
        ...card,
        factoryNo: normalizedFactoryNo,
      };
    }
    return card;
  }

  const parsed = parseFactoryProductFromSearchWord(country, searchWord);
  if (!parsed) {
    if (normalizedFactoryNo && normalizedFactoryNo !== card.factoryNo) {
      return {
        ...card,
        factoryNo: normalizedFactoryNo,
      };
    }
    return card;
  }

  if (
    normalizeText(parsed.factoryNo) ===
      normalizeText(normalizedFactoryNo ?? card.factoryNo ?? '') &&
    normalizeText(parsed.productName) === normalizeText(card.productName ?? '')
  ) {
    if (normalizedFactoryNo && normalizedFactoryNo !== card.factoryNo) {
      return {
        ...card,
        factoryNo: normalizedFactoryNo,
      };
    }
    return card;
  }

  return {
    ...card,
    factoryNo: parsed.factoryNo,
    productName: parsed.productName,
  };
}

function getCardSearchWord(card: HomeCardItem) {
  const explicit = (card as HomeCardItem & {searchWord?: string | null}).searchWord;
  if (explicit?.trim()) return explicit.trim();
  if (card.country && card.factoryNo && card.productName) {
    return `${card.country}${card.factoryNo}${card.productName}`;
  }
  if (card.country && card.factoryNo) {
    return `${card.country}${card.factoryNo}`;
  }
  if (card.country && card.productName) {
    return `${card.country}${card.productName}`;
  }
  return '';
}

function parseFactoryProductFromSearchWord(country: string, searchWord: string) {
  const tail = searchWord.slice(country.length).trim();
  if (!tail) return null;

  const match = tail.match(/^([A-Za-z0-9-]+)(?=[\u3400-\u9fff])/);
  if (!match) return null;

  const factoryNo = normalizeFactoryNoOrNull(match[1].trim());
  const productName = tail.slice(match[1].length).trim();
  if (!factoryNo || !productName) return null;

  return {factoryNo, productName};
}

function needsMerchantOfferEnrichment(card: HomeCardItem) {
  if (card.cardType !== 'merchant') return false;
  const hasOfferPreview = Boolean(card.latestOffers?.length);
  const hasCount = card.todayOfferCount != null;
  const hasLookupKey =
    card.merchantId != null ||
    Boolean(card.merchantName?.trim()) ||
    Boolean(card.merchantShortName?.trim());
  return hasLookupKey && (!hasOfferPreview || !hasCount);
}

function needsFactoryProductEnrichment(card: HomeCardItem) {
  if (card.cardType !== 'factoryProduct') return false;
  if (!card.country?.trim() || !card.factoryNo?.trim() || !card.productName?.trim()) {
    return false;
  }
  return (
    card.priceMin == null ||
    card.priceMax == null ||
    card.todayOfferCount == null ||
    card.inquiryCount == null ||
    !card.hotMerchants?.length ||
    !card.trendPoints?.length
  );
}

function needsFactoryEnrichment(card: HomeCardItem) {
  if (card.cardType !== 'factory') return false;
  if (!card.country?.trim() || !card.factoryNo?.trim()) return false;
  return !hasMeaningfulOfferCount(card.todayOfferCount) || !hasMeaningfulHotProducts(card.hotProducts);
}

function hasMeaningfulOfferCount(value?: number | null) {
  return typeof value === 'number' && value > 0;
}

function hasMeaningfulHotProducts(items?: Record<string, unknown>[] | null) {
  if (!items?.length) return false;
  return items.some(item => {
    const productName = typeof item.productName === 'string' ? item.productName.trim() : '';
    const offerCount =
      typeof item.offerCount === 'number'
        ? item.offerCount
        : typeof item.offerCount === 'string'
          ? Number(item.offerCount)
          : 0;
    return Boolean(productName) && offerCount > 0;
  });
}

function needsBrandProductEnrichment(card: HomeCardItem) {
  if (card.cardType !== 'brandProduct') return false;
  if (!card.productName?.trim()) return false;
  return (
    !card.brandName?.trim() ||
    card.priceMin == null ||
    card.priceMax == null ||
    card.todayOfferCount == null ||
    card.factoryCount == null
  );
}

function needsBrandEnrichment(card: HomeCardItem) {
  if (card.cardType !== 'brand') return false;
  if (!card.brandName?.trim()) return false;
  return (
    !hasMeaningfulOfferCount(card.todayOfferCount) ||
    card.productCount == null ||
    card.factoryCount == null
  );
}

function needsCountryProductEnrichment(card: HomeCardItem) {
  if (card.cardType !== 'countryProduct') return false;
  if (!card.country?.trim() || !card.productName?.trim()) return false;
  return (
    card.priceMin == null ||
    card.priceMax == null ||
    card.todayOfferCount == null ||
    card.factoryCount == null ||
    !card.topFactories?.length
  );
}

async function enrichBrandSelfSelectCard(
  category: string,
  card: HomeCardItem,
) {
  if (!card.brandName) return card;

  const detail = await mooketApi.getBrandDetail(
    card.brandName,
    category,
    'offer',
    'comprehensive',
    1,
    1000,
  );
  const recentOfferCount = getRecentBrandOfferCount(detail);

  return {
    ...card,
    brandName: detail.brandName || card.brandName,
    todayOfferCount: hasMeaningfulOfferCount(card.todayOfferCount)
      ? card.todayOfferCount
      : recentOfferCount,
    productCount: card.productCount ?? detail.productCount ?? null,
    factoryCount: card.factoryCount ?? detail.factoryCount ?? null,
  };
}

async function enrichBrandProductSelfSelectCard(
  category: string,
  card: HomeCardItem,
) {
  if (!card.productName) return card;
  const lookupBrandName =
    card.brandName?.trim() ||
    inferBrandName(card.searchWord ?? '', card.productName)?.trim();
  if (!lookupBrandName) return card;

  const detail = await mooketApi.getBrandProductDetail(
    lookupBrandName,
    card.productName,
    category,
    'offer',
    'comprehensive',
    1,
    1,
  );
  const resolvedBrandName = detail.brandName
    ? inferBrandName(detail.brandName, card.productName)
    : lookupBrandName;

  return {
    ...card,
    brandName: resolvedBrandName || lookupBrandName,
    productName: card.productName || detail.summaries?.[0]?.productName || null,
    priceMin: card.priceMin ?? detail.priceMin ?? null,
    priceMax: card.priceMax ?? detail.priceMax ?? null,
    todayOfferCount: hasMeaningfulOfferCount(card.todayOfferCount)
      ? card.todayOfferCount
      : getRecentBrandOfferCount(detail),
    factoryCount: card.factoryCount ?? detail.factoryCount ?? null,
  };
}

async function enrichCountryProductSelfSelectCard(
  category: string,
  card: HomeCardItem,
) {
  if (!card.country || !card.productName) return card;

  const detail = await mooketApi.getCountryProductDetail(
    card.country,
    card.productName,
    category,
    'offer',
    'comprehensive',
    1,
    6,
  );

  return {
    ...card,
    productId: card.productId ?? detail.productId ?? null,
    country: detail.country || card.country,
    productName: detail.productName || card.productName,
    priceMin: card.priceMin ?? detail.priceMin ?? null,
    priceMax: card.priceMax ?? detail.priceMax ?? null,
    priceChange: card.priceChange ?? detail.priceChange ?? null,
    priceChangeRate: card.priceChangeRate ?? detail.priceChangeRate ?? null,
    todayOfferCount: card.todayOfferCount ?? detail.offerCount ?? null,
    inquiryCount: card.inquiryCount ?? detail.inquiryCount ?? null,
    merchantCount: card.merchantCount ?? detail.merchantCount ?? null,
    factoryCount: card.factoryCount ?? detail.totalCount ?? null,
    topFactories: card.topFactories?.length
      ? card.topFactories
      : (detail.factories ?? []).slice(0, 3).map(item => ({
          factoryNo: item.factoryNo ?? null,
          priceMin: item.priceMin ?? null,
          priceMax: item.priceMax ?? null,
        })),
    trendPoints: card.trendPoints?.length
      ? card.trendPoints
      : (detail.priceHistory7Days ?? [])
          .filter(point => point.avgPrice != null)
          .map(point => ({
            date: point.date,
            fullDate: point.fullDate,
            avgPrice: point.avgPrice,
            offerCount: point.offerCount,
          })),
  };
}

async function enrichFactorySelfSelectCard(
  category: string,
  card: HomeCardItem,
) {
  if (!card.country || !card.factoryNo) return card;

  let resolvedCountry = card.country;
  let resolvedFactoryNo = card.factoryNo;
  let detail = await mooketApi.getFactoryDetail(
    resolvedCountry,
    resolvedFactoryNo,
    category,
    'offer',
    'comprehensive',
    1,
    3,
  );

  if (isEmptyFactoryDetail(detail)) {
    const resolved = await resolveFactoryFromKeyword(
      category,
      card.searchWord ?? `${card.country}${card.factoryNo}`,
      card.country,
      card.factoryNo,
    );
    if (
      resolved &&
      (normalizeText(resolved.country) !== normalizeText(resolvedCountry) ||
        normalizeText(resolved.factoryNo) !== normalizeText(resolvedFactoryNo))
    ) {
      resolvedCountry = resolved.country;
      resolvedFactoryNo = resolved.factoryNo;
      detail = await mooketApi.getFactoryDetail(
        resolvedCountry,
        resolvedFactoryNo,
        category,
        'offer',
        'comprehensive',
        1,
        3,
      );
    }
  }

  return {
    ...card,
    country: detail.country || resolvedCountry || card.country,
    countryAlias: card.countryAlias ?? detail.countryAlias ?? null,
    factoryNo:
      normalizeFactoryNoOrNull(detail.factoryNo || resolvedFactoryNo || card.factoryNo) ||
      card.factoryNo,
    productCount: card.productCount ?? detail.productCount ?? null,
    inquiryCount: card.inquiryCount ?? detail.inquiryCount ?? null,
    todayOfferCount: hasMeaningfulOfferCount(card.todayOfferCount)
      ? card.todayOfferCount
      : detail.recentOfferCount ?? null,
    hotProducts: hasMeaningfulHotProducts(card.hotProducts)
      ? card.hotProducts
      : (detail.products ?? []).slice(0, 3).map((item, index) => ({
          productName: item.productName ?? null,
          offerCount: item.offerCount ?? null,
          rank: index + 1,
        })),
  };
}

async function enrichFactoryProductSelfSelectCard(
  category: string,
  card: HomeCardItem,
) {
  if (!card.country || !card.factoryNo || !card.productName) return card;

  let resolvedCountry = card.country;
  let resolvedFactoryNo = card.factoryNo;
  let detail = await mooketApi.getCountryFactoryProductDetail(
    resolvedCountry,
    resolvedFactoryNo,
    card.productName,
    category,
    'offer',
    'comprehensive',
    1,
    6,
  );

  if (isEmptyFactoryProductDetail(detail)) {
    const resolved = await resolveFactoryFromKeyword(
      category,
      card.searchWord ?? `${card.country}${card.factoryNo}${card.productName}`,
      card.country,
      card.factoryNo,
    );
    if (
      resolved &&
      (normalizeText(resolved.country) !== normalizeText(resolvedCountry) ||
        normalizeText(resolved.factoryNo) !== normalizeText(resolvedFactoryNo))
    ) {
      resolvedCountry = resolved.country;
      resolvedFactoryNo = resolved.factoryNo;
      detail = await mooketApi.getCountryFactoryProductDetail(
        resolvedCountry,
        resolvedFactoryNo,
        card.productName,
        category,
        'offer',
        'comprehensive',
        1,
        6,
      );
    }
  }

  return {
    ...card,
    productId: card.productId ?? detail.productId ?? null,
    country: detail.country || resolvedCountry || card.country,
    factoryNo:
      normalizeFactoryNoOrNull(detail.factoryNo || resolvedFactoryNo || card.factoryNo) ||
      card.factoryNo,
    productName: detail.productName || card.productName,
    priceMin: card.priceMin ?? detail.priceMin ?? null,
    priceMax: card.priceMax ?? detail.priceMax ?? null,
    priceChange: card.priceChange ?? detail.priceChange ?? null,
    priceChangeRate: card.priceChangeRate ?? detail.priceChangeRate ?? null,
    todayOfferCount: card.todayOfferCount ?? detail.offerCount ?? null,
    inquiryCount: card.inquiryCount ?? detail.inquiryCount ?? null,
    merchantCount: card.merchantCount ?? detail.merchantCount ?? null,
    hotMerchants: card.hotMerchants?.length
      ? card.hotMerchants
      : (detail.merchantOffers ?? []).slice(0, 3).map(group => {
          const priceRange = getEmployeeOfferPriceRange(group.employeeOffers ?? []);
          return {
            merchantId: group.merchantId ?? null,
            merchantName: group.merchantName ?? null,
            priceMin: priceRange.min,
            priceMax: priceRange.max,
          };
        }),
    trendPoints: card.trendPoints?.length
      ? card.trendPoints
      : (detail.priceHistory7Days ?? [])
          .filter(point => point.avgPrice != null)
          .map(point => ({
            date: point.date,
            fullDate: point.fullDate,
            avgPrice: point.avgPrice,
            offerCount: point.offerCount,
          })),
  };
}

function getEmployeeOfferPriceRange(
  offers: Array<{price?: string | number | null}>,
) {
  const prices = offers
    .map(offer => parseOfferPrice(offer.price))
    .filter((price): price is number => price != null);
  if (!prices.length) return {min: null, max: null};
  return {min: Math.min(...prices), max: Math.max(...prices)};
}

function parseOfferPrice(value?: string | number | null) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string') return null;
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function enrichMerchantSelfSelectCard(
  category: string,
  card: HomeCardItem,
) {
  const byId = await loadMerchantOffersById(category, card);
  const byKeyword = byId.items.length
    ? null
    : await loadMerchantOffersByKeyword(category, card);
  const page = byId.items.length ? byId : byKeyword;
  const items = page?.items ?? [];
  if (!items.length) return card;

  const first = items[0];
  return {
    ...card,
    merchantId: card.merchantId ?? first.merchantId ?? null,
    merchantName: card.merchantName ?? first.merchantName ?? null,
    merchantShortName:
      card.merchantShortName ?? first.merchantShortName ?? first.merchantName ?? null,
    latestOffers: card.latestOffers?.length
      ? card.latestOffers
      : items.slice(0, 2).map(toHomeLatestOffer),
    todayOfferCount: card.todayOfferCount ?? page?.totalCount ?? items.length,
  };
}

async function loadMerchantOffersById(category: string, card: HomeCardItem) {
  if (card.merchantId == null || !String(card.merchantId).trim()) {
    return {items: [], totalCount: 0};
  }

  return mooketApi.getOfferFeed({
    category,
    type: 'offer',
    merchantId: card.merchantId,
    page: 1,
    pageSize: 3,
    sortBy: 'publishTime',
  });
}

async function loadMerchantOffersByKeyword(category: string, card: HomeCardItem) {
  const keyword = card.merchantShortName?.trim() || card.merchantName?.trim();
  if (!keyword) return {items: [], totalCount: 0};

  const page = await mooketApi.getOfferFeed({
    category,
    type: 'offer',
    keyword,
    page: 1,
    pageSize: 20,
    sortBy: 'publishTime',
  });
  const items = (page.items ?? []).filter(item => merchantNameMatches(item, keyword));
  return {...page, items, totalCount: items.length || page.totalCount};
}

function merchantNameMatches(item: OfferFeedItem, keyword: string) {
  const target = normalizeText(keyword);
  if (!target) return false;
  const names = [item.merchantName, item.merchantShortName]
    .map(value => normalizeText(value ?? ''))
    .filter(Boolean);
  return names.some(name => name === target || name.includes(target) || target.includes(name));
}

function toHomeLatestOffer(item: OfferFeedItem): Record<string, unknown> {
  return {
    offerId: item.offerId ?? null,
    productName: item.productName ?? null,
    country: item.country ?? null,
    factoryNo: item.factoryNo ?? null,
    price: item.price ?? item.priceMax ?? null,
    priceMax: item.priceMax ?? null,
    weight: item.weight ?? null,
    publishTime: item.publishTime ?? null,
  };
}

function inferBrandName(searchWord: string, productName: string) {
  const trimmed = searchWord.trim();
  const product = productName.trim();
  if (!trimmed) return null;
  if (!product) return trimmed;

  const withoutProduct = trimmed.replace(product, '').trim();
  return withoutProduct || trimmed;
}

function isEmptyFactoryDetail(detail: {
  productCount?: number | null;
  recentOfferCount?: number | null;
  totalCount?: number | null;
  products?: unknown[] | null;
}) {
  return (
    (detail.productCount ?? 0) === 0 &&
    (detail.recentOfferCount ?? 0) === 0 &&
    (detail.totalCount ?? 0) === 0 &&
    (detail.products?.length ?? 0) === 0
  );
}

function isEmptyFactoryProductDetail(detail: {
  offerCount?: number | null;
  inquiryCount?: number | null;
  merchantCount?: number | null;
  totalCount?: number | null;
  merchantOffers?: unknown[] | null;
}) {
  return (
    (detail.offerCount ?? 0) === 0 &&
    (detail.inquiryCount ?? 0) === 0 &&
    (detail.merchantCount ?? 0) === 0 &&
    (detail.totalCount ?? 0) === 0 &&
    (detail.merchantOffers?.length ?? 0) === 0
  );
}

async function resolveFactoryFromKeyword(
  category: string,
  keyword: string,
  fallbackCountry: string,
  fallbackFactoryNo: string,
) {
  const normalizedKeyword = keyword.trim().toLowerCase().replace(/\s+/g, '');
  if (!normalizedKeyword) return null;

  const suggestions = await mooketApi.getSearchSuggestions(category, keyword);
  const matched = suggestions.find(item => {
    if (item.matchType !== 'factory') return false;
    const country = item.country?.trim() || fallbackCountry;
    const factoryNo = normalizeFactoryNoOrNull(item.factoryNo) || fallbackFactoryNo;
    if (!country || !factoryNo) return false;
    return `${country}${factoryNo}`.toLowerCase() === normalizedKeyword;
  });

  if (!matched) return null;
  const country = matched.country?.trim() || fallbackCountry;
  const factoryNo = normalizeFactoryNoOrNull(matched.factoryNo) || fallbackFactoryNo;
  if (!country || !factoryNo) return null;
  return {country, factoryNo};
}

function inferCountryProductName(
  searchWord?: string | null,
  country?: string | null,
) {
  const raw = searchWord?.trim();
  const countryValue = country?.trim();
  if (!raw) return null;
  if (!countryValue) return raw;
  if (!raw.startsWith(countryValue)) return raw;
  const productName = raw.slice(countryValue.length).trim();
  return productName || null;
}

function inferFactoryNo(
  searchWord?: string | null,
  country?: string | null,
) {
  const raw = searchWord?.trim();
  const countryValue = country?.trim();
  if (!raw) return null;
  const tail =
    countryValue && raw.startsWith(countryValue) ? raw.slice(countryValue.length) : raw;
  return normalizeFactoryNoOrNull(tail);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}
