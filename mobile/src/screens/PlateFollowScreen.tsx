import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import {OriginalTextSheet} from '../components/detail/OriginalTextSheet';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import {copyToClipboard, dialPhone} from '../utils/contact';
import {buildOriginalTextPayload, type OriginalTextPayload} from '../utils/originalText';
import {formatGoodsLocation} from '../utils/offer';
import {
  getIntentPlates,
  getRecentContactPlates,
  recordRecentContactPlate,
  removeIntentPlate,
  updateIntentPlate,
  type ContactAction,
  type FollowStatus,
  type PlateSnapshot,
} from '../utils/plateFollowStore';

type Props = NativeStackScreenProps<RootStackParamList, 'PlateFollow'>;
type FollowTab = 'intent' | 'recent';
type DetailPartKind = 'tag' | 'location' | 'goods' | 'feeding' | 'fat' | 'breed' | 'weight' | 'remark';
type DetailPart = {
  text: string;
  kind: DetailPartKind;
};

export function PlateFollowScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FollowTab>(route.params?.initialTab ?? 'intent');
  const category = route.params?.category ?? '牛';
  const [intentItems, setIntentItems] = useState<PlateSnapshot[]>([]);
  const [recentItems, setRecentItems] = useState<PlateSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [originalText, setOriginalText] = useState<OriginalTextPayload | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [intentData, recentData] = await Promise.all([getIntentPlates(), getRecentContactPlates()]);
      setIntentItems(intentData);
      setRecentItems(recentData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const items = tab === 'intent' ? intentItems : recentItems;

  const subtitle = useMemo(() => {
    if (tab === 'intent') {
      return `已暂存 ${intentItems.length} 条感兴趣的盘`;
    }
    return `最近联系过 ${recentItems.length} 条盘`;
  }, [intentItems.length, recentItems.length, tab]);

  const handleContact = useCallback(async (item: PlateSnapshot, action: ContactAction) => {
    await recordRecentContactPlate(item, action).catch(() => undefined);
    if (action === 'wechat') {
      copyToClipboard(item.contactPhone ?? '', '已复制手机号').catch(() => undefined);
    } else {
      dialPhone(item.contactPhone ?? null);
    }
    load().catch(() => undefined);
  }, [load]);

  const handleRemoveIntent = useCallback((item: PlateSnapshot) => {
    Alert.alert('移出意向盘', `确定将“${item.title}”移出意向盘吗？`, [
      {text: '取消', style: 'cancel'},
      {
        text: '移出',
        style: 'destructive',
        onPress: () => {
          removeIntentPlate(item.key)
            .then(() => load())
            .catch(error => {
              Alert.alert('移出失败', error instanceof Error ? error.message : '请稍后重试');
            });
        },
      },
    ]);
  }, [load]);

  const handleUpdateIntent = useCallback(async (item: PlateSnapshot, patch: Partial<Pick<PlateSnapshot, 'note' | 'followStatus'>>) => {
    setIntentItems(prev => prev.map(current => (current.key === item.key ? {...current, ...patch} : current)));
    await updateIntentPlate(item.key, patch).catch(() => load().catch(() => undefined));
  }, [load]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <View style={[styles.safeTop, {height: insets.top}]} />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <BackIcon />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>我的跟进</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <View style={styles.tabBar}>
        <FollowTabButton text="意向盘" active={tab === 'intent'} count={intentItems.length} onPress={() => setTab('intent')} />
        <FollowTabButton text="最近沟通" active={tab === 'recent'} count={recentItems.length} onPress={() => setTab('recent')} />
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.key}
        renderItem={({item}) => (
          <PlateCard
            item={item}
            mode={tab}
            onCopyWechat={() => handleContact(item, 'wechat')}
            onDial={() => handleContact(item, 'phone')}
            onViewOriginalText={setOriginalText}
            onRemove={tab === 'intent' ? () => handleRemoveIntent(item) : undefined}
            onUpdate={tab === 'intent' ? patch => handleUpdateIntent(item, patch) : undefined}
          />
        )}
        contentContainerStyle={[styles.listContent, items.length === 0 && styles.listContentEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <EmptyState
              tab={tab}
              onSearch={() => navigation.navigate('Search', {category})}
            />
          )
        }
      />

      <OriginalTextSheet
        visible={Boolean(originalText)}
        text={originalText?.text ?? ''}
        keywords={originalText?.keywords ?? []}
        onClose={() => setOriginalText(null)}
      />
    </View>
  );
}

