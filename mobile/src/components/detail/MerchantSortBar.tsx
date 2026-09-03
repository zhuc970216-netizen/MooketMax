import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors} from '../../theme/colors';
import type {OfferTab, SortOrder} from './TabAndSortBar';

export type MerchantSortKey = 'comprehensive' | 'publish_time' | 'price';
export type MerchantSortMode =
  | {kind: 'comprehensive'}
  | {kind: 'publish_time'}
  | {kind: 'price'; order: SortOrder};

type Props = {
  tab: OfferTab;
  onTabChange: (next: OfferTab) => void;
  sort: MerchantSortMode;
  onSortChange: (next: MerchantSortMode) => void;
  hideInquiry?: boolean;
  showTabs?: boolean;
  offerLabel?: string;
  inquiryLabel?: string;
};

export function MerchantSortBar({
  tab,
  onTabChange,
  sort,
  onSortChange,
  hideInquiry = false,
  showTabs = true,
  offerLabel = '报盘',
  inquiryLabel = '求购',
}: Props) {
  const priceOrder = sort.kind === 'price' ? sort.order : 'none';
  const nextPriceOrder: SortOrder = priceOrder === 'asc' ? 'desc' : 'asc';

  return (
    <View style={styles.bar}>
      {showTabs ? (
        <View style={styles.left}>
          <TabItem text={offerLabel} active={tab === 'offer'} onPress={() => onTabChange('offer')} />
          {!hideInquiry ? (
            <TabItem text={inquiryLabel} active={tab === 'inquiry'} onPress={() => onTabChange('inquiry')} />
          ) : null}
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.sortScroll, !showTabs && styles.sortScrollOnly]}
        contentContainerStyle={[styles.sortContent, showTabs && styles.sortContentRight]}>
        <Pressable onPress={() => onSortChange({kind: 'comprehensive'})}>
          <Text style={[styles.sortText, sort.kind === 'comprehensive' && styles.sortTextActive]}>
            综合推荐
          </Text>
        </Pressable>
        <Pressable onPress={() => onSortChange({kind: 'publish_time'})}>
          <Text style={[styles.sortText, sort.kind === 'publish_time' && styles.sortTextActive]}>
            发布时间
          </Text>
        </Pressable>
        <Pressable onPress={() => onSortChange({kind: 'price', order: nextPriceOrder})}>
          <Text
            style={[
              styles.sortText,
              sort.kind === 'price' && styles.sortTextActive,
            ]}>
            {priceOrder === 'desc' ? '价格降序↓' : '价格升序↑'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function TabItem({text, active, onPress}: {text: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{text}</Text>
      <View style={[styles.indicator, active && styles.indicatorActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 40,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {flexDirection: 'row', alignItems: 'center', gap: 28},
  sortScroll: {flex: 1, marginLeft: 10, flexShrink: 1},
  sortScrollOnly: {marginLeft: 0},
  sortContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 32,
    paddingHorizontal: 0,
  },
  sortContentRight: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: 24,
  },
  tabItem: {alignItems: 'center', gap: 2},
  tabText: {color: '#3C4947', fontSize: 14, lineHeight: 20, textAlign: 'center'},
  tabTextActive: {color: colors.text, fontWeight: '600'},
  indicator: {width: 18, height: 3, backgroundColor: 'transparent'},
  indicatorActive: {backgroundColor: colors.primary},
  sortText: {color: '#3C4947', fontSize: 14, lineHeight: 20, textAlign: 'center'},
  sortTextActive: {color: colors.text, fontWeight: '600'},
});
