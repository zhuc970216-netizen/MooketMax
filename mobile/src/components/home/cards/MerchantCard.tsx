import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {SvgXml} from 'react-native-svg';
import {colors} from '../../../theme/colors';
import {fonts} from '../../../theme/typography';
import type {HomeCardItem} from '../../../types/api';
import {asText} from '../../../utils/format';
import {cardBaseStyle, formatThousand, sharedStyles} from './shared';

type Props = {card: HomeCardItem; onPress?: () => void; onLongPress?: () => void};

const merchantIconXml = `<svg viewBox="0 0 22 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.2237 18.4071V9.66841C11.2237 9.39637 11.2948 9.12906 11.4299 8.89294C11.565 8.65682 11.7595 8.46008 11.994 8.3222L14.0806 7.0957C14.3205 6.95467 14.5937 6.88031 14.8719 6.88031C15.1502 6.88031 15.4234 6.95467 15.6633 7.0957L17.7501 8.3222C17.9846 8.46009 18.179 8.65684 18.3141 8.89296C18.4491 9.12908 18.5202 9.39638 18.5202 9.66841V18.4071H11.2237Z" fill="#D2E2E6"/><path d="M11.4595 19.3643H3.10715C2.55922 19.3638 2.0339 19.1734 1.64645 18.835C1.259 18.4965 1.04107 18.0377 1.04047 17.5591V5.13421C1.04056 4.75717 1.14509 4.38574 1.34515 4.05163C1.54521 3.71752 1.83485 3.43066 2.18935 3.21553L5.75785 1.0508C6.20632 0.780481 6.73832 0.635712 7.2832 0.635712C7.82808 0.635712 8.36007 0.780481 8.80854 1.0508L12.3773 3.21553C12.7318 3.43065 13.0215 3.71751 13.2215 4.05162C13.4216 4.38573 13.5261 4.75716 13.5262 5.13421V17.5591C13.5256 18.0377 13.3076 18.4965 12.9202 18.835C12.5328 19.1734 12.0074 19.3638 11.4595 19.3643ZM7.28332 2.04158C7.06663 2.04129 6.85502 2.09891 6.67691 2.20671L3.10816 4.37145C2.96725 4.45698 2.85212 4.57103 2.7726 4.70385C2.69309 4.83667 2.65155 4.98433 2.65153 5.13421V17.5591C2.65166 17.6646 2.69971 17.7657 2.78512 17.8403C2.87054 17.915 2.98636 17.9569 3.10715 17.957H11.4595C11.5803 17.9569 11.6961 17.915 11.7815 17.8403C11.8669 17.7657 11.915 17.6646 11.9151 17.5591V5.13421C11.9151 4.98432 11.8736 4.83666 11.7941 4.70384C11.7146 4.57101 11.5994 4.45697 11.4585 4.37145L7.88974 2.20671C7.71159 2.09897 7.5 2.04136 7.28332 2.04158Z" fill="#244C56"/><path d="M18.8345 18.8689C18.6534 18.8689 18.4797 18.797 18.3517 18.6689C18.2236 18.5409 18.1517 18.3672 18.1517 18.1861V9.15803C18.152 8.98765 18.1096 8.8199 18.0285 8.67008C17.9474 8.52025 17.83 8.39311 17.6872 8.30025L11.5608 4.30281C11.4092 4.20377 11.3031 4.04854 11.2659 3.87127C11.2286 3.694 11.2634 3.5092 11.3624 3.35754C11.4614 3.20587 11.6167 3.09976 11.7939 3.06255C11.9712 3.02533 12.156 3.06006 12.3077 3.1591L18.4336 7.15654C18.7668 7.37325 19.0406 7.66992 19.2299 8.01951C19.4192 8.36909 19.518 8.76049 19.5173 9.15803V18.1861C19.5173 18.3672 19.4454 18.5409 19.3173 18.6689C19.1893 18.797 19.0156 18.8689 18.8345 18.8689Z" fill="#244C56"/><path d="M5.2692 9.05819H9.29744C9.45314 9.05819 9.60246 8.98625 9.71256 8.8582C9.82266 8.73015 9.88451 8.55647 9.88451 8.37538C9.88451 8.19429 9.82266 8.02061 9.71256 7.89256C9.60246 7.76451 9.45314 7.69257 9.29744 7.69257H5.2692C5.1135 7.69257 4.96417 7.76451 4.85408 7.89256C4.74398 8.02061 4.68213 8.19429 4.68213 8.37538C4.68213 8.55647 4.74398 8.73015 4.85408 8.8582C4.96417 8.98625 5.1135 9.05819 5.2692 9.05819Z" fill="#5098AA"/><path d="M5.2692 13.1642H9.29744C9.45314 13.1642 9.60246 13.0923 9.71256 12.9643C9.82266 12.8362 9.88451 12.6625 9.88451 12.4814C9.88451 12.3003 9.82266 12.1267 9.71256 11.9986C9.60246 11.8706 9.45314 11.7986 9.29744 11.7986H5.2692C5.1135 11.7986 4.96417 11.8706 4.85408 11.9986C4.74398 12.1267 4.68213 12.3003 4.68213 12.4814C4.68213 12.6625 4.74398 12.8362 4.85408 12.9643C4.96417 13.0923 5.1135 13.1642 5.2692 13.1642Z" fill="#5098AA"/><path d="M15.9014 15.5799C15.7203 15.5799 15.5466 15.5079 15.4186 15.3799C15.2905 15.2518 15.2186 15.0782 15.2186 14.8971V10.7558C15.2186 10.5747 15.2905 10.401 15.4186 10.273C15.5466 10.1449 15.7203 10.073 15.9014 10.073C16.0825 10.073 16.2561 10.1449 16.3842 10.273C16.5123 10.401 16.5842 10.5747 16.5842 10.7558V14.8971C16.5842 15.0782 16.5123 15.2518 16.3842 15.3799C16.2561 15.5079 16.0825 15.5799 15.9014 15.5799Z" fill="#244C56"/></svg>`;

