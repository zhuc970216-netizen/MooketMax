import storage from '../platform/storage';
import type {EmployeeOffer, EmployeeOfferItem, OfferFeedItem} from '../types/api';

export type PlateKind = 'offer' | 'inquiry';
export type ContactAction = 'wechat' | 'phone';
export type FollowStatus = 'new' | 'contacted' | 'waiting' | 'key' | 'done' | 'abandoned';

export type PlateSnapshot = {
  key: string;
  type: PlateKind;
  offerId?: number | null;
  title: string;
  productName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  merchantId?: number | string | null;
  merchantName?: string | null;
  publisherName?: string | null;
  price?: number | null;
  priceMax?: number | null;
  weight?: string | null;
  offerType?: string | null;
  goodsType?: string | null;
  goodsLocation?: string | null;
  region?: string | null;
  tags?: string | null;
  fatRatio?: string | null;
  feedingType?: string | null;
  cattleBreed?: string | null;
  remark?: string | null;
  contactPhone?: string | null;
  publishTime?: string | null;
  originalText?: string | null;
  note?: string | null;
  followStatus?: FollowStatus;
  createdAt?: number;
  lastContactedAt?: number;
  lastContactAction?: ContactAction;
};

const INTENT_STORAGE_KEY = 'mooket.intentPlates.v1';
const RECENT_CONTACT_STORAGE_KEY = 'mooket.recentContactPlates.v1';
const MAX_LOCAL_RECORDS = 200;

export function createPlateSnapshotFromFeed(item: OfferFeedItem, type: PlateKind): PlateSnapshot {
  const title = buildPlateTitle(item.productName, item.country, item.factoryNo, type);
  return withStableKey({
    type,
    offerId: item.offerId ?? null,
    title,
    productName: item.productName ?? null,
    country: item.country ?? null,
    factoryNo: item.factoryNo ?? null,
    merchantId: item.merchantId ?? null,
    merchantName: item.merchantShortName || item.merchantName || null,
    publisherName: item.userNickname ?? null,
    price: item.price ?? null,
    priceMax: item.priceMax ?? null,
    weight: item.weight ?? null,
    offerType: item.offerType ?? null,
    goodsType: item.goodsType ?? null,
    goodsLocation: item.goodsLocation ?? null,
    region: item.region ?? null,
    tags: item.tags ?? null,
    fatRatio: item.fatRatio ?? null,
    feedingType: item.feedingType ?? null,
    cattleBreed: item.cattleBreed ?? null,
    remark: item.remark ?? null,
    contactPhone: item.contactPhone ?? null,
    publishTime: item.publishTime ?? null,
    originalText:
      item.offerOriginalText ??
      item.originalText ??
      item.originalContent ??
      item.sourceText ??
      item.rawText ??
      null,
  });
}

export function createPlateSnapshotFromEmployee(
  offer: EmployeeOffer | EmployeeOfferItem,
  type: PlateKind,
  context: {
    country?: string | null;
    factoryNo?: string | null;
    productName?: string | null;
    merchantName?: string | null;
    merchantId?: number | string | null;
    contactPhone?: string | null;
  },
): PlateSnapshot {
  const title = buildPlateTitle(context.productName, context.country, context.factoryNo, type);
  return withStableKey({
    type,
    offerId: offer.offerId ?? null,
    title,
    productName: context.productName ?? null,
    country: context.country ?? null,
    factoryNo: context.factoryNo ?? null,
    merchantId: context.merchantId ?? null,
    merchantName: context.merchantName ?? null,
    publisherName: offer.userNickname ?? null,
    price: normalizePrice(offer.price),
    priceMax: 'priceMax' in offer ? normalizePrice(offer.priceMax) : null,
    weight: offer.weight ?? null,
    goodsType: offer.goodsType ?? null,
    goodsLocation: offer.goodsLocation ?? null,
    tags: offer.tags ?? null,
    fatRatio: offer.fatRatio ?? null,
    feedingType: offer.feedingType ?? ('feedingMethod' in offer ? offer.feedingMethod : null) ?? null,
    cattleBreed: offer.cattleBreed ?? null,
    remark: offer.remark ?? null,
    contactPhone: context.contactPhone ?? null,
    publishTime: offer.publishTime ?? null,
    originalText: offer.offerOriginalText ?? null,
  });
}

