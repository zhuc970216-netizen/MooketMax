import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  SectionList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {mooketApi} from '../api/mooketApi';
import {CountryProductDashboard} from '../components/detail/CountryProductDashboard';
import {DetailTopBar} from '../components/detail/DetailTopBar';
import {SelfSelectButton} from '../components/detail/SelfSelectButton';
import {FilterBar, type FilterKey} from '../components/detail/FilterBar';
import {FilterPanelSheet, MultiSelectChips} from '../components/detail/FilterPanelSheet';
import {MerchantOfferGroupCard} from '../components/detail/MerchantOfferGroupCard';
import {OriginalTextSheet} from '../components/detail/OriginalTextSheet';
import {OfferInquiryTabs, type OfferTab, type SortMode} from '../components/detail/TabAndSortBar';
import {ErrorState} from '../components/common/ErrorState';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import type {CountryFactoryProductDetail, MerchantOfferGroup} from '../types/api';
import {extractCity, splitTags} from '../utils/offer';
import type {OriginalTextPayload} from '../utils/originalText';
import {loadMerchantSearchResults} from '../utils/merchantSearchResults';
import {getTabCount, getTabMerchantCount} from '../utils/tabStats';

type Props = NativeStackScreenProps<RootStackParamList, 'CountryFactoryProduct'>;

const pageSize = 20;
const unlinkedMerchantLabel = '暂未关联行业商家';
type LocalFilterKey = Exclude<FilterKey, 'countryFactory' | 'product' | 'famousMerchant'>;
type MerchantFilterOption = {key: string; label: string};

const sortOptions: Array<{label: string; value: SortMode}> = [
  {label: '综合排序', value: {kind: 'comprehensive'}},
  {label: '发布时间', value: {kind: 'publishTime'}},
  {label: '价格从低到高↑', value: {kind: 'price', order: 'asc'}},
  {label: '价格从高到低↓', value: {kind: 'price', order: 'desc'}},
];

function buildCFLabel(country?: string | null, factoryNo?: string | null): string {
  const c = country?.trim();
  const f = factoryNo?.trim();
  if (c && f) {
    return `${c}${f}`;
  }
  if (c && !f) {
    return `${c}厂号不限`;
  }
  if (!c && f) {
    return `国家不限${f}`;
  }
  return '国家厂号不限';
}

