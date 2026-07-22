import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {mooketApi} from '../api/mooketApi';
import {ChevronDownIcon, StarIcon} from '../components/common/AppIcons';
import {HomeCardSwitcher} from '../components/home/cards';
import {DEFAULT_CATEGORY} from '../config/env';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import type {HomeCardItem} from '../types/api';
import {openHomeCard} from '../utils/navigation';
import {getRemoveSelfSelectMessage} from '../utils/selfSelectEntity';
import {
  enrichSelfSelectCards,
  mergeSelfSelectCardsWithHistories,
  sortSelfSelectCardsByCreateTime,
} from '../utils/selfSelectCards';

type Props = NativeStackScreenProps<RootStackParamList, 'HomeCards'>;

const categories = ['牛', '猪'];
const archiveDelIconPath = "M12.6152 1.5C14.2125 1.50013 15.5098 2.80482 15.5176 4.39453V14.9629C15.5174 16.32 14.5499 16.8901 13.3652 16.2305L9.70508 14.1973C9.32267 13.9798 8.69274 13.9799 8.30273 14.1973L4.64258 16.2305C3.45775 16.8828 2.49042 16.3126 2.49023 14.9629V4.39453C2.49049 2.80482 3.78753 1.50012 5.38477 1.5H12.6152ZM7.125 7.4248C6.81756 7.4248 6.5626 7.67989 6.5625 7.9873C6.5625 8.2948 6.8175 8.5498 7.125 8.5498H10.875C11.1825 8.5498 11.4375 8.2948 11.4375 7.9873C11.4374 7.67989 11.1824 7.4248 10.875 7.4248H7.125Z";

