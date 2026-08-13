import React, {useCallback, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeScrollEvent, NativeSyntheticEvent} from 'react-native';
import type {OfferFeedItem} from '../../types/api';
import {colors} from '../../theme/colors';

export type OfferTableGroup = {
  key: string;
  productName: string;
  country: string;
  factoryNo: string;
  merchantName: string;
  price: string;
  time: string;
  items: OfferFeedItem[];
};

type Props = {
  groups: OfferTableGroup[];
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
  onPublisherPress: (item: OfferFeedItem) => void;
};

const FROZEN_PADDING_LEFT = 10;
const FROZEN_PADDING_RIGHT = 6;
const SKU_WIDTH = 184;
const PRICE_WIDTH = 68;
const LEFT_WIDTH = FROZEN_PADDING_LEFT + SKU_WIDTH + PRICE_WIDTH + FROZEN_PADDING_RIGHT;
const TABLE_HEADER_BG = '#F7FAF9';
const MIDDLE_WIDTH = 311;
const columns = [
  {key: 'location', title: '货物地', width: 50},
  {key: 'tags', title: '标签', width: 91},
  {key: 'feeding', title: '饲养方式', width: 88},
  {key: 'weight', title: '数量', width: 82},
] as const;

export function getOfferTableValues(item?: OfferFeedItem) {
  return [
    formatLocation(clean(item?.goodsLocation) || clean(item?.region)),
    clean(item?.tags) || '-',
    clean(item?.feedingType) || '-',
    clean(item?.weight) || '-',
  ];
}

export function formatOfferTablePrice(price?: number | null, priceMax?: number | null) {
  const values = [price, priceMax].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return '协商报价';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? trimNumber(min) : `${trimNumber(min)}~${trimNumber(max)}`;
}

