import React, {memo, useEffect, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import type {EmployeeOfferItem, MerchantOfferGroup} from '../../types/api';
import {copyToClipboard, dialPhone} from '../../utils/contact';
import {buildOriginalTextPayload, type OriginalTextPayload} from '../../utils/originalText';
import {
  colorForOfferField,
  colorForTag,
  formatGoodsLocation,
  formatPublishTime,
  parseWeight,
  splitTags,
} from '../../utils/offer';
import {
  addIntentPlate,
  createPlateSnapshotFromEmployee,
  getIntentPlateKeys,
  recordRecentContactPlate,
  removeIntentPlate,
  type PlateKind,
} from '../../utils/plateFollowStore';
import {OfferTagChip} from './OfferTagChip';

type Props = {
  group: MerchantOfferGroup;
  isInquiry?: boolean;
  country?: string | null;
  factoryNo?: string | null;
  productName?: string | null;
  onCopyPhone?: string;
  onDial?: string;
  onViewOriginalText?: (payload: OriginalTextPayload) => void;
  onMerchantPress?: () => void;
  defaultExpanded?: boolean;
};

function MerchantOfferGroupCardInner({
  group,
  isInquiry,
  country,
  factoryNo,
  productName,
  onCopyPhone,
  onDial,
  onViewOriginalText,
  onMerchantPress,
  defaultExpanded,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const merchantName = group.merchantName || `商家-${group.merchantId ?? ''}`;
  const plateType: PlateKind = isInquiry ? 'inquiry' : 'offer';

  const prices = (group.employeeOffers ?? [])
    .map(item => Number(item.price))
    .filter(value => Number.isFinite(value) && value > 0);
  const priceMin = prices.length ? Math.min(...prices) : null;
  const priceMax = prices.length ? Math.max(...prices) : null;

  const firstLocation = firstNonEmpty(
    (group.employeeOffers ?? []).map(item => formatGoodsLocation(item.goodsLocation)),
  );
  const goodsTypes = uniqueNonEmpty((group.employeeOffers ?? []).map(item => item.goodsType));
  const feedings = uniqueNonEmpty((group.employeeOffers ?? []).map(item => item.feedingType));
  const fatRatios = uniqueNonEmpty((group.employeeOffers ?? []).map(item => item.fatRatio));
  const breeds = uniqueNonEmpty((group.employeeOffers ?? []).map(item => item.cattleBreed));
  const tags = uniqueNonEmpty(
    (group.employeeOffers ?? []).flatMap(item => splitTags(item.tags, 4)),
  );

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setExpanded(prev => !prev)} style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              {group.isFamousMerchant ? (
                <View style={styles.famousBadge}>
                  <Text style={styles.famousText}>知名商家</Text>
                  <FamousCrown />
                </View>
              ) : null}
              <Pressable
                disabled={!onMerchantPress}
                onPress={event => {
                  event.stopPropagation();
                  onMerchantPress?.();
                }}
                style={styles.merchantNameButton}>
                <Text style={styles.merchantName} numberOfLines={1}>{merchantName}</Text>
                <Text style={styles.merchantNameChevron}> &gt;</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.headerRight}>
            {priceMin != null && priceMax != null ? (
              <View style={styles.priceLine}>
                <Text style={styles.priceValue}>
                  ¥ {numStr(priceMin)}
                  {priceMin !== priceMax ? ` - ${numStr(priceMax)}` : ''}
                </Text>
                <Text style={styles.priceUnit}>/kg </Text>
              </View>
            ) : (
              <Text style={styles.negotiateText}>协商报价</Text>
            )}
            <View style={[styles.arrow, expanded && styles.arrowDown]}>
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path
                  d={expanded ? 'M4 10L8 6L12 10' : 'M4 6L8 10L12 6'}
                  stroke="#3C4947"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
        </View>

        <View style={styles.tagRow}>
          {firstLocation ? <OfferTagChip text={firstLocation} variant="location" /> : null}
          {goodsTypes.slice(0, 2).map(text => renderFieldChip('goodsType', text))}
          {feedings.slice(0, 2).map(text => renderFieldChip('feedingType', text))}
          {fatRatios.slice(0, 2).map(text => renderFieldChip('fatRatio', text))}
          {breeds.slice(0, 2).map(text => renderFieldChip('cattleBreed', text))}
          {tags.slice(0, 4).map(tag => {
            const {bg, fg} = colorForTag(tag);
            return <OfferTagChip key={`tag-${tag}`} text={tag} variant="colored" bg={bg} fg={fg} />;
          })}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedBody}>
          {(group.employeeOffers ?? []).map((offer, index) => (
            <EmployeeOfferRow
              key={`${offer.offerId ?? `${offer.userNickname}-${index}`}`}
              offer={offer}
              merchantPhone={offer.contactPhone ?? onCopyPhone ?? null}
              onCopyPhone={() =>
                copyToClipboard(offer.contactPhone ?? onCopyPhone ?? '', '已复制手机号').catch(() => undefined)
              }
              onDial={() => dialPhone(offer.contactPhone ?? onDial ?? null)}
              onViewOriginalText={onViewOriginalText}
              country={country}
              factoryNo={factoryNo}
              productName={productName}
              merchantName={group.merchantName}
              merchantId={group.merchantId}
              plateType={plateType}
            />
          ))}
          {group.offerCount > (group.employeeOffers?.length ?? 0) ? (
            <Text style={styles.moreCount}>共 {group.offerCount} 条{isInquiry ? '求购' : '报盘'}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const MerchantOfferGroupCard = memo(MerchantOfferGroupCardInner);

function EmployeeOfferRow({
  offer,
  merchantPhone,
  onCopyPhone,
  onDial,
  onViewOriginalText,
  country,
  factoryNo,
  productName,
  merchantName,
  merchantId,
  plateType,
}: {
  offer: EmployeeOfferItem;
  merchantPhone?: string | null;
  onCopyPhone?: () => void;
  onDial?: () => void;
  onViewOriginalText?: (payload: OriginalTextPayload) => void;
  country?: string | null;
  factoryNo?: string | null;
  productName?: string | null;
  merchantName?: string | null;
  merchantId?: number | string | null;
  plateType: PlateKind;
}) {
  const [weightValue, weightUnit] = parseWeight(offer.weight);
  const time = formatPublishTime(offer.publishTime);
  const feedingType = offer.feedingType?.trim() ?? '';
  const fatRatio = offer.fatRatio?.trim() ?? '';
  const cattleBreed = offer.cattleBreed?.trim() ?? '';
  const remark = offer.remark?.trim() ?? '';
  const tags = splitTags(offer.tags, 4);
  const [intentAdded, setIntentAdded] = useState(false);
  const snapshot = createPlateSnapshotFromEmployee(offer, plateType, {
    country,
    factoryNo,
    productName,
    merchantName,
    merchantId,
    contactPhone: merchantPhone,
  });

  useEffect(() => {
    let cancelled = false;
    getIntentPlateKeys()
      .then(keys => {
        if (!cancelled) setIntentAdded(keys.has(snapshot.key));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [snapshot.key]);

  async function handleToggleIntent() {
    if (intentAdded) {
      try {
        await removeIntentPlate(snapshot.key);
        setIntentAdded(false);
      } catch {
        // Cancelling should stay quiet; the next focus/load will resync local state.
      }
      return;
    }

    try {
      await addIntentPlate(snapshot);
      setIntentAdded(true);
    } catch (error) {
      Alert.alert('加入失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  function handleCopyPhone() {
    recordRecentContactPlate(snapshot, 'wechat').catch(() => undefined);
    onCopyPhone?.();
  }

  function handleDial() {
    recordRecentContactPlate(snapshot, 'phone').catch(() => undefined);
    onDial?.();
  }

  return (
    <View style={styles.offerCard}>
      <View style={styles.offerHead}>
        <View style={styles.userBlock}>
          <UserSquareIcon />
          <Text style={styles.userName} numberOfLines={1}>
            {(offer.userNickname ?? '')}
            {merchantPhone ?? ''}
          </Text>
        </View>
        <View style={styles.priceCol}>
          {weightValue ? (
            <View style={styles.priceLineSmall}>
              <Text style={styles.weightValue}>{weightValue}</Text>
              {weightUnit ? <Text style={styles.weightUnit}>{weightUnit}</Text> : null}
            </View>
          ) : null}
          <View style={styles.priceLineSmall}>
            {offer.price && !isNaN(Number(offer.price)) && Number(offer.price) > 0 ? (
              <>
                <Text style={styles.priceMain}>¥{offer.price}</Text>
                <Text style={styles.priceUnitInner}>/kg </Text>
              </>
            ) : (
              <Text style={styles.negotiateTextSmall}>协商报价</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.offerTagRow}>
        {time ? <Text style={styles.timeText}>{time}</Text> : null}
        {offer.goodsLocation ? <OfferTagChip text={formatGoodsLocation(offer.goodsLocation)} variant="location" /> : null}
        {offer.goodsType ? renderFieldChip('goodsType', offer.goodsType) : null}
        {feedingType ? renderFieldChip('feedingType', feedingType) : null}
        {fatRatio ? renderFieldChip('fatRatio', fatRatio) : null}
        {cattleBreed ? renderFieldChip('cattleBreed', cattleBreed) : null}
        {tags.map(tag => {
          const {bg, fg} = colorForTag(tag);
          return <OfferTagChip key={`tag-${tag}`} text={tag} variant="colored" bg={bg} fg={fg} />;
        })}
        {remark ? renderFieldChip('remark', remark, 220) : null}
      </View>

      <View style={styles.actionDivider} />

      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() =>
            onViewOriginalText?.(
              buildOriginalTextPayload({
                text: offer.offerOriginalText,
                intent: plateType,
                offerType: offer.offerType,
                country,
                factoryNo,
                productName,
                price: offer.price,
                goodsLocation: offer.goodsLocation,
                goodsType: offer.goodsType,
                feedingType,
                fatRatio,
                cattleBreed,
                tags: offer.tags,
                remark,
                publishTime: offer.publishTime,
                userNickname: offer.userNickname,
                merchantName,
              }),
            )
          }>
          <BookIcon />
          <Text style={styles.actionText}>查看原文</Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable style={styles.actionButton} onPress={handleToggleIntent}>
          <IntentActionIcon selected={intentAdded} />
          <Text style={[styles.actionText, intentAdded && styles.actionTextPrimary]}>
            {intentAdded ? '已加意向' : '加意向'}
          </Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable style={styles.actionButton} onPress={handleCopyPhone}>
          <AddSquareIcon />
          <Text style={styles.actionText}>添加微信</Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable style={styles.actionButton} onPress={handleDial}>
          <PhoneIcon />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>拨打电话</Text>
        </Pressable>
      </View>
    </View>
  );
}

function renderFieldChip(
  kind: 'goodsType' | 'feedingType' | 'fatRatio' | 'cattleBreed' | 'remark',
  text: string,
  maxWidth?: number,
) {
  const {bg, fg} = colorForOfferField(kind);
  return (
    <OfferTagChip
      key={`${kind}-${text}`}
      text={text}
      variant="colored"
      bg={bg}
      fg={fg}
      maxWidth={maxWidth}
      fillRest={kind === 'remark'}
    />
  );
}

function firstNonEmpty(values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value?.trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    result.push(text);
  }
  return result;
}

function FamousCrown() {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path
        d="M2 4l1.5 4h5L10 4l-2 1.5L6 3 4 5.5 2 4Z"
        fill="#FFD23A"
        stroke="#E0A914"
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UserSquareIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M12.75 16.5H5.25C2.25 16.5 1.5 15.75 1.5 12.75V5.25C1.5 2.25 2.25 1.5 5.25 1.5H12.75C15.75 1.5 16.5 2.25 16.5 5.25V12.75C16.5 15.75 15.75 16.5 12.75 16.5Z"
        fill="#D2E8E5"
        stroke="#5098AA"
        strokeWidth={0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12.75 14.25C12.75 12.5932 11.0711 11.25 9 11.25C6.92893 11.25 5.25 12.5932 5.25 14.25"
        stroke="#244C56"
        strokeWidth={0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z"
        fill="#D2E8E5"
        stroke="#244C56"
        strokeWidth={0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BookIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.7V4.7c0-1.2-1-2.1-2.2-2C16.3 3 11.1 3.9 7.7 6c-.4.2-.7.7-.7 1.2v15.6c0 .8.8 1.4 1.6 1.2 3.5-2 8.5-2.8 11.7-3.1 1-.1 1.7-1 1.7-2v-2.2"
        stroke="#3C4947"
        strokeWidth={1.5}
      />
      <Path d="M2 18.5V5C2 3.4 3.3 2.7 4.8 3.4 6.5 4.2 9.7 5.5 11.5 6.4" stroke="#3C4947" strokeWidth={1.5} />
    </Svg>
  );
}

function AddSquareIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M9 22h6c5 0 7-2 7-7V9c0-5-2-7-7-7H9C4 2 2 4 2 9v6c0 5 2 7 7 7Z" stroke="#3C4947" strokeWidth={1.5} />
      <Path d="M8 12h8M12 16V8" stroke="#3C4947" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function IntentActionIcon({selected = false}: {selected?: boolean}) {
  const color = selected ? colors.primary : '#3C4947';
  return (
    <Svg width={15} height={15} viewBox="0 0 18 18" fill="none">
      <Path
        d="M5.45 2.25H12.55C13.65 2.25 14.5 3.13 14.5 4.23V15C14.5 15.62 13.84 16.02 13.3 15.73L9.42 13.62C9.16 13.48 8.84 13.48 8.58 13.62L4.7 15.73C4.16 16.02 3.5 15.62 3.5 15V4.23C3.5 3.13 4.35 2.25 5.45 2.25Z"
        fill={selected ? colors.primary : 'none'}
        stroke={color}
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      {selected ? null : (
        <Path d="M9 5.8V10.2M6.8 8H11.2" stroke={color} strokeWidth={1.35} strokeLinecap="round" />
      )}
    </Svg>
  );
}

function PhoneIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"
        stroke={colors.primary}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function numStr(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    paddingVertical: 12,
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
    flexShrink: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  famousBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: '#FFF7D6',
    borderRadius: 2,
  },
  famousText: {
    fontSize: 10,
    color: '#8A6600',
  },
  merchantNameButton: {
    flexShrink: 1,
    flexGrow: 0,
    minWidth: 0,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  merchantName: {
    flexShrink: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  merchantNameChevron: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    marginLeft: 2,
    flexShrink: 0,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 17,
    lineHeight: 21,
    color: colors.price,
  },
  priceUnit: {
    fontFamily: fonts.manropeRegular,
    fontSize: 10,
    lineHeight: 16,
    color: colors.text,
    marginLeft: 1,
  },
  negotiateText: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.primary,
  },
  arrow: {
    padding: 4,
  },
  arrowDown: {},
  expandedBody: {
    paddingBottom: 12,
    gap: 12,
  },
  offerCard: {
    borderRadius: 4,
    backgroundColor: '#FBFFFE',
    borderWidth: 0.5,
    borderColor: 'rgba(0,106,97,0.2)',
    padding: 12,
    gap: 12,
  },
  offerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  userName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    minWidth: 0,
  },
  priceCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  priceLineSmall: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  weightValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  weightUnit: {
    fontFamily: fonts.manropeRegular,
    color: colors.text,
    fontSize: 10,
    lineHeight: 20,
    marginLeft: 1,
  },
  priceMain: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.price,
    fontSize: 16,
    lineHeight: 20,
  },
  priceUnitInner: {
    fontFamily: fonts.manropeRegular,
    color: colors.text,
    fontSize: 10,
    lineHeight: 20,
    marginLeft: 1,
  },
  negotiateTextSmall: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  offerTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    color: '#3C4947',
    fontSize: 11,
    lineHeight: 14,
  },
  actionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,106,97,0.05)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  actionText: {
    color: '#3C4947',
    fontSize: 12,
    lineHeight: 16,
  },
  actionTextPrimary: {
    color: colors.primary,
    fontWeight: '500',
  },
  actionVDivider: {
    width: 0.5,
    height: 13,
    backgroundColor: '#3C4947',
    opacity: 0.3,
  },
  moreCount: {
    color: '#9DA4A3',
    fontSize: 11,
    textAlign: 'center',
  },
});
