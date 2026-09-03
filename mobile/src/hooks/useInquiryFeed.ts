import {useCallback, useEffect, useRef, useState} from 'react';
import {mooketApi} from '../api/mooketApi';
import type {OfferFeedItem} from '../types/api';

const DEFAULT_PAGE_SIZE = 10;

type Params = {
  enabled: boolean;
  category: string;
  sortBy: string;
  productName?: string | null;
  brandName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  pageSize?: number;
};

export function useInquiryFeed({
  enabled,
  category,
  sortBy,
  productName,
  brandName,
  country,
  factoryNo,
  pageSize = DEFAULT_PAGE_SIZE,
}: Params) {
  const [items, setItems] = useState<OfferFeedItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const loadPage = useCallback(
    async (nextPage: number, mode: 'replace' | 'refresh' | 'more' = 'replace') => {
      if (!enabled) return;
      const requestSeq = (requestSeqRef.current += 1);
      if (mode === 'more') setLoadingMore(true);
      else if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);

      try {
        const result = await mooketApi.getOfferFeed({
          category,
          type: 'inquiry',
          productName: productName ?? undefined,
          brandName: brandName ?? undefined,
          country: country ?? undefined,
          factoryNo: factoryNo ?? undefined,
          sortBy,
          page: nextPage,
          pageSize,
          skipCache: mode === 'refresh',
        });
        if (requestSeq !== requestSeqRef.current) return;
        setItems(prev => (mode === 'more' ? prev.concat(result.items ?? []) : result.items ?? []));
        setTotalCount(result.totalCount ?? 0);
        setPage(result.page ?? nextPage);
        setTotalPages(result.totalPages ?? 1);
        setError(null);
      } catch (e) {
        if (requestSeq !== requestSeqRef.current) return;
        setError(e instanceof Error ? e.message : '加载失败，请稍后重试');
        if (mode !== 'more') {
          setItems([]);
          setTotalCount(0);
          setPage(1);
          setTotalPages(1);
        }
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [brandName, category, country, enabled, factoryNo, pageSize, productName, sortBy],
  );

  useEffect(() => {
    if (!enabled) return;
    loadPage(1).catch(() => undefined);
  }, [enabled, loadPage]);

  const refresh = useCallback(() => loadPage(1, 'refresh'), [loadPage]);

  const loadMore = useCallback(() => {
    if (!enabled || loading || refreshing || loadingMore || page >= totalPages) return Promise.resolve();
    return loadPage(page + 1, 'more');
  }, [enabled, loadPage, loading, loadingMore, page, refreshing, totalPages]);

  return {
    items,
    totalCount,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: page < totalPages,
    refresh,
    loadMore,
  };
}