export function HomeCardsScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState(route.params?.category ?? DEFAULT_CATEGORY);
  const [cards, setCards] = useState<HomeCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, histories] = await Promise.all([
        mooketApi.getSelfSelectCards(category),
        mooketApi.getSelfSelectSearches(500).catch(() => []),
      ]);
      const mergedCards = mergeSelfSelectCardsWithHistories(result.cards ?? [], histories);
      const nextCards = await enrichSelfSelectCards(category, mergedCards);
      setCards(sortSelfSelectCardsByCreateTime(nextCards, histories));
    } finally {
      setLoading(false);
    }
  }, [category]);

  const handleEditToggle = useCallback(() => {
    setEditMode(prev => {
      const next = !prev;
      if (prev && !next) {
        load().catch(() => undefined);
      }
      return next;
    });
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  function switchCategory(value: string) {
    setCategory(value);
    setMenuOpen(false);
    setEditMode(false);
  }

  async function cancelSelfSelect(historyId: number) {
    const previous = cards;
    setCards(prev => prev.filter(item => item.historyId !== historyId));
    try {
      await mooketApi.cancelSelfSelect(historyId);
    } catch (error) {
      setCards(previous);
      Alert.alert('移出失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  const {leftColumn, rightColumn} = useMemo(() => splitColumns(cards), [cards]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top, minHeight: insets.top + 56}]}>
        <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M15 5L8 12L15 19" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <Text style={styles.headerTitle}>数据卡片</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => setMenuOpen(prev => !prev)} style={styles.categoryTrigger}>
            <Text style={styles.categoryTriggerText}>{category}</Text>
            <ChevronDownIcon size={14} />
          </Pressable>
          {cards.length > 0 ? (
            <Pressable hitSlop={8} onPress={handleEditToggle}>
              <Text style={[styles.editText, editMode && styles.editTextActive]}>
                {editMode ? '完成' : '编辑'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {menuOpen ? (
          <View style={styles.categoryMenu}>
            {categories.map(item => {
              const selected = item === category;
              return (
                <Pressable key={item} onPress={() => switchCategory(item)} style={styles.categoryMenuItem}>
                  <Text style={[styles.categoryMenuText, selected && styles.categoryMenuTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.tabsRow}>
        <TabItem
          icon={<StarIcon size={16} color={colors.primary} />}
          text="自选数据"
          active
          onPress={() => undefined}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {cards.length === 0 ? (
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <EmptySelfSelectState onAdd={() => navigation.navigate('Search', {category, initialTab: 'offer'})} />
          )
        ) : (
          <View style={styles.gridRow}>
            <View style={styles.gridColumn}>
              {leftColumn.map((card, index) => (
                <CardWithActions
                  key={`l-${card.historyId ?? card.rank ?? index}`}
                  card={card}
                  editMode={editMode}
                  onPress={() => openHomeCard(navigation, category, card)}
                  onCancelSelfSelect={() => confirmCancelSelfSelect(card, cancelSelfSelect)}
                />
              ))}
            </View>
            <View style={styles.gridColumn}>
              {rightColumn.map((card, index) => (
                <CardWithActions
                  key={`r-${card.historyId ?? card.rank ?? index}`}
                  card={card}
                  editMode={editMode}
                  onPress={() => openHomeCard(navigation, category, card)}
                  onCancelSelfSelect={() => confirmCancelSelfSelect(card, cancelSelfSelect)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CardWithActions({
  card,
  editMode,
  onPress,
  onCancelSelfSelect,
}: {
  card: HomeCardItem;
  editMode: boolean;
  onPress: () => void;
  onCancelSelfSelect: () => void;
}) {
  return (
    <View style={styles.cardWrap}>
      <HomeCardSwitcher card={card} onPress={editMode ? undefined : onPress} />
      {card.isExample && !editMode ? (
        <View style={styles.exampleBadge}>
          <Text style={styles.exampleBadgeText}>例</Text>
        </View>
      ) : null}
      {editMode && card.historyId ? (
        <Pressable hitSlop={4} onPress={onCancelSelfSelect} style={styles.editIconSingle}>
          <Svg width={16} height={16} viewBox="0 0 18 18" fill="none">
            <Path d={archiveDelIconPath} fill="#006A61" />
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptySelfSelectState({onAdd}: {onAdd: () => void}) {
  return (
    <View style={styles.emptySelfWrap}>
      <Pressable onPress={onAdd} hitSlop={8} style={styles.emptySelfButton}>
        <View style={styles.emptySelfSquare}>
          <Svg width={42} height={42} viewBox="0 0 42 42" fill="none">
            <Path d="M21 10.5V31.5" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
            <Path d="M10.5 21H31.5" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </View>
        <Text style={styles.emptySelfText}>暂无数据 搜索后添加</Text>
      </Pressable>
    </View>
  );
}

function TabItem({
  icon,
  text,
  active,
  onPress,
}: {
  icon: React.ReactNode;
  text: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={styles.tabIconRow}>
        {icon}
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{text}</Text>
      </View>
      <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
    </Pressable>
  );
}

function splitColumns(cards: HomeCardItem[]) {
  const left: HomeCardItem[] = [];
  const right: HomeCardItem[] = [];
  cards.forEach((card, index) => {
    if (index % 2 === 0) left.push(card);
    else right.push(card);
  });
  return {leftColumn: left, rightColumn: right};
}

function confirmCancelSelfSelect(card: HomeCardItem, onConfirm: (id: number) => void | Promise<void>) {
  const historyId = card.historyId;
  if (!historyId) return;
  Alert.alert('移出自选', getRemoveSelfSelectMessage(card), [
    {text: '取消', style: 'cancel'},
    {text: '移出', style: 'destructive', onPress: () => onConfirm(historyId)},
  ]);
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {width: 24, height: 24, alignItems: 'center', justifyContent: 'center'},
  headerTitle: {color: colors.text, fontSize: 18, fontWeight: '600'},
  headerActions: {flexDirection: 'row', alignItems: 'center', gap: 16},
  categoryTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryTriggerText: {color: colors.text, fontSize: 14, fontWeight: '600'},
  editText: {color: '#9DA4A3', fontSize: 14},
  editTextActive: {color: colors.primary, fontWeight: '600'},
  categoryMenu: {
    position: 'absolute',
    top: 50,
    right: 60,
    width: 90,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    zIndex: 20,
  },
  categoryMenuItem: {paddingHorizontal: 12, paddingVertical: 10},
  categoryMenuText: {color: colors.text, fontSize: 14},
  categoryMenuTextActive: {color: colors.primary, fontWeight: '600'},
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 24,
  },
  tabItem: {alignItems: 'center', gap: 4},
  tabIconRow: {flexDirection: 'row', alignItems: 'center', gap: 4},
  tabText: {color: '#3C4947', fontSize: 14},
  tabTextActive: {color: colors.primary, fontWeight: '600'},
  tabIndicator: {height: 3, width: 0, backgroundColor: 'transparent', borderRadius: 1.5},
  tabIndicatorActive: {width: 18, backgroundColor: colors.primary},
  scroll: {flex: 1},
  content: {padding: 16, paddingBottom: 32},
  gridRow: {flexDirection: 'row', gap: 12},
  gridColumn: {flex: 1, gap: 12},
  cardWrap: {gap: 6, position: 'relative'},
  exampleBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,106,97,0.85)',
    zIndex: 2,
  },
  exampleBadgeText: {color: '#FFFFFF', fontSize: 9, fontWeight: '700'},
  editIconSingle: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  loading: {marginTop: 32},
  emptySelfWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 72,
    paddingBottom: 120,
  },
  emptySelfButton: {alignItems: 'center', justifyContent: 'center'},
  emptySelfSquare: {
    width: 86,
    height: 86,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptySelfText: {marginTop: 10, color: '#6C7A77', fontSize: 12, lineHeight: 16},
});
