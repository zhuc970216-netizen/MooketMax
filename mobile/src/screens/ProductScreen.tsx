import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, SectionList, RefreshControl, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {mooketApi} from '../api/mooketApi';
import {DataDashboard} from '../components/detail/DataDashboard';
import {DetailTopBar} from '../components/detail/DetailTopBar';
import {SelfSelectButton} from '../components/detail/SelfSelectButton';
import {SummaryRowCard} from '../components/detail/SummaryRowCard';
import {OfferInquiryTabs, TabAndSortBar, type OfferTab, type SortMode} from '../components/detail/TabAndSortBar';
import {ErrorState} from '../components/common/ErrorState';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import type {ProductDetail, ProductSummary} from '../types/api';
import {getTabCount, getTabFactoryCount, getTabMerchantCount} from '../utils/tabStats';

type Props = NativeStackScreenProps<RootStackParamList, 'Product'>;

const pageSize = 20;

export function ProductScreen({navigation, route}: Props) {
  const {productId, category, productName, searchKeyword: routeSearchKeyword, initialTab} = route.params;
  const searchKeyword = routeSearchKeyword ?? productName;
  const [data, setData] = useState<ProductDetail | null>(null);
  const [tab, setTab] = useState<OfferTab>(initialTab ?? 'offer');
  const [sort, setSort] = useState<SortMode>({kind: 'comprehensive'});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSortParam = useMemo(
    () => sortToParam(sort),
    [sort],
  );
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
  const summaries = data?.summaries ?? [];
  const currentProductName = data?.productName || productName;
  const selfSelectCard = currentProductName
    ? {cardType: 'product', productId, productName: currentProductName}
    : null;
  const selfSelectPayload = currentProductName
    ? {
        searchWord: currentProductName,
        searchType: '\u4ea7\u54c1',
        productId,
        productName: currentProductName,
      }
    : null;

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(1);
      const next = await mooketApi.getProductDetail(
        productId,
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
  }, [category, productId, requestSortParam, tab]);

  useEffect(() => {
    loadFirst().catch(() => undefined);
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !data) return;
    if (page >= (data.totalPages ?? 1)) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const more = await mooketApi.getProductDetail(
        productId,
        category,
        tab,
        requestSortParam,
        next,
        pageSize,
      );
      setPage(next);
      setData(prev => (prev ? {...more, summaries: mergeSummaries(prev.summaries, more.summaries)} : more));
    } catch {
      // 静默
    } finally {
      setLoadingMore(false);
    }
  }, [category, data, loading, loadingMore, page, productId, requestSortParam, tab]);

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
            text: productName,
            onClose: () => {
              navigation.popToTop();
              navigation.navigate('Search', {category, keyword: searchKeyword, initialTab: tab});
            },
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
                tags: [productName],
                merchantSearch: {
                  display: searchKeyword,
                  matchType: 'product',
                  type: '产品',
                  targetId: productId,
                  productName: currentProductName,
                },
                target: {screen: 'Product', productId, productName: currentProductName},
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
        <SectionList
          sections={[{key: 'items', data: summaries}]}
          keyExtractor={(item, index) => `${item.country ?? ''}-${item.factoryNo ?? ''}-${index}`}
          stickySectionHeadersEnabled
            initialNumToRender={8}
            maxToRenderPerBatch={5}
            windowSize={3}
            removeClippedSubviews
          ListHeaderComponent={
            <View>
              <DataDashboard
                title={data.productName}
                mainStat={{
                  label: tab === 'offer' ? '近2日报盘' : '近2日求购',
                  value: getTabCount(data, tab),
                }}
                priceRange={{min: data.priceMin, max: data.priceMax}}
                stats={[
                  {label: '商家数', value: getTabMerchantCount(data, tab)},
                  {label: '工厂数', value: getTabFactoryCount(data, tab)},
                ]}
              />
              <View style={styles.gap} />
            </View>
          }
          renderSectionHeader={() => (
            <View style={styles.stickyHeader}>
              <TabAndSortBar tab={tab} onTabChange={handleTabChange} sort={sort} onSortChange={setSort} showTabs={false} />
            </View>
          )}
          renderItem={({item}) => (
            <SummaryRowCard
              title={buildCountryFactoryTitle(item.country, item.factoryNo, item.countryFactory)}
              merchantNames={item.merchantNames}
              merchantCount={item.merchantCount}
              count={getTabCount(item, tab)}
              countLabel={tab === 'offer' ? '报盘' : '求购'}
              priceMin={item.priceMin}
              priceMax={item.priceMax}
              onPress={() =>
                navigation.navigate('CountryFactoryProduct', {
                  country: item.country ?? '',
                  factoryNo: item.factoryNo ?? '',
                  productName: data.productName,
                  category,
                  initialTab: tab,
                })
              }
            />
          )}
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
          ListEmptyComponent={
            !loading ? <Text style={styles.empty}>暂无数据</Text> : null
          }
        />
      ) : null}
    </View>
  );
}

function sortToParam(sort: SortMode): string {
  if (sort.kind === 'comprehensive') return 'comprehensive';
  if (sort.kind === 'publishTime') return 'publish_time';
  return sort.order === 'asc' ? 'price_asc' : sort.order === 'desc' ? 'price_desc' : 'comprehensive';
}

function buildCountryFactoryTitle(
  country?: string | null,
  factoryNo?: string | null,
  countryFactory?: string | null,
): string {
  const c = country?.trim();
  const f = factoryNo?.trim();
  if (c && f) {
    return countryFactory?.trim() || `${c} ${f}`;
  }
  if (c && !f) {
    return `${c} 厂号不限`;
  }
  if (!c && f) {
    return `国家不限 ${f}`;
  }
  return '国家厂号不限';
}

function mergeSummaries(prev: ProductSummary[], incoming: ProductSummary[]): ProductSummary[] {
  const seen = new Set(prev.map(item => `${item.country ?? ''}-${item.factoryNo ?? ''}`));
  const next = prev.slice();
  for (const item of incoming) {
    const key = `${item.country ?? ''}-${item.factoryNo ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      next.push(item);
    }
  }
  return next;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  topTabs: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFF5F3',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  gap: {
    height: 12,
    backgroundColor: '#F4FBF8',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerText: {
    color: '#9DA4A3',
    fontSize: 11,
    lineHeight: 18,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 48,
    color: '#9DA4A3',
    fontSize: 14,
  },
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DEE4E1',
    zIndex: 10,
    elevation: 3,
  },
});
