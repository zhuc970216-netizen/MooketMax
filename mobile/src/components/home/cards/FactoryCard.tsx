import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../theme/colors';
import {fonts} from '../../../theme/typography';
import type {HomeCardItem} from '../../../types/api';
import {asText} from '../../../utils/format';
import {getCountryFlag} from '../../../utils/country';
import {normalizeFactoryNo} from '../../../utils/factoryNo';
import {cardBaseStyle, formatThousand, rankPalette, sharedStyles} from './shared';

type Props = {card: HomeCardItem; onPress?: () => void; onLongPress?: () => void};

/**
 * 厂号卡（按 Figma 262:1069 对齐）
 */
export function FactoryCard({card, onPress, onLongPress}: Props) {
  const flag = getCountryFlag(card.country);
  const products = (card.hotProducts ?? []).slice(0, 3) as Array<Record<string, unknown>>;
  const factoryNo = normalizeFactoryNo(card.factoryNo);
  const title = `${card.countryAlias ?? card.country ?? '--'}${factoryNo}`;

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
          {title}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={sharedStyles.smallLabel}>热门产品</Text>
        {products.length > 0 ? (
          products.map((product, index) => {
            const rank = (product.rank as number | undefined) ?? index + 1;
            const palette = rankPalette(rank);
            return (
              <View key={index} style={styles.row}>
                <View style={[styles.rank, {backgroundColor: palette.bg, borderColor: palette.borderInner}]}>
                  <Text style={[styles.rankText, {color: palette.fg}]}>{rank}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {asText(product.productName)}
                </Text>
                <Text style={styles.count}>
                  {formatThousand(product.offerCount as number | undefined)}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>暂无数据</Text>
        )}
      </View>

      <View style={sharedStyles.divider} />

      <View style={styles.bottomRow}>
        <Text style={sharedStyles.smallLabel}>近2日报盘数</Text>
        <Text style={sharedStyles.midStat}>{formatThousand(card.todayOfferCount)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    ...cardBaseStyle,
    gap: 8,
    backgroundColor: '#F2FFF8',
  },
  pressed: {opacity: 0.85},
  titleWrap: {flexDirection: 'row', alignItems: 'center', gap: 6},
  flag: {fontSize: 20, lineHeight: 28},
  titleText: {color: colors.text, fontSize: 16, lineHeight: 28, fontWeight: '500', flex: 1},
  body: {gap: 4},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  rank: {
    width: 18,
    height: 18,
    borderRadius: 2,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {fontFamily: fonts.manropeBold, fontSize: 12, lineHeight: 15},
  name: {flex: 1, color: colors.text, fontSize: 11, lineHeight: 18},
  count: {fontFamily: fonts.manropeSemiBold, color: colors.text, fontSize: 14, lineHeight: 18},
  empty: {color: '#9DA4A3', fontSize: 11, paddingVertical: 4},
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
});