export function CountryFactoryProductScreen({navigation, route}: Props) {
  const {country, factoryNo, productName, category, searchKeyword: routeSearchKeyword, initialTab} = route.params;
  const searchKeyword = routeSearchKeyword ?? `${country}${factoryNo}${productName}`;
  const [data, setData] = useState<CountryFactoryProductDetail | null>(null);
  const [tab, setTab] = useState<OfferTab>(initialTab ?? 'offer');
  const [sort, setSort] = useState<SortMode>({kind: 'comprehensive'});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<OriginalTextPayload | null>(null);
  const handleViewOriginalText = useCallback((value: OriginalTextPayload) => setOriginalText(value), []);
  const [activeFilter, setActiveFilter] = useState<LocalFilterKey | null>(null);
  const [filterPanelTop, setFilterPanelTop] = useState(0);

  const [famousMerchant, setFamousMerchant] = useState(false);
  const [merchants, setMerchants] = useState<Set<string>>(new Set());
  const [merchantKeyword, setMerchantKeyword] = useState('');
  const [regions, setRegions] = useState<Set<string>>(new Set());
  const [goodsTypes, setGoodsTypes] = useState<Set<string>>(new Set());
  const [feedingMethods, setFeedingMethods] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [priceMinInput, setPriceMinInput] = useState('');
  const [priceMaxInput, setPriceMaxInput] = useState('');
  const requestSortParam = useMemo(
    () => sortToParam(sort),
    [sort],
  );
  const currentCountry = data?.country || country;
  const currentFactoryNo = data?.factoryNo || factoryNo;
  const currentProductName = data?.productName || productName;
  const handleTabChange = useCallback(
    (nextTab: OfferTab) => {
      if (nextTab === tab) return;
      setData(null);
      setPage(1);
      setError(null);
      setTab(nextTab);
    },
    [tab],
  );
  const openMerchantHome = useCallback(
    async (group: MerchantOfferGroup) => {
      const directMerchantId = normalizeMerchantTargetId(group.merchantId);
      if (directMerchantId) {
        navigation.navigate('Merchant', {
          merchantId: directMerchantId,
          category,
          initialTab: tab,
          initialCategory: 'all',
        });
        return;
      }

      const merchantName = group.merchantName?.trim();
      if (!merchantName || merchantName === unlinkedMerchantLabel) {
        Alert.alert('发布用户未关联商家', '该分组中的发布用户尚未解析出所属行业商家，所以没有可跳转的商家主页。');
        return;
      }

      try {
        const resolvedMerchantId = await resolveMerchantIdByName(category, merchantName);
        if (resolvedMerchantId) {
          navigation.navigate('Merchant', {
            merchantId: resolvedMerchantId,
            category,
            initialTab: tab,
            initialCategory: 'all',
          });
          return;
        }
      } catch {
        // Fall through to the explicit unlinked-state message below.
      }

      Alert.alert('暂未关联商家主页', '这个商家当前只有名称，尚未关联商家主页，暂时不能进入。');
    },
    [category, navigation, tab],
  );
  const selfSelectCard = currentCountry && currentFactoryNo && currentProductName
    ? {
        cardType: 'factoryProduct',
        country: currentCountry,
        factoryNo: currentFactoryNo,
        productName: currentProductName,
      }
    : null;
  const selfSelectPayload = currentCountry && currentFactoryNo && currentProductName
    ? {
        searchWord: `${currentCountry}${currentFactoryNo}${currentProductName}`,
        searchType: '\u56fd\u5bb6\u5382\u53f7\u4ea7\u54c1',
        country: currentCountry,
        factoryNo: currentFactoryNo,
        productName: currentProductName,
      }
    : null;

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(1);
      const next = await mooketApi.getCountryFactoryProductDetail(
        country,
        factoryNo,
        productName,
        category,
        tab,
        requestSortParam,
        1,
        pageSize,
      );
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [category, country, factoryNo, productName, requestSortParam, tab]);

  useEffect(() => {
    loadFirst().catch(() => undefined);
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !data) return;
    if (page >= (data.totalPages ?? 1)) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const more = await mooketApi.getCountryFactoryProductDetail(
        country,
        factoryNo,
        productName,
        category,
        tab,
        requestSortParam,
        next,
        pageSize,
      );
      setPage(next);
      setData(prev =>
        prev
          ? {
              ...more,
              merchantOffers: mergeMerchantOffers(prev.merchantOffers, more.merchantOffers),
            }
          : more,
      );
    } catch {
      // 静默
    } finally {
      setLoadingMore(false);
    }
  }, [category, country, data, factoryNo, loading, loadingMore, page, productName, requestSortParam, tab]);

  const filtered = useMemo(() => {
    const groups = data?.merchantOffers ?? [];
    const minPrice = parsePriceInput(priceMinInput);
    const maxPrice = parsePriceInput(priceMaxInput);
    const next = groups
      .filter(group => {
        if (famousMerchant && !group.isFamousMerchant) return false;
        if (merchants.size > 0) {
          const key = `${group.merchantId ?? group.merchantName ?? ''}`;
          if (!merchants.has(key)) return false;
        }
        return true;
      })
      .map(group => ({
        ...group,
        employeeOffers: (group.employeeOffers ?? []).filter(emp => {
          const price = parsePriceValue(emp.price);
          if (minPrice != null && (price == null || price < minPrice)) return false;
          if (maxPrice != null && (price == null || price > maxPrice)) return false;
          if (regions.size > 0) {
            const city = extractCity(emp.goodsLocation);
            if (!regions.has(city)) return false;
          }
          if (goodsTypes.size > 0) {
            if (!emp.goodsType || !goodsTypes.has(emp.goodsType)) return false;
          }
          if (feedingMethods.size > 0) {
            if (!emp.feedingType || !feedingMethods.has(emp.feedingType)) return false;
          }
          if (tags.size > 0) {
            const offerTags = splitTags(emp.tags, 8);
            const ok = offerTags.some(t => tags.has(t));
            if (!ok) return false;
          }
          return true;
        }),
      }))
      .filter(group => group.employeeOffers.length > 0);

    return next;
  }, [
    data?.merchantOffers,
    famousMerchant,
    feedingMethods,
    goodsTypes,
    merchants,
    priceMaxInput,
    priceMinInput,
    regions,
    tags,
  ]);

  const allRegions = useMemo(() => data?.filterOptions?.regions ?? [], [data?.filterOptions?.regions]);

  const allGoodsTypes = useMemo(() => data?.filterOptions?.goodsTypes ?? [], [data?.filterOptions?.goodsTypes]);

  const allFeedings = useMemo(() => data?.filterOptions?.feedingMethods ?? [], [data?.filterOptions?.feedingMethods]);

  const allTags = useMemo(() => data?.filterOptions?.tags ?? [], [data?.filterOptions?.tags]);

  const allMerchants = useMemo(
    () =>
      (data?.merchantOffers ?? []).map(group => ({
        key: `${group.merchantId ?? group.merchantName ?? ''}`,
        label: group.merchantName ?? `商家-${group.merchantId ?? ''}`,
      })),
    [data?.merchantOffers],
  );

  const fullMerchantOptions = useMemo(
    () => normalizeMerchantFilterOptions(data?.filterOptions?.merchants ?? allMerchants),
    [allMerchants, data?.filterOptions?.merchants],
  );

  const visibleMerchants = useMemo(() => {
    const keyword = merchantKeyword.trim().toLowerCase();
    if (!keyword) return fullMerchantOptions;
    return fullMerchantOptions.filter(item => item.label.toLowerCase().includes(keyword));
  }, [fullMerchantOptions, merchantKeyword]);

  const filterDefs = [
    {
      key: 'sort' as const,
      label: getSortLabel(sort),
      hasSelection: sort.kind !== 'comprehensive',
      onClear: sort.kind !== 'comprehensive' ? () => {
        setSort({kind: 'comprehensive'});
        setActiveFilter(null);
      } : undefined,
    },
    {key: 'famousMerchant' as const, label: '知名商家', hasSelection: famousMerchant, toggle: true},
    {
      key: 'merchant' as const,
      label: getSelectedOptionFilterLabel(merchants, fullMerchantOptions, '商家筛选'),
      hasSelection: merchants.size > 0,
      onClear: merchants.size > 0 ? () => {
        setMerchants(new Set());
        setMerchantKeyword('');
        setActiveFilter(null);
      } : undefined,
    },
    {
      key: 'region' as const,
      label: getSelectedFilterLabel(regions, '地区'),
      hasSelection: regions.size > 0,
      onClear: regions.size > 0 ? () => {
        setRegions(new Set());
        setActiveFilter(null);
      } : undefined,
    },
    {
      key: 'priceRange' as const,
      label: getPriceRangeFilterLabel(priceMinInput, priceMaxInput),
      hasSelection: priceMinInput.trim().length > 0 || priceMaxInput.trim().length > 0,
      onClear: priceMinInput.trim().length > 0 || priceMaxInput.trim().length > 0 ? () => {
        setPriceMinInput('');
        setPriceMaxInput('');
        setActiveFilter(null);
      } : undefined,
    },
    {
      key: 'goodsType' as const,
      label: getSelectedFilterLabel(goodsTypes, '货物类型'),
      hasSelection: goodsTypes.size > 0,
      onClear: goodsTypes.size > 0 ? () => {
        setGoodsTypes(new Set());
        setActiveFilter(null);
      } : undefined,
    },
    {
      key: 'feedingMethod' as const,
      label: getSelectedFilterLabel(feedingMethods, '饲养方式'),
      hasSelection: feedingMethods.size > 0,
      onClear: feedingMethods.size > 0 ? () => {
        setFeedingMethods(new Set());
        setActiveFilter(null);
      } : undefined,
    },
    {
      key: 'tag' as const,
      label: getSelectedFilterLabel(tags, '标签'),
      hasSelection: tags.size > 0,
      onClear: tags.size > 0 ? () => {
        setTags(new Set());
        setActiveFilter(null);
      } : undefined,
    },
  ];

  function handleFilterPress(key: FilterKey) {
    if (key === 'famousMerchant') {
      setFamousMerchant(prev => !prev);
      return;
    }
    setActiveFilter(key as LocalFilterKey);
  }

  return (
    <View style={styles.container}>
      <DetailTopBar
        onBack={() => navigation.goBack()}
        onSearchPress={() => {
          navigation.popToTop();
          navigation.navigate('Search', {category, keyword: searchKeyword, initialTab: tab});
        }}
        tags={[
          {
            text: buildCFLabel(currentCountry, currentFactoryNo),
            onClose: () => {
              if (data?.productId) {
                navigation.navigate('Product', {
                  productId: data.productId,
                  category,
                  productName,
                  initialTab: tab,
                });
              }
            },
          },
          {
            text: productName,
            onClose: () => navigation.navigate('Factory', {country, factoryNo, category, initialTab: tab}),
          },
        ]}
        topSlot={
          <OfferInquiryTabs
            tab={tab}
            onTabChange={handleTabChange}
            showMerchant
            onMerchantPress={() => {
              navigation.replace('MerchantSearchResults', {
                category,
                searchKeyword,
                tags: [buildCFLabel(country, factoryNo), productName],
                merchantSearch: {
                  display: searchKeyword,
                  matchType: 'combined',
                  type: '国家+厂号+产品',
                  country,
                  factoryNo,
                  productName,
                },
                target: {screen: 'CountryFactoryProduct', country, factoryNo, productName},
              });
            }}
          />
        }
        rightAction={
          <SelfSelectButton category={category} card={selfSelectCard} payload={selfSelectPayload} />
        }
      />

      {loading && !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={loadFirst} />
      ) : data ? (
        <>
          <SectionList
            sections={[{key: 'items', data: filtered}]}
            keyExtractor={(item, index) => `${item.merchantId ?? item.merchantName ?? index}`}
            stickySectionHeadersEnabled
            initialNumToRender={8}
            maxToRenderPerBatch={5}
            windowSize={3}
            removeClippedSubviews
            ListHeaderComponent={
              <View>
                <CountryProductDashboard
                  country={buildCFLabel(currentCountry, currentFactoryNo)}
                  productName={data.productName || productName}
                  isInquiry={tab === 'inquiry'}
                  priceMin={data.priceMin}
                  priceMax={data.priceMax}
                  priceChange={data.priceChange}
                  priceChangeRate={data.priceChangeRate}
                  offerCount={getTabCount(data, 'offer')}
                  inquiryCount={getTabCount(data, 'inquiry')}
                  merchantCount={getTabMerchantCount(data, tab)}
                  history7Days={data.priceHistory7Days}
                  history30Days={data.priceHistory30Days}
                />
                <View style={styles.gap} />
              </View>
            }
            renderSectionHeader={() => (
              <View style={styles.stickyHeader}>
                <FilterBar
                  filters={filterDefs}
                  active={activeFilter as FilterKey | null}
                  onPress={handleFilterPress}
                  onBottomLayout={setFilterPanelTop}
                />
              </View>
            )}
            renderItem={({item}) => (
              <MerchantOfferGroupCard
                group={item}
                isInquiry={tab === 'inquiry'}
                country={currentCountry}
                factoryNo={currentFactoryNo}
                productName={currentProductName}
                onCopyPhone={item.merchantPhone ?? undefined}
                onDial={item.merchantPhone ?? undefined}
                onViewOriginalText={handleViewOriginalText}
                onMerchantPress={() => openMerchantHome(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.itemDivider} />}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFirst} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              <View style={styles.footer}>
                {loadingMore ? (
                  <Text style={styles.footerText}>加载中...</Text>
                ) : page >= (data.totalPages ?? 1) ? (
                  <Text style={styles.footerText}>没有更多了～</Text>
                ) : null}
              </View>
            }
            ListEmptyComponent={!loading ? <Text style={styles.empty}>暂无数据</Text> : null}
          />

          {data.hasSubstitute ? (
            <Pressable
              style={styles.substituteFab}
              onPress={() =>
                navigation.navigate('SubstituteProduct', {
                  country: data.country || country,
                  factoryNo: data.factoryNo || factoryNo,
                  productName: data.productName || productName,
                  category,
                })
              }>
              <View style={styles.substituteText}>
                <Text style={styles.substituteChar}>{'平'}</Text>
                <Text style={styles.substituteChar}>{'替'}</Text>
                <Text style={styles.substituteChar}>{'产'}</Text>
                <Text style={styles.substituteChar}>{'品'}</Text>
              </View>
              <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                <Path
                  d="M8.64014 5.22501L10.5001 3.36499L8.64014 1.505"
                  stroke="#FFFFFF"
                  strokeWidth={0.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.4}
                />
                <Path
                  d="M1.5 3.36499H10.5"
                  stroke="#FFFFFF"
                  strokeWidth={0.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.4}
                />
                <Path
                  d="M3.35999 6.77502L1.5 8.63504L3.35999 10.495"
                  stroke="#FFFFFF"
                  strokeWidth={0.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M10.5 8.63501H1.5"
                  stroke="#FFFFFF"
                  strokeWidth={0.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          ) : null}
        </>
      ) : null}

      <FilterPanelSheet
        visible={activeFilter === 'sort'}
        topOffset={filterPanelTop}
        title="排序方式"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setSort({kind: 'comprehensive'});
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}
        showActions={false}>
        <SortSelectOptions
          sort={sort}
          onSelect={next => {
            setSort(next);
            setActiveFilter(null);
          }}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={activeFilter === 'merchant'}
        topOffset={filterPanelTop}
        title="商家筛选"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setMerchants(new Set());
          setMerchantKeyword('');
          setActiveFilter(null);
        }}
        onConfirm={() => {
          setMerchantKeyword('');
          setActiveFilter(null);
        }}>
        <View style={styles.searchWrap}>
          <TextInput
            value={merchantKeyword}
            onChangeText={setMerchantKeyword}
            placeholder="搜索商家名称"
            placeholderTextColor="#9DA4A3"
            style={styles.searchInput}
          />
        </View>
        <MultiSelectChips
          options={visibleMerchants.map(m => m.label)}
          selected={new Set(visibleMerchants.filter(m => merchants.has(m.key)).map(m => m.label))}
          onToggle={label => {
            const found = fullMerchantOptions.find(m => m.label === label);
            if (!found) return;
            setMerchants(prev => toggleSet(prev, found.key));
          }}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={activeFilter === 'region'}
        topOffset={filterPanelTop}
        title="地区"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setRegions(new Set());
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={allRegions}
          selected={regions}
          onToggle={value => setRegions(prev => toggleSet(prev, value))}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={activeFilter === 'priceRange'}
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
        {data?.priceMin != null || data?.priceMax != null ? (
          <Text style={styles.priceHint}>
            当前数据价格范围：{formatPriceRangeHint(data.priceMin, data.priceMax)}
          </Text>
        ) : null}
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={activeFilter === 'goodsType'}
        topOffset={filterPanelTop}
        title="货物类型"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setGoodsTypes(new Set());
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={allGoodsTypes.length > 0 ? allGoodsTypes : ['现货', '半期货', '期货']}
          selected={goodsTypes}
          onToggle={value => setGoodsTypes(prev => toggleSet(prev, value))}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={activeFilter === 'feedingMethod'}
        topOffset={filterPanelTop}
        title="饲养方式"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setFeedingMethods(new Set());
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={allFeedings.length > 0 ? allFeedings : ['草饲', '谷饲']}
          selected={feedingMethods}
          onToggle={value => setFeedingMethods(prev => toggleSet(prev, value))}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={activeFilter === 'tag'}
        topOffset={filterPanelTop}
        title="标签"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setTags(new Set());
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={allTags}
          selected={tags}
          onToggle={value => setTags(prev => toggleSet(prev, value))}
          groupSimilarTags
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

