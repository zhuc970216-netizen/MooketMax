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
import Svg, {Circle, Path, SvgXml} from 'react-native-svg';
import {mooketApi} from '../api/mooketApi';
import {FilterBar, type FilterDef, type FilterKey as DetailFilterKey} from '../components/detail/FilterBar';
import {FilterPanelSheet, MultiSelectChips} from '../components/detail/FilterPanelSheet';
import {OriginalTextSheet} from '../components/detail/OriginalTextSheet';
import {merchantBuildingXml} from '../components/detail/productIcons';
import {SelfSelectButton, toHistoryMerchantId} from '../components/detail/SelfSelectButton';
import type {SortMode} from '../components/detail/TabAndSortBar';
import {DEFAULT_CATEGORY} from '../config/env';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import type {OfferFeedFilterOptions, OfferFeedItem, SearchSuggest} from '../types/api';
import {copyToClipboard, dialPhone} from '../utils/contact';
import {buildOriginalTextPayload, type OriginalTextPayload} from '../utils/originalText';
import {formatGoodsLocation, parseWeight} from '../utils/offer';
import {
  addIntentPlate,
  createPlateSnapshotFromFeed,
  getIntentPlateKeys,
  recordRecentContactPlate,
  removeIntentPlate,
  type ContactAction,
} from '../utils/plateFollowStore';
import {
  buildMerchantDetailInitialFilters,
  buildMerchantSelectionFromRoute,
  buildMerchantSelectionFromSuggestion,
  getMerchantDefaultTab,
  loadMerchantSearchResults,
  type MerchantSearchResult,
  type MerchantSearchSelection,
} from '../utils/merchantSearchResults';

type Props = NativeStackScreenProps<RootStackParamList, 'OfferFeed'>;
export type OfferTab = 'offer' | 'inquiry';
type FeedTab = OfferTab | 'merchant';
type FeedFilterKey =
  | 'sort'
  | 'category'
  | 'region'
  | 'priceRange'
  | 'goodsType'
  | 'feedingMethod'
  | 'tag';
type DetailPartKind = 'tag' | 'location' | 'goods' | 'feeding' | 'fat' | 'breed' | 'weight' | 'remark';

type DetailPart = {
  text: string;
  kind: DetailPartKind;
};

type FeedFilters = {
  country?: string | null;
  factoryNo?: string | null;
  goodsType?: string | null;
  region?: string | null;
  feedingType?: string | null;
  tag?: string | null;
};

const PAGE_SIZE = 10;
const categoryOptions = ['牛', '猪'];
const sortOptions: Array<{label: string; value: SortMode}> = [
  {label: '综合排序', value: {kind: 'comprehensive'}},
  {label: '价格升序', value: {kind: 'price', order: 'asc'}},
  {label: '价格降序', value: {kind: 'price', order: 'desc'}},
  {label: '最新发布', value: {kind: 'publishTime'}},
];

