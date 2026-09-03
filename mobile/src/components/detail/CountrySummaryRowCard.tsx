import React, {memo} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {SvgXml} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {dotXml, rightArrowXml} from './productIcons';

type Props = {
  title: string;
  factoryNos?: string[] | null;
  factoryCount?: number | null;
  count?: number | null;
  countLabel?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  onPress?: () => void;
};

function CountrySummaryRowCardInner({
  title,
  factoryNos,
  factoryCount,
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
            style={styles.factoryScroll}
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.factoryList}>
            {(factoryNos ?? []).map((factory, index) => (
              <View key={`${factory}-${index}`} style={styles.factoryChip}>
                <FactoryIcon />
                <Text style={styles.factoryName} numberOfLines={1}>
                  {factory}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.metaAction}>
            <View style={styles.countRow}>
              {factoryCount != null ? (
                <View style={styles.countCell}>
                  <Text style={styles.countValue}>{factoryCount}</Text>
                  <Text style={styles.countLabelText}>厂号</Text>
                </View>
              ) : null}
              {factoryCount != null && count != null ? (
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

export const CountrySummaryRowCard = memo(CountrySummaryRowCardInner);

function FactoryIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        opacity={0.4}
        d="M9.5 4C10.3284 4 11 3.32843 11 2.5C11 1.67157 10.3284 1 9.5 1C8.67157 1 8 1.67157 8 2.5C8 3.32843 8.67157 4 9.5 4Z"
        stroke="#244C56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        opacity={0.4}
        d="M3.5 6.5H6"
        stroke="#244C56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        opacity={0.4}
        d="M3.5 8.5H8"
        stroke="#244C56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 1H4.5C2 1 1 2 1 4.5V7.5C1 10 2 11 4.5 11H7.5C10 11 11 10 11 7.5V5"
        stroke="#244C56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function formatPrice(min?: number | null, max?: number | null) {
  if (min != null && max != null && min > 0 && max >= min) {
    if (min === max) return {value: `¥ ${num(min)}`, unit: '/kg', hasRange: true};
    return {value: `¥ ${num(min)} - ${num(max)}`, unit: '/kg', hasRange: true};
  }
  if (min != null && min > 0) return {value: `¥ ${num(min)}`, unit: '/kg', hasRange: true};
  return {value: '协商报价', unit: '', hasRange: false};
}

function num(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
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
  priceWrap: {flexDirection: 'row', alignItems: 'baseline'},
  priceValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.price,
    fontSize: 16,
    lineHeight: 20,
  },
  priceMuted: {color: colors.primary, fontSize: 14},
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
  factoryScroll: {
    flex: 1,
    minWidth: 0,
  },
  factoryList: {
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  factoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: '#F3F6F5',
  },
  factoryName: {
    color: '#3C4947',
    fontSize: 11,
    lineHeight: 14,
    maxWidth: 80,
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
  countLabelText: {color: '#3C4947', fontSize: 11, lineHeight: 14},
  dotWrap: {width: 4, height: 4, marginHorizontal: 4, alignItems: 'center', justifyContent: 'center'},
  arrowWrap: {width: 16, height: 16, flexShrink: 0, alignItems: 'center', justifyContent: 'center'},
  pressed: {
    opacity: 0.75,
  },
});
