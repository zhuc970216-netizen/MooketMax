import React, {useState} from 'react';
import {ActivityIndicator, Alert, RefreshControl, SectionList, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import type {OfferFeedItem} from '../../types/api';
import type {OriginalTextPayload} from '../../utils/originalText';
import {addIntentPlate, createPlateSnapshotFromFeed, recordRecentContactPlate} from '../../utils/plateFollowStore';
import {OriginalTextSheet} from './OriginalTextSheet';
import {OfferFeedCard} from '../../screens/OfferFeedScreen';

type Props = {
  items: OfferFeedItem[];
  category: string;
  navigation: {
    navigate: (screen: 'Merchant', params: {merchantId: number | string; category: string; initialTab?: 'offer' | 'inquiry'}) => void;
  };
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  onRefresh: () => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  ListHeaderComponent: React.ReactElement;
  renderSectionHeader: () => React.ReactElement;
};

export function InquiryFeedSectionList({
  items,
  category,
  navigation,
  loading,
  refreshing,
  loadingMore,
  error,
  onRefresh,
  onLoadMore,
  ListHeaderComponent,
  renderSectionHeader,
}: Props) {
  const [originalText, setOriginalText] = useState<OriginalTextPayload | null>(null);

  async function addIntent(item: OfferFeedItem) {
    try {
      const result = await addIntentPlate(createPlateSnapshotFromFeed(item, 'inquiry'));
      Alert.alert(result.alreadyAdded ? '已在意向盘' : '已加入意向盘', result.alreadyAdded ? '这条盘已在意向盘中。' : '后续可以在首页“我的跟进”里找回。');
    } catch (error) {
      Alert.alert('加入失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  return (
    <>
      <SectionList
        sections={[{key: 'items', data: items}]}
        keyExtractor={(item, index) => `${item.offerId ?? item.merchantId ?? 'inquiry'}-${index}`}
        stickySectionHeadersEnabled
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        contentContainerStyle={styles.content}
        ListHeaderComponent={ListHeaderComponent}
        renderSectionHeader={renderSectionHeader}
        renderItem={({item}) => (
          <View style={styles.cardWrap}>
            <OfferFeedCard
              item={item}
              tab="inquiry"
              onMerchantPress={() => {
                if (item.merchantId != null) {
                  navigation.navigate('Merchant', {merchantId: item.merchantId, category, initialTab: 'inquiry'});
                }
              }}
              onViewOriginalText={setOriginalText}
              onAddIntent={() => addIntent(item)}
              onContact={action => {
                recordRecentContactPlate(createPlateSnapshotFromFeed(item, 'inquiry'), action).catch(() => undefined);
              }}
            />
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={() => {
          if (!loading && !loadingMore) {
            void onLoadMore();
          }
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : error ? (
            <Text style={styles.empty}>{error}</Text>
          ) : (
            <Text style={styles.empty}>暂无匹配数据</Text>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.footerLoading} />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      <OriginalTextSheet
        visible={originalText !== null}
        text={originalText?.text ?? ''}
        keywords={originalText?.keywords ?? []}
        onClose={() => setOriginalText(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
    backgroundColor: '#F4F7F6',
  },
  cardWrap: {
    paddingHorizontal: 8,
  },
  loading: {
    marginTop: 40,
  },
  footerLoading: {
    paddingVertical: 16,
  },
  empty: {
    marginTop: 48,
    textAlign: 'center',
    color: '#9DA4A3',
    fontSize: 14,
  },
});
