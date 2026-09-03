import type {HomeCardItem} from '../types/api';

type SearchHistoryPayload = {
  searchWord: string;
  searchType: string;
  isSelfSelect?: number;
  productId?: number | null;
  productName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  brandId?: number | null;
  merchantId?: number | string | null;
};

const EXAMPLE_CARD_TYPES = [
  'product',
  'country',
  'brand',
  'merchant',
  'factory',
  'countryProduct',
  'factoryProduct',
  'brandProduct',
];

function toHistoryId(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

export function getHomeCardEntityKey(card: HomeCardItem) {
  switch (card.cardType) {
    case 'product':
      return card.productId ? `product:${card.productId}` : null;
    case 'country':
      return card.country ? `country:${card.country}` : null;
    case 'brand':
      return card.brandId
        ? `brand:${card.brandId}`
        : card.brandName
          ? `brand-name:${card.brandName}`
          : null;
    case 'merchant':
      return card.merchantId
        ? `merchant:${card.merchantId}`
        : card.merchantName
          ? `merchant-name:${card.merchantName}`
          : null;
    case 'factory':
      return card.country && card.factoryNo ? `factory:${card.country}:${card.factoryNo}` : null;
    case 'countryProduct':
      return card.country && card.productName ? `countryProduct:${card.country}:${card.productName}` : null;
    case 'factoryProduct':
      return card.country && card.factoryNo && card.productName
        ? `factoryProduct:${card.country}:${card.factoryNo}:${card.productName}`
        : null;
    case 'brandProduct':
      return card.brandId && card.productName
        ? `brandProduct:${card.brandId}:${card.productName}`
        : card.brandName && card.productName
          ? `brandProductName:${card.brandName}:${card.productName}`
          : null;
    default:
      return null;
  }
}

export function buildHomeFallbackExampleCards(
  cards: HomeCardItem[],
  promotedKeys: Set<string>,
  dismissedKeys: Set<string>,
): HomeCardItem[] {
  const seenTypes = new Set<string>();
  const result: HomeCardItem[] = [];

  for (const card of cards) {
    const cardType = card.cardType ?? '';
    if (!EXAMPLE_CARD_TYPES.includes(cardType) || seenTypes.has(cardType)) continue;

    const entityKey = getHomeCardEntityKey(card);
    if (!entityKey || dismissedKeys.has(entityKey) || promotedKeys.has(entityKey)) continue;

    seenTypes.add(cardType);
    result.push({
      ...card,
      isExample: true,
      exampleEntityKey: entityKey,
    });
  }

  return result;
}

export function buildHomeCardSearchHistoryPayload(card: HomeCardItem): SearchHistoryPayload | null {
  switch (card.cardType) {
    case 'product':
      if (!card.productName) return null;
      return {
        searchWord: card.productName,
        searchType: '\u4ea7\u54c1',
        productId: card.productId ?? null,
        productName: card.productName,
      };
    case 'country':
      if (!card.country) return null;
      return {
        searchWord: card.country,
        searchType: '\u56fd\u5bb6',
        country: card.country,
      };
    case 'brand':
      if (!card.brandName) return null;
      return {
        searchWord: card.brandName,
        searchType: '\u54c1\u724c',
        brandId: card.brandId ?? null,
      };
    case 'merchant': {
      const merchantName = card.merchantName ?? card.merchantShortName;
      if (!merchantName) return null;
      return {
        searchWord: merchantName,
        searchType: '\u5546\u5bb6',
        merchantId: toHistoryId(card.merchantId),
      };
    }
    case 'factory':
      if (!card.country || !card.factoryNo) return null;
      return {
        searchWord: `${card.country}${card.factoryNo}`,
        searchType: '\u56fd\u5bb6\u5382\u53f7',
        country: card.country,
        factoryNo: card.factoryNo,
      };
    case 'countryProduct':
      if (!card.country || !card.productName) return null;
      return {
        searchWord: `${card.country}${card.productName}`,
        searchType: '\u56fd\u5bb6\u4ea7\u54c1',
        country: card.country,
        productName: card.productName,
      };
    case 'factoryProduct':
      if (!card.country || !card.factoryNo || !card.productName) return null;
      return {
        searchWord: `${card.country}${card.factoryNo}${card.productName}`,
        searchType: '\u56fd\u5bb6\u5382\u53f7\u4ea7\u54c1',
        country: card.country,
        factoryNo: card.factoryNo,
        productName: card.productName,
      };
    case 'brandProduct':
      if (!card.brandName || !card.productName) return null;
      return {
        searchWord: `${card.brandName} ${card.productName}`,
        searchType: '\u54c1\u724c\u4ea7\u54c1',
        brandId: card.brandId ?? null,
        productName: card.productName,
      };
    default:
      return null;
  }
}
