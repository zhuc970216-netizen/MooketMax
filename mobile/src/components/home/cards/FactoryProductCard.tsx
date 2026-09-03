import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../theme/colors';
import {fonts} from '../../../theme/typography';
import type {HomeCardItem} from '../../../types/api';
import {asText} from '../../../utils/format';
import {getCountryFlag} from '../../../utils/country';
import {MiniTrendChart} from '../MiniTrendChart';
import {cardBaseStyle, formatPriceRange, priceChangePalette, sharedStyles} from './shared';

type Props = {card: HomeCardItem; onPress?: () => void; onLongPress?: () => void};

export function FactoryProductCard({card, onPress, onLongPress}: Props) {
  const flag = getCountryFlag(card.country);
  const merchants = (card.hotMerchants ?? []).slice(0, 3) as Array<Record<string, unknown>>;
  const trend = (card.trendPoints ?? [])
    .map(item => Number((item as Record<string, unknown>).avgPrice))
    .filter(value => Number.isFinite(value)) as number[];
  const palette = priceChangePalette(card.priceChange);

  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      delayLongPress={250}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.titleBlock}>
        <View style={styles.titleWrap}>
          {flag ? <Text style={styles.flag}>{flag}</Text> : null}
          <Text style={styles.countryText} numberOfLines={1}>
            {card.countryAlias ?? card.country ?? '--'}
          </Text>
          <Text style={styles.factoryText} numberOfLines={1}>
            {card.factoryNo ?? ''}
          </Text>
        </View>
        {card.productName ? (
          <Text style={styles.titleText} numberOfLines={1}>{card.productName}</Text>
        ) : null}
      </View>

      <View style={styles.priceLine}>
        <Text style={styles.priceValue}>{formatPriceRange(card.priceMin, card.priceMax)}</Text>
        <Text style={styles.priceUnit}>/kg</Text>
      </View>

      {card.priceChange != null || card.priceChangeRate != null ? (
        <View style={[styles.changeBadge, {backgroundColor: palette.bg}]}>
          <Text style={[styles.changeText, {color: palette.fg}]}>{formatChange(card.priceChange)}</Text>
          {card.priceChangeRate != null ? (
            <Text style={[styles.changeText, {color: palette.fg}]}>
              {`  ${(card.priceChangeRate > 0 ? '+' : '') + card.priceChangeRate.toFixed(2)}%`}
            </Text>
          ) : null}
        </View>
      ) : null}

      {trend.length > 1 ? <MiniTrendChart data={trend} /> : null}

      <View style={styles.tableHead}>
        <Text style={sharedStyles.smallLabel}>热门商家</Text>
        <Text style={sharedStyles.smallLabel}>(元/千克)</Text>
      </View>

      {merchants.length > 0 ? (
        merchants.map((m, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {asText(m.merchantName) || `商家-${asText(m.merchantId)}`}
            </Text>
            <Text style={styles.rowPrice}>
              {formatPriceRange(m.priceMin as number, m.priceMax as number)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>暂无数据</Text>
      )}

      <View style={sharedStyles.divider} />

      <View style={styles.bottomRow}>
        <View style={styles.col}>
          <Text style={sharedStyles.smallLabel}>近2日报盘数</Text>
          <Text style={sharedStyles.midStat}>{card.todayOfferCount ?? '--'}</Text>
        </View>
        <View style={styles.col}>
          <Text style={sharedStyles.smallLabel}>近2日求购数</Text>
          <Text style={sharedStyles.midStat}>{card.inquiryCount ?? '--'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function formatChange(change?: number | null): string {
  if (change == null) return '0';
  if (change > 0) return `+${change.toFixed(2)}`;
  return change.toFixed(2);
}

const styles = StyleSheet.create({
  card: {...cardBaseStyle, gap: 6},
  pressed: {opacity: 0.85},
  titleBlock: {gap: 0},
  titleWrap: {flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'nowrap'},
  flag: {fontSize: 20, lineHeight: 28},
  countryText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 28,
    fontWeight: '500',
    flexShrink: 0,
  },
  factoryText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 28,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
    includeFontPadding: false,
  },
  titleText: {color: colors.text, fontSize: 16, lineHeight: 28, fontWeight: '500'},
  priceLine: {flexDirection: 'row', alignItems: 'baseline'},
  priceValue: {fontFamily: fonts.manropeBold, color: colors.price, fontSize: 20, lineHeight: 26},
  priceUnit: {fontFamily: fonts.manropeRegular, color: '#3C4947', fontSize: 11, marginLeft: 2},
  changeBadge: {alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 2, flexDirection: 'row'},
  changeText: {fontFamily: fonts.manropeSemiBold, fontSize: 11, lineHeight: 14},
  tableHead: {flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2},
  name: {flex: 1, color: colors.text, fontSize: 11, lineHeight: 18, paddingRight: 8},
  rowPrice: {fontFamily: fonts.manropeSemiBold, color: colors.price, fontSize: 12, lineHeight: 18},
  empty: {color: '#9DA4A3', fontSize: 11, paddingVertical: 4},
  bottomRow: {flexDirection: 'row', gap: 24, paddingTop: 4},
  col: {gap: 4, flex: 1},
});
