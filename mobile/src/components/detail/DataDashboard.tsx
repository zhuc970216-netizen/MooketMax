import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {FeedStatLink} from './FeedStatLink';

type Stat = {
  label: string;
  value: string | number | null | undefined;
  onPress?: () => void;
};

type Props = {
  stats: Stat[];
  /** 顶部主标题（产品名/国家+厂号等） */
  title?: string;
  /** 左侧主指标（大数字，如近 2 日报盘） */
  mainStat?: {label: string; value: string | number | null | undefined; onPress?: () => void};
  /** 右上角价格区间 */
  priceRange?: {min?: number | null; max?: number | null};
};

/**
 * 详情页数据看板（与 Figma node-id 1371:5309 对齐）
 * - 商家页：仅传 stats —— 单行简洁横排
 * - 产品/国家+产品/国家+厂号+产品：传 title+mainStat+priceRange+stats
 *   左 167w：产品名 + "近2日报盘" + 36px 主色大数字
 *   右 140w：12px 间隔 + "价格区间（RMB）" + 16px 价格 + 1px 分隔线
 *           + "商家数 / 工厂数" 两列横排
 */
export function DataDashboard({stats, title, mainStat, priceRange}: Props) {
  const hasMainBlock = title || mainStat || priceRange;
  if (!hasMainBlock) {
    return (
      <View style={styles.simpleBar}>
        {stats.map(item => (
          <FeedStatLink
            key={item.label}
            label={item.label}
            value={formatStat(item.value)}
            onPress={item.onPress}
            style={styles.simpleItem}
          />
        ))}
      </View>
    );
  }

  const priceText = formatPrice(priceRange);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.left}>
          {title ? (
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
          ) : null}
          {mainStat ? (
            <FeedStatLink
              label={mainStat.label}
              value={formatStat(mainStat.value)}
              layout="large"
              onPress={mainStat.onPress}
              style={styles.mainStatBlock}
            />
          ) : null}
        </View>

        <View style={styles.right}>
          {priceRange ? (
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
          ) : null}
          {stats.length > 0 ? (
            <View style={styles.smallStatsRow}>
              {stats.map(item => (
                <FeedStatLink
                  key={item.label}
                  label={item.label}
                  value={formatStat(item.value)}
                  onPress={item.onPress}
                  layout="stacked"
                  style={styles.smallStat}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function formatStat(value: Stat['value']) {
  if (value == null || value === '') return '--';
  return String(value);
}

function formatPrice(range?: {min?: number | null; max?: number | null}) {
  if (!range) return {value: '--', unit: '', hasRange: false};
  const {min, max} = range;
  if (min != null && max != null && max >= min && min > 0) {
    if (min === max) return {value: `¥${formatPriceNumber(min)}`, unit: '/kg', hasRange: true};
    return {
      value: `¥${formatPriceNumber(min)} - ${formatPriceNumber(max)}`,
      unit: '/kg',
      hasRange: true,
    };
  }
  return {value: '暂无报价', unit: '', hasRange: false};
}

function formatPriceNumber(value: number) {
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
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 0,
  },
  left: {
    width: 167,
    gap: 4,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 30,
  },
  mainStatBlock: {
    gap: 0,
  },
  smallLabel: {
    color: 'rgba(60,73,71,0.5)',
    fontSize: 10,
    lineHeight: 14,
  },
  mainStatValue: {
    fontFamily: fonts.manropeBold,
    color: colors.primary,
    fontSize: 36,
    lineHeight: 42,
  },
  right: {
    flex: 1,
    paddingLeft: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#EFF5F3',
    gap: 6,
    justifyContent: 'space-between',
  },
  priceBlock: {
    width: '100%',
    gap: 4,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'nowrap',
  },
  priceValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.price,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  priceMuted: {
    color: colors.primary,
    fontSize: 14,
  },
  priceUnit: {
    fontFamily: fonts.manropeRegular,
    color: colors.text,
    fontSize: 10,
    lineHeight: 20,
  },
  smallStatsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 6,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#EFF5F3',
  },
  smallStat: {
    flex: 1,
    minWidth: 40,
    gap: 4,
  },
  smallValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  // 简单看板（商家页用）
  simpleBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  simpleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simpleLabel: {
    color: 'rgba(60,73,71,0.5)',
    fontSize: 10,
    lineHeight: 14,
  },
  simpleValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
});
