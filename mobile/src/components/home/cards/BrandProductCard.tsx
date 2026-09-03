import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../../theme/colors';
import {fonts} from '../../../theme/typography';
import type {HomeCardItem} from '../../../types/api';
import {asText} from '../../../utils/format';
import {MiniTrendChart} from '../MiniTrendChart';
import {cardBaseStyle, formatPriceRange, priceChangePalette, sharedStyles} from './shared';

type Props = {card: HomeCardItem; onPress?: () => void; onLongPress?: () => void};

export function BrandProductCard({card, onPress, onLongPress}: Props) {
  const factories = (card.hotFactories ?? []).slice(0, 3) as Array<Record<string, unknown>>;
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
      <View style={styles.titleWrap}>
        <View style={styles.brandIconWrap}>
          <BrandIcon />
        </View>
        <Text style={styles.titleText} numberOfLines={2}>
          {`${card.brandName || ''} ${card.productName || ''}`}
        </Text>
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
        <Text style={sharedStyles.smallLabel}>热门工厂</Text>
        <Text style={sharedStyles.smallLabel}>(元/千克)</Text>
      </View>

      {factories.length > 0 ? (
        factories.map((f, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {asText(f.factoryNo)}
            </Text>
            <Text style={styles.rowPrice}>
              {formatPriceRange(f.priceMin as number, f.priceMax as number)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>暂无数据</Text>
      )}

      <View style={sharedStyles.divider} />

      <View style={styles.bottomRow}>
        <View style={styles.colLeft}>
          <Text style={sharedStyles.smallLabel}>近2日报盘工厂</Text>
          <Text style={sharedStyles.midStat}>{card.factoryCount ?? '--'}</Text>
        </View>
        <View style={styles.colRight}>
          <Text style={sharedStyles.smallLabel}>近2日报盘数</Text>
          <Text style={sharedStyles.midStat}>{card.todayOfferCount ?? '--'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function BrandIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d="M5 5l6-2 6 2v9c0 2.5-2.5 5-6 5s-6-2.5-6-5V5Z"
        fill="#FFFFFF"
        stroke="#1F2D3A"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path d="M8 9h6M8 12h6" stroke="#1F2D3A" strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
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
  titleWrap: {flexDirection: 'row', alignItems: 'flex-start', gap: 6},
  brandIconWrap: {marginTop: 3},
  titleText: {color: colors.text, fontSize: 16, lineHeight: 28, fontWeight: '500', flex: 1},
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
  bottomRow: {flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4},
  colLeft: {gap: 4},
  colRight: {gap: 4, alignItems: 'flex-end'},
});
