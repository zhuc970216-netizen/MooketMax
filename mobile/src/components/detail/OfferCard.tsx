import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import type {EmployeeOffer, OfferSummary} from '../../types/api';
import {buildOriginalTextPayload, type OriginalTextPayload} from '../../utils/originalText';
import {
  colorForOfferField,
  colorForTag,
  computePriceRange,
  formatGoodsLocation,
  formatPublishTime,
  parseWeight,
  splitTags,
} from '../../utils/offer';
import {OfferTagChip} from './OfferTagChip';

type Props = {
  offer: OfferSummary;
  expanded: boolean;
  onToggle: () => void;
  merchantPhone?: string | null;
  onCopyPhone?: () => void;
  onDial?: () => void;
  onViewOriginalText?: (payload: OriginalTextPayload) => void;
};

/**
 * 商家页报盘卡：折叠态显示产品名+价格+合并标签；展开态加上每条员工报价
 */
export function OfferCard({
  offer,
  expanded,
  onToggle,
  merchantPhone,
  onCopyPhone,
  onDial,
  onViewOriginalText,
}: Props) {
  const employeePrices = offer.employeeOffers?.map(item => item.price);
  const [priceText, priceUnit] = computePriceRange(employeePrices, offer.price, offer.priceMax);
  const isNegotiatedPrice = Boolean(priceText?.includes('协商'));

  const factoryLabel = offer.factoryNo
    ? `${offer.country ?? ''}${offer.factoryNo}`
    : `${offer.country ?? ''}厂号不限`;

  const allLocations = uniqueStrings(
    (offer.employeeOffers ?? [])
      .map(item => formatGoodsLocation(item.goodsLocation))
      .concat(formatGoodsLocation(offer.goodsLocation)),
  );
  const allGoodsTypes = uniqueStrings(
    (offer.employeeOffers ?? []).map(item => item.goodsType ?? '').concat(offer.goodsType ?? ''),
  );
  const allFeedings = uniqueStrings(
    (offer.employeeOffers ?? [])
      .map(item => item.feedingType ?? item.feedingMethod ?? '')
      .concat(offer.feedingType ?? ''),
  );
  const allFatRatios = uniqueStrings((offer.employeeOffers ?? []).map(item => item.fatRatio ?? ''));
  const allBreeds = uniqueStrings((offer.employeeOffers ?? []).map(item => item.cattleBreed ?? ''));
  const allRemarks = uniqueStrings((offer.employeeOffers ?? []).map(item => item.remark ?? ''));
  const allTags = uniqueStrings(
    (offer.employeeOffers ?? []).flatMap(item => splitTags(item.tags, 4)).concat(splitTags(offer.tags, 4)),
  ).slice(0, 4);

  const hasAnyTag =
    allLocations.length > 0 ||
    allGoodsTypes.length > 0 ||
    allFeedings.length > 0 ||
    allFatRatios.length > 0 ||
    allBreeds.length > 0 ||
    allRemarks.length > 0 ||
    allTags.length > 0;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onToggle} style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.titleText} numberOfLines={1}>
            {offer.productName ?? ''} {factoryLabel}
          </Text>
        </View>
        <View style={styles.priceWrap}>
          {priceText ? (
            <View style={styles.priceLine}>
              <Text style={[styles.priceValue, isNegotiatedPrice && styles.negotiateValue]}>
                {priceText}
              </Text>
              {priceUnit ? <Text style={styles.priceUnit}>{priceUnit}</Text> : null}
            </View>
          ) : null}
          <ExpandArrow expanded={expanded} />
        </View>
      </Pressable>

      {hasAnyTag ? (
        <View style={styles.tagRow}>
          {allLocations.length > 0 ? (
            <OfferTagChip text={allLocations.join('/')} variant="location" />
          ) : null}
          {allGoodsTypes.map(text => (
            <OfferTagChip key={`goods-${text}`} text={text} variant="colored" {...colorForOfferField('goodsType')} />
          ))}
          {allFeedings.map(text => (
            <OfferTagChip key={`feeding-${text}`} text={text} variant="colored" {...colorForOfferField('feedingType')} />
          ))}
          {allFatRatios.map(text => (
            <OfferTagChip key={`fat-${text}`} text={text} variant="colored" {...colorForOfferField('fatRatio')} />
          ))}
          {allBreeds.map(text => (
            <OfferTagChip key={`breed-${text}`} text={text} variant="colored" {...colorForOfferField('cattleBreed')} />
          ))}
          {allTags.map(tag => {
            const {bg, fg} = colorForTag(tag);
            return <OfferTagChip key={tag} text={tag} variant="colored" bg={bg} fg={fg} />;
          })}
          {allRemarks.slice(0, 2).map(text => (
            <OfferTagChip key={`remark-${text}`} text={text} variant="colored" maxWidth={180} {...colorForOfferField('remark')} />
          ))}
        </View>
      ) : null}

      {expanded
        ? (offer.employeeOffers ?? []).map((item, index) => (
            <EmployeeOfferCard
              key={`${item.offerId ?? `${item.userNickname}-${index}`}`}
              offer={item}
              merchantPhone={merchantPhone}
              country={offer.country}
              factoryNo={offer.factoryNo}
              productName={offer.productName}
              fallbackGoodsType={offer.goodsType}
              fallbackFeedingType={offer.feedingType}
              onCopyPhone={onCopyPhone}
              onDial={onDial}
              onViewOriginalText={onViewOriginalText}
            />
          ))
        : null}
    </View>
  );
}

