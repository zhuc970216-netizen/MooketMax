import type {OfferTab} from '../components/detail/TabAndSortBar';

type NumericLike = number | string | null | undefined;
type AnyRecord = Record<string, unknown>;

type TabNumberOptions = {
  offer?: string[];
  inquiry?: string[];
  fallback?: string[];
};

export function pickNumber(source: unknown, keys: string[]): number | null {
  const record = source as AnyRecord | null | undefined;
  if (!record) return null;

  for (const key of keys) {
    const value = normalizeNumber(record[key] as NumericLike);
    if (value != null) return value;
  }

  return null;
}

export function pickTabNumber(source: unknown, tab: OfferTab, options: TabNumberOptions): number | null {
  const tabKeys = tab === 'offer' ? options.offer ?? [] : options.inquiry ?? [];
  return pickNumber(source, [...tabKeys, ...(options.fallback ?? [])]);
}

export function getTabCount(source: unknown, tab: OfferTab): number {
  return (
    pickTabNumber(source, tab, {
      offer: ['offerCount', 'todayOfferCount', 'recentOfferCount', 'totalOfferCount'],
      inquiry: ['inquiryCount', 'todayInquiryCount', 'recentInquiryCount', 'totalInquiryCount'],
      fallback: ['offerCount', 'count', 'totalCount'],
    }) ?? 0
  );
}

export function getTabMerchantCount(source: unknown, tab: OfferTab): number | null {
  return pickTabNumber(source, tab, {
    offer: ['offerMerchantCount', 'merchantOfferCount', 'todayOfferMerchantCount', 'recentOfferMerchantCount'],
    inquiry: ['inquiryMerchantCount', 'merchantInquiryCount', 'todayInquiryMerchantCount', 'recentInquiryMerchantCount'],
    fallback: ['merchantCount', 'todayMerchantCount'],
  });
}

export function getTabFactoryCount(source: unknown, tab: OfferTab): number | null {
  return pickTabNumber(source, tab, {
    offer: ['offerFactoryCount', 'factoryOfferCount', 'todayOfferFactoryCount', 'recentOfferFactoryCount'],
    inquiry: ['inquiryFactoryCount', 'factoryInquiryCount', 'todayInquiryFactoryCount', 'recentInquiryFactoryCount'],
    fallback: ['factoryCount', 'todayFactoryCount'],
  });
}

export function getTabProductCount(source: unknown, tab: OfferTab): number | null {
  return pickTabNumber(source, tab, {
    offer: ['offerProductCount', 'productOfferCount', 'todayOfferProductCount', 'recentOfferProductCount'],
    inquiry: ['inquiryProductCount', 'productInquiryCount', 'todayInquiryProductCount', 'recentInquiryProductCount'],
    fallback: ['productCount', 'todayProductCount'],
  });
}

export function countUniqueProducts(items: Array<{productName?: string | null}>): number {
  return countUnique(items.map(item => item.productName));
}

export function countUniqueFactories(items: Array<{country?: string | null; factoryNo?: string | null}>): number {
  return countUnique(items.map(item => [item.country, item.factoryNo].filter(Boolean).join('')));
}

function countUnique(values: Array<string | null | undefined>): number {
  const seen = new Set<string>();
  values.forEach(value => {
    const normalized = value?.trim();
    if (normalized) seen.add(normalized);
  });
  return seen.size;
}

function normalizeNumber(value: NumericLike): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
