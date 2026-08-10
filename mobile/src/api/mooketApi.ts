import {CURRENT_APP_VERSION, CURRENT_APP_VERSION_CODE} from '../config/env';
import {apiClient, unwrap} from './client';
import {normalizeFactoryNo, normalizeFactoryNoOrNull} from '../utils/factoryNo';
import type {
  AppVersionInfo,
  AuthResult,
  BrandDetail,
  BrandProductDetailResult,
  CountryDetail,
  CountryFactoryProductDetail,
  CountryProductDetail,
  FactoryDetail,
  FactoryPriceComparison,
  HomeCardsResponse,
  HomeStatData,
  HotSearchItem,
  MerchantDetail,
  OfferFeedPage,
  ProductDetail,
  RegisterRequest,
  SearchHistory,
  SearchSuggest,
  SendCodeResult,
  SubstituteProduct,
  SubstituteProductDetail,
  UpdateProfileRequest,
  UserProfile,
} from '../types/api';

const DETAIL_REQUEST_TTL_MS = 5 * 60 * 1000;
const OFFER_FEED_REQUEST_TTL_MS = 60 * 1000;

type DetailRequestCacheEntry<T> = {
  expiresAt: number;
  promise?: Promise<T>;
  value?: T;
};

const detailRequestCache = new Map<string, DetailRequestCacheEntry<unknown>>();

function withDetailCache<T>(key: string, loader: () => Promise<T>, ttlMs = DETAIL_REQUEST_TTL_MS): Promise<T> {
  const now = Date.now();
  const cached = detailRequestCache.get(key) as DetailRequestCacheEntry<T> | undefined;
  if (cached && cached.value !== undefined && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }
  if (cached?.promise) {
    return cached.promise;
  }
  const promise = loader()
    .then(result => {
      detailRequestCache.set(key, {
        value: result,
        expiresAt: Date.now() + ttlMs,
      });
      return result;
    })
    .catch(error => {
      const current = detailRequestCache.get(key) as DetailRequestCacheEntry<T> | undefined;
      if (current?.promise === promise) {
        detailRequestCache.delete(key);
      }
      throw error;
    });

  detailRequestCache.set(key, {
    promise,
    expiresAt: now + ttlMs,
  });
  return promise;
}

function buildRequestCacheKey(prefix: string, params: Record<string, unknown>) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right));

  return `${prefix}:${entries
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
    .join('&')}`;
}

