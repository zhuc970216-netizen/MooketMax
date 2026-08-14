import React, {useCallback, useMemo, useRef} from 'react';
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
  renderHeader?: boolean;
  scrollController?: OfferTableScrollController;
};

export type OfferTableScrollController = {
  register: (key: string, ref: ScrollView | null) => void;
  onSync: (key: string, x: number) => void;
  onBeginScroll: (key: string) => void;
};

const FROZEN_PADDING_LEFT = 10;
const FROZEN_PADDING_RIGHT = 6;
const SKU_WIDTH = 90;
const PRICE_WIDTH = 90;
const PUBLISHER_SKU_WIDTH = 130;
const PUBLISHER_PRICE_WIDTH = 50;
const LEFT_WIDTH = FROZEN_PADDING_LEFT + SKU_WIDTH + PRICE_WIDTH + FROZEN_PADDING_RIGHT;
const TABLE_HEADER_BG = '#F4F5F6';
const MIDDLE_WIDTH = 311;
const GROUP_ROW_HEIGHT = 64;
const PUBLISHER_ROW_HEIGHT = 38;
const TABLE_SELECTED_BG = '#F8F9FA';
const TABLE_PRESSED_BG = '#F3F4F5';
const GROUP_SHADOW_STEPS = [
  'rgba(24, 39, 34, 0.075)',
  'rgba(24, 39, 34, 0.052)',
  'rgba(24, 39, 34, 0.032)',
  'rgba(24, 39, 34, 0.016)',
  'rgba(24, 39, 34, 0)',
];
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
  if (!values.length) return '协商';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? trimNumber(min) : `${trimNumber(min)}~${trimNumber(max)}`;
}

export function useOfferTableScrollController(): OfferTableScrollController {
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

  return useMemo(
    () => ({register, onSync: syncScroll, onBeginScroll: beginScroll}),
    [beginScroll, register, syncScroll],
  );
}

export function OfferFrozenTable({groups, expandedKeys, onToggle, onPublisherPress, renderHeader = true, scrollController}: Props) {
  const fallbackScrollController = useOfferTableScrollController();
  const controller = scrollController ?? fallbackScrollController;
  const rows: TableDataRow[] = [];
  groups.forEach(group => {
    const latest = group.items[0];
    const expanded = expandedKeys.has(group.key);
    rows.push({
      rowKey: `group-${group.key}`,
      leftTitle: group.productName,
      leftSkuMeta: [group.country, group.factoryNo].filter(Boolean).join(''),
      leftMeta: formatMerchantName(group.merchantName),
      item: latest,
      price: formatDisplayPrice(group.price),
      time: formatTime(group.time),
      highlighted: expanded,
      separator: expanded ? 'dashed' : 'solid',
      separatorShadow: expanded,
      onPress: () => onToggle(group.key),
    });
    if (!expanded) return;
    group.items.forEach((item, index) => {
      rows.push({
        rowKey: `publisher-${group.key}-${item.offerId ?? index}`,
        publisher: true,
        leftTitle: item.userNickname?.trim() || '未知发布人',
        leftMeta: formatMerchantName(item.merchantShortName || item.merchantName || '暂未关联商家'),
        item,
        price: formatOfferTablePrice(item.price, item.priceMax),
        time: formatTime(item.publishTime),
        highlighted: true,
        separator: index === group.items.length - 1 ? 'solid' : 'dashed',
        groupEndShadow: index === group.items.length - 1,
        onPress: () => onPublisherPress(item),
      });
    });
  });

  return (
    <View style={styles.table}>
      {renderHeader ? <TableHeader {...controller} /> : null}
      <View style={styles.bodyTable}>
        <View style={styles.leftColumn}>
          {rows.map(row => (
            <TableLeftCell key={row.rowKey} row={row} />
          ))}
        </View>
        <MiddleScroll rowKey="body" body {...controller}>
          {rows.map(row => (
            <TableMiddleRow key={row.rowKey} row={row} />
          ))}
        </MiddleScroll>
      </View>
    </View>
  );
}