function normalizePrice(value?: string | number | null) {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function addIntentPlate(snapshot: PlateSnapshot) {
  const items = await readSnapshots(INTENT_STORAGE_KEY);
  const now = Date.now();
  const existingIndex = items.findIndex(item => item.key === snapshot.key);
  const existing = existingIndex >= 0 ? items[existingIndex] : null;
  const nextItem = {
    ...existing,
    ...snapshot,
    createdAt: existing?.createdAt ?? now,
    note: existing?.note ?? snapshot.note ?? null,
    followStatus: existing?.followStatus ?? snapshot.followStatus ?? undefined,
  };
  const nextItems =
    existingIndex >= 0
      ? [nextItem, ...items.filter((_, index) => index !== existingIndex)]
      : [nextItem, ...items];

  await writeSnapshots(INTENT_STORAGE_KEY, nextItems);
  return {alreadyAdded: existingIndex >= 0, total: nextItems.length};
}

export async function recordRecentContactPlate(snapshot: PlateSnapshot, action: ContactAction) {
  const items = await readSnapshots(RECENT_CONTACT_STORAGE_KEY);
  const now = Date.now();
  const nextItem = {...snapshot, lastContactedAt: now, lastContactAction: action};
  const nextItems = [nextItem, ...items.filter(item => item.key !== snapshot.key)];
  await writeSnapshots(RECENT_CONTACT_STORAGE_KEY, nextItems);
  return {total: nextItems.length};
}

export async function getPlateFollowCounts() {
  const [intentItems, recentItems] = await Promise.all([
    readSnapshots(INTENT_STORAGE_KEY),
    readSnapshots(RECENT_CONTACT_STORAGE_KEY),
  ]);

  return {
    intentCount: intentItems.length,
    recentCount: recentItems.length,
  };
}

export async function getIntentPlates() {
  return readSnapshots(INTENT_STORAGE_KEY);
}

export async function getIntentPlateKeys() {
  const items = await readSnapshots(INTENT_STORAGE_KEY);
  return new Set(items.map(item => item.key));
}

export async function getRecentContactPlates() {
  return readSnapshots(RECENT_CONTACT_STORAGE_KEY);
}

export async function updateIntentPlate(key: string, patch: Partial<Pick<PlateSnapshot, 'note' | 'followStatus'>>) {
  const items = await readSnapshots(INTENT_STORAGE_KEY);
  const nextItems = items.map(item => (item.key === key ? {...item, ...patch} : item));
  await writeSnapshots(INTENT_STORAGE_KEY, nextItems);
  return nextItems;
}

export async function removeIntentPlate(key: string) {
  const items = await readSnapshots(INTENT_STORAGE_KEY);
  await writeSnapshots(INTENT_STORAGE_KEY, items.filter(item => item.key !== key));
}

function buildPlateTitle(
  productName?: string | null,
  country?: string | null,
  factoryNo?: string | null,
  type?: PlateKind,
) {
  const product = productName?.trim() || (type === 'inquiry' ? '求购' : '报盘');
  const countryText = country?.trim() ?? '';
  const factoryText = factoryNo?.trim() ?? '';
  const factoryLabel = countryText || factoryText ? `${countryText}${factoryText || '厂号不限'}` : '国家厂号不限';
  return `${product} ${factoryLabel}`;
}

function withStableKey(snapshot: Omit<PlateSnapshot, 'key'>): PlateSnapshot {
  const key = snapshot.offerId
    ? `${snapshot.type}:${snapshot.offerId}`
    : [
        snapshot.type,
        snapshot.title,
        snapshot.merchantId ?? snapshot.merchantName ?? '',
        snapshot.publisherName ?? '',
        snapshot.price ?? '',
        snapshot.publishTime ?? '',
      ].join('|');

  return {...snapshot, key};
}

async function readSnapshots(key: string): Promise<PlateSnapshot[]> {
  const raw = await storage.getItem(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPlateSnapshot) : [];
  } catch {
    return [];
  }
}

async function writeSnapshots(key: string, items: PlateSnapshot[]) {
  await storage.setItem(key, JSON.stringify(items.slice(0, MAX_LOCAL_RECORDS)));
}

function isPlateSnapshot(value: unknown): value is PlateSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<PlateSnapshot>;
  return typeof item.key === 'string' && (item.type === 'offer' || item.type === 'inquiry');
}
