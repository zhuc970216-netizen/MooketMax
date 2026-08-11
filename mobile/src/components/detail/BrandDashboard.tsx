import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {formatCount} from '../../utils/format';
import {getRecentBrandInquiryCount, getRecentBrandOfferCount} from '../../utils/brandStats';
import {FeedStatLink} from './FeedStatLink';

type Props = {
  brandName: string;
  isInquiry?: boolean;
  factoryCount?: number | null;
  productCount?: number | null;
  todayOfferCount?: number | null;
  yesterdayOfferCount?: number | null;
  totalOfferCount?: number | null;
  todayInquiryCount?: number | null;
  yesterdayInquiryCount?: number | null;
  totalInquiryCount?: number | null;
  onFeedPress?: () => void;
};

/**
 * 品牌详情看板（与 Figma 1353:2325 对齐）
 * 左：品牌名 + 工厂数/产品数 横排
 * 右：76w 边线 + "近2日报盘" + 36px Manrope 主色
 */
export function BrandDashboard({
  brandName,
  isInquiry = false,
  factoryCount,
  productCount,
  todayOfferCount,
  yesterdayOfferCount,
  totalOfferCount,
  todayInquiryCount,
  yesterdayInquiryCount,
  totalInquiryCount,
  onFeedPress,
}: Props) {
  const bigValue = isInquiry
    ? getRecentBrandInquiryCount({todayInquiryCount, yesterdayInquiryCount, totalInquiryCount}) ?? 0
    : getRecentBrandOfferCount({todayOfferCount, yesterdayOfferCount, totalOfferCount}) ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.title} numberOfLines={1}>
            {brandName}
          </Text>
          <View style={styles.statsRow}>
            <Stat label="工厂数" value={factoryCount} />
            <Stat label="产品数" value={productCount} />
          </View>
        </View>
        <FeedStatLink
          label={isInquiry ? '近2日求购' : '近2日报盘'}
          value={formatCount(bigValue)}
          layout="large"
          align="end"
          onPress={onFeedPress}
          style={styles.right}
        />
      </View>
    </View>
  );
}

function Stat({label, value}: {label: string; value: number | null | undefined}) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={styles.statValue}>{value ?? '--'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  left: {flex: 1, gap: 4},
  title: {color: colors.text, fontSize: 20, fontWeight: '500', lineHeight: 30},
  statsRow: {flexDirection: 'row', gap: 24},
  statItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  smallLabel: {color: 'rgba(60,73,71,0.5)', fontSize: 10, lineHeight: 14},
  statValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  right: {
    width: 88,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#EFF5F3',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  bigValue: {
    fontFamily: fonts.manropeBold,
    color: colors.primary,
    fontSize: 36,
    lineHeight: 42,
  },
});
