import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SvgXml} from 'react-native-svg';
import {mooketApi} from '../api/mooketApi';
import {FilterBar, type FilterKey} from '../components/detail/FilterBar';
import {FilterPanelSheet, MultiSelectChips} from '../components/detail/FilterPanelSheet';
import {MerchantSortBar, type MerchantSortMode} from '../components/detail/MerchantSortBar';
import {MerchantOfferGroupCard} from '../components/detail/MerchantOfferGroupCard';
import {OriginalTextSheet} from '../components/detail/OriginalTextSheet';
import {ErrorState} from '../components/common/ErrorState';
import {backArrowXml} from '../components/detail/productIcons';
import type {OfferTab} from '../components/detail/TabAndSortBar';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import type {MerchantOfferGroup, SubstituteFactory, SubstituteProduct as SubstituteOverview, SubstituteProductDetail} from '../types/api';
import {extractCity, splitTags} from '../utils/offer';
import type {OriginalTextPayload} from '../utils/originalText';

type Props = NativeStackScreenProps<RootStackParamList, 'SubstituteProduct'>;
type LocalFilterKey = Exclude<FilterKey, 'product'>;

const pageSize = 10;

export function SubstituteProductScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const {country, factoryNo, productName, category} = route.params;
  const [overview, setOverview] = useState<SubstituteOverview | null>(null);
  const [detail, setDetail] = useState<SubstituteProductDetail | null>(null);
  const [selectedFactory, setSelectedFactory] = useState(factoryNo);
  const [tab, setTab] = useState<OfferTab>('offer');
  const [sort, setSort] = useState<MerchantSortMode>({kind: 'comprehensive'});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<OriginalTextPayload | null>(null);
  const [activeFilter, setActiveFilter] = useState<LocalFilterKey | null>(null);
  const [filterPanelTop, setFilterPanelTop] = useState(0);
  const [famousOnly, setFamousOnly] = useState(false);
  const [regions, setRegions] = useState<Set<string>>(new Set());
  const [goodsTypes, setGoodsTypes] = useState<Set<string>>(new Set());
  const [feedingMethods, setFeedingMethods] = useState<Set<string>>(new Set());
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const requestSortParam = useMemo(
    () => sortToParam(sort),
    [sort],
  );

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(1);
      const [overviewData, detailData] = await Promise.all([
        mooketApi.getSubstituteProducts(country, factoryNo, productName, category),
        mooketApi.getSubstituteProductDetail(
          country,
          selectedFactory,
          productName,
          category,
          tab,
          requestSortParam,
          1,
          pageSize,
        ),
      ]);
      setOverview(overviewData);
      setDetail(detailData);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [category, country, factoryNo, productName, requestSortParam, selectedFactory, tab]);

  useEffect(() => {
    loadFirst().catch(() => undefined);
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !detail) return;
    if (page >= detail.totalPages) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const more = await mooketApi.getSubstituteProductDetail(
        country,
        selectedFactory,
        productName,
        category,
        tab,
        requestSortParam,
        next,
        pageSize,
      );
      setPage(next);
      setDetail(prev =>
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
  }, [category, country, detail, loading, loadingMore, page, productName, requestSortParam, selectedFactory, tab]);

  const factoryOptions: SubstituteFactory[] = overview
    ? [
        {
          factoryNo,
          priceMin: overview.priceMin,
          priceMax: overview.priceMax,
          offerCount: overview.offerCount,
          merchantCount: overview.merchantCount,
          isSelected: selectedFactory === factoryNo,
        },
        ...overview.factories.filter(item => item.factoryNo !== factoryNo),
      ]
    : [];

  // 筛选 merchantOffers
  const filtered = useMemo(() => {
    const groups = detail?.merchantOffers ?? [];
    const next = groups
      .filter(group => {
        if (famousOnly && !group.isFamousMerchant) return false;
        return true;
      })
      .map(group => ({
        ...group,
        employeeOffers: (group.employeeOffers ?? []).filter(emp => {
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
          if (tagFilters.size > 0) {
            const empTags = splitTags(emp.tags, 8);
            if (!empTags.some(t => tagFilters.has(t))) return false;
          }
          return true;
        }),
      }))
      .filter(group => group.employeeOffers.length > 0);

    return next;
  }, [detail?.merchantOffers, famousOnly, feedingMethods, goodsTypes, regions, tagFilters]);

  const allRegions = useMemo(() => detail?.filterOptions?.regions ?? [], [detail?.filterOptions?.regions]);
  const allGoodsTypes = useMemo(() => detail?.filterOptions?.goodsTypes ?? [], [detail?.filterOptions?.goodsTypes]);
  const allFeedings = useMemo(() => detail?.filterOptions?.feedingMethods ?? [], [detail?.filterOptions?.feedingMethods]);
  const allTags = useMemo(() => detail?.filterOptions?.tags ?? [], [detail?.filterOptions?.tags]);

  const filters = [
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
      label: getSelectedFilterLabel(tagFilters, '价格/标签'),
      hasSelection: tagFilters.size > 0,
      onClear: tagFilters.size > 0 ? () => {
        setTagFilters(new Set());
        setActiveFilter(null);
      } : undefined,
    },
  ];

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} topInset={insets.top} />

      {loading && !overview ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error && !overview ? (
        <ErrorState message={error} onRetry={loadFirst} />
      ) : overview ? (
        <>
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => `${item.merchantId ?? item.merchantName ?? index}`}
            stickyHeaderIndices={[0]}
            ListHeaderComponent={
              <View>
                <SubstituteHeaderCard
                  country={country}
                  factoryNo={selectedFactory}
                  productName={productName}
                  priceMin={detail?.priceMin}
                  priceMax={detail?.priceMax}
                  onCompare={() =>
                    navigation.navigate('DataComparison', {
                      country,
                      factoryNos: [
                        selectedFactory,
                        ...overview.factories
                          .map(item => item.factoryNo)
                          .filter(item => item !== selectedFactory),
                      ],
                      productName,
                      category,
                      excludeFactoryNo: selectedFactory,
                    })
                  }
                />
                <View style={styles.gap} />
                <FactorySelector
                  country={country}
                  factories={factoryOptions}
                  selected={selectedFactory}
                  onSelect={value => setSelectedFactory(value)}
                />
                <View style={styles.stickyTabBlock}>
                  <MerchantSortBar
                    tab={tab}
                    onTabChange={setTab}
                    sort={sort}
                    onSortChange={setSort}
                    hideInquiry
                  />
                  <View style={styles.quickRow}>
                    <Pressable
                      onPress={() => setFamousOnly(prev => !prev)}
                      style={[styles.quickChip, famousOnly && styles.quickChipActive]}>
                      <Text style={[styles.quickChipText, famousOnly && styles.quickChipTextActive]}>
                        知名商家
                      </Text>
                    </Pressable>
                    <View style={styles.filterBarWrap}>
                      <FilterBar
                        filters={filters}
                        active={activeFilter}
                        onPress={key => {
                          if (key === 'product' || key === 'countryFactory') return;
                          setActiveFilter(key as LocalFilterKey);
                        }}
                        onBottomLayout={setFilterPanelTop}
                      />
                    </View>
                  </View>
                </View>
              </View>
            }
          renderItem={({item}) => (
            <MerchantOfferGroupCard
              group={item}
              isInquiry={tab === 'inquiry'}
              country={country}
              factoryNo={selectedFactory}
              productName={productName}
              onCopyPhone={item.merchantPhone ?? undefined}
              onDial={item.merchantPhone ?? undefined}
              onViewOriginalText={value => setOriginalText(value)}
            />
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadFirst} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <View style={styles.footer}>
              {loadingMore ? (
                <Text style={styles.footerText}>加载中...</Text>
              ) : detail && page >= detail.totalPages ? (
                <Text style={styles.footerText}>没有更多了</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={!loading ? <Text style={styles.empty}>暂无平替商家报盘</Text> : null}
        />
        </>
      ) : null}

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
          onToggle={value => setRegions(prev => toggle(prev, value))}
        />
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
          options={allGoodsTypes.length ? allGoodsTypes : ['现货', '半期货', '期货']}
          selected={goodsTypes}
          onToggle={value => setGoodsTypes(prev => toggle(prev, value))}
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
          options={allFeedings.length ? allFeedings : ['草饲', '谷饲']}
          selected={feedingMethods}
          onToggle={value => setFeedingMethods(prev => toggle(prev, value))}
        />
      </FilterPanelSheet>

      <FilterPanelSheet
        visible={activeFilter === 'tag'}
        topOffset={filterPanelTop}
        title="价格/标签"
        onClose={() => setActiveFilter(null)}
        onReset={() => {
          setTagFilters(new Set());
          setActiveFilter(null);
        }}
        onConfirm={() => setActiveFilter(null)}>
        <MultiSelectChips
          options={allTags.length ? allTags : ['大日龄', '可开证', '整柜', '一口价']}
          selected={tagFilters}
          onToggle={value => setTagFilters(prev => toggle(prev, value))}
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

function Header({onBack, topInset}: {onBack: () => void; topInset: number}) {
  return (
    <View style={[headerStyles.bar, {paddingTop: topInset + 12, minHeight: topInset + 48}]}>
      <Pressable hitSlop={8} onPress={onBack} style={headerStyles.backButton}>
        <SvgXml xml={backArrowXml} width={24} height={24} />
      </Pressable>
      <Text style={headerStyles.title}>平替产品</Text>
      <View style={headerStyles.placeholder} />
    </View>
  );
}

function SubstituteHeaderCard({
  country,
  factoryNo,
  productName,
  priceMin,
  priceMax,
  onCompare,
}: {
  country: string;
  factoryNo: string;
  productName: string;
  priceMin?: number | null;
  priceMax?: number | null;
  onCompare: () => void;
}) {
  const priceText = formatPriceText(priceMin, priceMax);
  return (
    <View style={cardStyles.wrap}>
      <View style={cardStyles.left}>
        <View style={cardStyles.titleRow}>
          <Text style={cardStyles.titlePart}>
            {country}
            {factoryNo}
          </Text>
          <View style={cardStyles.dot} />
          <Text style={cardStyles.titlePart}>{productName}</Text>
        </View>
        <Text style={cardStyles.subtitle}>
          近2日报盘价格区间：<Text style={cardStyles.subtitlePrice}>{priceText}</Text>
          {priceText !== '暂无报价' ? <Text style={cardStyles.subtitleUnit}>/kg</Text> : null}
        </Text>
      </View>
      <Pressable onPress={onCompare} style={cardStyles.compareButton}>
        <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
          <Path d="M11.8125 13.8825C11.8125 14.2575 12.1125 14.5575 12.4875 14.5575L15.975 14.5575C16.35 14.5575 16.65 14.2575 16.65 13.8825C16.65 13.5075 16.35 13.2075 15.975 13.2075L12.4875 13.2075C12.12 13.2075 11.8125 13.515 11.8125 13.8825Z" fill={colors.primary}/>
          <Path d="M6.1875 9.00001C6.1875 8.62501 5.8875 8.32501 5.5125 8.32501L2.025 8.32501C1.65 8.32501 1.35 8.62501 1.35 9.00001C1.35 9.37501 1.65 9.67501 2.025 9.67501L5.5125 9.67501C5.88 9.67501 6.1875 9.37501 6.1875 9.00001Z" fill={colors.primary}/>
          <Path d="M11.8125 4.1175C11.8125 4.4925 12.1125 4.7925 12.4875 4.7925L15.975 4.7925C16.35 4.7925 16.65 4.4925 16.65 4.1175C16.65 3.7425 16.35 3.4425 15.975 3.4425L12.4875 3.4425C12.12 3.4425 11.8125 3.7425 11.8125 4.1175Z" fill={colors.primary}/>
          <Path d="M10.3725 5.51251L10.3725 2.72251C10.3725 2.34751 10.0725 2.04751 9.6975 2.04751C9.3225 2.04751 9.0225 2.34751 9.0225 2.72251L9.0225 3.44251L2.025 3.44251C1.65 3.44251 1.35 3.74251 1.35 4.11751C1.35 4.49251 1.65 4.79251 2.025 4.79251L9.0225 4.79251L9.0225 5.51251C9.0225 5.88751 9.3225 6.18751 9.6975 6.18751C10.0725 6.18751 10.3725 5.88001 10.3725 5.51251Z" fill={colors.primary}/>
          <Path d="M10.3725 15.2775L10.3725 12.4875C10.3725 12.1125 10.0725 11.8125 9.6975 11.8125C9.3225 11.8125 9.0225 12.1125 9.0225 12.4875L9.0225 13.2075L2.025 13.2075C1.65 13.2075 1.35 13.5075 1.35 13.8825C1.35 14.2575 1.65 14.5575 2.025 14.5575L9.0225 14.5575L9.0225 15.2775C9.0225 15.6525 9.3225 15.9525 9.6975 15.9525C10.0725 15.9525 10.3725 15.6525 10.3725 15.2775Z" fill={colors.primary}/>
          <Path d="M8.97753 10.395L8.97753 9.675L15.975 9.675C16.35 9.675 16.65 9.375 16.65 9C16.65 8.625 16.35 8.325 15.975 8.325L8.97753 8.325L8.97753 7.605C8.97753 7.23 8.67753 6.93 8.30253 6.93C7.92753 6.93 7.62753 7.23 7.62753 7.605L7.62753 10.395C7.62753 10.77 7.92753 11.07 8.30253 11.07C8.67753 11.07 8.97753 10.77 8.97753 10.395Z" fill={colors.primary}/>
        </Svg>
        <Text style={cardStyles.compareText}>数据对比</Text>
      </Pressable>
    </View>
  );
}

function FactorySelector({
  country,
  factories,
  selected,
  onSelect,
}: {
  country: string;
  factories: SubstituteFactory[];
  selected: string;
  onSelect: (factoryNo: string) => void;
}) {
  return (
    <View style={selectorStyles.wrap}>
      <View style={selectorStyles.titleRow}>
        <Text style={selectorStyles.title}>平替产品</Text>
        <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
          <Path opacity={0.4} d="M11.5202 6.96667L14.0002 4.48665L11.5202 2.00667" stroke={colors.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
          <Path opacity={0.4} d="M2 4.48665H14" stroke={colors.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M4.47998 9.03333L2 11.5133L4.47998 13.9933" stroke={colors.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
          <Path d="M14 11.5134H2" stroke={colors.primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </Svg>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={selectorStyles.row}>
        {factories.map(item => {
          const active = item.factoryNo === selected;
          const priceText = formatPriceText(item.priceMin, item.priceMax);
          return (
            <Pressable
              key={item.factoryNo}
              onPress={() => onSelect(item.factoryNo)}
              style={[selectorStyles.chip, active && selectorStyles.chipActive]}>
              <Text style={[selectorStyles.factoryName, active && selectorStyles.factoryNameActive]}>
                {country}
                {item.factoryNo}
              </Text>
              <Text style={[selectorStyles.priceText, active && selectorStyles.priceTextActive]} numberOfLines={1}>
                {priceText}{priceText !== '暂无报价' ? '/kg' : ''}
              </Text>
              {active ? (
                <View style={selectorStyles.arrowWrap}>
                  <Svg width={18} height={6} viewBox="0 0 18 6">
                    <Path d="M9 6L0 0H18L9 6Z" fill={colors.primary} />
                  </Svg>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function mergeMerchantOffers(prev: MerchantOfferGroup[], incoming: MerchantOfferGroup[]) {
  const map = new Map<string, MerchantOfferGroup>();
  prev.forEach((group, index) => {
    map.set(`${group.merchantId ?? group.merchantName ?? index}`, group);
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

function groupPriceRange(group: MerchantOfferGroup) {
  const prices = (group.employeeOffers ?? [])
    .map(emp => parseEmployeePrice(emp.price))
    .filter((value): value is number => value != null);

  if (prices.length > 0) {
    return normalizePriceRange(Math.min(...prices), Math.max(...prices));
  }

  return normalizePriceRange(null, null);
}

function parseEmployeePrice(value?: string | number | null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sortToParam(sort: MerchantSortMode): string {
  if (sort.kind === 'comprehensive') return 'comprehensive';
  if (sort.kind === 'publish_time') return 'publish_time';
  return sort.order === 'asc' ? 'price_asc' : sort.order === 'desc' ? 'price_desc' : 'comprehensive';
}

function getSelectedFilterLabel(values: Set<string>, fallback: string) {
  if (values.size === 1) return Array.from(values)[0];
  return values.size > 1 ? `${fallback}(${values.size})` : fallback;
}

function formatPriceText(min?: number | null, max?: number | null): string {
  if (min != null && max != null && min > 0 && max >= min) {
    if (min === max) return `¥${num(min)}`;
    return `¥${num(min)}-${num(max)}`;
  }
  if (min != null && min > 0) return `¥${num(min)}`;
  return '暂无报价';
}

function num(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function unique(values: string[]) {
  const set = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (set.has(trimmed)) continue;
    set.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  loading: {paddingVertical: 48, alignItems: 'center'},
  gap: {height: 12, backgroundColor: '#F4FBF8', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border},
  stickyTabBlock: {backgroundColor: '#FFFFFF'},
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingLeft: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterBarWrap: {flex: 1, marginLeft: -10},
  quickChip: {
    height: 27,
    paddingHorizontal: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#F3F6F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipActive: {borderColor: colors.primary},
  quickChipText: {color: '#254D5A', fontSize: 12, lineHeight: 15},
  quickChipTextActive: {color: colors.primary, fontWeight: '600'},
  footer: {alignItems: 'center', paddingVertical: 8},
  footerText: {color: '#9DA4A3', fontSize: 11, lineHeight: 18},
  empty: {textAlign: 'center', paddingVertical: 48, color: '#9DA4A3', fontSize: 14},
});

const headerStyles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  backButton: {width: 24, height: 24, alignItems: 'center', justifyContent: 'center'},
  title: {flex: 1, textAlign: 'center', color: colors.text, fontSize: 16, lineHeight: 24, fontWeight: '500'},
  placeholder: {width: 24},
});

const cardStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  left: {flex: 1, gap: 4, paddingRight: 12},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  titlePart: {color: colors.text, fontSize: 20, fontWeight: '500', lineHeight: 30},
  dot: {width: 4, height: 4, borderRadius: 2, backgroundColor: '#171D1C'},
  subtitle: {color: colors.text, fontSize: 12, lineHeight: 16},
  subtitlePrice: {color: colors.price},
  subtitleUnit: {fontFamily: fonts.manropeRegular, color: colors.text, fontSize: 10, lineHeight: 16},
  compareButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,106,97,0.15)',
    backgroundColor: 'rgba(0,106,97,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareText: {color: colors.primary, fontSize: 10, lineHeight: 14},
});

const selectorStyles = StyleSheet.create({
  wrap: {paddingTop: 12, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#FFFFFF'},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8},
  title: {color: colors.primary, fontSize: 14, fontWeight: '500', lineHeight: 20},
  row: {gap: 12, paddingRight: 8, paddingBottom: 8},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(60,73,71,0.15)',
    backgroundColor: 'rgba(60,73,71,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 100,
    overflow: 'visible',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,106,97,0.05)',
  },
  factoryName: {color: '#3C4947', fontSize: 14, lineHeight: 20, textAlign: 'center'},
  factoryNameActive: {color: colors.primary, fontWeight: '500'},
  priceText: {fontFamily: fonts.manropeSemiBold, color: colors.price, fontSize: 12, lineHeight: 16},
  priceTextActive: {color: colors.price},
  activeArrow: {},
  arrowWrap: {
    position: 'absolute',
    bottom: -7,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});


