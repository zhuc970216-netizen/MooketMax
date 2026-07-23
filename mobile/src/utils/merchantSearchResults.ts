import {mooketApi} from '../api/mooketApi';
import type {OfferTab} from '../components/detail/TabAndSortBar';
import type {OfferFeedItem, SearchSuggest} from '../types/api';

export type MerchantSearchSample = {
  type: OfferTab;
  category?: string | null;
  productName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  price?: number | null;
  weight?: string | null;
  publishTime?: string | null;
};

export type MerchantSearchResult = {
  merchantId?: number | string | null;
  merchantName: string;
  merchantShortName?: string | null;
  offerCount: number;
  inquiryCount: number;
  samples: MerchantSearchSample[];
  factoryKeys?: string[];
  seenFeedKeys?: Set<string>;
};

export type MerchantSearchSelection = {
  display: string;
  matchType: string;
  type: string;
  targetId?: number | string | null;
  country?: string | null;
  factoryNo?: string | null;
  productName?: string | null;
  brandName?: string | null;
  merchantName?: string | null;
};

type MerchantSearchCondition = {
  raw: string;
  matchType?: string | null;
  targetId?: number | string | null;
  merchantName?: string | null;
  brandName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  productName?: string | null;
};

type MerchantFeedParamVariant = {
  keyword?: string;
  merchantId?: number | string;
  brandName?: string;
  productName?: string;
  country?: string | null;
  factoryNo?: string | null;
};

const merchantSearchCategories = ['牛', '猪'] as const;
const merchantSearchTypes = ['offer', 'inquiry'] as const;
const merchantSearchPageSize = 80;
const merchantSearchCountries = [
  '巴西',
  '乌拉圭',
  '阿根廷',
  '澳大利亚',
  '新西兰',
  '美国',
  '加拿大',
  '墨西哥',
  '智利',
  '玻利维亚',
  '俄罗斯',
  '西班牙',
  '法国',
  '英国',
  '德国',
  '爱尔兰',
  '波兰',
  '白俄罗斯',
  '日本',
  '韩国',
  '中国',
];

export async function loadMerchantSearchResults(
  selection: MerchantSearchSelection,
): Promise<MerchantSearchResult[]> {
  const condition = buildMerchantSearchConditionFromSelection(selection);
  if (!condition.raw) return [];

  const map = new Map<string, MerchantSearchResult>();
  const feedTasks = merchantSearchCategories.flatMap(category =>
    merchantSearchTypes.map(type => ({category, type})),
  );
  const paramVariants = buildMerchantFeedParamVariants(condition);

  const feedResponses = await Promise.allSettled(
    feedTasks.flatMap(task =>
      paramVariants.map(params =>
        mooketApi
          .getOfferFeed({
            category: task.category,
            type: task.type,
            ...params,
            page: 1,
            pageSize: merchantSearchPageSize,
            sortBy: 'publish_time',
            skipCache: true,
          })
          .then(page => ({...task, params, items: page.items ?? []})),
      ),
    ),
  );

  feedResponses.forEach(response => {
    if (response.status !== 'fulfilled') return;
    const isStructuredResponse = Boolean(
      response.value.params.merchantId ||
        response.value.params.brandName ||
        response.value.params.productName ||
        response.value.params.country ||
        response.value.params.factoryNo,
    );
    response.value.items
      .filter(item => isStructuredResponse || merchantFeedItemMatchesCondition(item, condition))
      .forEach(item => addMerchantFeedItem(map, item, response.value.type, response.value.category));
  });

  if (condition.matchType === 'merchant' && map.size === 0) {
    addMerchantSuggestion(map, {
      text: condition.merchantName || condition.raw,
      keyword: condition.raw,
      type: '商家',
      priority: 0,
      targetId: Number(condition.targetId) || 0,
      matchType: 'merchant',
      merchantName: condition.merchantName || condition.raw,
      standardName: condition.merchantName || condition.raw,
    });
  }

  return Array.from(map.values()).sort((left, right) => {
    const rightTime = getMerchantLatestTime(right);
    const leftTime = getMerchantLatestTime(left);
    if (rightTime !== leftTime) return rightTime - leftTime;
    const rightScore = right.offerCount + right.inquiryCount;
    const leftScore = left.offerCount + left.inquiryCount;
    return rightScore - leftScore;
  });
}

export function buildMerchantSelectionFromSuggestion(
  item: SearchSuggest,
  display: string,
  standard: {
    country?: string | null;
    factoryNo?: string | null;
    productName?: string | null;
    brandName?: string | null;
  },
): MerchantSearchSelection {
  return {
    display,
    matchType: item.matchType,
    type: item.type,
    targetId: item.targetId,
    country: standard.country,
    factoryNo: standard.factoryNo,
    productName: standard.productName,
    brandName: standard.brandName,
    merchantName: item.matchType === 'merchant' ? item.merchantName ?? item.standardName ?? display : null,
  };
}

