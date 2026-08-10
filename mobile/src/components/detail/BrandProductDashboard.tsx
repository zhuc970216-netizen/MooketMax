import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {formatCount} from '../../utils/format';
import {FeedStatLink} from './FeedStatLink';

type Props = {
  brandName: string;
  productName: string;
  isInquiry?: boolean;
  todayOfferCount?: number | null;
  todayInquiryCount?: number | null;
  totalOfferCount?: number | null;
  totalInquiryCount?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  merchantCount?: number | null;
  factoryCount?: number | null;
  onFeedPress?: () => void;
};

/**
 * 品牌+产品详情看板（与 Figma 1371:5205 / 158:1108 对齐）
 * 行 1: 标题"品牌 · 产品名"
 * 行 2 左 167w：近2日报盘 + 36px Manrope 大数字主色
 *      右 140w：左竖线分隔
 *               价格区间（RMB） + 16px Manrope 黑色价格
 *               1px 分隔
 *               商家数 / 工厂数 横排
 */
export function BrandProductDashboard({
  brandName,
  productName,
  isInquiry = false,
  todayOfferCount,
  todayInquiryCount,
  totalOfferCount,
  totalInquiryCount,
  priceMin,
  priceMax,
  merchantCount,
  factoryCount,
  onFeedPress,
}: Props) {
  const bigValue = isInquiry
    ? totalInquiryCount ?? (todayInquiryCount ?? 0)
    : totalOfferCount ?? (todayOfferCount ?? 0);
  const priceText = formatPrice(priceMin, priceMax);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* 左侧 */}
        <View style={styles.left}>
          {/* 第1段：标题 - 对齐右侧价格区间顶部 */}
          <View style={styles.titleRow}>
            <Text style={styles.titlePart} numberOfLines={1}>{brandName}</Text>
            <View style={styles.dot} />
            <Text style={styles.titlePart} numberOfLines={1}>{productName}</Text>
          </View>
          {/* 第2段：近2日报盘 - 对齐右侧分隔线 */}
          <FeedStatLink
            label={isInquiry ? '近2日求购' : '近2日报盘'}
            value={formatCount(bigValue)}
            layout="large"
            onPress={onFeedPress}
          />
        </View>

        {/* 右侧 */}
        <View style={styles.right}>
          {/* 第1段：价格区间 - 对齐左侧标题 */}
          <View style={styles.priceBlock}>
            <Text style={styles.smallLabel}>价格区间（RMB）</Text>
            <View style={styles.priceLine}>
              <Text
                style={[styles.priceValue, !priceText.hasRange && styles.priceMuted]}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {priceText.value}
              </Text>
              {priceText.unit ? <Text style={styles.priceUnit}>{priceText.unit}</Text> : null}
            </View>
          </View>
          {/* 第2段：分隔线 - 对齐左侧近2日报盘 */}
          <View style={styles.divider} />
          {/* 第3段：商家数/工厂数 - 对齐左侧大数字 */}
          <View style={styles.statsRow}>
            <Stat label="商家数" value={merchantCount ?? '--'} />
            <Stat label="工厂数" value={factoryCount ?? '--'} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Stat({label, value}: {label: string; value: string | number}) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function formatPrice(min?: number | null, max?: number | null) {
  if (min != null && max != null && min > 0 && max >= min) {
    if (min === max) return {value: `¥${num(min)}`, unit: '/kg', hasRange: true};
    return {value: `¥${num(min)} - ${num(max)}`, unit: '/kg', hasRange: true};
  }
  if (min != null && min > 0) return {value: `¥${num(min)}`, unit: '/kg', hasRange: true};
  return {value: '暂无报价', unit: '', hasRange: false};
}

function num(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'},
  left: {width: 167},
  right: {
    width: 140,
    paddingLeft: 24,
    borderLeftWidth: 1,
    borderLeftColor: '#EFF5F3',
  },

  /* 第1段：标题 ↔ 价格区间，高度 38 对齐 */
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 6, height: 38},
  titlePart: {color: colors.text, fontSize: 20, fontWeight: '500', lineHeight: 30, flexShrink: 1},
  dot: {width: 4, height: 4, borderRadius: 2, backgroundColor: '#171D1C'},
  priceBlock: {height: 38, justifyContent: 'center', gap: 2},
  priceLine: {flexDirection: 'row', alignItems: 'baseline', flexWrap: 'nowrap'},
  priceValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.price,
    fontSize: 16,
    lineHeight: 20,
    flexShrink: 1,
  },
  priceMuted: {color: colors.primary, fontSize: 14},
  priceUnit: {
    fontFamily: fonts.manropeRegular,
    color: colors.text,
    fontSize: 12,
    lineHeight: 20,
  },

  /* 第2段：近2日报盘 ↔ 分隔线，高度 14 对齐 */
  smallLabel: {color: 'rgba(60,73,71,0.5)', fontSize: 10, lineHeight: 14},
  divider: {height: 1, backgroundColor: '#EFF5F3', marginVertical: 6},

  /* 第3段：大数字 ↔ 商家数/工厂数 */
  bigValue: {
    fontFamily: fonts.manropeBold,
    color: colors.primary,
    fontSize: 36,
    lineHeight: 42,
  },
  statsRow: {flexDirection: 'row', gap: 24},
  statCol: {gap: 4, width: 40},
  statValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
});