export function OfferFrozenTable({groups, expandedKeys, onToggle, onPublisherPress}: Props) {
  const scrollRefs = useRef(new Map<string, ScrollView>());
  const scrollX = useRef(0);
  const syncing = useRef(false);
  const activeSource = useRef<string | null>(null);

  const syncScroll = useCallback((sourceKey: string, x: number) => {
    if (syncing.current || activeSource.current !== sourceKey) return;
    scrollX.current = x;
    syncing.current = true;
    scrollRefs.current.forEach((ref, key) => {
      if (key !== sourceKey) ref.scrollTo({x, animated: false});
    });
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  const beginScroll = useCallback((sourceKey: string) => {
    activeSource.current = sourceKey;
  }, []);

  const register = useCallback((key: string, ref: ScrollView | null) => {
    if (!ref) {
      scrollRefs.current.delete(key);
      return;
    }
    scrollRefs.current.set(key, ref);
    ref.scrollTo({x: scrollX.current, animated: false});
  }, []);

  return (
    <View style={styles.table}>
      <TableHeader register={register} onSync={syncScroll} onBeginScroll={beginScroll} />
      {groups.map(group => {
        const latest = group.items[0];
        const expanded = expandedKeys.has(group.key);
        return (
          <View key={group.key}>
            <TableRow
              rowKey={`group-${group.key}`}
              leftTitle={group.productName}
              leftSkuMeta={[group.country, group.factoryNo].filter(Boolean).join('')}
              leftMeta={formatMerchantName(group.merchantName)}
              item={latest}
              price={formatDisplayPrice(group.price)}
              time={formatTime(group.time)}
              highlighted={expanded}
              onPress={() => onToggle(group.key)}
              register={register}
              onSync={syncScroll}
              onBeginScroll={beginScroll}
            />
            {expanded
              ? group.items.map((item, index) => (
                  <TableRow
                    key={`${item.offerId ?? index}-${item.userNickname ?? index}`}
                    rowKey={`publisher-${group.key}-${item.offerId ?? index}`}
                    publisher
                    leftTitle={item.userNickname?.trim() || '未知发布人'}
                    leftMeta={formatMerchantName(item.merchantShortName || item.merchantName || '暂未关联商家')}
                    item={item}
                    price={formatOfferTablePrice(item.price, item.priceMax)}
                    time={formatTime(item.publishTime)}
                    highlighted
                    onPress={() => onPublisherPress(item)}
                    register={register}
                    onSync={syncScroll}
                    onBeginScroll={beginScroll}
                  />
                ))
              : null}
          </View>
        );
      })}
    </View>
  );
}

function TableHeader({register, onSync, onBeginScroll}: SyncProps) {
  return (
    <View style={[styles.row, styles.header]}>
      <View style={styles.headerLeftFrozen}>
        <View style={[styles.leftSku, styles.headerColumn]}><Text style={[styles.headerText, styles.leftText]}>SKU · 商家</Text></View>
        <View style={[styles.leftPrice, styles.headerColumn]}><Text style={[styles.headerText, styles.leftText]}>价格</Text></View>
      </View>
      <MiddleScroll rowKey="header" register={register} onSync={onSync} onBeginScroll={onBeginScroll}>
        {columns.map(column => (
          <View key={column.key} style={[styles.headerMiddleCell, {width: column.width}]}>
            <Text style={[styles.headerText, styles.centerText]}>{column.title}</Text>
          </View>
        ))}
      </MiddleScroll>
    </View>
  );
}

type SyncProps = {
  register: (key: string, ref: ScrollView | null) => void;
  onSync: (key: string, x: number) => void;
  onBeginScroll: (key: string) => void;
};

function TableRow({rowKey, publisher = false, highlighted = false, leftTitle, leftSkuMeta, leftMeta, item, price, time, onPress, register, onSync, onBeginScroll}: SyncProps & {
  rowKey: string;
  publisher?: boolean;
  highlighted?: boolean;
  leftTitle: string;
  leftSkuMeta?: string;
  leftMeta: string;
  item?: OfferFeedItem;
  price: string;
  time: string;
  onPress: () => void;
}) {
  const values = getOfferTableValues(item);
  const priceBadge = getPriceBadge(item);
  return (
    <View style={[styles.row, highlighted && styles.highlightedRow, publisher && styles.publisherRow]}>
      <Pressable onPress={onPress} style={({pressed}) => [styles.leftFrozen, highlighted && styles.highlightedCell, pressed && styles.pressed]}>
        <View style={styles.leftSku}>
          <View style={styles.leftTitleLine}>
            {publisher ? <View style={styles.publisherDot} /> : null}
            {publisher ? <Text style={styles.publisherAvatarText}>{getAvatarText(leftTitle)}</Text> : null}
            <Text style={[styles.leftTitle, publisher && styles.publisherTitle]} numberOfLines={1}>
              {leftTitle}
              {!publisher && leftSkuMeta ? <Text style={styles.leftSkuMeta}> {leftSkuMeta}</Text> : null}
            </Text>
          </View>
          {!publisher ? (
            <View style={styles.leftMetaLine}>
              {isKnownMerchant(leftMeta) ? <Text style={styles.knownMerchantBadge}>知名商家</Text> : null}
              <Text style={styles.leftMeta} numberOfLines={1}>{leftMeta || '-'}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.leftPrice}>
          <View style={styles.priceLine}>
            <Text style={[styles.price, priceBadge && styles.priceWithBadge, price === '协商报价' && styles.negotiate]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{price}</Text>
            {priceBadge ? <Text style={styles.lowPriceBadge}>{priceBadge}</Text> : null}
          </View>
          <Text style={styles.time}>{time || '-'}</Text>
        </View>
        <View style={styles.frozenShadow} pointerEvents="none">
          <View style={styles.frozenShadowStrong} />
          <View style={styles.frozenShadowMid} />
          <View style={styles.frozenShadowSoft} />
        </View>
      </Pressable>
      <MiddleScroll rowKey={rowKey} register={register} onSync={onSync} onBeginScroll={onBeginScroll}>
        {columns.map((column, index) => (
          <View key={column.key} style={[styles.middleCell, highlighted && styles.highlightedCell, {width: column.width}]}>
            <Text style={styles.middleText} numberOfLines={1}>{values[index]}</Text>
          </View>
        ))}
      </MiddleScroll>
    </View>
  );
}

function MiddleScroll({rowKey, register, onSync, onBeginScroll, children}: SyncProps & {rowKey: string; children: React.ReactNode}) {
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => onSync(rowKey, event.nativeEvent.contentOffset.x);
  return (
    <ScrollView
      ref={ref => register(rowKey, ref)}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScrollBeginDrag={() => onBeginScroll(rowKey)}
      onMomentumScrollBegin={() => onBeginScroll(rowKey)}
      onScroll={handleScroll}
      style={styles.middleViewport}
      contentContainerStyle={[styles.middleContent, {width: MIDDLE_WIDTH}]}>
      {children}
    </ScrollView>
  );
}

function clean(value?: string | null) {
  return value?.trim() ?? '';
}

function formatMerchantName(value?: string | null) {
  const text = clean(value);
  if (!text || text === '暂未关联商家') return text;
  return text.replace(/(?:国际供应链管理|供应链管理|物流管理|贸易|食品|进出口|管理)?(?:有限责任公司|有限公司|冻品商行)$/u, '');
}

function formatDisplayPrice(value: string) {
  return value.replace(/¥/g, '').replace(/\/kg/g, '').replace(/-/g, '~');
}

function formatLocation(value: string) {
  const text = clean(value).replace(/城区$/u, '');
  return text || '-';
}

function trimNumber(value: number) {
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const match = value.match(/(\d{1,2}):(\d{2})/);
  const time = match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
  const dayLabel = getRelativeDayLabel(value);
  if (time) return dayLabel ? `${dayLabel} ${time}` : time;
  return value.slice(5, 10);
}

function getAvatarText(value: string) {
  const text = clean(value).replace(/\s+/g, '');
  return text ? text.slice(0, 1) : '?';
}

function isKnownMerchant(value?: string | null) {
  return clean(value).includes('郑州帮你省');
}

function getPriceBadge(item?: OfferFeedItem) {
  if (!item) return '';
  const phone = clean(item.contactPhone);
  const productName = clean(item.productName);
  const country = clean(item.country);
  const factoryNo = clean(item.factoryNo).toUpperCase();
  const publishTime = clean(item.publishTime);
  const isTargetOffer =
    phone === '18039505886' &&
    productName.includes('带骨前胸') &&
    country.includes('乌拉圭') &&
    factoryNo === '439' &&
    /21:24/.test(publishTime);
  return isTargetOffer ? '低价' : '';
}

function getRelativeDayLabel(value: string) {
  const date = value.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!date) return '';
  const target = new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3]));
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayStart.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  return '';
}