function EmployeeOfferCard({
  offer,
  merchantPhone,
  country,
  factoryNo,
  productName,
  fallbackGoodsType,
  fallbackFeedingType,
  onCopyPhone,
  onDial,
  onViewOriginalText,
}: {
  offer: EmployeeOffer;
  merchantPhone?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  productName?: string | null;
  fallbackGoodsType?: string | null;
  fallbackFeedingType?: string | null;
  onCopyPhone?: () => void;
  onDial?: () => void;
  onViewOriginalText?: (payload: OriginalTextPayload) => void;
}) {
  const [weightValue, weightUnit] = parseWeight(offer.weight);
  const hasWeight = weightValue.length > 0;
  const time = formatPublishTime(offer.publishTime);
  const goodsType = offer.goodsType ?? fallbackGoodsType ?? '';
  const feeding = offer.feedingType ?? offer.feedingMethod ?? fallbackFeedingType ?? '';
  const fatRatio = offer.fatRatio?.trim() ?? '';
  const cattleBreed = offer.cattleBreed?.trim() ?? '';
  const tags = splitTags(offer.tags, 4);
  const remark = offer.remark?.trim() ?? '';

  return (
    <View style={styles.employeeWrap}>
      <View style={styles.employeeCard}>
        <View style={styles.employeeHead}>
          <View style={hasWeight ? styles.userBlock : styles.userBlockInline}>
            <View style={styles.avatarRow}>
              <View style={styles.avatar}>
                <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                  <Path d="M12.75 16.5H5.25C2.25 16.5 1.5 15.75 1.5 12.75V5.25C1.5 2.25 2.25 1.5 5.25 1.5H12.75C15.75 1.5 16.5 2.25 16.5 5.25V12.75C16.5 15.75 15.75 16.5 12.75 16.5Z" fill="#D2E8E5" stroke="#5098AA" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round"/>
                  <Path d="M12.75 14.25C12.75 12.5932 11.0711 11.25 9 11.25C6.92893 11.25 5.25 12.5932 5.25 14.25" stroke="#244C56" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round"/>
                  <Path d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z" fill="#D2E8E5" stroke="#244C56" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round"/>
                </Svg>
              </View>
              <Text style={styles.userName} numberOfLines={1}>
                {hasWeight
                  ? offer.userNickname ?? ''
                  : `${offer.userNickname ?? ''}${merchantPhone ? ` | ${merchantPhone}` : ''}`}
              </Text>
            </View>
            {hasWeight && merchantPhone ? <Text style={styles.userPhone}>{merchantPhone}</Text> : null}
          </View>
          <View style={styles.priceWrapRight}>
            {hasWeight ? (
              <View style={styles.priceLine}>
                <Text style={styles.weightValue}>{weightValue}</Text>
                {weightUnit ? <Text style={styles.weightUnit}>{weightUnit}</Text> : null}
              </View>
            ) : null}
            {offer.price != null && offer.price > 0 ? (
              <View style={styles.priceLine}>
                <Text style={styles.priceValue}>¥{offer.price}</Text>
                <Text style={styles.priceUnit}>/kg</Text>
              </View>
            ) : (
              <Text style={styles.negotiateText}>协商报价</Text>
            )}
          </View>
        </View>

        <View style={styles.employeeTagRow}>
          {time ? <Text style={styles.timeText}>{time}</Text> : null}
          {offer.goodsLocation ? (
            <OfferTagChip text={formatGoodsLocation(offer.goodsLocation)} variant="location" />
          ) : null}
          {goodsType ? <OfferTagChip text={goodsType} variant="colored" {...colorForOfferField('goodsType')} /> : null}
          {feeding ? <OfferTagChip text={feeding} variant="colored" {...colorForOfferField('feedingType')} /> : null}
          {fatRatio ? <OfferTagChip text={fatRatio} variant="colored" {...colorForOfferField('fatRatio')} /> : null}
          {cattleBreed ? <OfferTagChip text={cattleBreed} variant="colored" {...colorForOfferField('cattleBreed')} /> : null}
          {tags.map(tag => {
            const {bg, fg} = colorForTag(tag);
            return <OfferTagChip key={tag} text={tag} variant="colored" bg={bg} fg={fg} />;
          })}
          {remark ? <OfferTagChip text={remark} variant="colored" maxWidth={220} {...colorForOfferField('remark')} /> : null}
        </View>

        <View style={styles.actionDivider} />

        <View style={styles.actionRow}>
          <ActionButton
            text="查看原文"
            onPress={() =>
              onViewOriginalText?.(
                buildOriginalTextPayload({
                  text: offer.offerOriginalText,
                  intent: 'offer',
                  country,
                  factoryNo,
                  productName,
                  price: offer.price,
                  priceMax: offer.priceMax,
                  goodsLocation: offer.goodsLocation,
                  goodsType,
                  feedingType: feeding,
                  fatRatio,
                  cattleBreed,
                  tags: offer.tags,
                  remark,
                  publishTime: offer.publishTime,
                  userNickname: offer.userNickname,
                }),
              )
            }
          />
          <View style={styles.actionVDivider} />
          <ActionButton text="添加微信" onPress={onCopyPhone} />
          <View style={styles.actionVDivider} />
          <ActionButton text="拨打电话" onPress={onDial} primary />
        </View>
      </View>
    </View>
  );
}

