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

const LEFT_WIDTH = 158;
const RIGHT_WIDTH = 105;
const MIDDLE_WIDTH = 392;
const columns = [
  {key: 'feeding', title: '饲养方式', width: 88},
  {key: 'weight', title: '数量', width: 82},
  {key: 'location', title: '货物地', width: 108},
  {key: 'tags', title: '标签', width: 114},
] as const;

export function getOfferTableValues(item?: OfferFeedItem) {
  return [
    clean(item?.feedingType) || '-',
    clean(item?.weight) || '-',
    clean(item?.goodsLocation) || clean(item?.region) || '-',
    clean(item?.tags) || '-',
  ];
}

export function formatOfferTablePrice(price?: number | null, priceMax?: number | null) {
  const values = [price, priceMax].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return '协商报价';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `¥${trimNumber(min)}/kg` : `¥${trimNumber(min)}-${trimNumber(max)}/kg`;
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
              expanded={expanded}
              leftTitle={group.productName}
              leftMeta={[group.country, group.factoryNo, group.merchantName].filter(Boolean).join(' · ')}
              item={latest}
              price={group.price}
              time={group.time}
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
                    leftMeta={(item.merchantShortName || item.merchantName || '暂未关联商家').trim()}
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
      <View style={[styles.left, styles.headerCell]}><Text style={styles.headerText}>SKU · 商家</Text></View>
      <MiddleScroll rowKey="header" register={register} onSync={onSync} onBeginScroll={onBeginScroll}>
        {columns.map(column => <Text key={column.key} style={[styles.headerText, {width: column.width}]}>{column.title}</Text>)}
      </MiddleScroll>
      <View style={[styles.right, styles.headerCell]}><Text style={[styles.headerText, styles.alignRight]}>价格</Text></View>
    </View>
  );
}

type SyncProps = {
  register: (key: string, ref: ScrollView | null) => void;
  onSync: (key: string, x: number) => void;
  onBeginScroll: (key: string) => void;
};

function TableRow({rowKey, publisher = false, expanded, highlighted = false, leftTitle, leftMeta, item, price, time, onPress, register, onSync, onBeginScroll}: SyncProps & {
  rowKey: string;
  publisher?: boolean;
  expanded?: boolean;
  highlighted?: boolean;
  leftTitle: string;
  leftMeta: string;
  item?: OfferFeedItem;
  price: string;
  time: string;
  onPress: () => void;
}) {
  const values = getOfferTableValues(item);
  return (
    <View style={[styles.row, highlighted && styles.highlightedRow, publisher && styles.publisherRow]}>
      <Pressable onPress={onPress} style={({pressed}) => [styles.left, highlighted && styles.highlightedCell, pressed && styles.pressed]}>
        <View style={styles.leftTitleLine}>
          {!publisher ? <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text> : <View style={styles.publisherDot} />}
          {publisher ? <Text style={styles.publisherAvatarText}>{getAvatarText(leftTitle)}</Text> : null}
          <Text style={[styles.leftTitle, publisher && styles.publisherTitle]} numberOfLines={1}>{leftTitle}</Text>
        </View>
        {!publisher ? <Text style={styles.leftMeta} numberOfLines={1}>{leftMeta || '-'}</Text> : null}
      </Pressable>
      <MiddleScroll rowKey={rowKey} register={register} onSync={onSync} onBeginScroll={onBeginScroll}>
        {columns.map((column, index) => (
          <View key={column.key} style={[styles.middleCell, highlighted && styles.highlightedCell, {width: column.width}]}>
            <Text style={styles.middleText} numberOfLines={1}>{values[index]}</Text>
          </View>
        ))}
      </MiddleScroll>
      <Pressable onPress={onPress} style={({pressed}) => [styles.right, highlighted && styles.highlightedCell, pressed && styles.pressed]}>
        <Text style={[styles.price, price === '协商报价' && styles.negotiate]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{price}</Text>
        <Text style={styles.time}>{time || '-'}</Text>
      </Pressable>
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

function trimNumber(value: number) {
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function formatTime(value?: string | null) {
  if (!value) return '';
  const match = value.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value.slice(5, 10);
}

function getAvatarText(value: string) {
  const text = clean(value).replace(/\s+/g, '');
  return text ? text.slice(0, 1) : '?';
}

const styles = StyleSheet.create({
  table: {backgroundColor: '#FFFFFF'},
  row: {minHeight: 64, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DFE8E6', backgroundColor: '#FFFFFF'},
  header: {minHeight: 34, backgroundColor: '#F7FAF9', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DFE8E6'},
  headerCell: {justifyContent: 'center'},
  headerText: {color: '#85928F', fontSize: 11, lineHeight: 15, fontWeight: '700'},
  alignRight: {textAlign: 'right'},
  left: {width: LEFT_WIDTH, paddingHorizontal: 10, justifyContent: 'center', backgroundColor: '#FFFFFF', zIndex: 2},
  leftTitleLine: {flexDirection: 'row', alignItems: 'center', minWidth: 0, gap: 4},
  chevron: {width: 13, color: colors.primary, fontSize: 13, fontWeight: '900'},
  publisherDot: {width: 24, height: 24, marginRight: -22, borderRadius: 12, backgroundColor: colors.primary},
  publisherAvatarText: {width: 24, color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '900', textAlign: 'center', zIndex: 3},
  leftTitle: {flex: 1, minWidth: 0, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '800'},
  publisherTitle: {fontSize: 14},
  leftMeta: {marginTop: 3, color: colors.textMuted, fontSize: 10, lineHeight: 14},
  middleViewport: {flex: 1, minWidth: 0, backgroundColor: '#FFFFFF'},
  middleContent: {flexDirection: 'row', alignItems: 'stretch'},
  middleCell: {paddingHorizontal: 8, justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#EDF2F1'},
  middleText: {color: colors.textSecondary, fontSize: 12, lineHeight: 17},
  right: {width: RIGHT_WIDTH, paddingHorizontal: 9, alignItems: 'flex-end', justifyContent: 'center', backgroundColor: '#FFFFFF', zIndex: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#DCE6E3'},
  price: {width: '100%', color: colors.price, fontSize: 14, lineHeight: 19, fontWeight: '800', textAlign: 'right'},
  negotiate: {color: colors.primary, fontSize: 13},
  time: {marginTop: 3, color: colors.textMuted, fontSize: 10, lineHeight: 14},
  highlightedRow: {backgroundColor: '#F3FAF8'},
  highlightedCell: {backgroundColor: '#F3FAF8'},
  publisherRow: {minHeight: 58},
  pressed: {backgroundColor: '#F0F8F6'},
});
