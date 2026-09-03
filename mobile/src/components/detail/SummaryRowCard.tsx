import React, {memo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SvgXml} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {dotXml, merchantBuildingXml, rightArrowXml} from './productIcons';

type Props = {
  title: string;
  merchantNames?: string[] | null;
  merchantCount?: number | null;
  count?: number | null;
  countLabel?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  onPress?: () => void;
};

function SummaryRowCardInner({
  title,
  merchantNames,
  merchantCount,
  count,
  countLabel = '报盘',
  priceMin,
  priceMax,
  onPress,
}: Props) {
  const priceText = formatPrice(priceMin, priceMax);
  const hasPress = Boolean(onPress);

  return (
    <Pressable
      onPress={onPress}
      disabled={!hasPress}
      style={({pressed}) => [styles.card, pressed && hasPress && styles.pressed]}>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.priceWrap}>
            <Text style={[styles.priceValue, !priceText.hasRange && styles.priceMuted]}>
              {priceText.value}
            </Text>
            {priceText.unit ? <Text style={styles.priceUnit}>{priceText.unit}</Text> : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <ScrollView
            style={styles.merchantsScroll}
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.merchantsRow}>
            {dedupeNames(merchantNames).map((name, index) => (
              <View key={`${name}-${index}`} style={styles.merchantChip}>
                <SvgXml xml={merchantBuildingXml} width={14} height={14} />
                <Text style={styles.merchantName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.metaAction}>
            <View style={styles.countRow}>
              {merchantCount != null ? (
                <View style={styles.countCell}>
                  <Text style={styles.countValue}>{merchantCount}</Text>
                  <Text style={styles.countLabelText}>商家</Text>
                </View>
              ) : null}
              {merchantCount != null && count != null ? (
                <View style={styles.dotWrap}>
                  <SvgXml xml={dotXml} width={4} height={4} />
                </View>
              ) : null}
              {count != null ? (
                <View style={styles.countCell}>
                  <Text style={styles.countValue}>{count}</Text>
                  <Text style={styles.countLabelText}>{countLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
      {hasPress ? (
        <View style={styles.arrowWrap}>
          <SvgXml xml={rightArrowXml} width={16} height={16} />
        </View>
      ) : null}
    </Pressable>
  );
}

export const SummaryRowCard = memo(SummaryRowCardInner);

function formatPrice(min?: number | null, max?: number | null) {
  if (min != null && max != null && min > 0 && max >= min) {
    if (min === max) return {value: `¥ ${num(min)}`, unit: '/kg', hasRange: true};
    return {value: `¥ ${num(min)} - ${num(max)}`, unit: '/kg', hasRange: true};
  }
  if (min != null && min > 0) {
    return {value: `¥ ${num(min)}`, unit: '/kg', hasRange: true};
  }
  return {value: '协商报价', unit: '', hasRange: false};
}

function num(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function dedupeNames(names?: string[] | null): string[] {
  if (!names) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = normalizeMerchantName(name);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeMerchantName(name?: string | null): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return '';
  const sep = trimmed.indexOf('|');
  if (sep <= 0) return trimmed;
  const shortName = trimmed.slice(0, sep).trim();
  const fullName = trimmed.slice(sep + 1).trim();
  return shortName && shortName.toUpperCase() !== 'NULL' ? shortName : fullName;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  body: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.price,
    fontSize: 16,
    lineHeight: 20,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  merchantsScroll: {
    flex: 1,
    minWidth: 0,
  },
  merchantsRow: {
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  merchantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: '#F3F6F5',
  },
  merchantName: {
    color: '#3C4947',
    fontSize: 11,
    lineHeight: 14,
    maxWidth: 120,
  },
  metaAction: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
  },
  countCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  countValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 13,
    lineHeight: 14,
  },
  countLabelText: {
    color: '#3C4947',
    fontSize: 11,
    lineHeight: 14,
  },
  dotWrap: {
    width: 4,
    height: 4,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowWrap: {
    width: 16,
    height: 16,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