function ActionButton({text, primary, onPress}: {text: string; primary?: boolean; onPress?: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.actionButton}>
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{text}</Text>
    </Pressable>
  );
}

function ExpandArrow({expanded}: {expanded: boolean}) {
  return (
    <View style={styles.arrowWrap}>
      <Svg width={12} height={16} viewBox="0 0 12 16">
        <Path
          d={expanded ? 'M2 6 L6 10 L10 6' : 'M4 2 L8 8 L4 14'}
          stroke="#BFCAC8"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of values) {
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FBFFFE',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
  },
  titleText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceWrapRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  priceValue: {
    color: colors.price,
    fontSize: 16,
    fontWeight: '600',
  },
  negotiateValue: {
    color: colors.primary,
    fontSize: 14,
  },
  priceUnit: {
    color: colors.text,
    fontSize: 10,
    marginLeft: 1,
    paddingBottom: 1,
  },
  negotiateText: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.primary,
    fontSize: 14,
    lineHeight: 18,
  },
  weightValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  weightUnit: {
    color: colors.text,
    fontSize: 10,
    marginLeft: 1,
    paddingBottom: 1,
  },
  arrowWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  employeeWrap: {
    paddingTop: 4,
  },
  employeeCard: {
    borderRadius: 4,
    backgroundColor: '#FBFFFE',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,106,97,0.2)',
    padding: 12,
    gap: 8,
  },
  employeeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userBlock: {
    gap: 2,
  },
  userBlockInline: {},
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  userName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 150,
  },
  userPhone: {
    marginLeft: 26,
    color: '#9DA4A3',
    fontSize: 12,
  },
  employeeTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    color: '#3C4947',
    fontSize: 11,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,106,97,0.15)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  actionText: {
    color: '#3C4947',
    fontSize: 12,
  },
  actionTextPrimary: {
    color: colors.primary,
    fontWeight: '600',
  },
  actionVDivider: {
    width: StyleSheet.hairlineWidth,
    height: 13,
    backgroundColor: '#3C4947',
  },
});
