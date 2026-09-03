import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../theme/colors';
import {fonts} from '../../../theme/typography';
import type {HomeCardItem} from '../../../types/api';
import {asText} from '../../../utils/format';
import {getCountryFlag} from '../../../utils/country';
import {cardBaseStyle, formatPriceRange, sharedStyles} from './shared';

type Props = {card: HomeCardItem; onPress?: () => void; onLongPress?: () => void};

export function CountryProductCard({card, onPress, onLongPress}: Props) {
  const flag = getCountryFlag(card.country);
  const factories = (card.topFactories ?? []).slice(0, 3) as Array<Record<string, unknown>>;

  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      delayLongPress={250}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.titleWrap}>
        {flag ? <Text style={styles.flag}>{flag}</Text> : null}
        <Text style={styles.titleText} numberOfLines={1}>
          {`${card.countryAlias ?? card.country ?? '--'} ${card.productName ?? ''}`}
        </Text>
      </View>

      <View style={styles.tableHead}>
        <Text style={sharedStyles.smallLabel}>热门工厂</Text>
        <Text style={sharedStyles.smallLabel}>(元/千克)</Text>
      </View>

      {factories.length > 0 ? (
        factories.map((item, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {asText(item.factoryNo)}
            </Text>
            <Text style={styles.price}>
              {formatPriceRange(item.priceMin as number, item.priceMax as number)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>暂无数据</Text>
      )}

      <View style={sharedStyles.divider} />

      <View style={styles.bottomRow}>
        <View style={styles.col}>
          <Text style={sharedStyles.smallLabel}>近2日报盘工厂</Text>
          <Text style={sharedStyles.midStat}>{card.factoryCount ?? '--'}</Text>
        </View>
        <View style={styles.col}>
          <Text style={sharedStyles.smallLabel}>近2日报盘数</Text>
          <Text style={sharedStyles.midStat}>{card.todayOfferCount ?? '--'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {...cardBaseStyle, gap: 6},
  pressed: {opacity: 0.85},
  titleWrap: {flexDirection: 'row', alignItems: 'center', gap: 6},
  flag: {fontSize: 20, lineHeight: 28},
  titleText: {color: colors.text, fontSize: 16, lineHeight: 28, fontWeight: '500', flex: 1},
  tableHead: {flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2},
  name: {flex: 1, color: colors.text, fontSize: 11, lineHeight: 18, paddingRight: 8},
  price: {fontFamily: fonts.manropeSemiBold, color: colors.price, fontSize: 12, lineHeight: 18},
  empty: {color: '#9DA4A3', fontSize: 11, paddingVertical: 4},
  bottomRow: {flexDirection: 'row', gap: 16, paddingTop: 4},
  col: {gap: 4, minWidth: 40},
});