const styles = StyleSheet.create({
  table: {backgroundColor: '#FFFFFF'},
  row: {minHeight: 64, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#B8C0C9', backgroundColor: '#FFFFFF'},
  header: {minHeight: 34, alignItems: 'center', backgroundColor: TABLE_HEADER_BG, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DFE8E6'},
  headerLeftFrozen: {width: LEFT_WIDTH, height: 34, paddingLeft: FROZEN_PADDING_LEFT, paddingRight: FROZEN_PADDING_RIGHT, flexDirection: 'row', alignItems: 'center', backgroundColor: TABLE_HEADER_BG, zIndex: 2},
  headerColumn: {alignItems: 'flex-start', justifyContent: 'center'},
  headerMiddleCell: {height: 34, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, backgroundColor: TABLE_HEADER_BG, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#EDF2F1'},
  headerText: {color: '#85928F', fontSize: 11, lineHeight: 15, fontWeight: '700'},
  centerText: {textAlign: 'center'},
  leftText: {textAlign: 'left'},
  leftFrozen: {width: LEFT_WIDTH, paddingLeft: FROZEN_PADDING_LEFT, paddingRight: FROZEN_PADDING_RIGHT, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', zIndex: 2},
  frozenShadow: {position: 'absolute', top: 0, right: -9, bottom: 0, width: 9, flexDirection: 'row', zIndex: 4},
  frozenShadowStrong: {width: 2, backgroundColor: 'rgba(0,0,0,0.085)'},
  frozenShadowMid: {width: 3, backgroundColor: 'rgba(0,0,0,0.038)'},
  frozenShadowSoft: {width: 4, backgroundColor: 'rgba(0,0,0,0.012)'},
  leftSku: {width: SKU_WIDTH, minWidth: 0, justifyContent: 'center'},
  leftPrice: {width: PRICE_WIDTH, minWidth: 0, alignItems: 'flex-start', justifyContent: 'center'},
  leftTitleLine: {flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 2},
  publisherDot: {width: 24, height: 24, marginRight: -22, borderRadius: 12, backgroundColor: colors.primary},
  publisherAvatarText: {width: 24, color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '900', textAlign: 'center', zIndex: 3},
  leftTitle: {flexShrink: 1, maxWidth: 180, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800'},
  leftSkuMeta: {color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '400'},
  publisherTitle: {fontSize: 14},
  leftMetaLine: {marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0},
  knownMerchantBadge: {height: 16, paddingHorizontal: 4, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.primaryLight, color: colors.primary, fontSize: 10, lineHeight: 16, fontWeight: '800'},
  leftMeta: {flex: 1, minWidth: 0, color: colors.textMuted, fontSize: 12, lineHeight: 17},
  middleViewport: {flex: 1, minWidth: 0, backgroundColor: '#FFFFFF'},
  middleContent: {flexDirection: 'row', alignItems: 'stretch'},
  middleCell: {paddingHorizontal: 8, justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#EDF2F1'},
  middleText: {color: colors.textSecondary, fontSize: 12, lineHeight: 17},
  priceLine: {width: '100%', flexDirection: 'row', alignItems: 'center', gap: 3},
  price: {flexShrink: 1, minWidth: 0, color: colors.price, fontSize: 14, lineHeight: 19, fontWeight: '800', textAlign: 'left'},
  priceWithBadge: {maxWidth: 36},
  lowPriceBadge: {height: 15, paddingHorizontal: 3, borderRadius: 3, overflow: 'hidden', backgroundColor: '#FFF1EF', color: colors.price, fontSize: 9, lineHeight: 15, fontWeight: '800'},
  negotiate: {color: colors.primary, fontSize: 13},
  time: {marginTop: 3, color: colors.textMuted, fontSize: 10, lineHeight: 14},
  highlightedRow: {backgroundColor: '#F3FAF8'},
  highlightedCell: {backgroundColor: '#F3FAF8'},
  publisherRow: {minHeight: 58, borderStyle: 'dashed'},
  pressed: {backgroundColor: '#F0F8F6'},
});