function FollowTabButton({
  text,
  active,
  count,
  onPress,
}: {
  text: string;
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{text}</Text>
      <View style={[styles.tabCountBadge, active && styles.tabCountBadgeActive]}>
        <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function PlateCard({
  item,
  mode,
  onCopyWechat,
  onDial,
  onViewOriginalText,
  onRemove,
  onUpdate,
}: {
  item: PlateSnapshot;
  mode: FollowTab;
  onCopyWechat: () => void;
  onDial: () => void;
  onViewOriginalText: (payload: OriginalTextPayload) => void;
  onRemove?: () => void;
  onUpdate?: (patch: Partial<Pick<PlateSnapshot, 'note' | 'followStatus'>>) => void;
}) {
  const price = formatPrice(item);
  const time = mode === 'recent' ? formatRelativeTime(item.lastContactedAt) : formatRelativeTime(item.createdAt);
  const merchantName = item.merchantName?.trim() ?? '';
  const hasMerchantName = Boolean(merchantName) && merchantName !== '未知商家';
  const publisherName = item.publisherName?.trim() || '未知发布人';
  const detailParts = buildPlateDetailParts(item);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeBadge, item.type === 'inquiry' ? styles.typeBadgeInquiry : styles.typeBadgeOffer]}>
          <Text style={[styles.typeBadgeText, item.type === 'inquiry' ? styles.typeBadgeTextInquiry : styles.typeBadgeTextOffer]}>
            {item.type === 'inquiry' ? '求购' : '报盘'}
          </Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardTime}>{time}</Text>
      </View>

      {detailParts.length > 0 ? (
        <View style={styles.detailRow}>
          {detailParts.map(part => (
            <DetailChip key={`${part.kind}-${part.text}`} part={part} />
          ))}
        </View>
      ) : null}

      <View style={styles.publisherPriceRow}>
        <View style={styles.publisherRow}>
          <View style={styles.publisherTextWrap}>
            {hasMerchantName ? (
              <>
                <CompanyIcon />
                <Text style={styles.merchantText} numberOfLines={1}>{merchantName}</Text>
                <Text style={styles.publisherDivider}>|</Text>
              </>
            ) : null}
            <PersonIcon />
            <Text style={[styles.publisherNameText, !hasMerchantName && styles.publisherNameOnlyText]} numberOfLines={1}>
              {publisherName}
            </Text>
          </View>
        </View>
        {price ? (
          <View style={styles.priceLine}>
            <Text style={[styles.priceValue, price.amount === '协商报价' && styles.negotiateText]} numberOfLines={1}>
              {price.amount}
            </Text>
            {price.unit ? <Text style={styles.priceUnit}>{price.unit}</Text> : null}
          </View>
        ) : null}
      </View>

      {onUpdate ? (
        <View style={styles.followBox}>
          <Text style={styles.followLabel}>跟进状态</Text>
          <View style={styles.statusRow}>
            {followStatusOptions.map(option => (
              <Pressable
                key={option.value}
                onPress={() => onUpdate({followStatus: option.value})}
                style={[styles.statusChip, item.followStatus === option.value && styles.statusChipActive]}>
                <Text style={[styles.statusText, item.followStatus === option.value && styles.statusTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <FollowNoteInput value={item.note ?? ''} onSubmit={note => onUpdate({note})} />
        </View>
      ) : item.lastContactAction ? (
        <Text style={styles.recentActionText}>
          最近动作：{item.lastContactAction === 'wechat' ? '添加微信' : '拨打电话'}
        </Text>
      ) : null}

      <View style={styles.actionDivider} />
      <View style={styles.actionRow}>
        <Pressable
          style={styles.actionButton}
          onPress={() =>
            onViewOriginalText(
              buildOriginalTextPayload({
                text: item.originalText,
                intent: item.type,
                offerType: item.offerType,
                country: item.country,
                factoryNo: item.factoryNo,
                productName: item.productName,
                price: item.price,
                priceMax: item.priceMax,
                goodsLocation: item.goodsLocation,
                goodsType: item.goodsType,
                feedingType: item.feedingType,
                fatRatio: item.fatRatio,
                cattleBreed: item.cattleBreed,
                tags: item.tags,
                remark: item.remark,
                publishTime: item.publishTime,
                userNickname: item.publisherName,
                merchantName: item.merchantName,
              }),
            )
          }>
          <BookIcon />
          <Text style={styles.actionText}>查看原文</Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable style={styles.actionButton} onPress={onCopyWechat}>
          <AddSquareIcon />
          <Text style={styles.actionText}>添加微信</Text>
        </Pressable>
        <View style={styles.actionVDivider} />
        <Pressable style={styles.actionButton} onPress={onDial}>
          <PhoneIcon />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>拨打电话</Text>
        </Pressable>
        {onRemove ? (
          <>
            <View style={styles.actionVDivider} />
            <Pressable style={styles.actionButton} onPress={onRemove}>
              <Text style={styles.removeText}>移出</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

function DetailChip({part}: {part: DetailPart}) {
  return (
    <View
      style={[
        styles.detailChip,
        part.kind === 'tag' && styles.detailChipTag,
        part.kind === 'location' && styles.detailChipLocation,
        part.kind === 'goods' && styles.detailChipGoods,
        part.kind === 'feeding' && styles.detailChipFeeding,
        part.kind === 'fat' && styles.detailChipFat,
        part.kind === 'breed' && styles.detailChipBreed,
        part.kind === 'weight' && styles.detailChipWeight,
        part.kind === 'remark' && styles.detailChipRemark,
      ]}>
      <Text
        style={[
          styles.detailChipText,
          part.kind === 'tag' && styles.detailChipTextTag,
          part.kind === 'location' && styles.detailChipTextLocation,
          part.kind === 'goods' && styles.detailChipTextGoods,
          part.kind === 'feeding' && styles.detailChipTextFeeding,
          part.kind === 'fat' && styles.detailChipTextFat,
          part.kind === 'breed' && styles.detailChipTextBreed,
          part.kind === 'weight' && styles.detailChipTextWeight,
          part.kind === 'remark' && styles.detailChipTextRemark,
        ]}
        numberOfLines={1}>
        {part.text}
      </Text>
    </View>
  );
}

const followStatusOptions: Array<{label: string; value: FollowStatus}> = [
  {label: '已联系', value: 'contacted'},
  {label: '待回复', value: 'waiting'},
  {label: '重点', value: 'key'},
  {label: '已成交', value: 'done'},
  {label: '放弃', value: 'abandoned'},
];

function FollowNoteInput({value, onSubmit}: {value: string; onSubmit: (value: string) => void}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={() => onSubmit(draft.trim())}
      onSubmitEditing={() => onSubmit(draft.trim())}
      placeholder="添加备注，例如：已问价、等回电、重点对比"
      placeholderTextColor="#A8B2B0"
      multiline
      style={styles.noteInput}
    />
  );
}

function EmptyState({tab, onSearch}: {tab: FollowTab; onSearch: () => void}) {
  const title = tab === 'intent' ? '暂无意向盘' : '暂无最近沟通';
  const desc = tab === 'intent' ? '看到感兴趣的盘，可以先加入意向盘。' : '点击添加微信或拨打电话后，会自动记录在这里。';

  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <PathIcon />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
      <Pressable onPress={onSearch} style={styles.emptyButton}>
        <Text style={styles.emptyButtonText}>去搜索</Text>
      </Pressable>
    </View>
  );
}

function buildPlateDetailParts(item: PlateSnapshot): DetailPart[] {
  const parts: DetailPart[] = [];
  const add = (kind: DetailPartKind, value?: string | null) => {
    const text = value?.trim();
    if (text) parts.push({kind, text});
  };

  splitTags(item.tags).slice(0, 3).forEach(tag => add('tag', tag));
  add('tag', item.offerType);
  add('location', formatGoodsLocation(item.goodsLocation ?? item.region));
  add('goods', item.goodsType);
  add('feeding', item.feedingType);
  add('fat', item.fatRatio);
  add('breed', item.cattleBreed);
  add('weight', item.weight);
  add('remark', item.remark);

  const seen = new Set<string>();
  return parts.filter(part => {
    const key = `${part.kind}-${part.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitTags(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[|,，、\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function formatPrice(item: PlateSnapshot) {
  if (item.price == null || item.price <= 0) return item.type === 'offer' ? {amount: '协商报价', unit: ''} : null;
  const amount = item.priceMax != null && item.priceMax > 0 && item.priceMax !== item.price
    ? `¥${trimNum(item.price)}-${trimNum(item.priceMax)}`
    : `¥${trimNum(item.price)}`;
  return {amount, unit: '/kg'};
}

function trimNum(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatRelativeTime(value?: number) {
  if (!value) return '';
  const diffMs = Math.max(0, Date.now() - value);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18L9 12L15 6" stroke="#171D1C" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PathIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44" fill="none">
      <Path d="M15 8H29C31.2 8 33 9.8 33 12V36L22 30L11 36V12C11 9.8 12.8 8 15 8Z" stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M22 15V25M17 20H27" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
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

function CompanyIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
      <Path
        d="M2.75 14V4.1c0-.6.4-1.1 1-1.25l4.05-1c.75-.2 1.45.38 1.45 1.15V14"
        stroke="#477782"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.25 5.35h2.9c.6 0 1.1.5 1.1 1.1V14M1.75 14h12.5"
        stroke="#477782"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M5 5.15h2M5 7.5h2M5 9.85h2" stroke="#477782" strokeWidth={1.15} strokeLinecap="round" />
    </Svg>
  );
}

function PersonIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
      <Path d="M8 7.3c1.41 0 2.55-1.14 2.55-2.55S9.41 2.2 8 2.2 5.45 3.34 5.45 4.75 6.59 7.3 8 7.3Z" stroke="#6C7A77" strokeWidth={1.25} />
      <Path
        d="M3.35 13.55c.28-2.35 2.2-4.1 4.65-4.1s4.37 1.75 4.65 4.1"
        stroke="#6C7A77"
        strokeWidth={1.25}
        strokeLinecap="round"
      />
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

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4F7F6'},
  safeTop: {backgroundColor: '#FFFFFF'},
  header: {
    minHeight: 58,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  titleWrap: {flex: 1, alignItems: 'center'},
  title: {color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700'},
  subtitle: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  tabBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#F4F7F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabButtonActive: {backgroundColor: colors.primary},
  tabText: {color: colors.textSecondary, fontSize: 14, lineHeight: 18, fontWeight: '600'},
  tabTextActive: {color: '#FFFFFF'},
  tabCountBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountBadgeActive: {backgroundColor: 'rgba(255,255,255,0.2)'},
  tabCountText: {color: colors.primary, fontSize: 11, fontWeight: '700'},
  tabCountTextActive: {color: '#FFFFFF'},
  listContent: {padding: 10, paddingBottom: 32},
  listContentEmpty: {flexGrow: 1, alignItems: 'center', justifyContent: 'center'},
  card: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  typeBadge: {
    minWidth: 38,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadgeOffer: {backgroundColor: '#EAF9F7', borderColor: '#BDE9E4'},
  typeBadgeInquiry: {backgroundColor: '#EEF4FF', borderColor: '#C8D8FF'},
  typeBadgeText: {fontSize: 13, lineHeight: 18},
  typeBadgeTextOffer: {color: colors.primary},
  typeBadgeTextInquiry: {color: '#3767D6'},
  cardTitle: {flex: 1, minWidth: 0, color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '500'},
  cardTime: {color: colors.textMuted, fontSize: 13, lineHeight: 18, flexShrink: 0},
  detailRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  detailChip: {
    maxWidth: 220,
    minHeight: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailChipTag: {backgroundColor: '#FFF2E8'},
  detailChipLocation: {backgroundColor: '#F4F6F5'},
  detailChipGoods: {backgroundColor: '#EEF4FF'},
  detailChipFeeding: {backgroundColor: '#EEF8F2'},
  detailChipFat: {backgroundColor: '#FFF2E8'},
  detailChipBreed: {backgroundColor: '#F7EEFF'},
  detailChipWeight: {backgroundColor: '#F6F2FF'},
  detailChipRemark: {backgroundColor: '#FFF1F0', maxWidth: 260},
  detailChipText: {fontSize: 13, lineHeight: 18},
  detailChipTextTag: {color: '#D86B17', fontWeight: '600'},
  detailChipTextLocation: {color: colors.textSecondary},
  detailChipTextGoods: {color: '#3767D6'},
  detailChipTextFeeding: {color: '#1F8A55'},
  detailChipTextFat: {color: '#C96A1A'},
  detailChipTextBreed: {color: '#7A47B8'},
  detailChipTextWeight: {color: '#7A47B8'},
  detailChipTextRemark: {color: '#D54941'},
  publisherPriceRow: {
    marginTop: 9,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  publisherRow: {
    width: '68%',
    maxWidth: '68%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  publisherTextWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  merchantText: {flex: 1.05, minWidth: 0, color: colors.textMuted, fontSize: 14, lineHeight: 20},
  publisherDivider: {width: 14, textAlign: 'center', color: '#D4DAD8', fontSize: 14, lineHeight: 20},
  publisherNameText: {flex: 0.95, minWidth: 0, color: colors.textMuted, fontSize: 14, lineHeight: 20},
  publisherNameOnlyText: {flex: 1.8},
  priceLine: {flexDirection: 'row', alignItems: 'baseline', flexShrink: 0, justifyContent: 'flex-end', maxWidth: '32%'},
  priceValue: {fontFamily: fonts.manropeSemiBold, color: colors.price, fontSize: 16, lineHeight: 20},
  priceUnit: {fontFamily: fonts.manropeRegular, color: colors.text, fontSize: 10, lineHeight: 20, marginLeft: 2},
  negotiateText: {fontFamily: fonts.manropeSemiBold, color: colors.primary, fontSize: 14, lineHeight: 18},
  followBox: {marginTop: 10, borderRadius: 6, backgroundColor: '#F8FAFA', padding: 8},
  followLabel: {color: colors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '600'},
  statusRow: {marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  statusChip: {
    minHeight: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE8E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipActive: {backgroundColor: '#E7F5F2', borderColor: '#BDE3DD'},
  statusText: {color: colors.textSecondary, fontSize: 11, lineHeight: 15},
  statusTextActive: {color: colors.primary, fontWeight: '700'},
  noteInput: {
    marginTop: 8,
    minHeight: 38,
    maxHeight: 82,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DDE8E5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 7,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  recentActionText: {marginTop: 8, color: colors.textMuted, fontSize: 12, lineHeight: 17},
  actionDivider: {marginTop: 10, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,106,97,0.12)'},
  actionRow: {minHeight: 38, flexDirection: 'row', alignItems: 'center'},
  actionButton: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8},
  actionText: {color: '#3C4947', fontSize: 13, lineHeight: 18},
  actionTextPrimary: {color: colors.primary, fontWeight: '600'},
  removeText: {color: colors.textMuted, fontSize: 12, lineHeight: 17},
  actionVDivider: {width: StyleSheet.hairlineWidth, height: 14, backgroundColor: 'rgba(60,73,71,0.26)'},
  emptyWrap: {alignItems: 'center', paddingHorizontal: 28},
  emptyIcon: {width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8F5F3', alignItems: 'center', justifyContent: 'center'},
  emptyTitle: {marginTop: 14, color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700'},
  emptyDesc: {marginTop: 6, color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center'},
  emptyButton: {marginTop: 18, height: 38, paddingHorizontal: 22, borderRadius: 4, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center'},
  emptyButtonText: {color: '#FFFFFF', fontSize: 14, lineHeight: 18, fontWeight: '600'},
});