export function MerchantCard({card, onPress, onLongPress}: Props) {
  const offers = (card.latestOffers ?? []).slice(0, 2) as Array<Record<string, unknown>>;

  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      delayLongPress={250}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.titleWrap}>
        <SvgXml xml={merchantIconXml} width={22} height={21} />
        <Text style={styles.titleText} numberOfLines={2}>
          {card.merchantShortName ?? card.merchantName ?? '--'}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.bodyDivider} />
        <Text style={sharedStyles.smallLabel}>最新报盘</Text>

        {offers.length > 0 ? (
          offers.map((offer, index) => (
            <View key={index} style={styles.offerBlock}>
              <Text style={styles.offerTitle} numberOfLines={1}>
                {asText(offer.productName)}
                {offer.country ? ` ${asText(offer.country)} ${asText(offer.factoryNo)}` : ''}
              </Text>
              <View style={styles.offerInfo}>
                <View style={styles.priceLine}>
                  {(() => {
                    const price = formatLatestOfferPrice(offer.price);
                    return (
                      <>
                        <Text style={[styles.priceValue, !price.unit && styles.negotiateValue]}>
                          {price.text}
                        </Text>
                        {price.unit ? <Text style={styles.priceUnit}>{price.unit}</Text> : null}
                      </>
                    );
                  })()}
                </View>
                <View style={styles.weightLine}>
                  <Text style={styles.weightValue}>{formatWeightNumber(offer.weight)}</Text>
                  <Text style={styles.weightUnit}>{formatWeightUnit(offer.weight)}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>暂无报盘</Text>
        )}
      </View>

      <View style={sharedStyles.divider} />

      <View style={styles.footerRow}>
        <Text style={sharedStyles.smallLabel}>今日报盘数</Text>
        <Text style={styles.footerValue}>{formatThousand(card.todayOfferCount)}</Text>
      </View>
    </Pressable>
  );
}

function formatLatestOfferPrice(value: unknown): {text: string; unit: string} {
  const text = asText(value).trim();
  if (!text || text === '-' || text === '--') {
    return {text: '协商报价', unit: ''};
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric <= 0) {
    return {text: '协商报价', unit: ''};
  }

  return {text: `¥${text}`, unit: '/kg '};
}

function formatWeightNumber(value: unknown): string {
  const text = asText(value);
  if (!text) return '';
  const match = text.match(/^([\d.]+)/);
  if (match) {
    const num = Number(match[1]);
    if (Number.isFinite(num)) return Number.isInteger(num) ? `${num}` : num.toFixed(1).replace(/\.0$/, '');
  }
  return text;
}

function formatWeightUnit(value: unknown): string {
  const text = asText(value);
  if (!text) return '';
  const parts = text.trim().split(/\s+/);
  if (parts.length >= 2) return parts.slice(1).join(' ');
  return '吨';
}

const styles = StyleSheet.create({
  card: {...cardBaseStyle, gap: 6, paddingVertical: 7},
  pressed: {opacity: 0.85},
  titleWrap: {flexDirection: 'row', alignItems: 'flex-start', gap: 6},
  titleText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
  },
  body: {gap: 3},
  bodyDivider: {
    height: 0.5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: 2,
  },
  offerBlock: {gap: 0},
  offerTitle: {color: colors.text, fontSize: 11, lineHeight: 16},
  offerInfo: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  priceLine: {flexDirection: 'row', alignItems: 'baseline'},
  priceValue: {fontFamily: fonts.manropeBold, color: colors.price, fontSize: 12, lineHeight: 18},
  negotiateValue: {color: colors.primary},
  priceUnit: {fontFamily: fonts.manropeRegular, color: colors.text, fontSize: 10, lineHeight: 18},
  weightLine: {flexDirection: 'row', alignItems: 'baseline'},
  weightValue: {fontFamily: fonts.manropeBold, color: colors.text, fontSize: 12, lineHeight: 18},
  weightUnit: {color: colors.textSecondary, fontSize: 9, lineHeight: 18, marginLeft: 1},
  empty: {color: '#9DA4A3', fontSize: 11, paddingVertical: 4},
  footerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4},
  footerValue: {fontFamily: fonts.manropeSemiBold, color: colors.text, fontSize: 14, lineHeight: 18},
});