export function buildMerchantSelectionFromRoute(params: {
  keyword?: string;
  merchantId?: number | string;
  brandName?: string;
  productName?: string;
  country?: string | null;
  factoryNo?: string | null;
}): MerchantSearchSelection | null {
  const display = getStandardSearchWord(params.keyword || params.productName || params.brandName || params.country || '');
  if (!display && params.merchantId == null) return null;

  if (params.merchantId != null) {
    return {
      display,
      matchType: 'merchant',
      type: '商家',
      targetId: params.merchantId,
      merchantName: display,
    };
  }

  if (params.brandName) {
    return {
      display,
      matchType: 'brand',
      type: params.productName ? '品牌+产品' : '品牌',
      brandName: params.brandName,
      productName: params.productName ?? null,
    };
  }

  if (params.country || params.factoryNo || params.productName) {
    return {
      display,
      matchType: params.country && params.factoryNo && params.productName ? 'combined' : params.country ? 'country' : 'product',
      type: params.country && params.factoryNo && params.productName
        ? '国家+厂号+产品'
        : params.country && params.productName
          ? '国家+产品'
          : params.country && params.factoryNo
            ? '国家+厂号'
            : params.country
              ? '国家'
              : '产品',
      country: params.country ?? null,
      factoryNo: params.factoryNo ?? null,
      productName: params.productName ?? null,
    };
  }

  return {
    display,
    matchType: 'keyword',
    type: '关键词',
  };
}

export function getMerchantDefaultTab(item: MerchantSearchResult): OfferTab {
  if (item.offerCount === 0 && item.inquiryCount > 0) return 'inquiry';
  return 'offer';
}

export function buildMerchantDetailInitialFilters(
  selection: MerchantSearchSelection,
  result?: MerchantSearchResult,
) {
  if (selection.matchType === 'merchant') return {};
  const factoryKeys = getMerchantDetailInitialFactoryKeys(selection, result);
  return {
    initialCountry: selection.country ?? null,
    initialFactoryNo: selection.factoryNo ?? null,
    initialFactoryKeys: factoryKeys,
    initialProductName: selection.productName ?? null,
  };
}

function buildMerchantSearchConditionFromSelection(selection: MerchantSearchSelection): MerchantSearchCondition {
  const raw = getStandardSearchWord(selection.display || '').trim();
  const parsed = buildMerchantSearchCondition(raw);
  const condition: MerchantSearchCondition = {
    ...parsed,
    raw,
    matchType: selection.matchType,
    targetId: selection.targetId,
    merchantName: selection.merchantName,
    brandName: selection.brandName ?? parsed.brandName ?? null,
    country: selection.country ?? parsed.country ?? null,
    factoryNo: selection.factoryNo ?? parsed.factoryNo ?? null,
    productName: selection.productName ?? parsed.productName ?? null,
  };

  if (selection.matchType === 'product') {
    condition.productName = selection.productName ?? raw;
  }
  if (selection.matchType === 'country') {
    condition.country = selection.country ?? raw;
    condition.productName = selection.productName ?? null;
  }
  if (selection.matchType === 'brand') {
    condition.brandName = selection.brandName ?? raw.split(/\s+/)[0];
  }

  return condition;
}

function buildMerchantFeedKeyword(condition: MerchantSearchCondition) {
  if (condition.matchType === 'merchant') {
    return condition.merchantName || condition.raw;
  }
  if (condition.brandName || condition.productName || condition.country || condition.factoryNo) {
    return undefined;
  }
  return condition.raw;
}

function buildMerchantFeedParamVariants(condition: MerchantSearchCondition): MerchantFeedParamVariant[] {
  const map = new Map<string, MerchantFeedParamVariant>();
  const add = (params: MerchantFeedParamVariant) => {
    const cleanParams: MerchantFeedParamVariant = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        (cleanParams as Record<string, string | number>)[key] = value as string | number;
      }
    });
    if (Object.keys(cleanParams).length === 0) return;
    const key = Object.entries(cleanParams)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([itemKey, value]) => `${itemKey}:${String(value)}`)
      .join('|');
    if (!map.has(key)) map.set(key, cleanParams);
  };

  const keyword = buildMerchantFeedKeyword(condition);
  if (condition.matchType === 'merchant') {
    add({merchantId: condition.targetId ?? undefined});
    add({keyword});
  } else {
    add({
      brandName: condition.brandName ?? undefined,
      productName: condition.productName ?? undefined,
      country: condition.country,
      factoryNo: condition.factoryNo,
    });
    add({keyword});
  }

  if (!condition.brandName && !condition.productName && !condition.country && !condition.factoryNo) {
    add({productName: condition.raw});
    if (looksLikeBrandKeyword(condition.raw)) {
      add({brandName: condition.raw});
    }
    if (looksLikeFactoryNo(condition.raw)) {
      add({factoryNo: condition.raw});
    }
  }

  return Array.from(map.values());
}

