import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, SectionList, RefreshControl, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {mooketApi} from '../api/mooketApi';
import {BrandDashboard} from '../components/detail/BrandDashboard';
import {CountrySummaryRowCard} from '../components/detail/CountrySummaryRowCard';
import {DetailTopBar} from '../components/detail/DetailTopBar';
import {SelfSelectButton} from '../components/detail/SelfSelectButton';
import {OfferInquiryTabs, TabAndSortBar, type OfferTab, type SortMode} from '../components/detail/TabAndSortBar';
import {ErrorState} from '../components/common/ErrorState';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import type {BrandDetail, BrandProductSummary} from '../types/api';
import {getTabCount, getTabFactoryCount, getTabProductCount} from '../utils/tabStats';

type Props = NativeStackScreenProps<RootStackParamList, 'Brand'>;

const pageSize = 20;

export function BrandScreen({navigation, route}: Props) {
  const {brandName, category, searchKeyword: routeSearchKeyword, initialTab} = route.params;
  const searchKeyword = routeSearchKeyword ?? brandName;
  const [data, setData] = useState<BrandDetail | null>(null);
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
  const summaries = data?.summaries ?? [];
  const currentBrandName = data?.brandName || brandName;
  const selfSelectCard = currentBrandName
    ? {cardType: 'brand', brandName: currentBrandName}
    : null;
  const selfSelectPayload = currentBrandName
    ? {searchWord: currentBrandName, searchType: '\u54c1\u724c'}
    : null;

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPage(1);
      const next = await mooketApi.getBrandDetail(
        brandName,
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
  }, [brandName, category, requestSortParam, tab]);

  useEffect(() => {
    loadFirst().catch(() => undefined);
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !data) return;
    if (page >= (data.totalPages ?? 1)) return;
    const next = page + 1;
    setLoadingMore(true);
    try {
      const more = await mooketApi.getBrandDetail(
        brandName,
        category,
        tab,
        requestSortParam,
        next,
        pageSize,
      );
      setPage(next);
      setData(prev =>
        prev ? {...more, summaries: mergeSummaries(prev.summaries, more.summaries)} : more,
      );
    } catch {
      // 静默
    } finally {
      setLoadingMore(false);
    }
  }, [brandName, category, data, loading, loadingMore, page, requestSortParam, tab]);

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
            text: brandName,
            onClose: () => {
              navigation.popToTop();
              navigation.navigate('Search', {category, keyword: searchKeyword, initialTab: tab});
            },
          },
        ]}
        topSlot={
          <OfferInquiryTabs
            tab={tab}
            onTabChange={setTab}
            showMerchant
            onMerchantPress={() => {
              navigation.replace('MerchantSearchResults', {
                category,
                searchKeyword,
                tags: [brandName],
                merchantSearch: {
                  display: searchKeyword,
                  matchType: 'brand',
                  type: '品牌',
                  brandName,
                },
                target: {screen: 'Brand', brandName},
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
          keyExtractor={(item, index) => `${item.productId}-${index}`}
          stickySectionHeadersEnabled
            initialNumToRender={8}
            maxToRenderPerBatch={5}
            windowSize={3}
            removeClippedSubviews
          ListHeaderComponent={
            <View>
              <BrandDashboard
                brandName={data.brandName || brandName}
                isInquiry={tab === 'inquiry'}
                factoryCount={getTabFactoryCount(data, tab)}
                productCount={getTabProductCount(data, tab)}
                todayOfferCount={data.todayOfferCount}
                yesterdayOfferCount={data.yesterdayOfferCount}
                totalOfferCount={data.totalOfferCount}
                todayInquiryCount={data.todayInquiryCount}
                yesterdayInquiryCount={data.yesterdayInquiryCount}
                totalInquiryCount={data.totalInquiryCount}
              />
              <View style={styles.gap} />
            </View>
          }
          renderSectionHeader={() => (
            <View style={styles.stickyHeader}>
              <TabAndSortBar tab={tab} onTabChange={setTab} sort={sort} onSortChange={setSort} showTabs={false} />
            </View>
          )}
          renderItem={({item}) => (
            <CountrySummaryRowCard
              title={item.productName}
              factoryNos={parseFactoryNos(item.factoryNos)}
              factoryCount={item.factoryCount}
              count={getTabCount(item, tab)}
              countLabel={tab === 'offer' ? '报盘' : '求购'}
              priceMin={item.priceMin}
              priceMax={item.priceMax}
              onPress={() =>
                navigation.navigate('BrandProduct', {
                  brandName: data.brandName || brandName,
                  productName: item.productName,
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
          ListEmptyComponent={!loading ? <Text style={styles.empty}>暂无数据</Text> : null}
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

function parseFactoryNos(input?: string | null): string[] {
  if (!input) return [];
  return input
    .split(/[,，；\s]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function mergeSummaries(prev: BrandProductSummary[], incoming: BrandProductSummary[]) {
  const seen = new Set(prev.map(item => `${item.productId}`));
  const next = prev.slice();
  for (const item of incoming) {
    if (!seen.has(`${item.productId}`)) {
      seen.add(`${item.productId}`);
      next.push(item);
    }
  }
  return next;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  loading: {paddingVertical: 48, alignItems: 'center'},
  topTabs: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EFF5F3', borderBottomWidth: 1, borderBottomColor: colors.border},
  gap: {height: 12, backgroundColor: '#F4FBF8'},
  footer: {alignItems: 'center', paddingVertical: 16},
  footerText: {color: '#9DA4A3', fontSize: 12},
  empty: {textAlign: 'center', paddingVertical: 48, color: '#9DA4A3', fontSize: 14},
  stickyHeader: {backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#DEE4E1', zIndex: 10, elevation: 3},
});
