import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Circle, Path} from 'react-native-svg';
import {mooketApi} from '../api/mooketApi';
import {FilterBar, type FilterDef, type FilterKey} from '../components/detail/FilterBar';
import {FilterPanelSheet, MultiSelectChips} from '../components/detail/FilterPanelSheet';
import {OriginalTextSheet} from '../components/detail/OriginalTextSheet';
import {MiniTrendChart} from '../components/home/MiniTrendChart';
import {OfferActionSheet} from '../components/home/OfferActionSheet';
import {OfferFrozenTable} from '../components/home/OfferFrozenTable';
import {DEFAULT_CATEGORY} from '../config/env';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import type {HomeCardItem, HomeHotSku, HotSearchItem, OfferFeedFilterOptions, OfferFeedItem} from '../types/api';
import {copyToClipboard, dialPhone} from '../utils/contact';
import {normalizeFactoryNoOrNull} from '../utils/factoryNo';
import {buildOriginalTextPayload} from '../utils/originalText';
import {
  addIntentPlate,
  createPlateSnapshotFromFeed,
  getIntentPlateKeys,
  recordRecentContactPlate,
  removeIntentPlate,
  getIntentPlates,
  getRecentContactPlates,
  type ContactAction,
  type PlateSnapshot,
} from '../utils/plateFollowStore';
import {enrichSelfSelectCards, mergeSelfSelectCardsWithHistories, sortSelfSelectCardsByCreateTime} from '../utils/selfSelectCards';
import {openHomeCard, openHotSearch} from '../utils/navigation';
import {buildDiscoveryRecommendations, type DiscoveryRecommendation, type SubstituteRecommendationInput} from '../utils/discoveryRecommendations';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type MainTab = 'offer' | 'inquiry' | 'self' | 'discover';
type SelfCompareScene = 'sku' | 'merchant' | 'dynamic';
type FeedFilterKey = 'category' | 'sort' | 'followedMerchant' | 'region' | 'priceRange' | 'goodsType' | 'feedingMethod' | 'tag';
type SortKind = 'comprehensive' | 'priceAsc' | 'priceDesc' | 'publishTime';
type FeedFilters = {
  followedMerchant?: boolean;
  region?: string | null;
  goodsType?: string | null;
  feedingType?: string | null;
  tag?: string | null;
};
type FeedGroup = {
  key: string;
  title: string;
  productName: string;
  country: string;
  factoryNo: string;
  merchantName: string;
  merchantId?: number | string | null;
  price: string;
  time: string;
  items: OfferFeedItem[];
};
type HotSkuPriceStat = {
  key: string;
  country: string;
  factoryNo: string;
  productName: string;
  title: string;
  price: string;
  merchantCount: number;
  offerCount: number;
  latestTime: number;
  trend: number[];
};

type FallbackTrendMeta = {
  trend: number[];
  price?: string;
};
type SelfCompareFilter = {
  country: string[];
  factoryNo: string[];
  productName: string[];
};
type SelfCompareChip = {
  type: keyof SelfCompareFilter;
  value: string;
};
type SelfMerchantOption = {
  key: string;
  name: string;
  shortName: string;
  merchantId?: number | string | null;
};
type SelfEditTab = 'sku' | 'merchant';
type SelfFilterDropdown = keyof SelfCompareFilter | 'merchant' | null;
type SelfMerchantQuote = {
  key: string;
  name: string;
  shortName: string;
  merchantId?: number | string | null;
  price: string;
  meta: string;
};