function addMerchantFeedItem(map: Map<string, MerchantSearchResult>, item: OfferFeedItem, type: OfferTab, category: string) {
  const merchantName = getKnownMerchantName(item);
  if (!merchantName) return;
  const key = buildMerchantResultKey(item.merchantId, merchantName);
  const current = map.get(key) ?? {
    merchantId: item.merchantId,
    merchantName,
    merchantShortName: item.merchantShortName,
    offerCount: 0,
    inquiryCount: 0,
    samples: [],
    factoryKeys: [],
    seenFeedKeys: new Set<string>(),
  };

  const feedKey = buildMerchantFeedKey(item, type);
  if (current.seenFeedKeys?.has(feedKey)) {
    map.set(key, current);
    return;
  }
  current.seenFeedKeys?.add(feedKey);

  if (type === 'offer') current.offerCount += 1;
  else current.inquiryCount += 1;

  const factoryKey = buildMerchantFactoryKey(item.country, item.factoryNo);
  if (factoryKey && !current.factoryKeys?.includes(factoryKey)) {
    current.factoryKeys = [...(current.factoryKeys ?? []), factoryKey];
  }

  const sample: MerchantSearchSample = {
    type,
    category: item.category ?? category,
    productName: item.productName,
    country: item.country,
    factoryNo: item.factoryNo,
    price: item.price,
    weight: item.weight,
    publishTime: item.publishTime,
  };
  const sampleKey = `${sample.type}-${sample.productName ?? ''}-${sample.country ?? ''}-${sample.factoryNo ?? ''}`;
  const hasSample = current.samples.some(
    existing => `${existing.type}-${existing.productName ?? ''}-${existing.country ?? ''}-${existing.factoryNo ?? ''}` === sampleKey,
  );
  if (!hasSample) {
    current.samples.push(sample);
    current.samples = current.samples
      .sort((left, right) => parseMerchantTime(right.publishTime) - parseMerchantTime(left.publishTime))
      .slice(0, 5);
  }
  map.set(key, current);
}

function addMerchantSuggestion(map: Map<string, MerchantSearchResult>, item: SearchSuggest) {
  const merchantName = item.merchantName || item.text || '未知商家';
  const key = buildMerchantResultKey(item.targetId, merchantName);
  if (map.has(key)) return;
  map.set(key, {
    merchantId: item.targetId,
    merchantName,
    merchantShortName: item.standardName ?? null,
    offerCount: 0,
    inquiryCount: 0,
    samples: [],
    factoryKeys: [],
    seenFeedKeys: new Set<string>(),
  });
}

function getMerchantDetailInitialFactoryKeys(
  selection: MerchantSearchSelection,
  result?: MerchantSearchResult,
) {
  if (selection.factoryNo || selection.matchType === 'merchant') return undefined;
  const isBrandSearch = selection.matchType === 'brand' || Boolean(selection.brandName);
  if (!isBrandSearch) return undefined;
  const keys = result?.factoryKeys?.filter(Boolean) ?? [];
  return keys.length > 0 ? keys : undefined;
}

function buildMerchantFactoryKey(country?: string | null, factoryNo?: string | null) {
  const countryText = country?.trim();
  const factoryText = factoryNo?.trim();
  if (!countryText || !factoryText) return '';
  return `${countryText}${factoryText}`;
}