export function OfferFrozenTableHeader({scrollController}: {scrollController?: OfferTableScrollController}) {
  const fallbackScrollController = useOfferTableScrollController();
  return <TableHeader {...(scrollController ?? fallbackScrollController)} />;
}

function TableHeader({register, onSync, onBeginScroll}: SyncProps) {
  return (
    <View style={[styles.row, styles.header]}>
      <View style={styles.headerLeftFrozen}>
        <View style={[styles.leftSku, styles.headerColumn]}><Text style={[styles.headerText, styles.leftText]}>SKU</Text></View>
        <View style={[styles.leftPrice, styles.headerColumn, styles.headerPriceColumn]}><Text style={[styles.headerText, styles.rightText]}>价格·商家</Text></View>
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

type TableDataRow = {
  rowKey: string;
  publisher?: boolean;
  highlighted?: boolean;
  separator?: 'solid' | 'dashed';
  separatorShadow?: boolean;
  groupEndShadow?: boolean;
  leftTitle: string;
  leftSkuMeta?: string;
  leftMeta: string;
  item?: OfferFeedItem;
  price: string;
  time: string;
  onPress: () => void;
};

function TableLeftCell({row}: {row: TableDataRow}) {
  const priceBadge = getPriceBadge(row.item);
  return (
    <View style={[styles.bodyRow, row.highlighted && styles.highlightedRow, row.publisher && styles.publisherRow]}>
      <Pressable onPress={row.onPress} style={({pressed}) => [styles.leftFrozen, row.publisher && styles.publisherLeftFrozen, row.highlighted && styles.highlightedCell, pressed && styles.pressed]}>
        <View style={[styles.leftSku, row.publisher && styles.publisherLeftSku]}>
          <View style={styles.leftTitleLine}>
            {row.publisher ? (
              <View style={styles.publisherMiniIcon}>
                <View style={styles.publisherMiniIconHead} />
                <View style={styles.publisherMiniIconBody} />
              </View>
            ) : null}
            <Text style={[styles.leftTitle, row.publisher && styles.publisherTitle]} numberOfLines={1}>
              {row.leftTitle}
            </Text>
          </View>
          {!row.publisher ? (
            <Text style={styles.leftSkuMeta} numberOfLines={1}>{row.leftSkuMeta || '-'}</Text>
          ) : null}
        </View>
        <View style={[styles.leftPrice, row.publisher && styles.publisherLeftPrice]}>
          <View style={styles.priceLine}>
            {priceBadge ? <Text style={styles.lowPriceBadge}>{priceBadge}</Text> : null}
            <Text style={[styles.price, priceBadge && styles.priceWithBadge, row.price === '协商' && styles.negotiate]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{row.price}</Text>
          </View>
          {!row.publisher ? (
            <View style={styles.priceMetaLine}>
              <Text style={styles.priceMeta} numberOfLines={1}>{row.leftMeta || '-'}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.frozenShadow} pointerEvents="none">
          <View style={styles.frozenShadowStrong} />
          <View style={styles.frozenShadowMid} />
          <View style={styles.frozenShadowSoft} />
        </View>
      </Pressable>
      <RowSeparator type={row.separator ?? 'solid'} shadow={row.separatorShadow || row.groupEndShadow} />
    </View>
  );
}

function TableMiddleRow({row}: {row: TableDataRow}) {
  const values = getOfferTableValues(row.item);
  return (
    <View style={[styles.bodyMiddleRow, row.highlighted && styles.highlightedRow, row.publisher && styles.publisherRow]}>
      {columns.map((column, index) => (
        <Pressable key={column.key} onPress={row.onPress} style={({pressed}) => [styles.middleCell, row.highlighted && styles.highlightedCell, pressed && styles.pressed, {width: column.width}]}>
          <Text style={styles.middleText} numberOfLines={1}>{values[index]}</Text>
        </Pressable>
      ))}
      <RowSeparator type={row.separator ?? 'solid'} shadow={row.separatorShadow || row.groupEndShadow} />
    </View>
  );
}

function RowSeparator({type, shadow = false}: {type: 'solid' | 'dashed'; shadow?: boolean}) {
  if (type === 'solid') {
    return (
      <View pointerEvents="none" style={[styles.separatorLayer, shadow && styles.separatorLayerFloating]}>
        <View style={styles.separatorSolid} />
        {shadow ? (
          <View style={styles.groupEndShadow}>
            {GROUP_SHADOW_STEPS.map((backgroundColor, index) => (
              <View key={index} style={[styles.groupEndShadowStep, {backgroundColor}]} />
            ))}
          </View>
        ) : null}
      </View>
    );
  }
  if (!shadow) return null;
  return (
    <View pointerEvents="none" style={[styles.separatorLayer, styles.separatorLayerFloating]}>
      <View style={styles.groupEndShadow}>
        {GROUP_SHADOW_STEPS.map((backgroundColor, index) => (
          <View key={index} style={[styles.groupEndShadowStep, {backgroundColor}]} />
        ))}
      </View>
    </View>
  );
}

function MiddleScroll({rowKey, body = false, register, onSync, onBeginScroll, children}: SyncProps & {rowKey: string; body?: boolean; children: React.ReactNode}) {
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => onSync(rowKey, event.nativeEvent.contentOffset.x);
  return (
    <ScrollView
      ref={ref => register(rowKey, ref)}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={1}
      onScrollBeginDrag={() => onBeginScroll(rowKey)}
      onMomentumScrollBegin={() => onBeginScroll(rowKey)}
      onScroll={handleScroll}
      style={styles.middleViewport}
      contentContainerStyle={[body ? styles.bodyMiddleContent : styles.middleContent, {width: MIDDLE_WIDTH}]}>
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
  return text
    .replace(/^([\u4e00-\u9fa5]{2,})市[\u4e00-\u9fa5]{1,8}区/u, (_match, city: string) => city)
    .replace(/市/u, '')
    .replace(/^[\u4e00-\u9fa5]{1,8}区/u, '')
    .replace(/(?:国际供应链管理|供应链管理|供应链|物流管理|贸易|食品|进出口|管理)?(?:[（(][^）)]{1,12}[）)])?(?:有限责任公司|有限公司|冻品商行)$/u, '');
}

function formatDisplayPrice(value: string) {
  return value.replace(/协商报价/g, '协商').replace(/¥/g, '').replace(/\/kg/g, '').replace(/-/g, '~');
}

function formatLocation(value: string) {
  const text = clean(value).replace(/城区$/u, '').replace(/市$/u, '');
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
  row: {minHeight: GROUP_ROW_HEIGHT, flexDirection: 'row', backgroundColor: '#FFFFFF'},
  bodyTable: {flexDirection: 'row', backgroundColor: '#FFFFFF'},
  leftColumn: {width: LEFT_WIDTH, backgroundColor: '#FFFFFF', zIndex: 3},
  bodyRow: {minHeight: GROUP_ROW_HEIGHT, backgroundColor: '#FFFFFF'},
  bodyMiddleRow: {width: MIDDLE_WIDTH, minHeight: GROUP_ROW_HEIGHT, flexDirection: 'row', backgroundColor: '#FFFFFF'},
  header: {minHeight: 34, alignItems: 'center', backgroundColor: TABLE_HEADER_BG, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DFE8E6', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#B8C0C9'},
  headerLeftFrozen: {width: LEFT_WIDTH, height: 34, paddingLeft: FROZEN_PADDING_LEFT, paddingRight: FROZEN_PADDING_RIGHT, flexDirection: 'row', alignItems: 'center', backgroundColor: TABLE_HEADER_BG, zIndex: 2},
  headerColumn: {alignItems: 'flex-start', justifyContent: 'center'},
  headerMiddleCell: {height: 34, justifyContent: 'center', alignItems: 'flex-start', paddingHorizontal: 8, backgroundColor: TABLE_HEADER_BG, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#EDF2F1'},
  headerText: {color: '#85928F', fontSize: 11, lineHeight: 15, fontWeight: '700'},
  centerText: {textAlign: 'left'},
  leftText: {textAlign: 'left'},
  rightText: {textAlign: 'right'},
  headerPriceColumn: {alignItems: 'flex-end'},
  leftFrozen: {width: LEFT_WIDTH, minHeight: GROUP_ROW_HEIGHT, paddingLeft: FROZEN_PADDING_LEFT, paddingRight: FROZEN_PADDING_RIGHT, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', zIndex: 2},
  publisherLeftFrozen: {minHeight: PUBLISHER_ROW_HEIGHT},
  frozenShadow: {position: 'absolute', top: 0, right: -9, bottom: 0, width: 9, flexDirection: 'row', zIndex: 4},
  frozenShadowStrong: {width: 2, backgroundColor: 'rgba(0,0,0,0.085)'},
  frozenShadowMid: {width: 3, backgroundColor: 'rgba(0,0,0,0.038)'},
  frozenShadowSoft: {width: 4, backgroundColor: 'rgba(0,0,0,0.012)'},
  leftSku: {width: SKU_WIDTH, minWidth: 0, justifyContent: 'center'},
  publisherLeftSku: {width: PUBLISHER_SKU_WIDTH},
  leftPrice: {width: PRICE_WIDTH, minWidth: 0, alignItems: 'flex-end', justifyContent: 'center'},
  publisherLeftPrice: {width: PUBLISHER_PRICE_WIDTH},
  leftTitleLine: {flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 2},
  publisherMiniIcon: {width: 11, height: 13, marginRight: 2, alignItems: 'center', justifyContent: 'center'},
  publisherMiniIconHead: {width: 4, height: 4, borderRadius: 2, borderWidth: 1, borderColor: colors.primary},
  publisherMiniIconBody: {width: 8, height: 4, marginTop: 1, borderTopWidth: 1.2, borderLeftWidth: 1.2, borderRightWidth: 1.2, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderColor: colors.primary},
  leftTitle: {flexShrink: 1, maxWidth: 180, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800'},
  leftSkuMeta: {marginTop: 2, color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '400'},
  publisherTitle: {color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '400'},
  leftMetaLine: {marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0},
  knownMerchantBadge: {height: 16, paddingHorizontal: 4, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.primaryLight, color: colors.primary, fontSize: 10, lineHeight: 16, fontWeight: '800'},
  leftMeta: {flex: 1, minWidth: 0, color: colors.textMuted, fontSize: 12, lineHeight: 17},
  priceMetaLine: {marginTop: 2, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4},
  priceMeta: {flex: 1, minWidth: 0, color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'right'},
  middleViewport: {flex: 1, minWidth: 0, backgroundColor: '#FFFFFF'},
  middleContent: {flexDirection: 'row', alignItems: 'stretch'},
  bodyMiddleContent: {flexDirection: 'column', alignItems: 'stretch', backgroundColor: '#FFFFFF'},
  middleCell: {paddingHorizontal: 8, justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#EDF2F1'},
  middleText: {color: colors.textSecondary, fontSize: 12, lineHeight: 17, textAlign: 'left'},
  priceLine: {width: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 3},
  price: {flexShrink: 1, minWidth: 0, color: colors.price, fontSize: 14, lineHeight: 19, fontWeight: '800', textAlign: 'right'},
  priceWithBadge: {maxWidth: 36},
  lowPriceBadge: {height: 17, paddingHorizontal: 4, borderRadius: 3, overflow: 'hidden', backgroundColor: '#FFF7D8', color: '#D98200', fontSize: 10, lineHeight: 17, fontWeight: '800'},
  negotiate: {color: colors.primary, fontSize: 13},
  time: {marginTop: 3, color: colors.textMuted, fontSize: 10, lineHeight: 14},
  highlightedRow: {backgroundColor: TABLE_SELECTED_BG},
  highlightedCell: {backgroundColor: TABLE_SELECTED_BG},
  publisherRow: {minHeight: PUBLISHER_ROW_HEIGHT},
  separatorLayer: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, zIndex: 8, overflow: 'visible'},
  separatorLayerFloating: {bottom: -5, height: 6},
  separatorSolid: {height: StyleSheet.hairlineWidth, backgroundColor: '#AEB7C0'},
  groupEndShadow: {height: 5},
  groupEndShadowStep: {height: 1},
  pressed: {backgroundColor: TABLE_PRESSED_BG},
});