export function OfferFeedScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const routeKeyword = route.params?.keyword ?? '';
  const merchantId = route.params?.merchantId;
  const brandName = route.params?.brandName;
  const productName = route.params?.productName;
  const inquiryOnly = route.params?.inquiryOnly === true;
  const parsedRouteKeyword = parseOfferSearchText(routeKeyword);
  const initialCountry = route.params?.initialFilters?.country ?? parsedRouteKeyword.country;
  const initialFactoryNo = route.params?.initialFilters?.factoryNo ?? parsedRouteKeyword.factoryNo;
  const hasInitialStructuredFilter = Boolean(initialCountry || initialFactoryNo);
  const initialQueryKeyword =
    route.params?.queryKeyword ?? (hasInitialStructuredFilter ? parsedRouteKeyword.keyword : routeKeyword);
  const [tab, setTab] = useState<FeedTab>(inquiryOnly ? 'inquiry' : route.params?.initialTab ?? 'offer');
  const [category, setCategory] = useState(route.params?.category ?? DEFAULT_CATEGORY);
  const [keywordInput, setKeywordInput] = useState(routeKeyword);
  const [keyword, setKeyword] = useState(initialQueryKeyword);
  const [keywordScope, setKeywordScope] = useState<'all' | 'product'>(route.params?.keywordScope ?? 'all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggest[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [filters, setFilters] = useState<FeedFilters>({
    country: initialCountry,
    factoryNo: initialFactoryNo,
  });
  const [sort, setSort] = useState<SortMode>({kind: 'comprehensive'});
  const sortBy = useMemo(() => sortToParam(sort), [sort]);
  const [priceMinInput, setPriceMinInput] = useState('');
  const [priceMaxInput, setPriceMaxInput] = useState('');
  const [quotedOnly, setQuotedOnly] = useState(false);
  const [realNameOnly, setRealNameOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [items, setItems] = useState<OfferFeedItem[]>([]);
  const [merchantSearch, setMerchantSearch] = useState<MerchantSearchSelection | null>(
    route.params?.merchantSearch ?? null,
  );
  const [merchantResults, setMerchantResults] = useState<MerchantSearchResult[]>([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState<OfferFeedFilterOptions>({});
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FeedFilterKey | null>(null);
  const [originalText, setOriginalText] = useState<OriginalTextPayload | null>(null);
  const [intentKeys, setIntentKeys] = useState<Set<string>>(new Set());
  const [sortOverlayTop, setSortOverlayTop] = useState(0);
  const [filterPanelTop, setFilterPanelTop] = useState(0);
  const requestSeqRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      getIntentPlateKeys()
        .then(setIntentKeys)
        .catch(() => undefined);
    }, []),
  );

  const handleToggleIntent = useCallback(async (item: OfferFeedItem, itemTab: OfferTab) => {
    const snapshot = createPlateSnapshotFromFeed(item, itemTab);
    if (intentKeys.has(snapshot.key)) {
      try {
        await removeIntentPlate(snapshot.key);
        setIntentKeys(prev => {
          const next = new Set(prev);
          next.delete(snapshot.key);
          return next;
        });
      } catch {
        // Cancelling should stay quiet; focus refresh will resync local state.
      }
      return;
    }

    try {
      await addIntentPlate(snapshot);
      setIntentKeys(prev => {
        const next = new Set(prev);
        next.add(snapshot.key);
        return next;
      });
    } catch (error) {
      Alert.alert('加入失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }, [intentKeys]);

  const handleRecordContact = useCallback(async (item: OfferFeedItem, itemTab: OfferTab, action: ContactAction) => {
    try {
      await recordRecentContactPlate(createPlateSnapshotFromFeed(item, itemTab), action);
    } catch {
      // Contact action itself should not be blocked by local follow-up storage.
    }
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, mode: 'replace' | 'refresh' | 'more' = 'replace') => {
      if (tab === 'merchant') {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        return;
      }
      const requestSeq = (requestSeqRef.current += 1);
      if (mode === 'more') {
        setLoadingMore(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await mooketApi.getOfferFeed({
          category,
          type: tab as OfferTab,
          keyword,
          merchantId,
          brandName,
          productName,
          country: filters.country,
          factoryNo: filters.factoryNo,
          goodsType: filters.goodsType,
          region: filters.region,
          feedingType: filters.feedingType,
          tag: filters.tag,
          quotedOnly,
          realNameOnly,
          verifiedOnly,
          sortBy,
          page: nextPage,
          pageSize: PAGE_SIZE,
          skipCache: mode === 'refresh',
        });
        if (requestSeq !== requestSeqRef.current) return;
        setItems(prev => (mode === 'more' ? prev.concat(result.items ?? []) : result.items ?? []));
        setFilterOptions(result.filterOptions ?? {});
        setTotalCount(result.totalCount ?? 0);
        setPage(result.page ?? nextPage);
        setTotalPages(result.totalPages ?? 1);
        setError(null);
      } catch (err) {
        if (requestSeq !== requestSeqRef.current) return;
        setError(err instanceof Error ? err.message : '加载失败，请稍后重试');
        if (mode !== 'more') {
          setItems([]);
          setTotalCount(0);
        }
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [brandName, category, filters, keyword, merchantId, productName, quotedOnly, realNameOnly, sortBy, tab, verifiedOnly],
  );

  useEffect(() => {
    loadPage(1).catch(() => undefined);
  }, [loadPage]);

  const activeMerchantSelection = useMemo(
    () =>
      merchantSearch ??
      buildMerchantSelectionFromRoute({
        keyword: keywordInput || keyword,
        merchantId,
        brandName,
        productName,
        country: initialCountry,
        factoryNo: initialFactoryNo,
      }),
    [brandName, initialCountry, initialFactoryNo, keyword, keywordInput, merchantId, merchantSearch, productName],
  );

  useEffect(() => {
    if (tab !== 'merchant' || !activeMerchantSelection) {
      setMerchantLoading(false);
      return undefined;
    }

    let cancelled = false;
    setMerchantLoading(true);
    loadMerchantSearchResults(activeMerchantSelection)
      .then(result => {
        if (cancelled) return;
        setMerchantResults(result);
        setMerchantLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMerchantResults([]);
        setMerchantLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMerchantSelection, tab]);

  useEffect(() => {
    const value = keywordInput.trim();
    if (!searchFocused || !value) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setSuggestionsLoading(true);
    const timer = setTimeout(() => {
      const request =
        tab === 'merchant'
          ? Promise.all(categoryOptions.map(item => mooketApi.getSearchSuggestions(item, value))).then(mergeSearchSuggestions)
          : mooketApi.getSearchSuggestions(category, value);
      request
        .then(result => {
          if (cancelled) return;
          setSuggestions(result);
          setSuggestionsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
          setSuggestionsLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [category, keywordInput, searchFocused, tab]);

  const visibleItems = useMemo(() => {
    const merchantFilteredItems = merchantId == null
      ? items
      : items.filter(item => String(item.merchantId ?? '') === String(merchantId));
    const brandFilteredItems = brandName
      ? merchantFilteredItems.filter(item => item.brandName === brandName)
      : merchantFilteredItems;
    const productFilteredItems = productName
      ? brandFilteredItems.filter(item => item.productName === productName)
      : brandFilteredItems;
    const keywordFilteredItems = keyword.trim()
      ? productFilteredItems.filter(item => offerMatchesKeyword(item, keyword, {productOnly: keywordScope === 'product'}))
      : productFilteredItems;
    const minPrice = parsePriceInput(priceMinInput);
    const maxPrice = parsePriceInput(priceMaxInput);
    if (minPrice == null && maxPrice == null) return keywordFilteredItems;
    return keywordFilteredItems.filter(item => offerMatchesPriceRange(item, minPrice, maxPrice));
  }, [brandName, items, keyword, keywordScope, merchantId, priceMaxInput, priceMinInput, productName]);

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      {key: 'category', label: category, hasSelection: true},
      {
        key: 'sort',
        label: getSortLabel(sort),
        hasSelection: sort.kind !== 'comprehensive',
        onClear: sort.kind !== 'comprehensive' ? () => {
          setSort({kind: 'comprehensive'});
          setActiveFilter(null);
        } : undefined,
      },
      {
        key: 'region',
        label: filters.region || '地区',
        hasSelection: Boolean(filters.region),
        onClear: filters.region ? () => {
          setFilters(prev => ({...prev, region: null}));
          setActiveFilter(null);
        } : undefined,
      },
      {
        key: 'priceRange',
        label: getPriceRangeFilterLabel(priceMinInput, priceMaxInput),
        hasSelection: priceMinInput.trim().length > 0 || priceMaxInput.trim().length > 0,
        onClear: priceMinInput.trim().length > 0 || priceMaxInput.trim().length > 0 ? () => {
          setPriceMinInput('');
          setPriceMaxInput('');
          setActiveFilter(null);
        } : undefined,
      },
      {
        key: 'goodsType',
        label: filters.goodsType || '货物类型',
        hasSelection: Boolean(filters.goodsType),
        onClear: filters.goodsType ? () => {
          setFilters(prev => ({...prev, goodsType: null}));
          setActiveFilter(null);
        } : undefined,
      },
      {
        key: 'feedingMethod',
        label: filters.feedingType || '饲养方式',
        hasSelection: Boolean(filters.feedingType),
        onClear: filters.feedingType ? () => {
          setFilters(prev => ({...prev, feedingType: null}));
          setActiveFilter(null);
        } : undefined,
      },
      {
        key: 'tag',
        label: filters.tag || '标签',
        hasSelection: Boolean(filters.tag),
        onClear: filters.tag ? () => {
          setFilters(prev => ({...prev, tag: null}));
          setActiveFilter(null);
        } : undefined,
      },
    ],
    [category, filters.feedingType, filters.goodsType, filters.region, filters.tag, priceMaxInput, priceMinInput, sort],
  );

  const applyKeyword = useCallback(() => {
    const value = keywordInput.trim();
    if (tab === 'merchant') {
      Keyboard.dismiss();
      setKeyword(value);
      setMerchantSearch(buildMerchantSelectionFromRoute({keyword: value}));
      setSearchFocused(false);
      setSuggestions([]);
      return;
    }
    if (inquiryOnly && value) {
      setSearchFocused(true);
      return;
    }
    const parsed = parseOfferSearchText(value);
    const hasStructuredFilter = Boolean(parsed.country || parsed.factoryNo);
    const isStructuredProductSearch = Boolean(parsed.keyword && hasStructuredFilter);
    Keyboard.dismiss();
    setKeyword(hasStructuredFilter ? parsed.keyword : value);
    setKeywordScope(isStructuredProductSearch ? 'product' : 'all');
    setFilters(prev => ({...prev, country: parsed.country, factoryNo: parsed.factoryNo}));
    setSearchFocused(false);
    setSuggestions([]);
  }, [inquiryOnly, keywordInput, tab]);

  const selectSuggestion = useCallback((item: SearchSuggest) => {
    const query = buildOfferSuggestionQuery(item);
    Keyboard.dismiss();
    if (tab === 'merchant') {
      setKeywordInput(query.display);
      setKeyword(query.display);
      setMerchantSearch(
        buildMerchantSelectionFromSuggestion(item, query.display, {
          country: query.country,
          factoryNo: query.factoryNo,
          productName: normalizeOptionalText(item.productName) ?? (query.productOnly ? query.keyword : null),
          brandName: normalizeOptionalText(item.brandName),
        }),
      );
      setSearchFocused(false);
      setSuggestions([]);
      return;
    }
    setKeywordInput(query.display);
    setKeyword(query.keyword);
    setKeywordScope(query.productOnly ? 'product' : 'all');
    setFilters(prev => ({...prev, country: query.country, factoryNo: query.factoryNo}));
    setSearchFocused(false);
    setSuggestions([]);
  }, [tab]);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    setQuotedOnly(false);
    setRealNameOnly(false);
    setVerifiedOnly(false);
    setPriceMinInput('');
    setPriceMaxInput('');
    setSort({kind: 'comprehensive'});
  }, []);

  const toggleCategory = useCallback(() => {
    const currentIndex = categoryOptions.indexOf(category);
    const next = categoryOptions[(currentIndex + 1) % categoryOptions.length] ?? categoryOptions[0];
    setCategory(next);
    setSuggestions([]);
  }, [category]);

  const hasActiveFilters =
    Object.values(filters).some(Boolean) ||
    quotedOnly ||
    realNameOnly ||
    verifiedOnly ||
    priceMinInput.trim().length > 0 ||
    priceMaxInput.trim().length > 0 ||
    sort.kind !== 'comprehensive';
  const showSuggestionPanel = searchFocused && keywordInput.trim().length > 0;

  function handleFilterPress(key: DetailFilterKey) {
    if (key === 'sort' || key === 'category') {
      setActiveFilter(prev => (prev === key ? null : (key as FeedFilterKey)));
      return;
    }
    setActiveFilter(key as FeedFilterKey);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <View style={[styles.safeTop, {height: insets.top}]} />

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        {inquiryOnly ? (
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>求购专区</Text>
            <View style={styles.headerTitleLine} />
          </View>
        ) : (
          <View style={styles.headerTabs}>
            <HeaderTab text="报盘" active={tab === 'offer'} onPress={() => setTab('offer')} />
            <HeaderTab text="求购" active={tab === 'inquiry'} onPress={() => setTab('inquiry')} />
            <HeaderTab text="商家" active={tab === 'merchant'} onPress={() => setTab('merchant')} />
          </View>
        )}
        <View style={styles.clearButton} />
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchBox}>
          <SearchIcon />
          <TextInput
            value={keywordInput}
            disableFullscreenUI
            onFocus={() => setSearchFocused(true)}
            onChangeText={text => {
              setKeywordInput(text);
              setMerchantSearch(null);
              if (!text.trim()) {
                setKeyword('');
                setKeywordScope('all');
                setFilters(prev => ({...prev, country: null, factoryNo: null}));
                setMerchantResults([]);
              }
            }}
            onSubmitEditing={applyKeyword}
            returnKeyType="search"
            placeholder={`支持搜索产品/厂号，例如1440牛霖`}
            placeholderTextColor="rgba(108,122,119,0.55)"
            style={styles.searchInput}
          />
          {keywordInput ? (
            <Pressable
              onPress={() => {
                setKeywordInput('');
                setKeyword('');
                setKeywordScope('all');
                setMerchantSearch(null);
                setMerchantResults([]);
                setFilters(prev => ({...prev, country: null, factoryNo: null}));
                setSuggestions([]);
              }}
              hitSlop={8}>
              <Text style={styles.clearSearch}>×</Text>
            </Pressable>
          ) : null}
        </View>
        {showSuggestionPanel ? (
          <View style={styles.suggestionPanel}>
            {suggestions.length > 0 ? (
              suggestions.slice(0, 8).map((item, index) => (
                <OfferSuggestItem
                  key={`${item.type}-${item.targetId}-${item.text}-${index}`}
                  item={item}
                  keyword={keywordInput}
                  onPress={() => selectSuggestion(item)}
                />
              ))
            ) : (
              <Text style={styles.suggestionEmpty}>
                {suggestionsLoading ? '搜索中...' : `当前“${category}”大类下暂未找到相关内容`}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      {showSuggestionPanel ? (
        <Pressable
          style={[styles.suggestionOverlayMask, {top: insets.top + 108}]}
          onPress={() => setSearchFocused(false)}
        />
      ) : null}

      {tab === 'merchant' ? (
        <FlatList
          data={merchantResults}
          keyExtractor={(item, index) => `${item.merchantId ?? item.merchantName}-${index}`}
          renderItem={({item}) => (
            <MerchantSearchResultCard
              item={item}
              category={category}
              onPress={() => {
                if (item.merchantId == null || !activeMerchantSelection) return;
                navigation.navigate('Merchant', {
                  merchantId: item.merchantId,
                  category,
                  initialTab: getMerchantDefaultTab(item),
                  initialCategory: 'all',
                  ...buildMerchantDetailInitialFilters(activeMerchantSelection, item),
                });
              }}
            />
          )}
          contentContainerStyle={styles.merchantResultList}
          refreshControl={
            <RefreshControl
              refreshing={merchantLoading}
              onRefresh={() => {
                if (!activeMerchantSelection) return;
                setMerchantLoading(true);
                loadMerchantSearchResults(activeMerchantSelection)
                  .then(setMerchantResults)
                  .finally(() => setMerchantLoading(false));
              }}
            />
          }
          ListEmptyComponent={
            merchantLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.loading} />
            ) : (
              <Text style={styles.empty}>暂无匹配商家</Text>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <>
      <View
        style={styles.filterBlock}
        onLayout={event => {
          const {y, height} = event.nativeEvent.layout;
          setSortOverlayTop(y + height);
        }}>
        <FilterBar
          filters={filterDefs}
          active={activeFilter as DetailFilterKey | null}
          onPress={handleFilterPress}
          onBottomLayout={setFilterPanelTop}
        />
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item, index) => `${item.offerId ?? 'offer'}-${index}`}
        renderItem={({item}) => (
          <OfferFeedCard
            item={item}
            tab={tab as OfferTab}
            onMerchantPress={() => {
              if (item.merchantId != null) {
                navigation.navigate('Merchant', {merchantId: item.merchantId, category});
              }
            }}
            onViewOriginalText={setOriginalText}
            isIntentAdded={intentKeys.has(createPlateSnapshotFromFeed(item, tab as OfferTab).key)}
            onAddIntent={() => handleToggleIntent(item, tab as OfferTab)}
            onContact={action => handleRecordContact(item, tab as OfferTab, action)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadPage(1, 'refresh')} />}
        onEndReachedThreshold={0.25}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        updateCellsBatchingPeriod={16}
        windowSize={5}
        removeClippedSubviews={false}
        onEndReached={() => {
          if (!loading && !loadingMore && page < totalPages) {
            loadPage(page + 1, 'more').catch(() => undefined);
          }
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : error ? (
            <Pressable onPress={() => loadPage(1)} style={styles.errorState}>
              <Text style={styles.errorTitle}>加载失败</Text>
              <Text style={styles.errorMessage}>{error}</Text>
              <Text style={styles.errorRetry}>点击重试</Text>
            </Pressable>
          ) : (
            <Text style={styles.empty}>暂无匹配数据</Text>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footerLoading} /> : null}
        showsVerticalScrollIndicator={false}
      />
        </>
      )}

      {tab !== 'merchant' && (activeFilter === 'sort' || activeFilter === 'category') ? (
        <View pointerEvents="box-none" style={styles.sortOverlay}>
          <Pressable
            style={[styles.sortOverlayMask, {top: sortOverlayTop}]}
            onPress={() => setActiveFilter(null)}
          />
          <View pointerEvents="auto" style={[styles.sortFloatingPanel, {top: sortOverlayTop}]}>
            {activeFilter === 'sort' ? (
              <SortDropdown
                sort={sort}
                onSelect={next => {
                  setSort(next);
                  setActiveFilter(null);
                }}
              />
            ) : (
              <CategoryDropdown
                category={category}
                onSelect={next => {
                  setCategory(next);
                  setFilters({});
                  setSuggestions([]);
                  setActiveFilter(null);
                }}
              />
            )}
          </View>
        </View>
      ) : null}

      <FilterPanelSheet
        visible={tab !== 'merchant' && activeFilter === 'region'}
        topOffset={filterPanelTop}
        title="地区"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setFilters(prev => ({...prev, region: null}));
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={filterOptions.regions ?? []}
          selected={new Set(filters.region ? [filters.region] : [])}
          onToggle={value => setFilters(prev => ({...prev, region: prev.region === value ? null : value}))}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={tab !== 'merchant' && activeFilter === 'priceRange'}
        topOffset={filterPanelTop}
        title="价格区间"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setPriceMinInput('');
          setPriceMaxInput('');
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <View style={styles.priceRangeRow}>
          <View style={styles.priceField}>
            <Text style={styles.priceFieldLabel}>最低价</Text>
            <TextInput
              value={priceMinInput}
              onChangeText={value => setPriceMinInput(sanitizePriceInput(value))}
              keyboardType="decimal-pad"
              placeholder="例如 32"
              placeholderTextColor="#9DA4A3"
              style={styles.priceInput}
            />
          </View>
          <Text style={styles.priceRangeSeparator}>-</Text>
          <View style={styles.priceField}>
            <Text style={styles.priceFieldLabel}>最高价</Text>
            <TextInput
              value={priceMaxInput}
              onChangeText={value => setPriceMaxInput(sanitizePriceInput(value))}
              keyboardType="decimal-pad"
              placeholder="例如 45"
              placeholderTextColor="#9DA4A3"
              style={styles.priceInput}
            />
          </View>
        </View>
        <Text style={styles.priceUnitHint}>单位：元/kg</Text>
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={tab !== 'merchant' && activeFilter === 'goodsType'}
        topOffset={filterPanelTop}
        title="货物类型"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setFilters(prev => ({...prev, goodsType: null}));
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={(filterOptions.goodsTypes?.length ? filterOptions.goodsTypes : ['现货', '半期货', '期货']) ?? []}
          selected={new Set(filters.goodsType ? [filters.goodsType] : [])}
          onToggle={value => setFilters(prev => ({...prev, goodsType: prev.goodsType === value ? null : value}))}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={tab !== 'merchant' && activeFilter === 'feedingMethod'}
        topOffset={filterPanelTop}
        title="饲养方式"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setFilters(prev => ({...prev, feedingType: null}));
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={(filterOptions.feedingTypes?.length ? filterOptions.feedingTypes : ['草饲', '谷饲']) ?? []}
          selected={new Set(filters.feedingType ? [filters.feedingType] : [])}
          onToggle={value => setFilters(prev => ({...prev, feedingType: prev.feedingType === value ? null : value}))}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={tab !== 'merchant' && activeFilter === 'tag'}
        topOffset={filterPanelTop}
        title="标签"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setFilters(prev => ({...prev, tag: null}));
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={filterOptions.tags ?? []}
          selected={new Set(filters.tag ? [filters.tag] : [])}
          onToggle={value => setFilters(prev => ({...prev, tag: prev.tag === value ? null : value}))}
        />
      </FilterPanelSheet>

      <OriginalTextSheet
        visible={originalText !== null}
        text={originalText?.text ?? ''}
        keywords={originalText?.keywords ?? []}
        onClose={() => setOriginalText(null)}
      />
    </View>
  );
}

function HeaderTab({text, active, onPress}: {text: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.headerTab}>
      <Text style={[styles.headerTabText, active && styles.headerTabTextActive]}>{text}</Text>
      <View style={[styles.headerTabLine, active && styles.headerTabLineActive]} />
    </Pressable>
  );
}

function SortDropdown({sort, onSelect}: {sort: SortMode; onSelect: (next: SortMode) => void}) {
  return (
    <View style={styles.sortDropdown}>
      {sortOptions.map(option => {
        const active = isSameSort(sort, option.value);
        return (
          <Pressable key={option.label} style={styles.sortOption} onPress={() => onSelect(option.value)}>
            <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CategoryDropdown({category, onSelect}: {category: string; onSelect: (next: string) => void}) {
  return (
    <View style={styles.sortDropdown}>
      {categoryOptions.map(option => {
        const active = category === option;
        return (
          <Pressable key={option} style={styles.sortOption} onPress={() => onSelect(option)}>
            <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterChip({
  text,
  active,
  rightSlot,
  onPress,
}: {
  text: string;
  active?: boolean;
  rightSlot?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
        {text}
      </Text>
      {rightSlot ? <View style={styles.chipIcon}>{rightSlot}</View> : null}
    </Pressable>
  );
}

function QuickChip({
  text,
  active,
  rightSlot,
  onPress,
}: {
  text: string;
  active?: boolean;
  rightSlot?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.quickChip, active && styles.quickChipActive]}>
      <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{text}</Text>
      {rightSlot ? <View style={styles.chipIcon}>{rightSlot}</View> : null}
    </Pressable>
  );
}

export function OfferFeedCard({
  item,
  tab,
  onMerchantPress,
  onViewOriginalText,
  isIntentAdded = false,
  onAddIntent,
  onContact,
}: {
  item: OfferFeedItem;
  tab: OfferTab;
  onMerchantPress: () => void;
  onViewOriginalText: (payload: OriginalTextPayload) => void;
  isIntentAdded?: boolean;
  onAddIntent?: () => void;
  onContact?: (action: ContactAction) => void;
}) {
  const title = buildTitle(item, tab);
  const price = formatPrice(item.price, item.priceMax);
  const time = formatCardTime(item.publishTime);
  const merchantName = item.merchantShortName || item.merchantName || '';
  const hasMerchantName = Boolean(merchantName.trim()) && merchantName.trim() !== '未知商家';
  const publisherName = item.userNickname || '未知发布人';
  const phone = item.contactPhone?.trim() ?? '';
  const detailParts = buildDetailParts(item);
  const isInquiry = tab === 'inquiry';
  const showPriceInDetailRow = isInquiry && Boolean(price.amount);
  const priceText = price.amount ?? (isInquiry ? null : '协商报价');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, isInquiry ? styles.typeBadgeInquiry : styles.typeBadgeOffer]}>
          <Text style={[styles.typeBadgeText, isInquiry ? styles.typeBadgeTextInquiry : styles.typeBadgeTextOffer]}>
            {isInquiry ? '求购' : '报盘'}
          </Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.cardTime}>{time}</Text>
      </View>

      <View style={styles.detailRow}>
        {showPriceInDetailRow ? (
          <View style={styles.detailPriceChip}>
            <Text style={styles.detailPriceText} numberOfLines={1}>
              {price.amount}
              {price.unit}
            </Text>
          </View>
        ) : null}
        {detailParts.map(part => (
          <DetailChip key={`${part.kind}-${part.text}`} part={part} />
        ))}
      </View>

      <View style={styles.publisherPriceRow}>
        <Pressable disabled={!hasMerchantName} onPress={onMerchantPress} style={[styles.publisherRow, isInquiry && styles.publisherRowInquiry]}>
          <View style={styles.publisherTextWrap}>
            {hasMerchantName ? (
              <>
                <CompanyIcon />
                <Text style={[styles.merchantText, isInquiry && styles.merchantInquiryText]} numberOfLines={1}>{merchantName}</Text>
                {item.merchantId != null ? <MerchantChevronIcon /> : null}
                <Text style={styles.publisherDivider}>|</Text>
              </>
            ) : null}
            <PersonIcon />
            <Text
              style={[
                styles.publisherNameText,
                !hasMerchantName && styles.publisherNameOnlyText,
                isInquiry && styles.publisherNameInquiryText,
              ]}
              numberOfLines={1}>
              {publisherName}
            </Text>
          </View>
        </Pressable>
        {!isInquiry && priceText ? (
          <View style={styles.priceLine}>
            <Text style={[styles.priceValue, !price.amount && styles.negotiateText]} numberOfLines={1}>
              {priceText}
            </Text>
            {price.unit ? <Text style={styles.priceUnit}>{price.unit}</Text> : null}
          </View>
        ) : null}
      </View>

      {hasRealName(item.merchantTags) || hasVerified(item.merchantTags) ? (
        <View style={styles.certTags}>
          {hasRealName(item.merchantTags) ? <Text style={styles.certTag}>牧集实名</Text> : null}
          {hasVerified(item.merchantTags) ? <Text style={styles.certTag}>商家认证</Text> : null}
        </View>
      ) : null}

      <View style={styles.actionDivider} />
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() =>
            onViewOriginalText(
              buildOriginalTextPayload({
                text: item.offerOriginalText,
                intent: isInquiry ? 'inquiry' : 'offer',
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
              }),
            )
          }>
          <BookIcon />
          <Text style={styles.actionText}>查看原文</Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable
          style={styles.actionButton}
          onPress={onAddIntent}>
          <IntentActionIcon selected={isIntentAdded} />
          <Text style={[styles.actionText, isIntentAdded && styles.actionTextPrimary]}>
            {isIntentAdded ? '已加意向' : '加意向'}
          </Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            onContact?.('wechat');
            copyToClipboard(phone, '已复制手机号').catch(() => undefined);
          }}>
          <AddSquareIcon />
          <Text style={styles.actionText}>添加微信</Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable
          style={styles.actionButton}
          onPress={() => {
            onContact?.('phone');
            dialPhone(phone);
          }}>
          <PhoneIcon />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>拨打电话</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MerchantSearchResultCard({
  item,
  category,
  onPress,
}: {
  item: MerchantSearchResult;
  category: string;
  onPress: () => void;
}) {
  const displayName = item.merchantShortName || item.merchantName || '未知商家';
  const card = {
    cardType: 'merchant',
    merchantId: item.merchantId,
    merchantName: item.merchantName,
    merchantShortName: item.merchantShortName,
  };
  const payload = {
    searchWord: displayName,
    searchType: '商家',
    merchantId: toHistoryMerchantId(item.merchantId),
  };

  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.merchantResultCard, pressed && styles.merchantResultPressed]}>
      <View style={styles.merchantResultHeader}>
        <View style={styles.merchantResultTitleWrap}>
          <View style={styles.merchantResultIcon}>
            <SvgXml xml={merchantBuildingXml} width={22} height={21} />
          </View>
          <Text style={styles.merchantResultName} numberOfLines={1}>{displayName}</Text>
        </View>
        <SelfSelectButton category={category} card={card} payload={payload} />
      </View>

      <Text style={styles.merchantResultMeta} numberOfLines={1}>
        报盘 {item.offerCount}  求购 {item.inquiryCount}
      </Text>

      {item.samples.length > 0 ? (
        <View style={styles.merchantSampleList}>
          {item.samples.slice(0, 3).map((sample, index) => (
            <View key={`${sample.type}-${sample.category}-${sample.productName}-${sample.country}-${sample.factoryNo}-${index}`} style={styles.merchantSampleCard}>
              <View style={styles.merchantSampleTopLine}>
                <View style={[styles.merchantSampleBadge, sample.type === 'inquiry' && styles.merchantSampleBadgeInquiry]}>
                  <Text style={[styles.merchantSampleBadgeText, sample.type === 'inquiry' && styles.merchantSampleBadgeTextInquiry]}>
                    {sample.type === 'offer' ? '报盘' : '求购'}
                  </Text>
                </View>
                <Text style={styles.merchantSampleProduct} numberOfLines={1}>
                  {sample.productName?.trim() || '未知产品'}
                </Text>
              </View>
              <Text style={styles.merchantSampleFactory} numberOfLines={1}>
                {buildMerchantSampleFactoryText(sample)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.merchantResultFooter}>
        <Text style={styles.merchantResultMore}>查看</Text>
        <Text style={styles.merchantResultArrow}>›</Text>
      </View>
    </Pressable>
  );
}

function buildMerchantSampleFactoryText(sample: {country?: string | null; factoryNo?: string | null}) {
  const country = sample.country?.trim();
  const factoryNo = sample.factoryNo?.trim();
  if (country && factoryNo) return `${country}${factoryNo}`;
  return country || factoryNo || '国家厂号不限';
}

function DetailChip({part}: {part: DetailPart}) {
  return (
    <View
      style={[
        styles.detailChip,
        part.kind === 'tag' && styles.detailChipTag,
        part.kind === 'location' && styles.detailChipLocation,
        part.kind === 'goods' && styles.detailChipGoods,
        part.kind === 'feeding' && styles.detailChipFeeding,
        part.kind === 'fat' && styles.detailChipFat,
        part.kind === 'breed' && styles.detailChipBreed,
        part.kind === 'weight' && styles.detailChipWeight,
        part.kind === 'remark' && styles.detailChipRemark,
      ]}>
      <Text
        style={[
          styles.detailChipText,
          part.kind === 'tag' && styles.detailChipTextTag,
          part.kind === 'location' && styles.detailChipTextLocation,
          part.kind === 'goods' && styles.detailChipTextGoods,
          part.kind === 'feeding' && styles.detailChipTextFeeding,
          part.kind === 'fat' && styles.detailChipTextFat,
          part.kind === 'breed' && styles.detailChipTextBreed,
          part.kind === 'weight' && styles.detailChipTextWeight,
          part.kind === 'remark' && styles.detailChipTextRemark,
        ]}
        numberOfLines={1}>
        {part.text}
      </Text>
    </View>
  );
}

function OfferSuggestItem({
  item,
  keyword,
  onPress,
}: {
  item: SearchSuggest;
  keyword: string;
  onPress: () => void;
}) {
  const {main, alias} = parseSuggestionText(item.text);
  return (
    <Pressable onPress={onPress} style={styles.suggestionRow}>
      <View style={styles.suggestionMain}>
        <SearchIcon />
        <View style={styles.suggestionTextWrap}>
          <Text style={styles.suggestionPrimary} numberOfLines={1}>
            {renderHighlight(main, keyword)}
          </Text>
          {alias ? <Text style={styles.suggestionAlias} numberOfLines={1}>(别名：{alias})</Text> : null}
        </View>
      </View>
      <Text style={styles.suggestionType}>{item.type}</Text>
    </Pressable>
  );
}

function FilterSheet({
  visible,
  title,
  options,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string | null;
  onClose: () => void;
  onSelect: (value: string | null) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.sheetClose}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetOptions}>
            <Pressable onPress={() => onSelect(null)} style={[styles.sheetOption, selected == null && styles.sheetOptionActive]}>
              <Text style={[styles.sheetOptionText, selected == null && styles.sheetOptionTextActive]}>全部</Text>
            </Pressable>
            {options.map(option => (
              <Pressable
                key={option}
                onPress={() => onSelect(option)}
                style={[styles.sheetOption, selected === option && styles.sheetOptionActive]}>
                <Text style={[styles.sheetOptionText, selected === option && styles.sheetOptionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function buildTitle(item: OfferFeedItem, tab: OfferTab) {
  const product = item.productName?.trim() || '未知产品';
  const country = item.country?.trim() || '';
  const factoryNo = item.factoryNo?.trim() || '';

  if (tab === 'inquiry') {
    if (country && factoryNo) return `${product} ${country}${factoryNo}`;
    if (country) return `${product} ${country}厂号不限`;
    if (factoryNo) return `${product} 国家不限${factoryNo}`;
    return `${product} 国家厂号不限`;
  }

  const countryFactory = `${country}${factoryNo}`.trim();
  return countryFactory ? `${product} ${countryFactory}` : product;
}

function sortToParam(sort: SortMode): string {
  if (sort.kind === 'comprehensive') return 'comprehensive';
  if (sort.kind === 'publishTime') return 'publish_time';
  return sort.order === 'asc' ? 'price_asc' : sort.order === 'desc' ? 'price_desc' : 'comprehensive';
}

function getSortLabel(sort: SortMode) {
  if (sort.kind === 'publishTime') return '最新发布';
  if (sort.kind === 'price') return sort.order === 'desc' ? '价格降序' : '价格升序';
  return '综合排序';
}

function getPriceRangeFilterLabel(minInput: string, maxInput: string) {
  const min = minInput.trim();
  const max = maxInput.trim();
  if (min && max) return `${min}-${max}`;
  if (min) return `≥${min}`;
  if (max) return `≤${max}`;
  return '价格区间';
}

function isSameSort(left: SortMode, right: SortMode) {
  if (left.kind !== right.kind) return false;
  if (left.kind !== 'price' || right.kind !== 'price') return true;
  return left.order === right.order;
}

function sanitizePriceInput(value: string) {
  return value.replace(/[^\d.]/g, '');
}

function parsePriceInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function offerMatchesPriceRange(item: OfferFeedItem, minPrice: number | null, maxPrice: number | null) {
  const min = typeof item.price === 'number' && Number.isFinite(item.price) && item.price > 0 ? item.price : null;
  const max =
    typeof item.priceMax === 'number' && Number.isFinite(item.priceMax) && item.priceMax > 0
      ? item.priceMax
      : min;
  const low = min ?? max;
  const high = max ?? min;

  if (minPrice != null && (high == null || high < minPrice)) return false;
  if (maxPrice != null && (low == null || low > maxPrice)) return false;
  return true;
}

export function offerMatchesKeyword(
  item: OfferFeedItem,
  keyword: string,
  options: {productOnly?: boolean} = {},
) {
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) return true;

  const haystack = options.productOnly ? buildOfferProductKeywordHaystack(item) : buildOfferKeywordHaystack(item);
  if (haystack.includes(normalizedKeyword)) return true;

  const tokens = splitSearchTokens(keyword);
  return tokens.length > 0 && tokens.every(token => haystack.includes(token));
}

function buildOfferProductKeywordHaystack(item: OfferFeedItem) {
  return normalizeKeyword([item.productName].filter(Boolean).join(' '));
}

function buildOfferKeywordHaystack(item: OfferFeedItem) {
  const values = [
    item.productName,
    item.country,
    item.factoryNo,
    `${item.country ?? ''}${item.factoryNo ?? ''}`,
    item.merchantName,
    item.merchantShortName,
    item.merchantTags,
    item.contactPhone,
    item.userNickname,
    item.category,
    item.offerType,
    item.goodsType,
    item.goodsLocation,
    item.region,
    item.tags,
    item.fatRatio,
    item.feedingType,
    item.cattleBreed,
    item.remark,
    item.offerOriginalText,
  ];

  return normalizeKeyword(values.filter(Boolean).join(' '));
}

function splitSearchTokens(keyword: string) {
  return keyword
    .split(/[\s,;|/\\\u3001\uFF0C\uFF1B]+/)
    .map(normalizeKeyword)
    .filter(Boolean);
}

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/\s+/g, '');
}

function formatPrice(price?: number | null, priceMax?: number | null): {amount: string | null; unit: string | null} {
  const min = typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
  const max = typeof priceMax === 'number' && Number.isFinite(priceMax) && priceMax > 0 ? priceMax : null;
  if (min != null && max != null && min !== max) {
    return {amount: `¥${formatNumber(min)}-${formatNumber(max)}`, unit: '/kg'};
  }
  if (min != null) {
    return {amount: `¥${formatNumber(min)}`, unit: '/kg'};
  }
  return {amount: null, unit: null};
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function formatWeight(weight?: string | null): {value: string; unit: string} | null {
  const [value, unit] = parseWeight(weight);
  if (!value) return null;
  return {value, unit: unit || '吨'};
}

function formatCardTime(time?: string | null) {
  if (!time) return '';
  const match = time.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return time;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (Number.isNaN(date.getTime())) return `${hour}:${minute}`;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((todayStart - dateStart) / 86400000);

  if (dayDiff === 0) return `${hour}:${minute}`;
  if (dayDiff === 1) return `昨天 ${hour}:${minute}`;
  if (date.getFullYear() === today.getFullYear()) return `${month}-${day} ${hour}:${minute}`;
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function splitTags(tags?: string | null) {
  if (!tags) return [];
  return tags.split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
}

function parseSuggestionText(text: string): {main: string; alias: string | null} {
  const aliasMarker = '(别名：';
  const index = text.indexOf(aliasMarker);
  if (index >= 0 && text.endsWith(')')) {
    return {
      main: text.slice(0, index).trim(),
      alias: text.slice(index + aliasMarker.length, -1).trim(),
    };
  }
  return {main: text, alias: null};
}

function mergeSearchSuggestions(groups: SearchSuggest[][]): SearchSuggest[] {
  const result = new Map<string, SearchSuggest>();
  groups.flat().forEach(item => {
    const key = [
      item.matchType,
      item.targetId,
      item.text,
      item.country ?? '',
      item.factoryNo ?? '',
      item.productName ?? '',
      item.brandName ?? '',
      item.merchantName ?? '',
    ].join('|');
    const current = result.get(key);
    if (!current || item.priority < current.priority) {
      result.set(key, item);
    }
  });
  return Array.from(result.values()).sort((left, right) => left.priority - right.priority);
}

function getStandardSuggestionText(text: string): string {
  return parseSuggestionText(text).main;
}

type OfferSearchQuery = {
  display: string;
  keyword: string;
  country: string | null;
  factoryNo: string | null;
  productOnly?: boolean;
};

function buildOfferSuggestionQuery(item: SearchSuggest): OfferSearchQuery {
  const display = getStandardSuggestionText(item.text);
  const parsed = parseOfferSearchText(display);
  const country = normalizeOptionalText(item.country) ?? parsed.country;
  const factoryNo = normalizeOptionalText(item.factoryNo) ?? parsed.factoryNo;
  const productName = normalizeOptionalText(item.productName) ?? extractSuggestionProduct(display, country, factoryNo);

  return {
    display,
    keyword: productName || parsed.keyword,
    country,
    factoryNo,
    productOnly: Boolean(productName),
  };
}

export function parseOfferSearchText(text: string): OfferSearchQuery {
  const display = getStandardSuggestionText(text).trim();
  if (!display) {
    return {display: '', keyword: '', country: null, factoryNo: null, productOnly: false};
  }

  const parts = display.split(/\s+/).filter(Boolean);
  const compoundIndex = parts.findIndex(part => splitCountryFactoryPart(part) !== null);
  if (compoundIndex >= 0) {
    const compound = splitCountryFactoryPart(parts[compoundIndex]);
    const before = parts.slice(0, compoundIndex).join(' ').trim();
    const after = parts.slice(compoundIndex + 1).join(' ').trim();
    return {
      display,
      keyword: [before, after].filter(Boolean).join(' ').trim(),
      country: compound?.country ?? null,
      factoryNo: compound?.factoryNo ?? null,
      productOnly: Boolean(before || after),
    };
  }

  const factoryIndex = parts.findIndex(part => looksLikeFactoryNo(part));
  if (factoryIndex >= 0) {
    const country = parts.slice(0, factoryIndex).join('').trim();
    const keyword = parts.slice(factoryIndex + 1).join(' ').trim();
    return {
      display,
      keyword,
      country: country || null,
      factoryNo: parts[factoryIndex],
      productOnly: Boolean(keyword),
    };
  }

  return {display, keyword: display, country: null, factoryNo: null, productOnly: false};
}

function extractSuggestionProduct(display: string, country: string | null, factoryNo: string | null) {
  let value = display.trim();
  if (country && value.startsWith(country)) {
    value = value.slice(country.length).trim();
  }
  if (factoryNo) {
    value = value.replace(new RegExp(escapeRegExp(factoryNo), 'i'), '').trim();
  }
  return value || null;
}

function splitCountryFactoryPart(text: string): {country: string; factoryNo: string} | null {
  const match = text.match(/^([\u4e00-\u9fa5]+)([A-Za-z]*\d[\w-]*)$/);
  if (!match) return null;
  return {country: match[1], factoryNo: match[2]};
}

function looksLikeFactoryNo(text: string) {
  return /^(?:[A-Za-z]{1,8})?\d[\w-]*$/i.test(text);
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlight(text: string, keyword: string): React.ReactNode[] {
  const trimmed = keyword.trim();
  if (!trimmed) return [text];

  const lowerText = text.toLowerCase();
  const lowerKeyword = trimmed.toLowerCase();
  const result: React.ReactNode[] = [];
  let cursor = 0;
  let index = lowerText.indexOf(lowerKeyword, cursor);

  while (index >= 0) {
    if (index > cursor) result.push(text.slice(cursor, index));
    result.push(
      <Text key={`hi-${index}`} style={styles.highlight}>
        {text.slice(index, index + trimmed.length)}
      </Text>,
    );
    cursor = index + trimmed.length;
    index = lowerText.indexOf(lowerKeyword, cursor);
  }

  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

function buildDetailParts(item: OfferFeedItem): DetailPart[] {
  const weight = formatWeight(item.weight);
  const parts: Array<DetailPart | null> = [
    ...splitTags(item.tags).slice(0, 3).map(text => ({text, kind: 'tag' as const})),
    item.goodsLocation ? {text: formatGoodsLocation(item.goodsLocation), kind: 'location'} : null,
    item.goodsType ? {text: item.goodsType, kind: 'goods'} : null,
    item.feedingType ? {text: item.feedingType, kind: 'feeding'} : null,
    item.fatRatio ? {text: item.fatRatio, kind: 'fat'} : null,
    item.cattleBreed ? {text: item.cattleBreed, kind: 'breed'} : null,
    weight ? {text: `${weight.value}${weight.unit}`, kind: 'weight'} : null,
    item.remark ? {text: item.remark, kind: 'remark'} : null,
  ];
  const seen = new Set<string>();
  return parts.filter((part): part is DetailPart => {
    if (!part) return false;
    const key = `${part.kind}-${part.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasRealName(tags?: string | null) {
  return Boolean(tags?.includes('实名'));
}

function hasVerified(tags?: string | null) {
  return Boolean(tags?.includes('认证') || tags?.includes('实名'));
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke="#171D1C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke="#9DA4A3" strokeWidth={1.8} />
      <Path d="M20 20L16.2 16.2" stroke="#9DA4A3" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M3 4.5L6 7.5L9 4.5" stroke="#6C7A77" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChevronRightIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M4.5 3L7.5 6L4.5 9" stroke="#6C7A77" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MerchantChevronIcon() {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
      <Path d="M3.75 2.5L6.25 5L3.75 7.5" stroke="#6C7A77" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FilterIcon({size = 16, color = '#6C7A77'}: {size?: number; color?: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M2 4H14" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M4.5 8H11.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M6.5 12H9.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function BookIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.7V4.7c0-1.2-1-2.1-2.2-2C16.3 3 11.1 3.9 7.7 6c-.4.2-.7.7-.7 1.2v15.6c0 .8.8 1.4 1.6 1.2 3.5-2 8.5-2.8 11.7-3.1 1-.1 1.7-1 1.7-2v-2.2"
        stroke="#3C4947"
        strokeWidth={1.5}
      />
      <Path d="M2 18.5V5C2 3.4 3.3 2.7 4.8 3.4 6.5 4.2 9.7 5.5 11.5 6.4" stroke="#3C4947" strokeWidth={1.5} />
    </Svg>
  );
}

function AddSquareIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 22h6c5 0 7-2 7-7V9c0-5-2-7-7-7H9C4 2 2 4 2 9v6c0 5 2 7 7 7Z" stroke="#3C4947" strokeWidth={1.5} />
      <Path d="M8 12h8M12 16V8" stroke="#3C4947" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function IntentActionIcon({selected = false}: {selected?: boolean}) {
  const color = selected ? colors.primary : '#3C4947';
  return (
    <Svg width={15} height={15} viewBox="0 0 18 18" fill="none">
      <Path
        d="M5.45 2.25H12.55C13.65 2.25 14.5 3.13 14.5 4.23V15C14.5 15.62 13.84 16.02 13.3 15.73L9.42 13.62C9.16 13.48 8.84 13.48 8.58 13.62L4.7 15.73C4.16 16.02 3.5 15.62 3.5 15V4.23C3.5 3.13 4.35 2.25 5.45 2.25Z"
        fill={selected ? colors.primary : 'none'}
        stroke={color}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      {selected ? null : (
        <Path d="M9 5.8V10.2M6.8 8H11.2" stroke={color} strokeWidth={1.35} strokeLinecap="round" />
      )}
    </Svg>
  );
}

function PhoneIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"
        stroke={colors.primary}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function CompanyIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
      <Path
        d="M2.75 14V4.1c0-.6.4-1.1 1-1.25l4.05-1c.75-.2 1.45.38 1.45 1.15V14"
        stroke="#477782"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.25 5.35h2.9c.6 0 1.1.5 1.1 1.1V14M1.75 14h12.5"
        stroke="#477782"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 5.15h2M5 7.5h2M5 9.85h2" stroke="#477782" strokeWidth={1.15} strokeLinecap="round" />
    </Svg>
  );
}

function PersonIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={4.75} r={2.55} stroke="#6C7A77" strokeWidth={1.25} />
      <Path
        d="M3.35 13.55c.28-2.35 2.2-4.1 4.65-4.1s4.37 1.75 4.65 4.1"
        stroke="#6C7A77"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F7F6'},
  safeTop: {backgroundColor: '#FFFFFF'},
  header: {
    height: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  backButton: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  clearButton: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  headerTitleWrap: {alignItems: 'center', justifyContent: 'center', paddingTop: 6},
  headerTitle: {color: colors.primary, fontSize: 17, lineHeight: 24, fontWeight: '700'},
  headerTitleLine: {marginTop: 2, width: 18, height: 3, borderRadius: 3, backgroundColor: colors.primary},
  headerTabs: {flexDirection: 'row', alignItems: 'center', gap: 34},
  headerTab: {alignItems: 'center', justifyContent: 'center', paddingTop: 6},
  headerTabText: {fontSize: 22, lineHeight: 28, color: colors.text, fontWeight: '400'},
  headerTabTextActive: {color: '#00A99A', fontWeight: '700'},
  headerTabLine: {marginTop: 2, width: 28, height: 3, borderRadius: 3, backgroundColor: 'transparent'},
  headerTabLineActive: {backgroundColor: '#00A99A'},
  searchArea: {backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingBottom: 10, zIndex: 40, elevation: 40},
  searchBox: {
    height: 42,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#00A99A',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0},
  clearSearch: {fontSize: 22, color: '#9DA4A3', lineHeight: 22},
  suggestionPanel: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6ECEA',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
    zIndex: 45,
  },
  suggestionOverlayMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 25,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  suggestionRow: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFF5F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  suggestionMain: {flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8},
  suggestionTextWrap: {flex: 1, minWidth: 0},
  suggestionPrimary: {color: colors.text, fontSize: 14, lineHeight: 20},
  suggestionAlias: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  suggestionType: {color: colors.textSecondary, fontSize: 12, lineHeight: 16, flexShrink: 0},
  suggestionEmpty: {paddingVertical: 14, textAlign: 'center', color: colors.textMuted, fontSize: 12},
  highlight: {color: colors.primary, fontWeight: '700'},
  filterBlock: {backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.border},
  sortOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    elevation: 30,
  },
  sortOverlayMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  sortFloatingPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  sortDropdown: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF3F1',
  },
  sortOption: {
    height: 44,
    justifyContent: 'center',
  },
  sortOptionText: {
    color: '#3C4947',
    fontSize: 15,
    lineHeight: 20,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  filterRow: {paddingHorizontal: 12, paddingBottom: 8, gap: 8, alignItems: 'center'},
  quickRow: {paddingHorizontal: 12, paddingBottom: 12, gap: 8, alignItems: 'center'},
  filterChip: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#F4F6F5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 130,
  },
  filterChipActive: {backgroundColor: '#E8F5F3'},
  filterChipText: {fontSize: 13, color: colors.textSecondary, lineHeight: 18},
  filterChipTextActive: {color: colors.primary, fontWeight: '600'},
  quickChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#F4F6F5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickChipActive: {backgroundColor: '#E8F5F3'},
  quickChipText: {fontSize: 13, color: colors.textSecondary},
  quickChipTextActive: {color: colors.primary, fontWeight: '600'},
  chipIcon: {width: 12, height: 12, alignItems: 'center', justifyContent: 'center'},
  countRow: {
    minHeight: 34,
    paddingHorizontal: 12,
    backgroundColor: '#F4F7F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {fontSize: 12, color: colors.textMuted},
  countNumber: {fontFamily: fonts.manropeBold, color: colors.primary},
  keywordText: {fontSize: 12, color: colors.textMuted, maxWidth: 180},
  merchantResultList: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 28,
  },
  merchantResultCard: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE9E6',
  },
  merchantResultPressed: {
    opacity: 0.86,
  },
  merchantResultHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  merchantResultTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  merchantResultIcon: {
    width: 22,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantResultName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  merchantResultMeta: {
    marginTop: 4,
    marginLeft: 28,
    color: '#6C7A77',
    fontSize: 11,
    lineHeight: 16,
  },
  merchantSampleList: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  merchantSampleCard: {
    width: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 44,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 3,
    backgroundColor: '#FCFEFD',
    borderWidth: 1,
    borderColor: '#E3ECE9',
  },
  merchantSampleTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  merchantSampleBadge: {
    minWidth: 24,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: '#EAF9F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantSampleBadgeInquiry: {
    backgroundColor: '#EEF4FF',
  },
  merchantSampleBadgeText: {
    color: colors.primary,
    fontSize: 8,
    lineHeight: 11,
  },
  merchantSampleBadgeTextInquiry: {
    color: '#3767D6',
  },
  merchantSampleProduct: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 11,
    lineHeight: 16,
  },
  merchantSampleFactory: {
    marginTop: 2,
    color: '#3C4947',
    fontSize: 11,
    lineHeight: 16,
  },
  merchantResultFooter: {
    marginTop: 6,
    minHeight: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
  },
  merchantResultMore: {
    color: colors.primary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  merchantResultArrow: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 16,
  },
  listContent: {paddingHorizontal: 8, paddingBottom: 28},
  loading: {marginTop: 40},
  footerLoading: {paddingVertical: 16},
  empty: {marginTop: 48, textAlign: 'center', color: '#9DA4A3', fontSize: 14},
  errorState: {marginTop: 48, paddingHorizontal: 24, alignItems: 'center'},
  errorTitle: {color: colors.text, fontSize: 15, fontWeight: '700'},
  errorMessage: {marginTop: 6, color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center'},
  errorRetry: {marginTop: 10, color: colors.primary, fontSize: 13, fontWeight: '600'},
  card: {
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  typeBadge: {
    minWidth: 38,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeOffer: {backgroundColor: '#EAF9F7', borderColor: '#BDE9E4'},
  typeBadgeInquiry: {backgroundColor: '#EEF4FF', borderColor: '#C8D8FF'},
  typeBadgeText: {fontSize: 13, lineHeight: 18, fontWeight: '400'},
  typeBadgeTextOffer: {color: colors.primary},
  typeBadgeTextInquiry: {color: '#3767D6'},
  cardTitle: {flex: 1, color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '500'},
  cardTime: {color: colors.textMuted, fontSize: 14, lineHeight: 20, flexShrink: 0},
  detailRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  detailChip: {
    maxWidth: 220,
    minHeight: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailChipTag: {backgroundColor: '#FFF2E8'},
  detailChipLocation: {backgroundColor: '#F4F6F5'},
  detailChipGoods: {backgroundColor: '#EEF4FF'},
  detailChipFeeding: {backgroundColor: '#EEF8F2'},
  detailChipFat: {backgroundColor: '#FFF2E8'},
  detailChipBreed: {backgroundColor: '#F7EEFF'},
  detailChipWeight: {backgroundColor: '#F6F2FF'},
  detailChipRemark: {backgroundColor: '#FFF1F0', maxWidth: 260},
  detailChipText: {fontSize: 13, lineHeight: 18},
  detailChipTextTag: {color: '#D86B17', fontWeight: '600'},
  detailChipTextLocation: {color: colors.textSecondary},
  detailChipTextGoods: {color: '#3767D6'},
  detailChipTextFeeding: {color: '#1F8A55'},
  detailChipTextFat: {color: '#C96A1A'},
  detailChipTextBreed: {color: '#7A47B8'},
  detailChipTextWeight: {color: '#7A47B8'},
  detailChipTextRemark: {color: '#D54941'},
  detailPriceChip: {
    maxWidth: 110,
    minHeight: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: '#FFF1F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailPriceText: {fontFamily: fonts.manropeSemiBold, color: colors.price, fontSize: 13, lineHeight: 18},
  publisherPriceRow: {
    marginTop: 9,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  publisherRow: {
    width: '76%',
    maxWidth: '76%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  publisherRowInquiry: {
    width: '100%',
    maxWidth: '100%',
  },
  publisherTextWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  merchantText: {flex: 1.15, minWidth: 0, color: colors.textMuted, fontSize: 14, lineHeight: 20},
  publisherDivider: {width: 10, textAlign: 'center', color: '#D4DAD8', fontSize: 14, lineHeight: 20},
  publisherNameText: {flex: 1.05, minWidth: 0, color: colors.textMuted, fontSize: 14, lineHeight: 20},
  merchantInquiryText: {
    flex: 0,
    flexShrink: 1,
    maxWidth: '52%',
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  publisherNameInquiryText: {
    flex: 0,
    flexShrink: 1,
    maxWidth: '42%',
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  publisherNameOnlyText: {flex: 1.8},
  certTags: {marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5},
  certTag: {
    borderWidth: 1,
    borderColor: '#D7B978',
    color: '#8B6118',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 3,
  },
  priceLine: {flexDirection: 'row', alignItems: 'baseline', flexShrink: 0, justifyContent: 'flex-end', maxWidth: '24%'},
  priceValue: {fontFamily: fonts.manropeSemiBold, color: colors.price, fontSize: 16, lineHeight: 20},
  priceUnit: {fontFamily: fonts.manropeRegular, color: colors.text, fontSize: 10, lineHeight: 20, marginLeft: 2},
  negotiateText: {fontFamily: fonts.manropeSemiBold, color: colors.primary, fontSize: 14, lineHeight: 18},
  actionDivider: {
    marginTop: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,106,97,0.12)',
  },
  actionRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
  },
  actionText: {color: '#3C4947', fontSize: 12, lineHeight: 17},
  actionTextPrimary: {color: colors.primary, fontWeight: '600'},
  actionVDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: 'rgba(60,73,71,0.26)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '68%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingBottom: 12,
  },
  sheetHeader: {
    height: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {fontSize: 17, color: colors.text, fontWeight: '700'},
  sheetClose: {fontSize: 24, color: colors.textMuted, lineHeight: 24},
  sheetOptions: {padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  sheetOption: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#F4F6F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionActive: {backgroundColor: '#E8F5F3'},
  sheetOptionText: {fontSize: 13, color: colors.textSecondary},
  sheetOptionTextActive: {color: colors.primary, fontWeight: '700'},
  sectionLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8},
  sectionLabelTop: {marginTop: 16},
  priceRangeRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 12},
  priceField: {flex: 1, gap: 8},
  priceFieldLabel: {color: colors.textMuted, fontSize: 12, fontWeight: '600'},
  priceInput: {
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  priceRangeSeparator: {color: colors.textMuted, fontSize: 16, paddingBottom: 12},
  priceUnitHint: {marginTop: 12, color: '#6C7A77', fontSize: 12},
});