export const mooketApi = {
  getHotSearchRecommendations(category: string) {
    return unwrap<HotSearchItem[]>(apiClient.get('api/v1/home/hot-search', {params: {category}}));
  },

  getHomeStatData(category: string) {
    return unwrap<HomeStatData>(apiClient.get('api/v1/home/stat', {params: {category}}));
  },

  getHomeCards(category: string, tab = 0) {
    return unwrap<HomeCardsResponse>(apiClient.get('api/v1/home/cards', {params: {category, tab}}));
  },

  getRecentSearchCards(category: string) {
    return unwrap<HomeCardsResponse>(apiClient.get('api/v1/search-history/cards/recent', {params: {category}}));
  },

  getSelfSelectCards(category: string) {
    return unwrap<HomeCardsResponse>(apiClient.get('api/v1/search-history/cards/self-select', {params: {category}}));
  },

  getSelfSelectSearches(limit = 200) {
    return unwrap<SearchHistory[]>(apiClient.get('api/v1/search-history/self-select', {params: {limit}}));
  },

  getOfferFeed(params: {
    category: string;
    type: 'offer' | 'inquiry';
    keyword?: string;
    merchantId?: number | string;
    brandName?: string;
    productName?: string;
    country?: string | null;
    factoryNo?: string | null;
    goodsType?: string | null;
    region?: string | null;
    feedingType?: string | null;
    tag?: string | null;
    quotedOnly?: boolean;
    realNameOnly?: boolean;
    verifiedOnly?: boolean;
    sortBy?: string;
    page?: number;
    pageSize?: number;
    skipCache?: boolean;
  }) {
    const {skipCache, ...requestParams} = params;
    const loader = () => unwrap<OfferFeedPage>(apiClient.get('api/v1/offers/feed', {params: requestParams}));

    if (skipCache) {
      return loader();
    }

    return withDetailCache(
      buildRequestCacheKey('offerFeed', requestParams),
      loader,
      OFFER_FEED_REQUEST_TTL_MS,
    );
  },

  getSearchSuggestions(category: string, keyword: string) {
    return unwrap<SearchSuggest[]>(apiClient.get('api/v1/search/suggest', {params: {category, keyword}}));
  },

  async saveSearchHistory(params: {
    searchWord: string;
    searchType: string;
    isSelfSelect?: number;
    productId?: number | null;
    productName?: string | null;
    country?: string | null;
    factoryNo?: string | null;
    brandId?: number | null;
    merchantId?: number | string | null;
  }) {
    // Remove null/undefined values to avoid sending "null" as string
    const cleanParams: Record<string, string | number> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) cleanParams[key] = value;
    });
    await unwrap<void>(apiClient.post('api/v1/search/history', null, {params: cleanParams}));

    // The full-history endpoint does not evict the cached home-card response.
    // Re-apply self-select through its dedicated endpoint so the home screen
    // receives the newly added card as soon as it refreshes.
    if (params.isSelfSelect === 1) {
      const selfSelectParams = {...cleanParams};
      delete selfSelectParams.isSelfSelect;
      await unwrap<void>(
        apiClient.post('api/v1/search-history/self-select/add', null, {
          params: selfSelectParams,
        }),
      );
    }
  },

  getRecentSearches(limit = 20) {
    return unwrap<SearchHistory[]>(apiClient.get('api/v1/search-history/recent', {params: {limit}}));
  },

  deleteSearchHistory(historyId: number) {
    return unwrap<void>(apiClient.delete(`api/v1/search-history/${historyId}`));
  },

  batchDeleteSearchHistory(historyIds: number[]) {
    return unwrap<void>(apiClient.delete('api/v1/search-history/batch', {data: historyIds}));
  },

  moveToSelfSelect(historyId: number) {
    return unwrap<void>(apiClient.post(`api/v1/search-history/self-select/move/${historyId}`));
  },

  cancelSelfSelect(historyId: number) {
    return unwrap<void>(apiClient.post(`api/v1/search-history/self-select/cancel/${historyId}`));
  },

  sendCode(phone: string, deviceId?: string) {
    return unwrap<SendCodeResult>(
      apiClient.post('api/v1/auth/send-code', {phone}, {
        headers: deviceId ? {'X-Device-Id': deviceId} : undefined,
      }),
    );
  },

  login(phone: string, code: string, deviceId?: string) {
    const payload: Record<string, string | undefined> = {phone, code};
    if (deviceId) payload.deviceId = deviceId;
    return unwrap<AuthResult>(apiClient.post('api/v1/auth/login', payload, {timeout: 30000}));
  },

  register(token: string, payload: RegisterRequest) {
    return unwrap<AuthResult>(
      apiClient.post('api/v1/auth/register', payload, {
        headers: {Authorization: `Bearer ${token}`},
      }),
    );
  },

  getUserProfile() {
    return unwrap<UserProfile>(apiClient.get('api/v1/user/profile'));
  },

  updateProfile(payload: UpdateProfileRequest) {
    return unwrap<{message: string}>(apiClient.post('api/v1/user/profile/update', payload));
  },

  uploadAvatar(file: {uri: string; type?: string; name?: string}) {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type ?? 'image/jpeg',
      name: file.name ?? 'avatar.jpg',
    } as never);
    return unwrap<{avatarUrl: string; message: string}>(
      apiClient.post('api/v1/user/avatar/upload', formData, {
        headers: {'Content-Type': 'multipart/form-data'},
      }),
    );
  },

  logout() {
    return unwrap<void>(apiClient.post('api/v1/user/logout'));
  },

  cancelAccount() {
    return unwrap<{message: string}>(apiClient.post('api/v1/user/cancel-account'));
  },

  getAppVersion() {
    return unwrap<AppVersionInfo>(
      apiClient.get('api/v1/app/version', {
        params: {
          version: CURRENT_APP_VERSION,
          versionCode: CURRENT_APP_VERSION_CODE,
        },
      }),
    );
  },

  getMerchantDetail(merchantId: number | string, category: string) {
    return withDetailCache(
      `merchantDetail:${merchantId}:${category}`,
      () => unwrap<MerchantDetail>(apiClient.get(`api/v1/merchant/${merchantId}`, {params: {category}})),
    );
  },

  getMerchantProducts(
    merchantId: number | string,
    type: string,
    category: string,
    page: number,
    pageSize: number,
    sortBy = 'comprehensive',
  ) {
    return withDetailCache(
      `merchantProducts:${merchantId}:${type}:${category}:${page}:${pageSize}:${sortBy}`,
      () => unwrap<import('../types/api').MerchantProductPage>(
        apiClient.get(`api/v1/merchant/${merchantId}/products`, {
          params: {type, category, page, pageSize, sortBy},
        }),
      ),
    );
  },

  getProductDetail(
    productId: number,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 20,
  ) {
    return withDetailCache(
      `productDetail:${productId}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<ProductDetail>(
        apiClient.get(`api/v1/product/${productId}`, {
          params: {category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },

  getCountryDetail(
    country: string,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 20,
  ) {
    return withDetailCache(
      `countryDetail:${country}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<CountryDetail>(
        apiClient.get(`api/v1/country/${country}`, {
          params: {category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },

  getFactoryDetail(
    country: string,
    factoryNo: string,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 20,
  ) {
    const normalizedFactoryNo = normalizeFactoryNo(factoryNo);
    return withDetailCache(
      `factoryDetail:${country}:${normalizedFactoryNo}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<FactoryDetail>(
        apiClient.get('api/v1/factory/detail', {
          params: {country, factoryNo: normalizedFactoryNo, category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },

  getCountryProductDetail(
    country: string,
    productName: string,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 20,
  ) {
    return withDetailCache(
      `countryProductDetail:${country}:${productName}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<CountryProductDetail>(
        apiClient.get('api/v1/country-product', {
          params: {country, productName, category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },

  getCountryFactoryProductDetail(
    country: string,
    factoryNo: string,
    productName: string,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 20,
  ) {
    const normalizedFactoryNo = normalizeFactoryNo(factoryNo);
    return withDetailCache(
      `countryFactoryProductDetail:${country}:${normalizedFactoryNo}:${productName}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<CountryFactoryProductDetail>(
        apiClient.get('api/v1/country-factory-product', {
          params: {country, factoryNo: normalizedFactoryNo, productName, category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },

  getSubstituteProducts(country: string, factoryNo: string, productName: string, category: string) {
    const normalizedFactoryNo = normalizeFactoryNo(factoryNo);
    return withDetailCache(
      `substituteProducts:${country}:${normalizedFactoryNo}:${productName}:${category}`,
      () => unwrap<SubstituteProduct>(
        apiClient.get('api/v1/substitute/products', {
          params: {country, factoryNo: normalizedFactoryNo, productName, category},
        }),
      ),
    );
  },

  getSubstituteProductDetail(
    country: string,
    factoryNo: string,
    productName: string,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 10,
  ) {
    const normalizedFactoryNo = normalizeFactoryNo(factoryNo);
    return withDetailCache(
      `substituteProductDetail:${country}:${normalizedFactoryNo}:${productName}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<SubstituteProductDetail>(
        apiClient.get('api/v1/substitute/product/detail', {
          params: {country, factoryNo: normalizedFactoryNo, productName, category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },

  getFactoryPriceComparison(
    country: string,
    factoryNos: string[],
    productName: string,
    category: string,
    offerType = '报盘',
    days = 30,
  ) {
    const normalizedFactoryNos = Array.from(
      new Set(factoryNos.map(item => normalizeFactoryNoOrNull(item)).filter(Boolean)),
    ) as string[];
    return withDetailCache(
      `factoryPriceComparison:${country}:${normalizedFactoryNos.join(',')}:${productName}:${category}:${offerType}:${days}`,
      () => unwrap<FactoryPriceComparison>(
        apiClient.get('api/v1/price-trend/compare', {
          params: {country, factoryNos: normalizedFactoryNos.join(','), productName, category, offerType, days},
        }),
      ),
    );
  },

  getBrandDetail(
    brandName: string,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 20,
  ) {
    return withDetailCache(
      `brandDetail:${brandName}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<BrandDetail>(
        apiClient.get(`api/v1/brand/${brandName}`, {
          params: {category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },

  getBrandProductDetail(
    brandName: string,
    productName: string,
    category: string,
    type = 'offer',
    sortBy = 'comprehensive',
    page = 1,
    pageSize = 20,
  ) {
    return withDetailCache(
      `brandProductDetail:${brandName}:${productName}:${category}:${type}:${sortBy}:${page}:${pageSize}`,
      () => unwrap<BrandProductDetailResult>(
        apiClient.get(`api/v1/brand/${brandName}/product/${productName}`, {
          params: {category, type, sortBy, page, pageSize},
        }),
      ),
    );
  },
};