const FEED_PAGE_SIZE = 30;
const categoryOptions = ['牛', '猪'];
const sortOptions: Array<{label: string; value: SortKind}> = [
  {label: '综合', value: 'comprehensive'},
  {label: '最新', value: 'publishTime'},
  {label: '价格区间', value: 'priceAsc'},
  {label: '高价优先', value: 'priceDesc'},
];
export function HomeScreenV2({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MainTab>('offer');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [hotSearches, setHotSearches] = useState<HotSearchItem[]>([]);
  const [hotSkus, setHotSkus] = useState<HomeHotSku[]>([]);
  const [discoverItems, setDiscoverItems] = useState<DiscoveryRecommendation[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [cards, setCards] = useState<HomeCardItem[]>([]);
  const [feedItems, setFeedItems] = useState<OfferFeedItem[]>([]);
  const [fallbackTrendMap, setFallbackTrendMap] = useState<Record<string, FallbackTrendMeta>>({});
  const [filterOptions, setFilterOptions] = useState<OfferFeedFilterOptions>({});
  const [feedError, setFeedError] = useState('');
  const [filters, setFilters] = useState<FeedFilters>({});
  const [sort, setSort] = useState<SortKind>('comprehensive');
  const [priceMinInput, setPriceMinInput] = useState('');
  const [priceMaxInput, setPriceMaxInput] = useState('');
  const [activeFilter, setActiveFilter] = useState<FeedFilterKey | null>(null);
  const [filterPanelTop, setFilterPanelTop] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [intentKeys, setIntentKeys] = useState<Set<string>>(new Set());
  const [followedMerchantKeys, setFollowedMerchantKeys] = useState<Set<string>>(new Set());
  const [originalText, setOriginalText] = useState<{text: string; keywords: string[]} | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<OfferFeedItem | null>(null);
  const [selfCompareScene, setSelfCompareScene] = useState<SelfCompareScene>('sku');
  const [selfCompareFilter, setSelfCompareFilter] = useState<SelfCompareFilter>({
    country: [],
    factoryNo: [],
    productName: [],
  });
  const [selfFilterDropdown, setSelfFilterDropdown] = useState<SelfFilterDropdown>(null);
  const [selfMerchantFilterKeys, setSelfMerchantFilterKeys] = useState<string[] | null>(null);
  const [selfEditVisible, setSelfEditVisible] = useState(false);
  const [selfEditTab, setSelfEditTab] = useState<SelfEditTab>('sku');
  const [removingSelfKey, setRemovingSelfKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const requestSeqRef = useRef(0);
  const homeRequestSeqRef = useRef(0);
  const fallbackTrendSeqRef = useRef(0);
  const discoveryRequestSeqRef = useRef(0);

  const feedType = activeTab === 'inquiry' ? 'inquiry' : 'offer';

  const loadHomeData = useCallback(async () => {
    const seq = (homeRequestSeqRef.current += 1);
    const [hotDataResult, hotSkuResult, selfSelectResult, selfSelectHistoriesResult] = await Promise.allSettled([
      mooketApi.getHotSearchRecommendations(category),
      mooketApi.getHomeHotOfferSkus(category, 3),
      mooketApi.getSelfSelectCards(category),
      mooketApi.getSelfSelectSearches(500),
    ]);
    if (seq !== homeRequestSeqRef.current) return;

    const hotData = hotDataResult.status === 'fulfilled' ? hotDataResult.value : [];
    const hotSkuData = hotSkuResult.status === 'fulfilled' ? hotSkuResult.value : null;
    const selfSelectData = selfSelectResult.status === 'fulfilled' ? selfSelectResult.value : {cards: []};
    const selfSelectHistories = selfSelectHistoriesResult.status === 'fulfilled' ? selfSelectHistoriesResult.value : [];
    const merged = mergeSelfSelectCardsWithHistories(selfSelectData.cards ?? [], selfSelectHistories);
    const enriched = await enrichSelfSelectCards(category, merged);
    if (seq !== homeRequestSeqRef.current) return;

    setHotSearches(hotData);
    if (hotSkuData != null) {
      setHotSkus(hotSkuData);
    }
    setCards(sortSelfSelectCardsByCreateTime(enriched, selfSelectHistories));
  }, [category]);

  const loadFeed = useCallback(async (mode: 'replace' | 'refresh' = 'replace') => {
    if (activeTab === 'self' || activeTab === 'discover') return;
    const seq = (requestSeqRef.current += 1);
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setFeedError('');
      const result = await mooketApi.getOfferFeed({
        category,
        type: feedType,
        region: filters.region,
        goodsType: filters.goodsType,
        feedingType: filters.feedingType,
        tag: filters.tag,
        sortBy: sortToParam(sort),
        page: 1,
        pageSize: FEED_PAGE_SIZE,
        skipCache: mode === 'refresh',
      });
      if (seq !== requestSeqRef.current) return;
      setFeedItems(result.items ?? []);
      setFilterOptions(result.filterOptions ?? {});
      setExpandedKeys(new Set());
    } catch (error) {
      if (seq !== requestSeqRef.current) return;
      setFeedError(error instanceof Error ? error.message : '请稍后重试');
      setFeedItems([]);
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeTab, category, feedType, filters, sort]);

  const loadDiscovery = useCallback(async () => {
    const seq = (discoveryRequestSeqRef.current += 1);
    setDiscoverLoading(true);
    setDiscoverError('');
    try {
      const recentSelfSelects = sortSelfSelectCardsByCreateTime(cards, []).filter(card => normalizeCardType(card.cardType) === 'factoryProduct');
      const [hotResult, substituteResults] = await Promise.all([
        mooketApi.getHomeHotOfferSkus(category, 30).catch(() => hotSkus),
        Promise.allSettled(recentSelfSelects.slice(0, 5).map(async selected => ({
          selected,
          substitute: await mooketApi.getSubstituteProducts(clean(selected.country), clean(selected.factoryNo), clean(selected.productName), category),
        }))),
      ]);
      const substitutes = substituteResults
        .filter((result): result is PromiseFulfilledResult<SubstituteRecommendationInput> => result.status === 'fulfilled')
        .map(result => result.value);
      const recommendations = buildDiscoveryRecommendations({hotSkus: hotResult, recentSelfSelects, substitutes, limit: 30});
      const enrichmentTargets = new Set(recommendations.filter(item => item.trendPoints.length === 0).slice(0, 10).map(item => item.key));
      const enriched = await Promise.all(recommendations.map(async recommendation => {
        if (recommendation.trendPoints.length > 0 || !enrichmentTargets.has(recommendation.key)) return recommendation;
        try {
          const comparison = await mooketApi.getFactoryPriceComparison(recommendation.country, [recommendation.factoryNo], recommendation.productName, category);
          const factory = comparison.factories?.[0];
          const prices = factory?.trend?.map(point => Number(point.avgPrice)).filter(value => Number.isFinite(value) && value > 0) ?? [];
          return {
            ...recommendation,
            priceMin: prices.length > 0 ? Math.min(...prices) : recommendation.priceMin,
            priceMax: prices.length > 0 ? Math.max(...prices) : recommendation.priceMax,
            trendPoints: factory?.trend?.map(point => ({date: point.date, avgPrice: point.avgPrice, offerCount: point.offerCount})) ?? [],
          };
        } catch {
          return recommendation;
        }
      }));
      if (seq === discoveryRequestSeqRef.current) setDiscoverItems(enriched);
    } catch (error) {
      if (seq === discoveryRequestSeqRef.current) {
        setDiscoverItems([]);
        setDiscoverError(error instanceof Error ? error.message : '推荐加载失败');
      }
    } finally {
      if (seq === discoveryRequestSeqRef.current) setDiscoverLoading(false);
    }
  }, [cards, category, hotSkus]);

  useEffect(() => {
    loadHomeData().catch(() => undefined);
  }, [loadHomeData]);

  useEffect(() => {
    loadFeed('replace').catch(() => undefined);
  }, [loadFeed]);

  useEffect(() => {
    if (activeTab === 'discover') loadDiscovery().catch(() => undefined);
  }, [activeTab, loadDiscovery]);

  useFocusEffect(
    useCallback(() => {
      getIntentPlateKeys().then(setIntentKeys).catch(() => undefined);
      getFollowedMerchantKeys().then(setFollowedMerchantKeys).catch(() => undefined);
      loadHomeData().catch(() => undefined);
    }, [loadHomeData]),
  );

  const groups = useMemo(
    () => groupFeedItems(feedItems, feedType, priceMinInput, priceMaxInput, filters.followedMerchant ? followedMerchantKeys : null),
    [feedItems, feedType, filters.followedMerchant, followedMerchantKeys, priceMaxInput, priceMinInput],
  );
  const hotSkuPriceStats = useMemo(() => buildHotSkuPriceStats(hotSkus), [hotSkus]);
  const rawFallbackHotSkuPriceStats = useMemo(() => buildFallbackHotSkuPriceStats(feedItems), [feedItems]);
  const fallbackHotSkuPriceStats = useMemo(
    () =>
      rawFallbackHotSkuPriceStats.map(item => {
        const trendMeta = fallbackTrendMap[item.key];
        if (!trendMeta) {
          return item;
        }
        return {
          ...item,
          price: trendMeta.price ?? item.price,
          trend: trendMeta.trend.length > 0 ? trendMeta.trend : item.trend,
        };
      }),
    [fallbackTrendMap, rawFallbackHotSkuPriceStats],
  );
  const displayHotSkuPriceStats = hotSkuPriceStats.length > 0 ? hotSkuPriceStats : fallbackHotSkuPriceStats;

  useEffect(() => {
    if (hotSkuPriceStats.length > 0) {
      setFallbackTrendMap({});
      return;
    }
    if (rawFallbackHotSkuPriceStats.length === 0) {
      setFallbackTrendMap({});
      return;
    }

    const seq = (fallbackTrendSeqRef.current += 1);
    const targets = rawFallbackHotSkuPriceStats
      .filter(item => item.country && item.factoryNo && item.productName)
      .slice(0, 3);

    Promise.all(
      targets.map(async item => {
        try {
          const result = await mooketApi.getFactoryPriceComparison(
            item.country,
            [item.factoryNo],
            item.productName,
            category,
          );
          const trend =
            result.factories?.[0]?.trend
              ?.map(point => Number(point.avgPrice))
              .filter((value): value is number => Number.isFinite(value) && value > 0) ?? [];
          const rangeText = formatTrendRange(trend);
          console.log('[Home fallback trend fetch]', item.title, trend);
          if (trend.length === 1) {
            return [item.key, {trend: [trend[0], trend[0]], price: rangeText}] as const;
          }
          return [item.key, {trend, price: rangeText}] as const;
        } catch (error) {
          console.log('[Home fallback trend fetch failed]', item.title, error instanceof Error ? error.message : String(error));
          return [item.key, {trend: item.trend}] as const;
        }
      }),
    )
      .then(entries => {
        if (seq !== fallbackTrendSeqRef.current) {
          return;
        }
        console.log('[Home fallback trend map]', entries);
        setFallbackTrendMap(
          entries.reduce<Record<string, FallbackTrendMeta>>((acc, [key, trendMeta]) => {
            acc[key] = trendMeta;
            return acc;
          }, {}),
        );
      })
      .catch(() => {
        if (seq !== fallbackTrendSeqRef.current) {
          return;
        }
        setFallbackTrendMap({});
      });
  }, [category, hotSkuPriceStats.length, rawFallbackHotSkuPriceStats]);
  const selfCompareCards = useMemo(
    () => cards.filter(card => normalizeCardType(card.cardType) === 'factoryProduct'),
    [cards],
  );
  const selfMerchantDynamicCards = useMemo(
    () => cards.filter(card => normalizeCardType(card.cardType) === 'merchant'),
    [cards],
  );
  const selfCompareChips = useMemo(() => buildSelfCompareChips(selfCompareCards), [selfCompareCards]);
  const selfFilterOptions = useMemo(() => buildSelfFilterOptions(selfCompareChips), [selfCompareChips]);
  const selfCards = useMemo(
    () => filterSelfCompareCards(selfCompareCards, selfCompareFilter),
    [selfCompareCards, selfCompareFilter],
  );
  const selfMerchantOptions = useMemo(() => buildFollowedMerchantOptions(selfMerchantDynamicCards), [selfMerchantDynamicCards]);
  const activeSelfMerchantKeys = useMemo(
    () => selfMerchantFilterKeys ?? [],
    [selfMerchantFilterKeys],
  );
  const visibleSelfMerchants = useMemo(
    () => {
      if (activeSelfMerchantKeys.length > 0) {
        const selected = new Set(activeSelfMerchantKeys);
        return selfMerchantOptions.filter(item => selected.has(item.key));
      }
      return selfMerchantOptions;
    },
    [activeSelfMerchantKeys, selfMerchantOptions],
  );
  const selfListCards = useMemo(
    () => (selfCompareScene === 'dynamic'
      ? filterSelfMerchantDynamicCards(selfMerchantDynamicCards, selfCompareFilter)
      : selfCards),
    [selfCards, selfCompareFilter, selfCompareScene, selfMerchantDynamicCards],
  );

  useEffect(() => {
    setSelfCompareFilter(prev => pruneSelfCompareFilter(prev, selfFilterOptions));
  }, [selfFilterOptions]);

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      {key: 'category', label: category, hasSelection: true},
      {key: 'sort', label: getSortLabel(sort), hasSelection: sort !== 'comprehensive'},
      {
        key: 'followedMerchant',
        label: '关注商家',
        hasSelection: Boolean(filters.followedMerchant),
        toggle: true,
        onClear: filters.followedMerchant ? () => setFilters(prev => ({...prev, followedMerchant: false})) : undefined,
      },
      {
        key: 'region',
        label: filters.region || '地区',
        hasSelection: Boolean(filters.region),
        onClear: filters.region ? () => setFilters(prev => ({...prev, region: null})) : undefined,
      },
      {
        key: 'priceRange',
        label: getPriceRangeLabel(priceMinInput, priceMaxInput),
        hasSelection: Boolean(priceMinInput.trim() || priceMaxInput.trim()),
        onClear: priceMinInput || priceMaxInput ? () => {
          setPriceMinInput('');
          setPriceMaxInput('');
        } : undefined,
      },
      {
        key: 'goodsType',
        label: filters.goodsType || '货物类型',
        hasSelection: Boolean(filters.goodsType),
        onClear: filters.goodsType ? () => setFilters(prev => ({...prev, goodsType: null})) : undefined,
      },
      {
        key: 'feedingMethod',
        label: filters.feedingType || '饲养方式',
        hasSelection: Boolean(filters.feedingType),
        onClear: filters.feedingType ? () => setFilters(prev => ({...prev, feedingType: null})) : undefined,
      },
      {
        key: 'tag',
        label: filters.tag || '标签',
        hasSelection: Boolean(filters.tag),
        onClear: filters.tag ? () => setFilters(prev => ({...prev, tag: null})) : undefined,
      },
    ],
    [category, filters, priceMaxInput, priceMinInput, sort],
  );

  function openSearch() {
    navigation.navigate('Search', {category, initialTab: activeTab === 'inquiry' ? 'inquiry' : 'offer'});
  }

  function openHotSku(stat: HotSkuPriceStat) {
    if (stat.country && stat.factoryNo && stat.productName) {
      navigation.navigate('CountryFactoryProduct', {
        country: stat.country,
        factoryNo: stat.factoryNo,
        productName: stat.productName,
        category,
        initialTab: 'offer',
        searchKeyword: `${stat.country}${stat.factoryNo}${stat.productName}`,
      });
      return;
    }
    navigation.navigate('Search', {category, keyword: stat.title, initialTab: 'offer'});
  }

  function handleMainTabPress(next: MainTab) {
    Keyboard.dismiss();
    setActiveTab(next);
    setActiveFilter(null);
  }

  function handleFilterPress(key: FilterKey) {
    if (key === 'category') {
      const currentIndex = categoryOptions.indexOf(category);
      const next = categoryOptions[(currentIndex + 1) % categoryOptions.length] ?? categoryOptions[0];
      setCategory(next);
      setFilters({});
      return;
    }
    if (key === 'followedMerchant') {
      setFilters(prev => ({...prev, followedMerchant: !prev.followedMerchant}));
      setActiveFilter(null);
      return;
    }
    setActiveFilter(prev => (prev === key ? null : key as FeedFilterKey));
  }

  function toggleSelfCompareChip(chip: SelfCompareChip) {
    setSelfCompareFilter(prev => {
      const current = prev[chip.type] ?? [];
      const next = current.includes(chip.value)
        ? current.filter(item => item !== chip.value)
        : [...current, chip.value];
      return {
        ...prev,
        [chip.type]: next,
      };
    });
  }

  function toggleSelfMerchant(key: string) {
    setSelfMerchantFilterKeys(prev => {
      const base = prev ?? [];
      const next = base.includes(key) ? base.filter(item => item !== key) : [...base, key];
      return next;
    });
  }

  function openSelfMerchantQuote(card: HomeCardItem, merchant: SelfMerchantOption) {
    if (merchant.merchantId == null || !String(merchant.merchantId).trim()) {
      Alert.alert('暂未关联商家', '该商家暂缺可跳转的商家主页信息');
      return;
    }
    navigation.navigate('Merchant', {
      merchantId: merchant.merchantId,
      category,
      initialTab: 'offer',
      initialCountry: clean(card.country) || null,
      initialFactoryNo: (normalizeFactoryNoOrNull(card.factoryNo) ?? clean(card.factoryNo)) || null,
      initialProductName: clean(card.productName) || null,
    });
  }

  async function handleRemoveSelfCard(card: HomeCardItem) {
    const removeKey = getSelfEditCardKey(card);
    if (card.historyId == null) {
      Alert.alert('暂时无法移出', '这条自选缺少历史记录 ID，请刷新后再试。');
      return;
    }
    try {
      setRemovingSelfKey(removeKey);
      await mooketApi.cancelSelfSelect(card.historyId);
      setCards(prev => prev.filter(item => getSelfEditCardKey(item) !== removeKey));
      await loadHomeData();
    } catch (error) {
      Alert.alert('移出失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setRemovingSelfKey(null);
    }
  }

  async function handleToggleIntent(item: OfferFeedItem) {
    const snapshot = createPlateSnapshotFromFeed(item, feedType);
    try {
      if (intentKeys.has(snapshot.key)) {
        await removeIntentPlate(snapshot.key);
        setIntentKeys(prev => {
          const next = new Set(prev);
          next.delete(snapshot.key);
          return next;
        });
      } else {
        await addIntentPlate(snapshot);
        setIntentKeys(prev => {
          const next = new Set(prev);
          next.add(snapshot.key);
          return next;
        });
      }
      getFollowedMerchantKeys().then(setFollowedMerchantKeys).catch(() => undefined);
    } catch (error) {
      Alert.alert('操作失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  async function handleContact(item: OfferFeedItem, action: ContactAction) {
    recordRecentContactPlate(createPlateSnapshotFromFeed(item, feedType), action)
      .then(() => getFollowedMerchantKeys().then(setFollowedMerchantKeys).catch(() => undefined))
      .catch(() => undefined);
    const phone = item.contactPhone?.trim() ?? '';
    if (action === 'phone') {
      dialPhone(phone);
    } else {
      copyToClipboard(phone, '已复制手机号').catch(() => undefined);
    }
  }

  function showOfferOriginal(item: OfferFeedItem) {
    const payload = buildOriginalTextPayload({
      text: item.offerOriginalText, intent: feedType === 'inquiry' ? 'inquiry' : 'offer', offerType: item.offerType,
      country: item.country, factoryNo: item.factoryNo, productName: item.productName, price: item.price,
      priceMax: item.priceMax, goodsLocation: item.goodsLocation, goodsType: item.goodsType, feedingType: item.feedingType,
      fatRatio: item.fatRatio, cattleBreed: item.cattleBreed, tags: item.tags, remark: item.remark,
      publishTime: item.publishTime, userNickname: item.userNickname, merchantName: item.merchantName,
      merchantShortName: item.merchantShortName,
    });
    setOriginalText({text: payload.text, keywords: payload.keywords});
  }

  function openOfferMerchant(item: OfferFeedItem) {
    if (item.merchantId == null || !String(item.merchantId).trim()) return;
    setSelectedOffer(null);
    navigation.navigate('Merchant', {
      merchantId: item.merchantId, category, initialTab: feedType,
      initialCountry: clean(item.country) || null,
      initialFactoryNo: normalizeFactoryNoOrNull(item.factoryNo) || null,
      initialProductName: clean(item.productName) || null,
    });
  }

  const commonHeader = (
    <View style={styles.headerBlock}>
      <View style={styles.topLine}>
        <View style={styles.mainTabs}>
          <TopTab title="找货" active={activeTab === 'offer'} onPress={() => handleMainTabPress('offer')} />
          <TopTab title="求购" active={activeTab === 'inquiry'} onPress={() => handleMainTabPress('inquiry')} />
          <TopTab title="自选" active={activeTab === 'self'} onPress={() => handleMainTabPress('self')} />
          <TopTab title="发现" active={activeTab === 'discover'} onPress={() => handleMainTabPress('discover')} />
        </View>
        <Pressable onPress={() => Alert.alert('牧集问数', 'AI 智能问答入口建设中')} hitSlop={8} style={styles.askAiButton}>
          <AskAiIcon />
          <Text style={styles.askAiText}>牧集问数</Text>
        </Pressable>
      </View>

      {activeTab !== 'self' && activeTab !== 'discover' ? (
        <>
          <View style={styles.searchBox}>
            <Pressable onPress={() => setCategory(category === '牛' ? '猪' : '牛')} style={styles.searchCategory}>
              <Text style={styles.searchCategoryText}>{category}</Text>
              <ChevronDownIcon />
            </Pressable>
            <View style={styles.searchDivider} />
            <Pressable onPress={openSearch} style={styles.searchInput}>
              <Text style={styles.searchPlaceholder} numberOfLines={1}>搜索国家、厂号、产品、商家、品牌</Text>
            </Pressable>
            <Pressable onPress={openSearch} hitSlop={8} style={styles.searchIconButton}>
              <SearchIcon />
            </Pressable>
          </View>
          {activeTab === 'offer' && displayHotSkuPriceStats.length > 0 ? (
            <HotSkuPriceStrip items={displayHotSkuPriceStats} onPress={openHotSku} onMore={() => handleMainTabPress('discover')} />
          ) : null}
          <View style={styles.hotRow}>
            <Text style={styles.hotLabel}>热门搜索</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotList}>
              {hotSearches.length === 0 ? (
                <Text style={styles.hotEmpty}>暂无热门搜索</Text>
              ) : (
                hotSearches.slice(0, 8).map(item => (
                  <Pressable
                    key={`${item.dimension}-${item.keyword}`}
                    onPress={() => openHotSearch(navigation, category, item)}
                    style={styles.hotChip}>
                    <Text style={styles.hotChipText} numberOfLines={1}>{item.keyword}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <View style={[styles.safeTop, {height: insets.top}]} />
      {activeTab === 'self' ? (
        <FlatList
          data={selfCompareScene === 'merchant' ? [] : selfListCards}
          keyExtractor={(item, index) => `${item.cardType}-${item.historyId ?? item.searchWord ?? index}`}
          ListHeaderComponent={
            <>
              {commonHeader}
              <SelfCompareHeader
                scene={selfCompareScene}
                onSceneChange={next => {
                  setSelfCompareScene(next);
                  setSelfFilterDropdown(null);
                }}
                options={selfFilterOptions}
                selected={selfCompareFilter}
                activeDropdown={selfFilterDropdown}
                onToggleDropdown={key => setSelfFilterDropdown(prev => prev === key ? null : key)}
                onToggleChip={toggleSelfCompareChip}
                onSelectAll={key => setSelfCompareFilter(prev => ({...prev, [key]: selfFilterOptions[key]}))}
                onClear={key => setSelfCompareFilter(prev => ({...prev, [key]: []}))}
                merchantOptions={selfMerchantOptions}
                selectedMerchantKeys={activeSelfMerchantKeys}
                onToggleMerchant={toggleSelfMerchant}
                onSelectAllMerchants={() => setSelfMerchantFilterKeys(selfMerchantOptions.map(item => item.key))}
                onClearMerchants={() => setSelfMerchantFilterKeys([])}
                onEditSelf={() => setSelfEditVisible(true)}
              />
              {selfCompareScene === 'merchant' ? (
                <SelfMerchantQuoteMatrix
                  cards={selfCards}
                  visibleMerchants={visibleSelfMerchants}
                  onSkuPress={item => openHomeCard(navigation, category, item)}
                  onMerchantPress={(item, merchant) => openSelfMerchantQuote(item, merchant)}
                />
              ) : null}
            </>
          }
          renderItem={({item}) => (
            selfCompareScene === 'dynamic' ? (
              <SelfMerchantDynamicRow
                card={item}
                onPress={() => openHomeCard(navigation, category, item)}
              />
            ) : (
              <SelfCompareRow
                card={item}
                onPress={() => openHomeCard(navigation, category, item)}
              />
            )
          )}
          ListEmptyComponent={selfCompareScene === 'merchant' ? null : loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : <Text style={styles.empty}>当前筛选暂无自选</Text>}
          contentContainerStyle={[styles.listContent, {paddingBottom: Math.max(insets.bottom, 20)}]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHomeData().catch(() => undefined)} />}
        />
      ) : activeTab === 'discover' ? (
        <DiscoverScreen
          header={commonHeader}
          category={category}
          items={discoverItems}
          loading={discoverLoading}
          error={discoverError}
          onCategoryChange={setCategory}
          onRefresh={() => loadDiscovery()}
          onPress={item => openHotSku({...item, title: `${item.factoryNo} ${item.productName}`, price: priceRange(item.priceMin, item.priceMax), latestTime: 0, trend: item.trendPoints.map(point => Number(point.avgPrice)).filter(value => Number.isFinite(value))})}
        />
      ) : (
        <>
          <FlatList
            data={[{key: 'offer-table'}]}
            keyExtractor={item => item.key}
            ListHeaderComponent={
              <>
                {commonHeader}
                <View style={styles.filterBlock}>
                  <FilterBar filters={filterDefs} active={activeFilter as FilterKey | null} onPress={handleFilterPress} onBottomLayout={setFilterPanelTop} />
                </View>
              </>
            }
            renderItem={() => (
              <>
                <OfferFrozenTable
                  groups={groups}
                  expandedKeys={expandedKeys}
                  onToggle={key => {
                    setExpandedKeys(prev => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                  onPublisherPress={setSelectedOffer}
                />
                {!loading && groups.length === 0 ? (
                  <Text style={styles.empty}>{feedError || '暂无匹配数据'}</Text>
                ) : null}
              </>
            )}
            ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
            contentContainerStyle={[styles.listContent, {paddingBottom: Math.max(insets.bottom, 20)}]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFeed('refresh')} />}
          />
          <FilterSheets
            activeFilter={activeFilter}
            topOffset={filterPanelTop}
            sort={sort}
            setSort={setSort}
            filters={filters}
            setFilters={setFilters}
            priceMinInput={priceMinInput}
            priceMaxInput={priceMaxInput}
            setPriceMinInput={setPriceMinInput}
            setPriceMaxInput={setPriceMaxInput}
            filterOptions={filterOptions}
            onClose={() => setActiveFilter(null)}
          />
        </>
      )}

      <OriginalTextSheet
        visible={Boolean(originalText)}
        text={originalText?.text ?? ''}
        keywords={originalText?.keywords ?? []}
        onClose={() => setOriginalText(null)}
      />
      <OfferActionSheet
        visible={Boolean(selectedOffer)}
        item={selectedOffer}
        intentAdded={selectedOffer ? intentKeys.has(createPlateSnapshotFromFeed(selectedOffer, feedType).key) : false}
        onClose={() => setSelectedOffer(null)}
        onMerchant={() => selectedOffer && openOfferMerchant(selectedOffer)}
        onPhone={() => selectedOffer && handleContact(selectedOffer, 'phone')}
        onCopyPhone={() => selectedOffer && handleContact(selectedOffer, 'wechat')}
        onIntent={() => selectedOffer && handleToggleIntent(selectedOffer)}
        onOriginal={() => {
          if (!selectedOffer) return;
          const item = selectedOffer;
          setSelectedOffer(null);
          showOfferOriginal(item);
        }}
      />
      <SelfEditSheet
        visible={selfEditVisible}
        tab={selfEditTab}
        onTabChange={setSelfEditTab}
        skuCards={selfCompareCards}
        merchantCards={selfMerchantDynamicCards}
        removingKey={removingSelfKey}
        onRemove={handleRemoveSelfCard}
        onClose={() => setSelfEditVisible(false)}
      />
    </View>
  );
}

function TopTab({title, active, onPress}: {title: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.topTab}>
      <Text style={[styles.topTabText, active && styles.topTabTextActive]}>{title}</Text>
      <View style={[styles.topTabLine, active && styles.topTabLineActive]} />
    </Pressable>
  );
}

function HotSkuPriceStrip({items, onPress, onMore}: {items: HotSkuPriceStat[]; onPress: (item: HotSkuPriceStat) => void; onMore: () => void}) {
  return (
    <View style={styles.hotSkuStrip}>
      <View style={styles.hotSkuItems}>{items.map((item, index) => (
        <Pressable
          key={item.key}
          onPress={() => onPress(item)}
          style={[styles.hotSkuCell, index > 0 ? styles.hotSkuCellDivider : null]}>
          <Text style={styles.hotSkuTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.hotSkuPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>{item.price}</Text>
          <Text style={styles.hotSkuMerchantCount} numberOfLines={1}>{item.merchantCount}商家</Text>
          <View style={styles.hotSkuTrend}>
            <MiniTrendChart data={item.trend} width={86} height={18} color={colors.primary} />
          </View>
        </Pressable>
      ))}</View>
      <Pressable onPress={onMore} style={styles.hotSkuMore} accessibilityLabel="查看更多推荐">
        <Text style={styles.hotSkuMoreText}>›</Text>
      </Pressable>
    </View>
  );
}

function DiscoverScreen({header, category, items, loading, error, onCategoryChange, onRefresh, onPress}: {
  header: React.ReactNode;
  category: string;
  items: DiscoveryRecommendation[];
  loading: boolean;
  error: string;
  onCategoryChange: (value: string) => void;
  onRefresh: () => void;
  onPress: (item: DiscoveryRecommendation) => void;
}) {
  return (
    <View style={styles.discoverPage}>
      {header}
      <View style={styles.discoverToolbar}>
        <Text style={styles.discoverTitle}>为你发现</Text>
        <Pressable onPress={() => onCategoryChange(category === '牛' ? '猪' : '牛')} style={styles.discoverCategory}>
          <Text style={styles.discoverCategoryText}>{category}类推荐</Text>
          <ChevronDownIcon />
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.key}
        renderItem={({item}) => <DiscoveryCard item={item} onPress={() => onPress(item)} />}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : (
          <Pressable onPress={onRefresh} style={styles.discoverEmpty}>
            <Text style={styles.empty}>{error || '暂无推荐内容'}</Text>
            {error ? <Text style={styles.discoverRetry}>点击重试</Text> : null}
          </Pressable>
        )}
        contentContainerStyle={styles.discoverList}
      />
    </View>
  );
}

function DiscoveryCard({item, onPress}: {item: DiscoveryRecommendation; onPress: () => void}) {
  const trend = item.trendPoints.map(point => Number(point.avgPrice)).filter(value => Number.isFinite(value) && value > 0);
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.discoveryCard, pressed && styles.pressed]}>
      <View style={styles.discoveryTop}>
        <View style={styles.discoveryMain}>
          <Text style={styles.discoveryProduct} numberOfLines={1}>{item.productName}</Text>
          <Text style={styles.discoverySku} numberOfLines={1}>{item.country} · {item.factoryNo}</Text>
        </View>
        <Text style={styles.discoveryPrice} numberOfLines={1}>{priceRange(item.priceMin, item.priceMax) || '协商报价'}</Text>
      </View>
      <View style={styles.discoveryMetrics}>
        <Text style={styles.discoveryMetric}>{item.offerCount}报盘</Text>
        <Text style={styles.discoveryMetric}>{item.merchantCount}商家</Text>
        <View style={styles.discoveryTrend}><MiniTrendChart data={trend} width={92} height={22} color={colors.primary} /></View>
      </View>
      <View style={styles.discoveryReasonRow}>
        <Text style={[styles.discoveryReasonBadge, item.source === 'substitute' && styles.discoveryReasonSubstitute]}>{item.source === 'substitute' ? '替代推荐' : item.source === 'preference' ? '与你相关' : '热门'}</Text>
        <Text style={styles.discoveryReason} numberOfLines={1}>{item.reason}</Text>
        <Text style={styles.discoveryArrow}>›</Text>
      </View>
    </Pressable>
  );
}

/* Legacy publisher-card implementation retained temporarily while the frozen table is rolled out. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FeedGroupRow({
  group,
  expanded,
  type,
  intentKeys,
  onToggle,
  onOriginal,
  onToggleIntent,
  onContact,
}: {
  group: FeedGroup;
  expanded: boolean;
  type: 'offer' | 'inquiry';
  intentKeys: Set<string>;
  onToggle: () => void;
  onOriginal: (payload: {text: string; keywords: string[]}) => void;
  onToggleIntent: (item: OfferFeedItem) => void;
  onContact: (item: OfferFeedItem, action: ContactAction) => void;
}) {
  const metaParts = buildFeedMetaParts(group, type);
  return (
    <View style={styles.feedCard}>
      <Pressable onPress={onToggle} style={styles.feedCollapsed}>
        <View style={styles.feedMain}>
          <View style={styles.skuLine}>
            <Text style={styles.productName} numberOfLines={1}>{group.productName}</Text>
            {metaParts.map(part => <Text key={part} style={styles.skuMeta}>{part}</Text>)}
          </View>
          <View style={styles.merchantLine}>
            <CompanyTinyIcon />
            <Text style={styles.merchantName} numberOfLines={1}>{group.merchantName}</Text>
          </View>
        </View>
        <View style={styles.priceSide}>
          <Text style={[styles.feedPrice, group.price === '协商报价' && styles.negotiateFeedPrice]} numberOfLines={1}>{group.price}</Text>
          <Text style={styles.feedTime}>{group.time}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.publisherList}>
          {group.items.map((item, index) => (
            <PublisherCard
              key={`${item.offerId ?? index}-${item.userNickname ?? index}`}
              item={item}
              type={type}
              isIntentAdded={intentKeys.has(createPlateSnapshotFromFeed(item, type).key)}
              onOriginal={() => {
                const payload = buildOriginalTextPayload({
                  text: item.offerOriginalText,
                  intent: type === 'inquiry' ? 'inquiry' : 'offer',
                  offerType: item.offerType,
                  country: item.country,
                  factoryNo: item.factoryNo,
                  productName: item.productName,
                  price: item.price,
                  priceMax: item.priceMax,
                  goodsLocation: item.goodsLocation,
                  goodsType: item.goodsType,
                  feedingType: item.feedingType,
                  fatRatio: item.fatRatio,
                  cattleBreed: item.cattleBreed,
                  tags: item.tags,
                  remark: item.remark,
                  publishTime: item.publishTime,
                  userNickname: item.userNickname,
                  merchantName: item.merchantName,
                  merchantShortName: item.merchantShortName,
                });
                onOriginal({text: payload.text, keywords: payload.keywords});
              }}
              onIntent={() => onToggleIntent(item)}
              onWechat={() => onContact(item, 'wechat')}
              onPhone={() => onContact(item, 'phone')}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PublisherCard({
  item,
  type,
  isIntentAdded,
  onOriginal,
  onIntent,
  onWechat,
  onPhone,
}: {
  item: OfferFeedItem;
  type: 'offer' | 'inquiry';
  isIntentAdded: boolean;
  onOriginal: () => void;
  onIntent: () => void;
  onWechat: () => void;
  onPhone: () => void;
}) {
  const price = formatPrice(item.price, item.priceMax);
  const priceText = price || (type === 'offer' ? '协商报价' : '');
  const publishTimeText = formatCardTime(item.publishTime);
  const detailParts = buildPublisherDetailParts(item);
  return (
    <View style={styles.publisherCard}>
      <View style={styles.publisherTop}>
        <View style={styles.publisherNameLine}>
          <PersonTinyIcon />
          <Text style={styles.publisherName} numberOfLines={1}>{item.userNickname || '未知发布人'}</Text>
        </View>
        {priceText ? <Text style={[styles.publisherPrice, priceText === '协商报价' && styles.negotiatePublisherPrice]}>{priceText}</Text> : null}
      </View>
      {detailParts.length > 0 ? (
        <View style={styles.publisherTags}>
          {detailParts.map(part => <Text key={part} style={styles.publisherTag} numberOfLines={1}>{part}</Text>)}
        </View>
      ) : null}
      <View style={styles.subActionRow}>
        <Text style={styles.publisherTime}>{publishTimeText}</Text>
        <View style={styles.subActions}>
          <SubAction title="查看原文" icon={<BookIcon />} onPress={onOriginal} />
          <View style={styles.subActionDivider} />
          <SubAction title={isIntentAdded ? '已加意向' : '加意向'} icon={<StarIcon selected={isIntentAdded} />} onPress={onIntent} />
          <View style={styles.subActionDivider} />
          <SubAction title="加微信" icon={<PlusIcon />} onPress={onWechat} />
          <View style={styles.subActionDivider} />
          <SubAction title="拨打电话" icon={<PhoneIcon />} onPress={onPhone} />
        </View>
      </View>
    </View>
  );
}

function SubAction({title, icon, onPress}: {title: string; icon: React.ReactNode; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.subAction}>
      {icon}
      <Text style={styles.subActionText}>{title}</Text>
    </Pressable>
  );
}

function buildPublisherDetailParts(item: OfferFeedItem) {
  const rawParts = [
    item.region,
    item.goodsLocation,
    item.goodsType,
    item.feedingType,
    item.fatRatio,
    item.cattleBreed,
    item.weight,
    item.tags,
    item.remark,
  ];
  const seen = new Set<string>();
  return rawParts
    .flatMap(value => splitText(value))
    .map(value => value.trim())
    .filter(value => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, 8);
}

function SelfCompareHeader({
  scene,
  onSceneChange,
  options,
  selected,
  activeDropdown,
  onToggleDropdown,
  onToggleChip,
  onSelectAll,
  onClear,
  merchantOptions,
  selectedMerchantKeys,
  onToggleMerchant,
  onSelectAllMerchants,
  onClearMerchants,
  onEditSelf,
}: {
  scene: SelfCompareScene;
  onSceneChange: (scene: SelfCompareScene) => void;
  options: Record<keyof SelfCompareFilter, string[]>;
  selected: SelfCompareFilter;
  activeDropdown: SelfFilterDropdown;
  onToggleDropdown: (key: Exclude<SelfFilterDropdown, null>) => void;
  onToggleChip: (chip: SelfCompareChip) => void;
  onSelectAll: (key: keyof SelfCompareFilter) => void;
  onClear: (key: keyof SelfCompareFilter) => void;
  merchantOptions: SelfMerchantOption[];
  selectedMerchantKeys: string[];
  onToggleMerchant: (key: string) => void;
  onSelectAllMerchants: () => void;
  onClearMerchants: () => void;
  onEditSelf: () => void;
}) {
  const filterKeys: Array<{key: keyof SelfCompareFilter; label: string}> = [
    {key: 'productName', label: '产品'},
    {key: 'country', label: '国家'},
    {key: 'factoryNo', label: '厂号'},
  ];
  const dropdownKey = activeDropdown && activeDropdown !== 'merchant' ? activeDropdown : null;
  return (
    <View style={styles.selfCompareHeader}>
      <View style={styles.selfSceneTabs}>
        <View style={styles.selfSceneTabGroup}>
          <Pressable onPress={() => onSceneChange('sku')} style={[styles.selfSceneTab, scene === 'sku' && styles.selfSceneTabActive]}>
            <Text style={[styles.selfSceneTabText, scene === 'sku' && styles.selfSceneTabTextActive]}>货品对比</Text>
          </Pressable>
          <Pressable onPress={() => onSceneChange('merchant')} style={[styles.selfSceneTab, scene === 'merchant' && styles.selfSceneTabActive]}>
            <Text style={[styles.selfSceneTabText, scene === 'merchant' && styles.selfSceneTabTextActive]}>关注商家报价</Text>
          </Pressable>
          <Pressable onPress={() => onSceneChange('dynamic')} style={[styles.selfSceneTab, scene === 'dynamic' && styles.selfSceneTabActive]}>
            <Text style={[styles.selfSceneTabText, scene === 'dynamic' && styles.selfSceneTabTextActive]}>关注商家动态</Text>
          </Pressable>
        </View>
        <Pressable onPress={onEditSelf} style={styles.selfEditButton} hitSlop={8}>
          <Text style={styles.selfEditButtonText}>编辑自选</Text>
        </Pressable>
      </View>
      <View style={styles.selfFilterBar}>
        {filterKeys.map(item => (
          <Pressable key={item.key} onPress={() => onToggleDropdown(item.key)} style={[styles.selfFilterMenu, selected[item.key].length > 0 && styles.selfFilterChipActive]}>
            <Text style={[styles.selfFilterMenuText, selected[item.key].length > 0 && styles.selfFilterChipTextActive]} numberOfLines={1}>
              {selfFilterLabel(item.label, selected[item.key])}
            </Text>
            <Text style={styles.selfFilterMenuArrow}>{activeDropdown === item.key ? '⌃' : '⌄'}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => onToggleDropdown('merchant')} style={[styles.selfFilterMenu, selectedMerchantKeys.length > 0 && styles.selfFilterChipActive]}>
          <Text style={[styles.selfFilterMenuText, selectedMerchantKeys.length > 0 && styles.selfFilterChipTextActive]} numberOfLines={1}>
            {selectedMerchantKeys.length === 0 ? '关注商家' : `商家 ${selectedMerchantKeys.length}`}
          </Text>
          <Text style={styles.selfFilterMenuArrow}>{activeDropdown === 'merchant' ? '⌃' : '⌄'}</Text>
        </Pressable>
      </View>
      {dropdownKey ? (
        <SelfOptionDropdown
          title={filterKeys.find(item => item.key === dropdownKey)?.label ?? ''}
          options={options[dropdownKey]}
          selected={selected[dropdownKey]}
          onToggle={value => onToggleChip({type: dropdownKey, value})}
          onSelectAll={() => onSelectAll(dropdownKey)}
          onClear={() => onClear(dropdownKey)}
        />
      ) : activeDropdown === 'merchant' ? (
            <View style={styles.selfMerchantDropdown}>
              <View style={styles.selfMerchantDropdownTop}>
                <Text style={styles.selfMerchantDropdownTitle}>关注商家</Text>
                <View style={styles.selfMerchantDropdownActions}>
                  <Pressable onPress={onSelectAllMerchants} hitSlop={8}>
                    <Text style={styles.selfMerchantDropdownAction}>全选</Text>
                  </Pressable>
                  <Pressable onPress={onClearMerchants} hitSlop={8}>
                    <Text style={styles.selfMerchantDropdownAction}>清空</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.selfMerchantOptions}>
                {merchantOptions.length === 0 ? (
                  <Text style={styles.selfMerchantEmptyText}>暂无可选商家</Text>
                ) : (
                  merchantOptions.map(option => {
                    const active = selectedMerchantKeys.includes(option.key);
                    return (
                      <Pressable key={option.key} onPress={() => onToggleMerchant(option.key)} style={[styles.selfMerchantOption, active && styles.selfMerchantOptionActive]}>
                        <Text style={[styles.selfMerchantOptionText, active && styles.selfMerchantOptionTextActive]} numberOfLines={1}>{option.shortName}</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>
      ) : null}
      {scene === 'sku' ? (
        <View style={styles.selfTableHead}>
          <Text style={[styles.selfTableHeadText, styles.selfTableSku]}>国家厂号产品</Text>
          <Text style={[styles.selfTableHeadText, styles.selfTablePrice]}>价格区间</Text>
          <Text style={[styles.selfTableHeadText, styles.selfTableCount]}>报盘</Text>
          <Text style={[styles.selfTableHeadText, styles.selfTableCount]}>求购</Text>
          <Text style={[styles.selfTableHeadText, styles.selfTableChange]}>涨跌</Text>
        </View>
      ) : null}
    </View>
  );
}

function SelfOptionDropdown({title, options, selected, onToggle, onSelectAll, onClear}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.selfMerchantDropdown}>
      <View style={styles.selfMerchantDropdownTop}>
        <Text style={styles.selfMerchantDropdownTitle}>{title}</Text>
        <View style={styles.selfMerchantDropdownActions}>
          <Pressable onPress={onSelectAll} hitSlop={8}><Text style={styles.selfMerchantDropdownAction}>全选</Text></Pressable>
          <Pressable onPress={onClear} hitSlop={8}><Text style={styles.selfMerchantDropdownAction}>清空</Text></Pressable>
        </View>
      </View>
      <View style={styles.selfMerchantOptions}>
        {options.length === 0 ? <Text style={styles.selfMerchantEmptyText}>暂无可选项</Text> : options.map(value => {
          const active = selected.includes(value);
          return (
            <Pressable key={value} onPress={() => onToggle(value)} style={[styles.selfMerchantOption, active && styles.selfMerchantOptionActive]}>
              <Text style={[styles.selfMerchantOptionText, active && styles.selfMerchantOptionTextActive]} numberOfLines={1}>{value}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function selfFilterLabel(label: string, selected: string[]) {
  if (selected.length === 0) return label;
  if (selected.length === 1) return selected[0];
  return `${label} ${selected.length}`;
}

function SelfCompareRow({card, onPress}: {card: HomeCardItem; onPress: () => void}) {
  const factoryNo = normalizeFactoryNoOrNull(card.factoryNo) ?? clean(card.factoryNo);
  const price = priceRange(card.priceMin, card.priceMax).replace(/^¥/, '').replace(/\/kg$/, '');
  const change = formatPriceChange(card.priceChangeRate ?? card.priceChange);
  const changeTone = priceChangeTone(card.priceChangeRate ?? card.priceChange);
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.selfCompareRow, pressed && styles.pressed]}>
      <View style={styles.selfCompareSku}>
        <View style={styles.selfCompareSkuLine}>
          <Text style={styles.selfCompareProduct} numberOfLines={1}>{clean(card.productName) || '产品'}</Text>
          <Text style={styles.selfCompareMeta} numberOfLines={1}>{clean(card.country) || '-'}</Text>
          <Text style={styles.selfCompareMeta} numberOfLines={1}>{factoryNo || '-'}</Text>
        </View>
      </View>
      <Text style={styles.selfComparePrice} numberOfLines={1}>{price || '-'}{price ? <Text style={styles.selfCompareUnit}>/kg</Text> : null}</Text>
      <Text style={styles.selfCompareNum} numberOfLines={1}>{formatCount(card.todayOfferCount)}</Text>
      <Text style={styles.selfCompareNum} numberOfLines={1}>{formatCount(card.inquiryCount)}</Text>
      <Text style={[styles.selfCompareChange, changeTone === 'danger' && styles.selfCompareChangeUp]} numberOfLines={1}>{change}</Text>
    </Pressable>
  );
}

function SelfEditSheet({
  visible,
  tab,
  onTabChange,
  skuCards,
  merchantCards,
  removingKey,
  onRemove,
  onClose,
}: {
  visible: boolean;
  tab: SelfEditTab;
  onTabChange: (tab: SelfEditTab) => void;
  skuCards: HomeCardItem[];
  merchantCards: HomeCardItem[];
  removingKey: string | null;
  onRemove: (card: HomeCardItem) => void;
  onClose: () => void;
}) {
  const data = tab === 'sku' ? skuCards : merchantCards;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.selfEditOverlay}>
        <Pressable style={styles.selfEditBackdrop} onPress={onClose} />
        <View style={styles.selfEditPanel}>
          <View style={styles.selfEditHeader}>
            <Text style={styles.selfEditTitle}>编辑自选</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.selfEditClose}>
              <Text style={styles.selfEditCloseText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.selfEditTabs}>
            <SelfEditTabButton title="自选 SKU" active={tab === 'sku'} count={skuCards.length} onPress={() => onTabChange('sku')} />
            <SelfEditTabButton title="关注商家" active={tab === 'merchant'} count={merchantCards.length} onPress={() => onTabChange('merchant')} />
          </View>
          <ScrollView style={styles.selfEditList} contentContainerStyle={styles.selfEditListContent} showsVerticalScrollIndicator={false}>
            {data.length === 0 ? (
              <View style={styles.selfEditEmpty}>
                <Text style={styles.selfEditEmptyText}>{tab === 'sku' ? '暂无自选 SKU' : '暂无关注商家'}</Text>
              </View>
            ) : (
              data.map(card => (
                <SelfEditRow
                  key={getSelfEditCardKey(card)}
                  card={card}
                  type={tab}
                  removing={removingKey === getSelfEditCardKey(card)}
                  onRemove={() => onRemove(card)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SelfEditTabButton({title, active, count, onPress}: {title: string; active: boolean; count: number; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={[styles.selfEditTab, active && styles.selfEditTabActive]}>
      <Text style={[styles.selfEditTabText, active && styles.selfEditTabTextActive]}>{title}</Text>
      <Text style={[styles.selfEditTabCount, active && styles.selfEditTabCountActive]}>{count}</Text>
    </Pressable>
  );
}

function SelfEditRow({card, type, removing, onRemove}: {card: HomeCardItem; type: SelfEditTab; removing: boolean; onRemove: () => void}) {
  const title = type === 'sku' ? clean(card.productName) || '产品' : clean(card.merchantShortName) || clean(card.merchantName) || '关注商家';
  const meta = type === 'sku' ? buildSelfSkuMeta(card) : buildSelfMerchantMeta(card);
  const summary = type === 'sku'
    ? [formatCount(card.todayOfferCount) + '报盘', formatCount(card.inquiryCount) + '求购'].join(' · ')
    : [formatCount(card.todayOfferCount) + '报盘', formatCount(card.productCount) + '产品'].join(' · ');
  return (
    <View style={styles.selfEditRow}>
      <View style={styles.selfEditRowMain}>
        <Text style={styles.selfEditRowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.selfEditRowMeta} numberOfLines={1}>{meta}</Text>
      </View>
      <Text style={styles.selfEditRowSummary} numberOfLines={1}>{summary}</Text>
      <Pressable onPress={onRemove} disabled={removing} style={[styles.selfEditRemove, removing && styles.selfEditRemoveDisabled]}>
        <Text style={[styles.selfEditRemoveText, removing && styles.selfEditRemoveTextDisabled]}>{removing ? '移出中' : '移出'}</Text>
      </Pressable>
    </View>
  );
}

function SelfMerchantQuoteMatrix({
  cards,
  visibleMerchants,
  onSkuPress,
  onMerchantPress,
}: {
  cards: HomeCardItem[];
  visibleMerchants: SelfMerchantOption[];
  onSkuPress: (card: HomeCardItem) => void;
  onMerchantPress: (card: HomeCardItem, merchant: SelfMerchantOption) => void;
}) {
  if (cards.length === 0) {
    return <Text style={styles.empty}>当前筛选暂无自选</Text>;
  }

  return (
    <View style={styles.selfMerchantMatrix}>
      {visibleMerchants.length === 0 ? (
        <View style={styles.selfMerchantQuoteEmpty}>
          <Text style={styles.selfMerchantQuoteEmptyText}>暂无关注商家</Text>
        </View>
      ) : (
        <View style={styles.selfMerchantMatrixBody}>
          <View style={styles.selfMerchantFixedColumn}>
            <View style={styles.selfMerchantFixedHead}>
              <Text style={[styles.selfTableHeadText, styles.selfMerchantHeadSku]}>SKU</Text>
            </View>
            {cards.map((card, index) => (
              <Pressable
                key={`${card.historyId ?? card.searchWord ?? index}-sku`}
                onPress={() => onSkuPress(card)}
                style={({pressed}) => [styles.selfMerchantSkuBlock, styles.selfMerchantSkuRowBlock, pressed && styles.pressed]}>
                <Text style={styles.selfMerchantProduct} numberOfLines={1}>{clean(card.productName) || '产品'}</Text>
                <Text style={styles.selfMerchantMeta} numberOfLines={1}>{buildSelfSkuMeta(card)}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.selfMerchantMatrixScroll}>
            <View>
              <View style={styles.selfMerchantScrollableHead}>
                {visibleMerchants.map(option => (
                  <Text key={option.key} style={[styles.selfTableHeadText, styles.selfMerchantHeadMerchant]} numberOfLines={1}>{option.shortName}</Text>
                ))}
              </View>
              {cards.map((card, index) => (
                <SelfMerchantQuoteCells
                  key={`${card.historyId ?? card.searchWord ?? index}-quotes`}
                  card={card}
                  visibleMerchants={visibleMerchants}
                  onMerchantPress={merchant => onMerchantPress(card, merchant)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function SelfMerchantQuoteCells({
  card,
  visibleMerchants,
  onMerchantPress,
}: {
  card: HomeCardItem;
  visibleMerchants: SelfMerchantOption[];
  onMerchantPress: (merchant: SelfMerchantOption) => void;
}) {
  const quoteMap = buildSelfMerchantQuoteMap(card);
  return (
    <View style={styles.selfMerchantQuoteCellRow}>
      {visibleMerchants.map(merchant => {
        const quote = quoteMap.get(merchant.key);
        return (
          <Pressable
            key={merchant.key}
            onPress={() => onMerchantPress(merchant)}
            style={({pressed}) => [styles.selfMerchantQuoteCell, !quote && styles.selfMerchantQuoteCellEmpty, pressed && styles.pressed]}>
            <Text style={[styles.selfMerchantQuotePrice, quote?.price === '协商报价' && styles.selfMerchantQuotePriceMuted]} numberOfLines={1}>
              {quote?.price || '--'}
            </Text>
            {quote ? (
              quote.meta ? <Text style={styles.selfMerchantQuoteMeta}>{quote.meta}</Text> : null
            ) : (
              <Text style={styles.selfMerchantQuoteMeta}>无盘</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function SelfMerchantDynamicRow({card, onPress}: {card: HomeCardItem; onPress: () => void}) {
  const merchantName = card.merchantShortName || shortenMerchantName(clean(card.merchantName)) || clean(card.merchantName) || '关注商家';
  const events = buildMerchantDynamicEvents(card);
  const offerCount = formatCount(card.todayOfferCount);
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.selfDynamicCard, pressed && styles.pressed]}>
      <View style={styles.selfDynamicCardTop}>
        <View style={styles.selfDynamicMerchantLine}>
          <CompanyTinyIcon />
          <Text style={styles.selfDynamicMerchantName} numberOfLines={1}>{merchantName}</Text>
        </View>
        <View style={styles.selfDynamicBadge}>
          <Text style={styles.selfDynamicBadgeText}>{offerCount === '-' ? '关注中' : `近2日 ${offerCount}`}</Text>
        </View>
      </View>
      {events.length === 0 ? (
        <View style={styles.selfDynamicEmptyBlock}>
          <Text style={styles.selfDynamicEmptyBlockText}>暂无最新货源动态</Text>
        </View>
      ) : events.map((event, index) => (
        <View key={`${event.type}-${event.title}-${index}`} style={styles.selfDynamicEvent}>
          <Text style={[styles.selfDynamicEventType, event.tone === 'danger' && styles.selfDynamicEventTypeDanger, event.tone === 'warning' && styles.selfDynamicEventTypeWarning]}>
            {event.type}
          </Text>
          <View style={styles.selfDynamicEventMain}>
            <Text style={styles.selfDynamicEventTitle} numberOfLines={1}>{event.title}</Text>
            <Text style={styles.selfDynamicEventDesc} numberOfLines={1}>{event.desc}</Text>
          </View>
        </View>
      ))}
    </Pressable>
  );
}

function FilterSheets({
  activeFilter,
  topOffset,
  sort,
  setSort,
  filters,
  setFilters,
  priceMinInput,
  priceMaxInput,
  setPriceMinInput,
  setPriceMaxInput,
  filterOptions,
  onClose,
}: {
  activeFilter: FeedFilterKey | null;
  topOffset: number;
  sort: SortKind;
  setSort: (sort: SortKind) => void;
  filters: FeedFilters;
  setFilters: React.Dispatch<React.SetStateAction<FeedFilters>>;
  priceMinInput: string;
  priceMaxInput: string;
  setPriceMinInput: (value: string) => void;
  setPriceMaxInput: (value: string) => void;
  filterOptions: OfferFeedFilterOptions;
  onClose: () => void;
}) {
  return (
    <>
      <FilterPanelSheet visible={activeFilter === 'sort'} topOffset={topOffset} title="鎺掑簭鏂瑰紡" showActions={false} onClose={onClose}>
        <View style={styles.sortOptions}>
          {sortOptions.map(option => (
            <Pressable
              key={option.value}
              onPress={() => {
                setSort(option.value);
                onClose();
              }}
              style={[styles.sortOption, sort === option.value && styles.sortOptionActive]}>
              <Text style={[styles.sortOptionText, sort === option.value && styles.sortOptionTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </FilterPanelSheet>
      <FilterPanelSheet visible={activeFilter === 'region'} topOffset={topOffset} title="地区" onClose={onClose} onReset={() => { setFilters(prev => ({...prev, region: null})); onClose(); }} onConfirm={onClose}>
        <MultiSelectChips options={filterOptions.regions ?? []} selected={new Set(filters.region ? [filters.region] : [])} onToggle={value => setFilters(prev => ({...prev, region: prev.region === value ? null : value}))} />
      </FilterPanelSheet>
      <FilterPanelSheet visible={activeFilter === 'goodsType'} topOffset={topOffset} title="货物类型" onClose={onClose} onReset={() => { setFilters(prev => ({...prev, goodsType: null})); onClose(); }} onConfirm={onClose}>
        <MultiSelectChips options={filterOptions.goodsTypes?.length ? filterOptions.goodsTypes : ['现货', '新货', '期货']} selected={new Set(filters.goodsType ? [filters.goodsType] : [])} onToggle={value => setFilters(prev => ({...prev, goodsType: prev.goodsType === value ? null : value}))} />
      </FilterPanelSheet>
      <FilterPanelSheet visible={activeFilter === 'feedingMethod'} topOffset={topOffset} title="饲养方式" onClose={onClose} onReset={() => { setFilters(prev => ({...prev, feedingType: null})); onClose(); }} onConfirm={onClose}>
        <MultiSelectChips options={filterOptions.feedingTypes?.length ? filterOptions.feedingTypes : ['草饲', '谷饲']} selected={new Set(filters.feedingType ? [filters.feedingType] : [])} onToggle={value => setFilters(prev => ({...prev, feedingType: prev.feedingType === value ? null : value}))} />
      </FilterPanelSheet>
      <FilterPanelSheet visible={activeFilter === 'tag'} topOffset={topOffset} title="标签" onClose={onClose} onReset={() => { setFilters(prev => ({...prev, tag: null})); onClose(); }} onConfirm={onClose}>
        <MultiSelectChips options={filterOptions.tags ?? []} selected={new Set(filters.tag ? [filters.tag] : [])} onToggle={value => setFilters(prev => ({...prev, tag: prev.tag === value ? null : value}))} groupSimilarTags />
      </FilterPanelSheet>
      <FilterPanelSheet visible={activeFilter === 'priceRange'} topOffset={topOffset} title="价格区间" onClose={onClose} onReset={() => { setPriceMinInput(''); setPriceMaxInput(''); onClose(); }} onConfirm={onClose}>
        <View style={styles.priceRangeRow}>
          <View style={styles.priceField}>
            <Text style={styles.priceFieldLabel}>最低价</Text>
            <TextInput
              value={priceMinInput}
              onChangeText={setPriceMinInput}
              keyboardType="decimal-pad"
              placeholder="渚嬪 32"
              placeholderTextColor="#9DA4A3"
              style={styles.priceInput}
            />
          </View>
          <Text style={styles.priceDash}>-</Text>
          <View style={styles.priceField}>
            <Text style={styles.priceFieldLabel}>最高价</Text>
            <TextInput
              value={priceMaxInput}
              onChangeText={setPriceMaxInput}
              keyboardType="decimal-pad"
              placeholder="渚嬪 45"
              placeholderTextColor="#9DA4A3"
              style={styles.priceInput}
            />
          </View>
        </View>
        <View style={styles.quickPriceRow}>
          {['45', '50', '55', '60'].map(value => (
            <Pressable key={value} onPress={() => setPriceMinInput(value)} style={styles.quickPriceChip}>
              <Text style={styles.quickPriceText}>低于{value}</Text>
            </Pressable>
          ))}
        </View>
      </FilterPanelSheet>
    </>
  );
}

function groupFeedItems(
  items: OfferFeedItem[],
  type: 'offer' | 'inquiry',
  minInput: string,
  maxInput: string,
  followedMerchantKeys: Set<string> | null,
): FeedGroup[] {
  const min = parseNumber(minInput);
  const max = parseNumber(maxInput);
  const groups = new Map<string, FeedGroup>();
  items.forEach(item => {
    if (!matchesPrice(item, min, max)) return;
    if (followedMerchantKeys && !matchesFollowedMerchant(item, followedMerchantKeys)) return;
    const productName = clean(item.productName) || '未知产品';
    const country = clean(item.country);
    const factoryNo = normalizeFactoryNoOrNull(item.factoryNo) ?? clean(item.factoryNo);
    const merchantName = clean(item.merchantShortName) || clean(item.merchantName) || '暂未关联行业商家';
    const key = [productName, country, factoryNo].join('|');
    const current = groups.get(key);
    if (current) {
      current.items.push(item);
      current.price = mergePrice(current.items, type);
      current.time = formatCardTime(current.items[0]?.publishTime);
      return;
    }
    groups.set(key, {
      key,
      title: [productName, country, factoryNo].filter(Boolean).join(' '),
      productName,
      country,
      factoryNo,
      merchantName,
      merchantId: item.merchantId,
      price: mergePrice([item], type),
      time: formatCardTime(item.publishTime),
      items: [item],
    });
  });
  return Array.from(groups.values());
}

function buildHotSkuPriceStats(items: HomeHotSku[]): HotSkuPriceStat[] {
  return items
    .map(item => {
      const productName = clean(item.productName);
      const country = clean(item.country);
      const factoryNo = normalizeFactoryNoOrNull(item.factoryNo) ?? clean(item.factoryNo);
      const min = typeof item.priceMin === 'number' && Number.isFinite(item.priceMin) && item.priceMin > 0 ? item.priceMin : null;
      const max = typeof item.priceMax === 'number' && Number.isFinite(item.priceMax) && item.priceMax > 0 ? item.priceMax : min;

      if (!productName || !country || !factoryNo || min == null || max == null) {
        return null;
      }

      return {
        key: [country, factoryNo, productName].join('|'),
        country,
        factoryNo,
        productName,
        title: [factoryNo, productName].filter(Boolean).join(' '),
        price: min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`,
        merchantCount: item.merchantCount && item.merchantCount > 0 ? item.merchantCount : 1,
        offerCount: item.offerCount && item.offerCount > 0 ? item.offerCount : 0,
        latestTime: 0,
        trend: buildHomeHotSkuTrend(item),
      };
    })
    .filter((item): item is HotSkuPriceStat => item !== null)
    .slice(0, 3);
}

function buildFallbackHotSkuPriceStats(items: OfferFeedItem[]): HotSkuPriceStat[] {
  const groups = new Map<
    string,
    {
      item: OfferFeedItem;
      prices: number[];
      merchants: Set<string>;
      count: number;
      latestTime: number;
      trendByDate: Map<string, number[]>;
    }
  >();

  items.forEach(item => {
    const productName = clean(item.productName);
    const country = clean(item.country);
    const factoryNo = normalizeFactoryNoOrNull(item.factoryNo) ?? clean(item.factoryNo);
    if (!productName || !country || !factoryNo) return;

    const prices = [item.price, item.priceMax]
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
    if (prices.length === 0) return;

    const key = [country, factoryNo, productName].join('|');
    const merchantKeys = getFeedMerchantKeys(item);
    const latestTime = getFeedTimeValue(item.publishTime);
    const dateKey = getFeedDateKey(item.publishTime);
    const current = groups.get(key);

    if (current) {
      current.prices.push(...prices);
      merchantKeys.forEach(merchantKey => current.merchants.add(merchantKey));
      current.count += 1;
      current.latestTime = Math.max(current.latestTime, latestTime);
      if (dateKey) {
        const values = current.trendByDate.get(dateKey) ?? [];
        values.push(...prices);
        current.trendByDate.set(dateKey, values);
      }
      return;
    }

    const trendByDate = new Map<string, number[]>();
    if (dateKey) {
      trendByDate.set(dateKey, [...prices]);
    }
    groups.set(key, {
      item,
      prices: [...prices],
      merchants: new Set(merchantKeys),
      count: 1,
      latestTime,
      trendByDate,
    });
  });

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const productName = clean(group.item.productName);
      const country = clean(group.item.country);
      const factoryNo = normalizeFactoryNoOrNull(group.item.factoryNo) ?? clean(group.item.factoryNo);
      const min = Math.min(...group.prices);
      const max = Math.max(...group.prices);

      return {
        key,
        country,
        factoryNo,
        productName,
        title: [factoryNo, productName].filter(Boolean).join(' '),
        price: min === max ? formatNumber(min) : `${formatNumber(min)}-${formatNumber(max)}`,
        merchantCount: Math.max(group.merchants.size, 1),
        offerCount: group.count,
        latestTime: group.latestTime,
        trend: buildFallbackHotSkuTrend(group.trendByDate),
      };
    })
    .sort((left, right) => right.offerCount - left.offerCount || right.merchantCount - left.merchantCount || right.latestTime - left.latestTime)
    .slice(0, 3);
}

function buildHomeHotSkuTrend(item: HomeHotSku) {
  const trend = (item.trendPoints ?? [])
    .map(point => Number(point.avgPrice))
    .filter(value => Number.isFinite(value) && value > 0);
  return trend.length === 1 ? [trend[0], trend[0]] : trend;
}

function buildFallbackHotSkuTrend(trendByDate: Map<string, number[]>) {
  const trend = Array.from(trendByDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-7)
    .map(([, values]) => average(values))
    .filter(value => Number.isFinite(value) && value > 0);

  if (trend.length === 1) {
    return [trend[0], trend[0]];
  }
  return trend;
}

function formatTrendRange(trend: number[]) {
  if (trend.length === 0) {
    return undefined;
  }
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  return `${formatNumber(min)}-${formatNumber(max)}`;
}

function buildFeedMetaParts(group: FeedGroup, type: 'offer' | 'inquiry') {
  if (type === 'offer') {
    return [group.country, group.factoryNo].filter(Boolean);
  }
  if (group.country && group.factoryNo) {
    return [group.country, group.factoryNo];
  }
  if (group.country) {
    return [group.country, '厂号不限'];
  }
  return ['国家厂号不限'];
}

function matchesPrice(item: OfferFeedItem, min: number | null, max: number | null) {
  if (min == null && max == null) return true;
  const priceValues = [item.price, item.priceMax].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (priceValues.length === 0) return false;
  const low = Math.min(...priceValues);
  const high = Math.max(...priceValues);
  if (min != null && high < min) return false;
  if (max != null && low > max) return false;
  return true;
}

function getFeedTimeValue(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value.replace(/-/g, '/'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFeedDateKey(value?: string | null) {
  const timestamp = getFeedTimeValue(value);
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function matchesFollowedMerchant(item: OfferFeedItem, followedMerchantKeys: Set<string>) {
  if (followedMerchantKeys.size === 0) return false;
  return getFeedMerchantKeys(item).some(key => followedMerchantKeys.has(key));
}

async function getFollowedMerchantKeys() {
  const [intentItems, recentItems] = await Promise.all([getIntentPlates(), getRecentContactPlates()]);
  return buildFollowedMerchantKeySet([...intentItems, ...recentItems]);
}

function buildFollowedMerchantKeySet(items: PlateSnapshot[]) {
  const keys = new Set<string>();
  items.forEach(item => {
    addMerchantKeys(keys, item.merchantId, item.merchantName, item.contactPhone);
  });
  return keys;
}

function getFeedMerchantKeys(item: OfferFeedItem) {
  const keys = new Set<string>();
  addMerchantKeys(
    keys,
    item.merchantId,
    clean(item.merchantShortName) || clean(item.merchantName),
    item.contactPhone,
  );
  return Array.from(keys);
}

function addMerchantKeys(keys: Set<string>, merchantId?: number | string | null, merchantName?: string | null, contactPhone?: string | null) {
  const id = merchantId != null ? String(merchantId).trim() : '';
  if (id) keys.add(`id:${id}`);
  const name = normalizeMerchantName(merchantName);
  if (name) keys.add(`name:${name}`);
  const phone = clean(contactPhone);
  if (phone) keys.add(`phone:${phone}`);
}

function normalizeMerchantName(value?: string | null) {
  const name = clean(value);
  if (!name || isUnlinkedMerchantName(name)) return '';
  return name;
}

function mergePrice(items: OfferFeedItem[], type: 'offer' | 'inquiry') {
  const values = items.flatMap(item => [item.price, item.priceMax]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return type === 'offer' ? '协商报价' : '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return '¥' + formatNumber(min) + '/kg';
  return '¥' + formatNumber(min) + '-' + formatNumber(max) + '/kg';
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPrice(price?: number | null, priceMax?: number | null) {
  const values = [price, priceMax].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? '¥' + formatNumber(min) + '/kg' : '¥' + formatNumber(min) + '-' + formatNumber(max) + '/kg';
}

function formatCardTime(value?: string | null) {
  if (!value) return '';
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  const date = value.match(/(\d{2})-(\d{2})/);
  return date ? `${date[1]}-${date[2]}` : '';
}

function sortToParam(sort: SortKind) {
  if (sort === 'priceAsc') return 'priceAsc';
  if (sort === 'priceDesc') return 'priceDesc';
  if (sort === 'publishTime') return 'publishTime';
  return 'comprehensive';
}

function getSortLabel(sort: SortKind) {
  return sortOptions.find(item => item.value === sort)?.label ?? '缁煎悎';
}

function getPriceRangeLabel(min: string, max: string) {
  const left = min.trim();
  const right = max.trim();
  if (left && right) return `${left}-${right}`;
  if (left) return `≥${left}`;
  if (right) return `≤${right}`;
  return '价格区间';
}

function normalizeCardType(value?: string | null) {
  if (!value) return '';
  if (value === 'countryFactoryProduct') return 'factoryProduct';
  if (value === 'countryFactory') return 'factory';
  return value;
}

function buildSelfCompareChips(cards: HomeCardItem[]): SelfCompareChip[] {
  const chipGroups: Record<keyof SelfCompareFilter, SelfCompareChip[]> = {
    productName: [],
    country: [],
    factoryNo: [],
  };
  const seen = new Set<string>();
  const add = (type: keyof SelfCompareFilter, value?: string | null) => {
    const normalized = type === 'factoryNo' ? normalizeFactoryNoOrNull(value) ?? clean(value) : clean(value);
    if (!normalized) return;
    const key = `${type}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    chipGroups[type].push({type, value: normalized});
  };

  cards.forEach(card => {
    add('productName', card.productName);
    add('country', card.country);
    add('factoryNo', card.factoryNo);
  });
  return [...chipGroups.productName, ...chipGroups.country, ...chipGroups.factoryNo];
}

function buildSelfFilterOptions(chips: SelfCompareChip[]): Record<keyof SelfCompareFilter, string[]> {
  return {
    productName: chips.filter(item => item.type === 'productName').map(item => item.value),
    country: chips.filter(item => item.type === 'country').map(item => item.value),
    factoryNo: chips.filter(item => item.type === 'factoryNo').map(item => item.value),
  };
}

function pruneSelfCompareFilter(selected: SelfCompareFilter, options: Record<keyof SelfCompareFilter, string[]>): SelfCompareFilter {
  return {
    productName: selected.productName.filter(value => options.productName.includes(value)),
    country: selected.country.filter(value => options.country.includes(value)),
    factoryNo: selected.factoryNo.filter(value => options.factoryNo.includes(value)),
  };
}

function filterSelfCompareCards(cards: HomeCardItem[], selected: SelfCompareFilter) {
  return cards.filter(card => {
    const country = clean(card.country);
    const factoryNo = normalizeFactoryNoOrNull(card.factoryNo) ?? clean(card.factoryNo);
    const productName = clean(card.productName);
    if (selected.country.length > 0 && !selected.country.includes(country)) return false;
    if (selected.factoryNo.length > 0 && !selected.factoryNo.includes(factoryNo)) return false;
    if (selected.productName.length > 0 && !selected.productName.includes(productName)) return false;
    return true;
  });
}

function filterSelfMerchantDynamicCards(cards: HomeCardItem[], selected: SelfCompareFilter) {
  const hasFilters = selected.country.length > 0 || selected.factoryNo.length > 0 || selected.productName.length > 0;
  if (!hasFilters) return cards;

  return cards.filter(card => {
    const records = [card, ...(card.latestOffers ?? [])] as Array<Record<string, unknown>>;
    return records.some(record => {
      const country = getRecordString(record, ['country', 'countryName']);
      const factoryNo = normalizeFactoryNoOrNull(getRecordString(record, ['factoryNo', 'factory_no'])) ?? '';
      const productName = getRecordString(record, ['productName', 'product_name', 'goodsName']);
      if (selected.country.length > 0 && !selected.country.includes(country)) return false;
      if (selected.factoryNo.length > 0 && !selected.factoryNo.includes(factoryNo)) return false;
      if (selected.productName.length > 0 && !selected.productName.includes(productName)) return false;
      return true;
    });
  });
}

function buildSelfSkuMeta(card: HomeCardItem) {
  const factoryNo = normalizeFactoryNoOrNull(card.factoryNo) ?? clean(card.factoryNo);
  return [clean(card.country), factoryNo].filter(Boolean).join(' ') || '-';
}

function buildSelfMerchantMeta(card: HomeCardItem) {
  const tags = splitText(card.merchantTags).slice(0, 2).join(' · ');
  return tags || clean(card.searchWord) || '关注商家';
}

function getSelfEditCardKey(card: HomeCardItem) {
  if (card.historyId != null) return `history:${card.historyId}`;
  return [
    normalizeCardType(card.cardType),
    clean(card.searchWord),
    clean(card.country),
    normalizeFactoryNoOrNull(card.factoryNo) ?? clean(card.factoryNo),
    clean(card.productName),
    card.merchantId != null ? String(card.merchantId) : clean(card.merchantName),
  ].join('|');
}

function buildFollowedMerchantOptions(cards: HomeCardItem[]): SelfMerchantOption[] {
  const options: SelfMerchantOption[] = [];
  const seen = new Set<string>();
  cards.forEach(card => {
    const name = clean(card.merchantShortName) || clean(card.merchantName);
    if (!name || isUnlinkedMerchantName(name)) return;
    const merchantId = card.merchantId ?? null;
    const key = merchantId != null ? `id:${merchantId}` : `name:${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push({
      key,
      name,
      shortName: shortenMerchantName(name),
      merchantId,
    });
  });
  return options;
}

function buildSelfMerchantQuoteMap(card: HomeCardItem) {
  const quotes = new Map<string, SelfMerchantQuote>();
  (card.hotMerchants ?? []).forEach((raw, index) => {
    const option = getMerchantOptionFromRecord(raw);
    if (!option) return;
    const rawPrice = getMerchantQuotePrice(raw);
    const price = rawPrice || '协商报价';
    const meta = buildSelfMerchantQuoteMeta(raw);
    if (!quotes.has(option.key)) {
      quotes.set(option.key, {
        ...option,
        key: `${option.key}-${index}`,
        price,
        meta,
      });
    }
  });
  return quotes;
}

function buildSelfMerchantQuoteMeta(raw: Record<string, unknown>) {
  const feedingType = getRecordString(raw, ['feedingType', 'feeding_method', 'feeding']);
  const goodsLocation = getRecordString(raw, ['goodsLocation', 'goods_location', 'region', 'location']);
  const tags = splitText(getRecordString(raw, ['tags', 'tag', 'merchantTags']));
  const parts: string[] = [];
  if (feedingType.includes('谷饲')) {
    parts.push('谷饲');
  }
  if (tags.includes('大日期')) {
    parts.push('大日期');
  }
  if (tags.includes('新日期')) {
    parts.push('新日期');
  }
  if (tags.includes('临期')) {
    parts.push('临期');
  }
  if (tags.includes('整柜出')) {
    parts.push('整柜出');
  }
  if (tags.includes('可拆出')) {
    parts.push('可拆出');
  }
  if (tags.includes('可整可拆')) {
    parts.push('可整可拆');
  }
  if (goodsLocation) {
    parts.push(goodsLocation);
  }
  return parts.join(' · ');
}

function getMerchantOptionFromRecord(raw: Record<string, unknown>): SelfMerchantOption | null {
  const name = getRecordString(raw, ['merchantShortName', 'merchantName', 'name', 'companyName']);
  if (!name || isUnlinkedMerchantName(name)) return null;
  const merchantId = getRecordId(raw, ['merchantId', 'merchant_id', 'id', 'targetId', 'target_id']);
  const key = merchantId != null ? `id:${merchantId}` : `name:${name}`;
  return {
    key,
    name,
    shortName: shortenMerchantName(name),
    merchantId,
  };
}

function isUnlinkedMerchantName(name: string) {
  return !name || name.includes('暂未关联行业商家');
}

function shortenMerchantName(name: string) {
  return name
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/有限责任公司$/g, '')
    .replace(/股份有限公司$/g, '')
    .replace(/供应链管理有限公司$/g, '')
    .replace(/供应链有限公司$/g, '')
    .replace(/国际供应链有限公司$/g, '')
    .replace(/国际贸易有限公司$/g, '')
    .replace(/进出口贸易有限公司$/g, '')
    .replace(/进出口有限公司$/g, '')
    .replace(/贸易有限公司$/g, '')
    .replace(/食品有限公司$/g, '')
    .replace(/有限公司$/g, '')
    .replace(/公司$/g, '')
    .trim();
}

function getMerchantQuotePrice(raw: Record<string, unknown>) {
  const direct = getRecordString(raw, ['priceRange', 'priceText', 'quoteText']);
  if (direct) return direct.replace(/^¥/, '').replace(/\/kg$/, '');
  const min = getRecordNumber(raw, ['priceMin', 'minPrice', 'price', 'avgPrice', 'latestPrice']);
  const max = getRecordNumber(raw, ['priceMax', 'maxPrice']);
  return priceRange(min, max).replace(/^¥/, '').replace(/\/kg$/, '');
}

function buildDynamicOfferTitle(raw: Record<string, unknown>) {
  const country = getRecordString(raw, ['country']);
  const factoryNo = normalizeFactoryNoOrNull(getRecordString(raw, ['factoryNo'])) ?? getRecordString(raw, ['factoryNo']);
  const productName = getRecordString(raw, ['productName', 'product']);
  return [country, factoryNo, productName].filter(Boolean).join(' ') || getRecordString(raw, ['title', 'searchWord']) || '最新货源';
}

function buildDynamicOfferDesc(raw: Record<string, unknown>) {
  const price = getMerchantQuotePrice(raw);
  const time = formatCardTime(getRecordString(raw, ['publishTime', 'createTime', 'time']));
  const parts = [
    time ? `${time}发布` : '',
    price ? `报价 ${price}/kg` : '协商报价',
  ];
  return parts.filter(Boolean).join('，');
}

type MerchantDynamicEvent = {
  type: string;
  title: string;
  desc: string;
  tone?: 'danger' | 'warning';
};

function buildMerchantDynamicEvents(card: HomeCardItem): MerchantDynamicEvent[] {
  const latest = (card.latestOffers ?? []).slice(0, 2).map((offer, index) => ({
    type: index === 0 ? '新增' : '新增',
    title: buildDynamicOfferTitle(offer),
    desc: buildDynamicOfferDesc(offer),
  }));
  if (latest.length >= 4) return latest.slice(0, 4);

  const fallbackBase = latest.length > 0 ? latest : [
    {type: '新增', title: '巴西 SIF504 牛前八件套', desc: '近30天未出现，今天首次报盘 57/kg'},
    {type: '新增', title: '巴西 SIF51 板腱', desc: '今日新增报盘 68.8/kg'},
  ];
  const examples: MerchantDynamicEvent[] = [
    ...fallbackBase,
    {type: '调价', title: '美国337 胸肉 -0.03', desc: '今日均价 51.0，昨日 51.0，连续2天上调', tone: 'danger'},
    {type: '调价', title: '巴西SIF51 板腱 +0.13', desc: '今日均价 68.8，昨日 68.7，连续2天上调', tone: 'danger'},
    {type: '复卖', title: '巴西SIF3181 脖肉', desc: '距上次出现 12 天，今日报价 50.8/kg', tone: 'warning'},
    {type: '求购', title: '巴西SIF504 上脑', desc: '今日发布求购，关注是否有匹配货源', tone: 'warning'},
  ];
  return examples.slice(0, 6);
}

function getRecordString(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return `${value}`;
  }
  return '';
}

function getRecordNumber(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function getRecordId(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function formatPriceChange(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const percentValue = Math.abs(value) <= 1 ? value * 100 : value;
  const prefix = percentValue > 0 ? '+' : '';
  return `${prefix}${formatNumber(percentValue)}%`;
}

function priceChangeTone(value?: number | null): 'danger' | undefined {
  return typeof value === 'number' && value > 0 ? 'danger' : undefined;
}

function priceRange(min?: number | null, max?: number | null) {
  if (typeof min !== 'number' && typeof max !== 'number') return '';
  if (typeof min === 'number' && typeof max === 'number' && min !== max) return '¥' + formatNumber(min) + '-' + formatNumber(max) + '/kg';
  const value = typeof min === 'number' ? min : max;
  return '¥' + formatNumber(value ?? 0) + '/kg';
}

function splitText(value?: string | null) {
  return clean(value).split(/[,\s锛屻€亅]+/).map(item => item.trim()).filter(Boolean);
}

function clean(value?: string | null) {
  return value?.trim() ?? '';
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, '');
}

function formatCount(value?: number | string | null) {
  if (value == null || value === '') return '-';
  return `${value}`;
}

function SearchIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={colors.primary} strokeWidth={1.8} />
      <Path d="M20 20L16.2 16.2" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M3 4.5L6 7.5L9 4.5" stroke="#171D1C" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function AskAiIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M3.1 6.7C3.1 4.3 5.2 2.5 8 2.5C10.8 2.5 12.9 4.3 12.9 6.7C12.9 9.1 10.8 10.9 8 10.9C7.4 10.9 6.8 10.8 6.3 10.6L3.8 12.6L4.3 9.6C3.5 8.8 3.1 7.8 3.1 6.7Z" stroke={colors.primary} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.2 6.8H6.25M8 6.8H8.05M9.8 6.8H9.85" stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M11.5 2L11.9 1.1L12.3 2L13.2 2.4L12.3 2.8L11.9 3.7L11.5 2.8L10.6 2.4L11.5 2Z" fill={colors.primary} />
    </Svg>
  );
}

function CompanyTinyIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 14 14" fill="none">
      <Path d="M2.5 12V3.3L7 1.5L11.5 3.3V12" stroke="#2D6E78" strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M5 5H9M5 7H9M5 9H7.5" stroke="#2D6E78" strokeWidth={1.1} strokeLinecap="round" />
    </Svg>
  );
}

function PersonTinyIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={5.3} r={2.3} stroke="#2D6E78" strokeWidth={1.2} />
      <Path d="M3.5 13C4.2 10.8 5.7 9.7 8 9.7C10.3 9.7 11.8 10.8 12.5 13" stroke="#2D6E78" strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

function BookIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
      <Path d="M3 3.2C4.6 2.5 6 2.6 8 3.7V13C6 11.9 4.6 11.8 3 12.5V3.2Z" stroke="#6C7A77" strokeWidth={1.1} />
      <Path d="M13 3.2C11.4 2.5 10 2.6 8 3.7V13C10 11.9 11.4 11.8 13 12.5V3.2Z" stroke="#6C7A77" strokeWidth={1.1} />
    </Svg>
  );
}

function StarIcon({selected}: {selected: boolean}) {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
      <Path d="M8 2.2L9.7 5.8L13.6 6.3L10.8 9.1L11.5 13L8 11.1L4.5 13L5.2 9.1L2.4 6.3L6.3 5.8L8 2.2Z" stroke={selected ? colors.primary : '#6C7A77'} fill={selected ? colors.primary : 'none'} strokeWidth={1.1} />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
      <Path d="M8 4V12M4 8H12" stroke="#6C7A77" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function PhoneIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
      <Path d="M5.2 2.5L6.4 5.1L5.3 6.2C6 7.7 7.3 9 8.8 9.7L9.9 8.6L12.5 9.8L12.1 12.3C11.9 13.1 11.2 13.5 10.4 13.4C6.4 12.8 3.2 9.6 2.6 5.6C2.5 4.8 2.9 4.1 3.7 3.9L5.2 2.5Z" stroke="#6C7A77" strokeWidth={1.1} strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  safeTop: {backgroundColor: '#FFFFFF'},
  headerBlock: {backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border},
  topLine: {height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  mainTabs: {flexDirection: 'row', alignItems: 'center', gap: 12},
  topTab: {height: 52, justifyContent: 'center'},
  topTabText: {color: colors.textSecondary, fontSize: 18, fontWeight: '700', lineHeight: 24},
  topTabTextActive: {color: colors.text, fontWeight: '800'},
  topTabLine: {marginTop: 5, width: 22, height: 3, borderRadius: 2, backgroundColor: 'transparent'},
  topTabLineActive: {backgroundColor: '#F0602B'},
  askAiButton: {height: 32, minWidth: 96, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.primaryLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4},
  askAiText: {color: colors.primary, fontSize: 12, fontWeight: '700'},
  searchBox: {height: 46, borderWidth: 1.2, borderColor: colors.primary, borderRadius: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF'},
  searchCategory: {height: '100%', width: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5},
  searchCategoryText: {color: colors.text, fontSize: 16, fontWeight: '800'},
  searchDivider: {width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.border},
  searchInput: {flex: 1, height: '100%', justifyContent: 'center', paddingHorizontal: 13},
  searchPlaceholder: {color: 'rgba(108,122,119,0.5)', fontSize: 14},
  searchIconButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  hotSkuStrip: {marginTop: 10, minHeight: 96, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E1EBE8', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EBE8', flexDirection: 'row', backgroundColor: '#FFFFFF'},
  hotSkuItems: {flex: 1, minWidth: 0, flexDirection: 'row'},
  hotSkuCell: {flex: 1, minWidth: 0, paddingHorizontal: 8, paddingTop: 9, paddingBottom: 7, justifyContent: 'center'},
  hotSkuMore: {width: 32, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#D9E6E3', alignItems: 'center', justifyContent: 'center'},
  hotSkuMoreText: {color: colors.primary, fontSize: 34, lineHeight: 38, fontWeight: '500'},
  hotSkuCellDivider: {borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E1EBE8'},
  hotSkuTitle: {color: '#7F8D89', fontSize: 12, lineHeight: 16, fontWeight: '800'},
  hotSkuPrice: {marginTop: 2, color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: 0},
  hotSkuMerchantCount: {marginTop: 2, color: '#7F8D89', fontSize: 11, lineHeight: 15, fontWeight: '700'},
  hotSkuTrend: {marginTop: 4, width: '100%', height: 18, overflow: 'hidden'},
  hotRow: {marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8},
  hotLabel: {color: colors.textSecondary, fontSize: 12},
  hotList: {gap: 8, alignItems: 'center', paddingRight: 10},
  hotChip: {height: 30, minWidth: 72, paddingHorizontal: 12, borderRadius: 3, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center'},
  hotChipText: {color: colors.text, fontSize: 12, fontWeight: '600'},
  hotEmpty: {color: colors.textMuted, fontSize: 12},
  discoverPage: {flex: 1, backgroundColor: '#FFFFFF'},
  discoverToolbar: {height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EAE7'},
  discoverTitle: {color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900'},
  discoverCategory: {height: 30, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5},
  discoverCategoryText: {color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  discoverList: {paddingBottom: 24, backgroundColor: '#FFFFFF'},
  discoverEmpty: {minHeight: 140, alignItems: 'center', justifyContent: 'center'},
  discoverRetry: {marginTop: 8, color: colors.primary, fontSize: 12, fontWeight: '800'},
  discoveryCard: {minHeight: 138, marginHorizontal: 12, marginTop: 10, padding: 12, borderRadius: 7, borderWidth: 1, borderColor: '#D9E7E4', backgroundColor: '#FFFFFF'},
  discoveryTop: {flexDirection: 'row', alignItems: 'flex-start', gap: 10},
  discoveryMain: {flex: 1, minWidth: 0},
  discoveryProduct: {color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '900'},
  discoverySku: {marginTop: 2, color: colors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '700'},
  discoveryPrice: {maxWidth: 132, color: colors.price, fontSize: 16, lineHeight: 22, fontWeight: '900', textAlign: 'right'},
  discoveryMetrics: {height: 34, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12},
  discoveryMetric: {color: colors.textMuted, fontSize: 11, lineHeight: 16, fontWeight: '700'},
  discoveryTrend: {marginLeft: 'auto', width: 92, height: 22, overflow: 'hidden'},
  discoveryReasonRow: {height: 32, marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E3ECE9', flexDirection: 'row', alignItems: 'center', gap: 7},
  discoveryReasonBadge: {overflow: 'hidden', borderRadius: 3, backgroundColor: colors.primaryLight, color: colors.primary, fontSize: 10, lineHeight: 18, paddingHorizontal: 5, fontWeight: '800'},
  discoveryReasonSubstitute: {backgroundColor: '#FFF0E8', color: '#D96125'},
  discoveryReason: {flex: 1, minWidth: 0, color: colors.textSecondary, fontSize: 12, lineHeight: 17},
  discoveryArrow: {color: colors.primary, fontSize: 22, lineHeight: 24},
  filterBlock: {backgroundColor: '#FFFFFF'},
  listContent: {paddingBottom: 20, backgroundColor: '#FFFFFF'},
  loading: {marginTop: 40},
  empty: {marginTop: 40, color: '#9DA4A3', textAlign: 'center', fontSize: 14},
  feedCard: {backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE8E5'},
  feedCollapsed: {minHeight: 66, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center'},
  feedMain: {flex: 1, minWidth: 0, paddingRight: 12},
  skuLine: {flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0},
  productName: {color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: '800', flexShrink: 1},
  skuMeta: {color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '700'},
  merchantLine: {marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0},
  merchantName: {color: colors.textMuted, fontSize: 12, lineHeight: 17, flex: 1},
  priceSide: {width: 116, alignItems: 'flex-end'},
  feedPrice: {color: colors.price, fontSize: 17, lineHeight: 23, fontWeight: '800'},
  negotiateFeedPrice: {color: colors.primary, fontSize: 15},
  feedTime: {marginTop: 4, color: '#8C9694', fontSize: 11, lineHeight: 15},
  publisherList: {paddingHorizontal: 8, paddingBottom: 8, gap: 7, backgroundColor: '#FFFFFF'},
  publisherCard: {borderRadius: 8, borderWidth: 1, borderColor: '#D8ECE8', backgroundColor: '#FAFFFE', paddingHorizontal: 10, paddingTop: 9},
  publisherTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10},
  publisherNameLine: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4},
  publisherName: {flex: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700'},
  publisherPrice: {color: colors.price, fontSize: 17, lineHeight: 22, fontFamily: fonts.manropeSemiBold},
  negotiatePublisherPrice: {color: colors.primary, fontSize: 14, fontFamily: fonts.manropeRegular},
  publisherTags: {marginTop: 5, minHeight: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 5},
  publisherTag: {paddingHorizontal: 5, borderRadius: 3, backgroundColor: '#EAF8F5', color: '#3D7772', fontSize: 10, lineHeight: 17},
  subActionRow: {marginTop: 6, height: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DFE8E6', flexDirection: 'row', alignItems: 'center'},
  publisherTime: {width: 46, color: colors.textMuted, fontSize: 11, lineHeight: 16},
  subActions: {marginLeft: 'auto', width: 292, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end'},
  subAction: {width: 72, height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2},
  subActionText: {color: '#4D5A58', fontSize: 10, lineHeight: 15},
  subActionDivider: {width: StyleSheet.hairlineWidth, height: 15, backgroundColor: '#D9E1DF'},
  selfCompareHeader: {backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE8E5'},
  selfSceneTabs: {height: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EEEB'},
  selfSceneTabGroup: {flex: 1, minWidth: 0, height: 42, flexDirection: 'row', alignItems: 'center', gap: 18},
  selfSceneTab: {height: 42, justifyContent: 'center'},
  selfSceneTabActive: {borderBottomWidth: 3, borderBottomColor: colors.primary},
  selfSceneTabText: {color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontWeight: '800'},
  selfSceneTabTextActive: {color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '800'},
  selfEditButton: {height: 28, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  selfEditButtonText: {color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  selfFilterBar: {minHeight: 48, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6},
  selfFilterMenu: {flex: 1, minWidth: 0, height: 30, paddingHorizontal: 7, borderRadius: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3},
  selfFilterMenuText: {flexShrink: 1, color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: '800'},
  selfFilterMenuArrow: {color: colors.primary, fontSize: 11, lineHeight: 14, fontWeight: '800'},
  selfFilterChips: {flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 7, maxHeight: 68, overflow: 'hidden'},
  selfFilterChipsCollapsed: {height: 30, flexWrap: 'nowrap'},
  selfFilterChip: {height: 30, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  selfFilterChipActive: {borderColor: colors.primary, backgroundColor: colors.primaryLight},
  selfFilterChipText: {color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  selfFilterChipTextActive: {color: colors.primary},
  selfFilterMore: {width: 31, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  selfFilterMoreText: {color: colors.primary, fontSize: 16, lineHeight: 20, fontWeight: '800'},
  selfTableHead: {height: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FBFA', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5EEEB'},
  selfTableHeadText: {color: '#879590', fontSize: 11, lineHeight: 15, fontWeight: '700'},
  selfTableSku: {flex: 1.22, minWidth: 0},
  selfTablePrice: {width: 82, textAlign: 'right'},
  selfTableCount: {width: 44, textAlign: 'right'},
  selfTableChange: {width: 50, textAlign: 'right'},
  selfMerchantFilterLine: {paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center'},
  selfMerchantFilterButton: {height: 30, maxWidth: 142, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryLight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5},
  selfMerchantFilterText: {color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  selfMerchantFilterArrow: {color: colors.primary, fontSize: 13, lineHeight: 16, fontWeight: '800'},
  selfMerchantDropdown: {paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5EEEB', backgroundColor: '#FFFFFF'},
  selfMerchantDropdownTop: {height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  selfMerchantDropdownTitle: {color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700'},
  selfMerchantDropdownActions: {flexDirection: 'row', alignItems: 'center', gap: 14},
  selfMerchantDropdownAction: {color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  selfMerchantOptions: {marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 7},
  selfMerchantOption: {height: 28, maxWidth: 132, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', justifyContent: 'center'},
  selfMerchantOptionActive: {borderColor: colors.primary, backgroundColor: colors.primaryLight},
  selfMerchantOptionText: {color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: '700'},
  selfMerchantOptionTextActive: {color: colors.primary},
  selfMerchantEmptyText: {color: colors.textMuted, fontSize: 12, lineHeight: 18},
  selfMerchantMatrix: {backgroundColor: '#FFFFFF'},
  selfMerchantMatrixBody: {flexDirection: 'row', backgroundColor: '#FFFFFF'},
  selfMerchantMatrixScroll: {paddingRight: 12},
  selfMerchantFixedColumn: {width: 138, backgroundColor: '#FFFFFF'},
  selfMerchantFixedHead: {height: 34, paddingLeft: 12, justifyContent: 'center', backgroundColor: '#F8FBFA', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5EEEB', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EAE7'},
  selfMerchantScrollableHead: {height: 34, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FBFA', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5EEEB', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EAE7'},
  selfMerchantHeadSku: {width: 138},
  selfMerchantHeadScroll: {alignItems: 'center', paddingRight: 12},
  selfMerchantHeadMerchant: {width: 78, textAlign: 'right', marginLeft: 6},
  selfCompareRow: {minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EAE7'},
  selfCompareSku: {flex: 1.22, minWidth: 0, paddingRight: 8},
  selfCompareSkuLine: {flexDirection: 'row', alignItems: 'baseline', gap: 5, minWidth: 0},
  selfCompareProduct: {color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '800', flexShrink: 1},
  selfCompareMeta: {color: '#263633', fontSize: 12, lineHeight: 17, fontWeight: '700'},
  selfComparePrice: {width: 82, color: colors.price, fontSize: 15, lineHeight: 19, fontWeight: '800', textAlign: 'right'},
  selfCompareUnit: {color: colors.textSecondary, fontSize: 10, fontWeight: '600'},
  selfCompareNum: {width: 44, color: colors.text, fontSize: 15, lineHeight: 19, fontWeight: '800', textAlign: 'right'},
  selfCompareChange: {width: 50, color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: '800', textAlign: 'right'},
  selfCompareChangeUp: {color: colors.danger},
  selfMerchantRow: {minHeight: 58, paddingLeft: 12, paddingRight: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EAE7'},
  selfMerchantSkuBlock: {width: 138, minWidth: 0, paddingRight: 8},
  selfMerchantSkuRowBlock: {height: 58, paddingVertical: 8, paddingLeft: 12, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EAE7', backgroundColor: '#FFFFFF'},
  selfMerchantProduct: {color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800'},
  selfMerchantMeta: {marginTop: 2, color: colors.textSecondary, fontSize: 11, lineHeight: 15, fontWeight: '700'},
  selfMerchantQuoteCellRow: {minHeight: 62, flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E1EAE7', paddingVertical: 3},
  selfMerchantQuoteList: {alignItems: 'center', gap: 7, paddingRight: 6},
  selfMerchantQuoteCell: {width: 78, minHeight: 46, marginLeft: 6, borderRadius: 5, backgroundColor: '#FDEEEE', paddingHorizontal: 5, paddingVertical: 5, justifyContent: 'center', alignItems: 'flex-end', alignSelf: 'stretch', marginTop: 1, marginBottom: 1},
  selfMerchantQuoteCellEmpty: {backgroundColor: '#F6FAF9'},
  selfMerchantQuoteName: {color: colors.textSecondary, fontSize: 10, lineHeight: 14, fontWeight: '700'},
  selfMerchantQuotePrice: {color: colors.price, fontSize: 13, lineHeight: 17, fontWeight: '800'},
  selfMerchantQuotePriceMuted: {color: colors.primary, fontSize: 11, lineHeight: 15, fontWeight: '700'},
  selfMerchantQuoteMeta: {marginTop: 2, color: colors.textMuted, fontSize: 10, lineHeight: 13, textAlign: 'right'},
  selfMerchantQuoteEmpty: {height: 38, flex: 1, borderRadius: 5, backgroundColor: '#F8FBFA', alignItems: 'center', justifyContent: 'center'},
  selfMerchantQuoteEmptyText: {color: colors.textMuted, fontSize: 11, lineHeight: 15},
  selfDynamicCard: {marginHorizontal: 10, marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: '#D8E8E5', backgroundColor: '#FFFFFF', paddingTop: 12, overflow: 'hidden'},
  selfDynamicCardTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10},
  selfDynamicMerchantLine: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12},
  selfDynamicMerchantName: {flex: 1, color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '800'},
  selfDynamicBadge: {minWidth: 58, height: 28, marginRight: 12, borderRadius: 6, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight},
  selfDynamicBadgeText: {color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  selfDynamicEvent: {minHeight: 56, marginHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EFED', paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8},
  selfDynamicEventType: {height: 24, minWidth: 38, borderRadius: 5, overflow: 'hidden', backgroundColor: '#E6F7F3', color: colors.primary, textAlign: 'center', fontSize: 12, lineHeight: 24, fontWeight: '800'},
  selfDynamicEventTypeDanger: {backgroundColor: '#FDECEE', color: colors.danger},
  selfDynamicEventTypeWarning: {backgroundColor: '#FFF2DD', color: '#E97919'},
  selfDynamicEventMain: {flex: 1, minWidth: 0},
  selfDynamicEventTitle: {color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '800'},
  selfDynamicEventDesc: {marginTop: 2, color: colors.textSecondary, fontSize: 12, lineHeight: 17},
  selfDynamicEmptyBlock: {marginTop: 10, height: 48, borderRadius: 7, borderWidth: 1, borderColor: '#DDEAE7', backgroundColor: '#F8FCFB', alignItems: 'center', justifyContent: 'center'},
  selfDynamicEmptyBlockText: {color: colors.textMuted, fontSize: 12, lineHeight: 17},
  selfRow: {minHeight: 92, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE8E5', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 9},
  pressed: {opacity: 0.72},
  selfIconBubble: {width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center'},
  selfContent: {flex: 1, minWidth: 0, marginHorizontal: 10},
  selfTopRow: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10},
  selfTitleWrap: {flex: 1, minWidth: 0},
  selfTitle: {color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '800'},
  selfSummaryRow: {marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6},
  selfBadge: {overflow: 'hidden', borderRadius: 3, backgroundColor: '#EDF4FF', color: '#4D73D9', fontSize: 11, lineHeight: 17, paddingHorizontal: 5},
  selfSummary: {flex: 1, minWidth: 0, color: colors.textSecondary, fontSize: 12, lineHeight: 17},
  selfRightMetric: {minWidth: 76, alignItems: 'flex-end'},
  selfRightValue: {color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '800'},
  selfRightPrice: {color: colors.danger},
  selfRightLabel: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  selfStatsRow: {marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E3ECE9', flexDirection: 'row', justifyContent: 'space-between', gap: 8},
  selfStatItem: {flex: 1, minWidth: 0},
  selfStatValue: {color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800'},
  selfStatValueDanger: {color: colors.danger},
  selfStatLabel: {marginTop: 1, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  selfPrimary: {marginTop: 4, color: colors.textSecondary, fontSize: 12, lineHeight: 17},
  selfSecondary: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 16},
  selfEditOverlay: {flex: 1, justifyContent: 'flex-end'},
  selfEditBackdrop: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.28)'},
  selfEditPanel: {maxHeight: '82%', minHeight: 420, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden'},
  selfEditHeader: {height: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3ECE9'},
  selfEditTitle: {color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '900'},
  selfEditClose: {width: 30, height: 30, alignItems: 'center', justifyContent: 'center'},
  selfEditCloseText: {color: colors.textSecondary, fontSize: 24, lineHeight: 28, fontWeight: '600'},
  selfEditTabs: {height: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8F0EE'},
  selfEditTab: {height: 30, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF'},
  selfEditTabActive: {borderColor: colors.primary, backgroundColor: colors.primaryLight},
  selfEditTabText: {color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  selfEditTabTextActive: {color: colors.primary},
  selfEditTabCount: {color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '800'},
  selfEditTabCountActive: {color: colors.primary},
  selfEditList: {flex: 1},
  selfEditListContent: {paddingBottom: 16},
  selfEditEmpty: {height: 128, alignItems: 'center', justifyContent: 'center'},
  selfEditEmptyText: {color: colors.textMuted, fontSize: 13, lineHeight: 18},
  selfEditRow: {minHeight: 58, paddingLeft: 14, paddingRight: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EEEB'},
  selfEditRowMain: {flex: 1, minWidth: 0},
  selfEditRowTitle: {color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800'},
  selfEditRowMeta: {marginTop: 2, color: colors.textSecondary, fontSize: 11, lineHeight: 15},
  selfEditRowSummary: {width: 74, color: colors.textMuted, fontSize: 11, lineHeight: 15, textAlign: 'right'},
  selfEditRemove: {height: 28, minWidth: 48, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: '#F0B4B4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5F5'},
  selfEditRemoveDisabled: {borderColor: colors.border, backgroundColor: '#F7FAF9'},
  selfEditRemoveText: {color: colors.danger, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  selfEditRemoveTextDisabled: {color: colors.textMuted},
  sortOptions: {gap: 8},
  sortOption: {height: 40, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  sortOptionActive: {borderColor: colors.primary, backgroundColor: colors.primaryLight},
  sortOptionText: {fontSize: 14, color: colors.textSecondary},
  sortOptionTextActive: {color: colors.primary, fontWeight: '800'},
  priceRangeRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 12},
  priceField: {flex: 1, gap: 8},
  priceFieldLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '600'},
  priceInput: {height: 42, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FFFFFF', color: colors.text, fontSize: 14, paddingHorizontal: 12},
  priceDash: {color: colors.textMuted, fontSize: 16, paddingBottom: 10},
  quickPriceRow: {marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  quickPriceChip: {height: 30, paddingHorizontal: 10, borderRadius: 4, backgroundColor: colors.primaryLight, justifyContent: 'center'},
  quickPriceText: {color: colors.primary, fontSize: 12, fontWeight: '700'},
});