function sortToParam(sort: SortMode): string {
  if (sort.kind === 'comprehensive') return 'comprehensive';
  if (sort.kind === 'publishTime') return 'publish_time';
  return sort.order === 'asc' ? 'price_asc' : sort.order === 'desc' ? 'price_desc' : 'comprehensive';
}

function SortSelectOptions({sort, onSelect}: {sort: SortMode; onSelect: (next: SortMode) => void}) {
  return (
    <View style={styles.sortOptions}>
      {sortOptions.map(option => {
        const active = isSameSort(sort, option.value);
        return (
          <Pressable
            key={option.label}
            onPress={() => onSelect(option.value)}
            style={[styles.sortOption, active && styles.sortOptionActive]}>
            <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getSortLabel(sort: SortMode) {
  if (sort.kind === 'publishTime') return '发布时间';
  if (sort.kind === 'price') return sort.order === 'desc' ? '价格从高到低↓' : '价格从低到高↑';
  return '综合排序';
}

function isSameSort(left: SortMode, right: SortMode) {
  if (left.kind !== right.kind) return false;
  if (left.kind !== 'price' || right.kind !== 'price') return true;
  return left.order === right.order;
}

function getSelectedFilterLabel(values: Set<string>, fallback: string) {
  if (values.size === 1) return Array.from(values)[0];
  return values.size > 1 ? `${fallback}(${values.size})` : fallback;
}

function getSelectedOptionFilterLabel(values: Set<string>, options: MerchantFilterOption[], fallback: string) {
  if (values.size === 1) {
    const selected = Array.from(values)[0];
    return options.find(option => option.key === selected)?.label ?? selected;
  }
  return values.size > 1 ? `${fallback}(${values.size})` : fallback;
}

function getPriceRangeFilterLabel(minInput: string, maxInput: string) {
  const min = minInput.trim();
  const max = maxInput.trim();
  if (min && max) return `${min}-${max}`;
  if (min) return `≥${min}`;
  if (max) return `≤${max}`;
  return '价格区间';
}

function mergeMerchantOffers(prev: MerchantOfferGroup[], incoming: MerchantOfferGroup[]) {
  const map = new Map<string, MerchantOfferGroup>();
  prev.forEach((group, index) => {
    const key = `${group.merchantId ?? group.merchantName ?? index}`;
    map.set(key, group);
  });
  incoming.forEach((group, index) => {
    const key = `${group.merchantId ?? group.merchantName ?? prev.length + index}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...group,
        employeeOffers: [...(existing.employeeOffers ?? []), ...(group.employeeOffers ?? [])],
      });
    } else {
      map.set(key, group);
    }
  });
  return Array.from(map.values());
}

function normalizeMerchantFilterOptions(options: MerchantFilterOption[]) {
  const seen = new Set<string>();
  const result: MerchantFilterOption[] = [];

  for (const option of options) {
    const label = option.label?.trim() ?? '';
    const key = `${option.key ?? ''}`.trim() || label;
    if (!label || label === unlinkedMerchantLabel || seen.has(label)) continue;
    seen.add(label);
    result.push({key, label});
  }

  return result;
}

async function resolveMerchantIdByName(category: string, merchantName: string) {
  const normalizedName = normalizeMerchantNameForMatch(merchantName);
  if (!normalizedName) return null;

  const suggestions = await mooketApi.getSearchSuggestions(category, merchantName).catch(() => []);
  const suggestion = suggestions.find(item => {
    if (item.matchType !== 'merchant' || !normalizeMerchantTargetId(item.targetId)) return false;
    return [item.merchantName, item.standardName, item.text].some(
      value => normalizeMerchantNameForMatch(value) === normalizedName,
    );
  });
  const suggestionId = normalizeMerchantTargetId(suggestion?.targetId);
  if (suggestionId) return suggestionId;

  const results = await loadMerchantSearchResults({
    display: merchantName,
    matchType: 'merchant',
    type: '商家',
    merchantName,
  });
  const exact = results.find(item => {
    if (!normalizeMerchantTargetId(item.merchantId)) return false;
    return [item.merchantName, item.merchantShortName].some(
      value => normalizeMerchantNameForMatch(value) === normalizedName,
    );
  });
  return normalizeMerchantTargetId(exact?.merchantId);
}

function normalizeMerchantTargetId(value?: number | string | null) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? value : null;
}

function normalizeMerchantNameForMatch(value?: string | null) {
  return stripSuggestionAlias(value).replace(/\s+/g, '').toLowerCase();
}

function stripSuggestionAlias(value?: string | null) {
  const text = value?.trim() ?? '';
  const aliasIndex = text.indexOf('(别名：');
  return aliasIndex >= 0 ? text.slice(0, aliasIndex).trim() : text;
}

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
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

function parsePriceValue(value?: string | number | null): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPriceRangeHint(min?: number | null, max?: number | null) {
  if (min != null && max != null && min !== max) return `楼 ${min} - ${max} /kg`;
  if (min != null) return `楼 ${min} /kg`;
  if (max != null) return `楼 ${max} /kg`;
  return '暂无价格';
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  loading: {paddingVertical: 48, alignItems: 'center'},
  topTabs: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EFF5F3', borderBottomWidth: 1, borderBottomColor: colors.border},
  gap: {height: 12, backgroundColor: '#F4FBF8'},
  itemDivider: {
    marginHorizontal: 16,
    height: 0,
  },
  footer: {alignItems: 'center', paddingVertical: 16},
  footerText: {color: '#9DA4A3', fontSize: 12},
  empty: {textAlign: 'center', paddingVertical: 48, color: '#9DA4A3', fontSize: 14},
  placeholder: {color: '#9DA4A3', fontSize: 12, padding: 16, textAlign: 'center'},
  stickyHeader: {backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DEE4E1', zIndex: 10, elevation: 3},
  searchWrap: {marginBottom: 12},
  searchInput: {
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
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
  priceHint: {marginTop: 8, color: '#9DA4A3', fontSize: 12},
  sortOptions: {
    gap: 10,
  },
  sortOption: {
    minHeight: 42,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sortOptionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },

  substituteFab: {
    position: 'absolute',
    left: 0,
    bottom: 80,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(23,29,28,0.8)',
    gap: 4,
  },
  substituteText: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  substituteChar: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