function buildMerchantResultKey(merchantId?: number | string | null, merchantName?: string | null) {
  if (merchantId != null && String(merchantId).trim()) return `id:${String(merchantId).trim()}`;
  return `name:${normalizeText(merchantName)}`;
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

function getKnownMerchantName(item: OfferFeedItem) {
  const names = [item.merchantShortName, item.merchantName]
    .map(name => name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.find(name => !isUnknownMerchantName(name)) ?? null;
}

function isUnknownMerchantName(value?: string | null) {
  return normalizeText(value) === normalizeText('未知商家');
}

function buildMerchantFeedKey(item: OfferFeedItem, type: OfferTab) {
  if (item.offerId != null) return `${type}:id:${item.offerId}`;
  return [
    type,
    item.merchantId ?? '',
    item.productName ?? '',
    item.country ?? '',
    item.factoryNo ?? '',
    item.publishTime ?? '',
    item.price ?? '',
  ].join('|');
}

function getMerchantLatestTime(item: MerchantSearchResult) {
  return Math.max(0, ...item.samples.map(sample => parseMerchantTime(sample.publishTime)));
}

function parseMerchantTime(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value.replace(/-/g, '/'));
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

function merchantFeedItemMatchesCondition(item: OfferFeedItem, condition: MerchantSearchCondition) {
  const comparable = normalizeSearchComparable(condition.raw);
  if (!comparable) return true;
  const haystack = normalizeSearchComparable([
    item.merchantName,
    item.merchantShortName,
    item.brandName,
    item.productName,
    item.country,
    item.factoryNo,
    `${item.country ?? ''}${item.factoryNo ?? ''}`,
  ].filter(Boolean).join(' '));
  return haystack.includes(comparable);
}

function buildMerchantSearchCondition(keyword: string): MerchantSearchCondition {
  const raw = getStandardSearchWord(keyword).trim();
  const compact = normalizeSearchComparable(raw);
  const compactCondition = splitCompactCountryFactoryProduct(raw, compact);
  if (compactCondition) return compactCondition;

  const parts = raw.split(/\s+/).filter(Boolean);
  const countryFactoryIndex = parts.findIndex(part => Boolean(splitCountryFactoryPart(part)));
  if (countryFactoryIndex >= 0) {
    const countryFactory = splitCountryFactoryPart(parts[countryFactoryIndex]);
    if (countryFactory) {
      const productName = [
        ...parts.slice(0, countryFactoryIndex),
        ...parts.slice(countryFactoryIndex + 1),
      ].join(' ');
      return {
        raw,
        country: countryFactory.country,
        factoryNo: countryFactory.factoryNo,
        productName: productName || null,
      };
    }
  }

  const factoryIndex = parts.findIndex(looksLikeFactoryNo);
  if (factoryIndex >= 0) {
    const beforeFactory = parts.slice(0, factoryIndex).join('');
    const productName = parts.slice(factoryIndex + 1).join(' ');
    return {
      raw,
      country: looksLikeCountryText(beforeFactory) ? beforeFactory : null,
      factoryNo: parts[factoryIndex],
      productName: productName || null,
    };
  }

  if (parts.length >= 2 && looksLikeCountryText(parts[0])) {
    return {
      raw,
      country: parts[0],
      productName: parts.slice(1).join(' '),
    };
  }

  if (parts.length >= 2 && looksLikeBrandKeyword(parts[0])) {
    return {
      raw,
      brandName: parts[0],
      productName: parts.slice(1).join(' '),
    };
  }

  return {raw};
}

function splitCompactCountryFactoryProduct(raw: string, compact: string): MerchantSearchCondition | null {
  const country = [...merchantSearchCountries]
    .sort((left, right) => right.length - left.length)
    .find(item => compact.startsWith(normalizeSearchComparable(item)));
  if (!country) return null;
  const tail = raw.replace(/\s+/g, '').slice(country.length);
  const factoryMatch = tail.match(/^([A-Za-z]*\d[A-Za-z0-9-]*)(.*)$/);
  if (factoryMatch) {
    return {
      raw,
      country,
      factoryNo: factoryMatch[1],
      productName: factoryMatch[2] || null,
    };
  }
  return tail
    ? {
        raw,
        country,
        productName: tail,
      }
    : {raw, country};
}

function splitCountryFactoryPart(value: string) {
  const compact = value.replace(/\s+/g, '');
  const country = [...merchantSearchCountries]
    .sort((left, right) => right.length - left.length)
    .find(item => compact.startsWith(item));
  if (!country) return null;
  const factoryNo = compact.slice(country.length);
  if (!looksLikeFactoryNo(factoryNo)) return null;
  return {country, factoryNo};
}

function looksLikeCountryText(value?: string | null) {
  const text = value?.trim();
  return Boolean(text && merchantSearchCountries.includes(text as (typeof merchantSearchCountries)[number]));
}

function looksLikeBrandKeyword(value?: string | null) {
  const text = value?.trim();
  return Boolean(text && /^[a-zA-Z][a-zA-Z0-9-]{1,24}$/.test(text) && !looksLikeFactoryNo(text));
}

function looksLikeFactoryNo(value?: string | null) {
  const text = value?.trim();
  return Boolean(text && /^(?:[A-Za-z]+\d|\d+[A-Za-z])[A-Za-z0-9-]*$/.test(text));
}

function normalizeSearchComparable(value?: string | null) {
  return getStandardSearchWord(value ?? '').replace(/\s+/g, '').toLowerCase();
}

function getStandardSearchWord(value?: string | null) {
  return (value ?? '').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}
