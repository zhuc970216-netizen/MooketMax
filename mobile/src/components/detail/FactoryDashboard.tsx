import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {getCountryFlag} from '../../utils/country';
import {formatCount} from '../../utils/format';
import {FeedStatLink} from './FeedStatLink';

type Props = {
  country: string;
  factoryNo: string;
  isInquiry?: boolean;
  productCount?: number | null;
  inquiryCount?: number | null;
  recentOfferCount?: number | null;
  secondaryCountLabel?: string;
  secondaryCount?: number | null;
  onFeedPress?: () => void;
};

/**
 * 国家+厂号详情看板（与 Figma 1353:2384 对齐）
 * 左：国旗 + "国家+厂号" + 产品数/求购数横排
 * 右：76w 边线 + "近2日报盘" + 36px Manrope Bold 主色
 */
export function FactoryDashboard({
  country,
  factoryNo,
  isInquiry = false,
  productCount,
  inquiryCount,
  recentOfferCount,
  secondaryCountLabel,
  secondaryCount,
  onFeedPress,
}: Props) {
  const flag = getCountryFlag(country);
  const bigValue = isInquiry ? inquiryCount ?? 0 : recentOfferCount ?? 0;
  const secondaryLabel = secondaryCountLabel ?? (isInquiry ? '求购数' : '报盘数');
  const secondaryValue = secondaryCount ?? (isInquiry ? inquiryCount : recentOfferCount);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.titleRow}>
            {flag ? <Text style={styles.flag}>{flag}</Text> : null}
            <Text style={styles.title} numberOfLines={1}>
              {`${country}${factoryNo}`}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <Stat label="产品数" value={productCount} />
            <Stat label={secondaryLabel} value={secondaryValue} />
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
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  flag: {fontSize: 22, lineHeight: 24},
  title: {color: colors.text, fontSize: 20, fontWeight: '500', lineHeight: 30, flex: 1},
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
