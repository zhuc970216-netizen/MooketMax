import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Path, Circle} from 'react-native-svg';
import {SvgXml} from 'react-native-svg';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {mooketApi} from '../api/mooketApi';
import {HomeCardSwitcher} from '../components/home/cards';
import {MooketMaxLogo} from '../components/login/LoginIcons';
import {DEFAULT_CATEGORY} from '../config/env';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import {fonts} from '../theme/typography';
import type {HomeCardItem, HomeStatData, HotSearchItem, OfferFeedItem} from '../types/api';
import {openHomeCard, openHotSearch} from '../utils/navigation';
import {getPlateFollowCounts} from '../utils/plateFollowStore';
import {getRemoveSelfSelectMessage} from '../utils/selfSelectEntity';
import {
  enrichSelfSelectCards,
  mergeSelfSelectCardsWithHistories,
  sortSelfSelectCardsByCreateTime,
} from '../utils/selfSelectCards';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const categories = ['牛', '猪'];
const HOME_INQUIRY_PAGE_SIZE = 30;
const HOME_INQUIRY_VISIBLE_COUNT = 3;
const HOME_INQUIRY_ROW_HEIGHT = 32;
const HOME_INQUIRY_SCROLL_MS_PER_ROW = 2400;
const HOME_INQUIRY_SCROLL_ANIMATION_MS = 520;
const SHOW_HOME_ENTRY_BLOCKS = false;

// 18x18 主色「移除删除」icon
const archiveDelIconXml = `<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M12.6152 1.5C14.2125 1.50013 15.5098 2.80482 15.5176 4.39453V14.9629C15.5174 16.32 14.5499 16.8901 13.3652 16.2305L9.70508 14.1973C9.32267 13.9798 8.69274 13.9799 8.30273 14.1973L4.64258 16.2305C3.45775 16.8828 2.49042 16.3126 2.49023 14.9629V4.39453C2.49049 2.80482 3.78753 1.50012 5.38477 1.5H12.6152ZM7.125 7.4248C6.81756 7.4248 6.5626 7.67989 6.5625 7.9873C6.5625 8.2948 6.8175 8.5498 7.125 8.5498H10.875C11.1825 8.5498 11.4375 8.2948 11.4375 7.9873C11.4374 7.67989 11.1824 7.4248 10.875 7.4248H7.125Z" fill="#006A61"/></svg>`;

export function HomeScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [stat, setStat] = useState<HomeStatData | null>(null);
  const [hotSearches, setHotSearches] = useState<HotSearchItem[]>([]);
  const [cards, setCards] = useState<HomeCardItem[]>([]);
  const [homeInquiries, setHomeInquiries] = useState<OfferFeedItem[]>([]);
  const [followCounts, setFollowCounts] = useState({intentCount: 0, recentCount: 0});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [headerSticky, setHeaderSticky] = useState(false);
  const headerHeightRef = useRef(0);
  const [fixedTopBottom, setFixedTopBottom] = useState(0);
  const focusRefreshReadyRef = useRef(false);
  const loadRef = useRef<(mode?: 'initial' | 'refresh' | 'silent') => Promise<void>>(async () => undefined);
  const sectionListRef = useRef<SectionList>(null);
  const inquiryTickerY = useRef(new Animated.Value(0)).current;
  const inquiryTickerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const inquiryTickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inquiryTickerStepRef = useRef(0);
  const handleEditToggle = useCallback(() => {
    setEditMode(prev => {
      const next = !prev;
      if (prev && !next) {
        loadRef.current('silent').catch(() => undefined);
      }
      return next;
    });
  }, []);

  const performScrollToTop = useCallback((animated: boolean) => {
    const list = sectionListRef.current as
      | (SectionList & {
          scrollToOffset?: (options: {offset: number; animated?: boolean}) => void;
          getScrollResponder?: () => {
            scrollTo?: (options: {x?: number; y?: number; animated?: boolean}) => void;
          };
          getNativeScrollRef?: () => {
            scrollTo?: (options: {x?: number; y?: number; animated?: boolean}) => void;
          };
        })
      | null;

    list?.scrollToOffset?.({offset: 0, animated});
    list?.scrollToLocation?.({
      sectionIndex: 0,
      itemIndex: 0,
      animated,
      viewPosition: 0,
      viewOffset: 0,
    });
    list?.getNativeScrollRef?.()?.scrollTo?.({x: 0, y: 0, animated});
    list?.getScrollResponder?.()?.scrollTo?.({x: 0, y: 0, animated});
  }, []);

  const scrollHomeToTop = useCallback(() => {
    setMenuOpen(false);
    performScrollToTop(true);

    if (Platform.OS === 'ios') {
      setTimeout(() => {
        performScrollToTop(false);
      }, 120);
      setTimeout(() => {
        performScrollToTop(false);
      }, 260);
    }
  }, [performScrollToTop]);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else if (mode === 'initial') {
      setLoading(true);
    }

    try {
      const [statData, hotData, selfSelectData, selfSelectHistories, inquiryFeedData, followCountData] = await Promise.all([
        mooketApi.getHomeStatData(category),
        mooketApi.getHotSearchRecommendations(category),
        mooketApi.getSelfSelectCards(category),
        mooketApi.getSelfSelectSearches(500).catch(() => []),
        mooketApi
          .getOfferFeed({
            category,
            type: 'inquiry',
            page: 1,
            pageSize: HOME_INQUIRY_PAGE_SIZE,
            sortBy: 'publishTime',
          })
          .catch(() => null),
        getPlateFollowCounts().catch(() => ({intentCount: 0, recentCount: 0})),
      ]);
      const mergedSelfSelectCards = mergeSelfSelectCardsWithHistories(
        selfSelectData.cards ?? [],
        selfSelectHistories,
      );
      const selfSelectCards = await enrichSelfSelectCards(category, mergedSelfSelectCards);

      setStat(statData);
      setHotSearches(hotData);
      setCards(sortSelfSelectCardsByCreateTime(selfSelectCards, selfSelectHistories));
      setHomeInquiries(inquiryFeedData?.items ?? []);
      setFollowCounts(followCountData);
      inquiryTickerY.setValue(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, inquiryTickerY]);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    load('initial').catch(() => undefined);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (focusRefreshReadyRef.current) {
        loadRef.current('silent').catch(() => undefined);
      } else {
        focusRefreshReadyRef.current = true;
      }
    }, []),
  );

  useEffect(() => {
    inquiryTickerLoopRef.current?.stop();
    inquiryTickerLoopRef.current = null;
    if (inquiryTickerIntervalRef.current) {
      clearInterval(inquiryTickerIntervalRef.current);
      inquiryTickerIntervalRef.current = null;
    }
    inquiryTickerStepRef.current = 0;

    if (homeInquiries.length <= 1) {
      inquiryTickerY.setValue(0);
      return undefined;
    }

    inquiryTickerY.setValue(0);
    inquiryTickerIntervalRef.current = setInterval(() => {
      const nextStep = inquiryTickerStepRef.current + 1;
      const animation = Animated.timing(inquiryTickerY, {
        toValue: -(nextStep * HOME_INQUIRY_ROW_HEIGHT),
        duration: HOME_INQUIRY_SCROLL_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

      inquiryTickerLoopRef.current = animation;
      animation.start(({finished}) => {
        if (!finished) return;
        if (nextStep >= homeInquiries.length) {
          inquiryTickerStepRef.current = 0;
          inquiryTickerY.setValue(0);
        } else {
          inquiryTickerStepRef.current = nextStep;
        }
      });
    }, HOME_INQUIRY_SCROLL_MS_PER_ROW);

    return () => {
      inquiryTickerLoopRef.current?.stop();
      inquiryTickerLoopRef.current = null;
      if (inquiryTickerIntervalRef.current) {
        clearInterval(inquiryTickerIntervalRef.current);
        inquiryTickerIntervalRef.current = null;
      }
    };
  }, [homeInquiries.length, inquiryTickerY]);

  const visibleHomeInquiries = useMemo(() => {
    if (homeInquiries.length === 0) return [];
    if (homeInquiries.length === 1) {
      return homeInquiries;
    }

    const repeated = [...homeInquiries];
    while (repeated.length < homeInquiries.length + HOME_INQUIRY_VISIBLE_COUNT) {
      repeated.push(...homeInquiries);
    }
    return repeated;
  }, [homeInquiries]);

  function switchCategory(value: string) {
    setCategory(value);
    setMenuOpen(false);
    setEditMode(false);
  }

  function openInquiryFeed() {
    navigation.navigate('OfferFeed', {category, initialTab: 'inquiry', inquiryOnly: true});
  }

  function openSearch(initialTab?: 'offer' | 'inquiry' | 'merchant') {
    navigation.navigate('Search', initialTab ? {category, initialTab} : {category});
  }

  function openIntentPlates() {
    navigation.navigate('PlateFollow', {initialTab: 'intent', category});
  }

  function openRecentContacts() {
    navigation.navigate('PlateFollow', {initialTab: 'recent', category});
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

  function onArchiveDelete(card: HomeCardItem) {
    if (!card.historyId) return;
    Alert.alert('移出自选', getRemoveSelfSelectMessage(card), [
      {text: '取消', style: 'cancel'},
      {text: '移出', style: 'destructive', onPress: () => cancelSelfSelect(card.historyId!).catch(() => undefined)},
    ]);
  }

  const {leftColumn, rightColumn} = splitColumns(cards);

  // 用 SectionList：section header 固定在mooketmax栏下方
  const sections = [{key: 'cards', data: [{leftColumn, rightColumn}]}];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <View style={[styles.safeTop, {height: insets.top}]} />

      {/* 永远吸顶的 Logo + 用户图标 */}
      <View style={styles.fixedTop} onLayout={(e) => { setFixedTopBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height); }}>
        <View style={styles.headerRow}>
          <MooketMaxLogo width={90} height={14.6451} />
          <View style={styles.headerIcons}>
            <Pressable
              onPress={() => navigation.navigate('Inventory')}
              hitSlop={8}
              style={styles.headerIconButton}>
              <InventoryIcon />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Profile')}
              hitSlop={8}
              style={styles.headerIconButton}>
              <UserSquareIcon />
            </Pressable>
          </View>
        </View>
      </View>

      <SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(_, index) => `cards-${index}`}
        stickySectionHeadersEnabled={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          setShowScrollTop(y > 100);
          setHeaderSticky(y >= headerHeightRef.current);
        }}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View onLayout={(e) => { headerHeightRef.current = e.nativeEvent.layout.height; }}>
          <View style={styles.scrollableTop}>
            {/* 50dp 搜索栏 */}
            <View style={styles.searchWrap}>
              <View style={styles.searchBox}>
                <Pressable onPress={() => setMenuOpen(prev => !prev)} style={styles.searchCategory}>
                  <Text style={styles.searchCategoryText}>{category}</Text>
                  <ChevronDownSmall />
                </Pressable>
                <View style={styles.searchVDivider} />
                <Pressable
                  style={styles.searchPlaceholder}
                  onPress={() => openSearch()}>
                  <Text style={styles.searchPlaceholderText} numberOfLines={1}>
                    搜索国家、厂号、产品、商家、品牌
                  </Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => openSearch()} style={styles.searchIcon}>
                  <SearchIcon24 />
                </Pressable>
              </View>
              {/* menu rendered at root level */}
            </View>

            {/* 热门搜索 */}
            <View style={styles.hotRow}>
              <Text style={styles.hotLabel}>热门搜索</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hotList}>
                {hotSearches.length === 0 ? (
                  <Text style={styles.hotEmpty}>暂无热门搜索</Text>
                ) : (
                  hotSearches.slice(0, 8).map(item => (
                    <Pressable
                      key={`${item.dimension}-${item.keyword}`}
                      onPress={() => openHotSearch(navigation, category, item)}
                      style={styles.hotChip}>
                      <Text style={styles.hotChipText} numberOfLines={1}>
                        {item.keyword}
                      </Text>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
          {SHOW_HOME_ENTRY_BLOCKS ? (
            <>
              <TradingGuideSection
                offerCount={stat?.totalOfferCount}
                inquiries={visibleHomeInquiries}
                tickerTranslateY={inquiryTickerY}
                onInquiryPress={openInquiryFeed}
                onOfferSearchPress={() => openSearch('offer')}
                onMerchantSearchPress={() => openSearch('merchant')}
              />
              <FollowUpSection
                intentCount={followCounts.intentCount}
                recentCount={followCounts.recentCount}
                onIntentPress={openIntentPlates}
                onRecentPress={openRecentContacts}
              />
            </>
          ) : null}
          </View>
        }
        renderSectionHeader={() => (
          <View style={styles.stickyBlock}>
            {/* Tabs + 编辑 按钮 */}
            <View style={styles.tabsBar}>
              <Tab
                text="自选数据"
                active
                icon={<CandleIcon active />}
                onPress={() => undefined}
              />
              <View style={styles.tabsSpace} />
              {cards.length > 0 ? (
                <Pressable onPress={handleEditToggle} style={styles.editButton}>
                  {editMode ? (
                    <View style={styles.editDoneBadge}>
                      <Text style={styles.editDoneText}>完成</Text>
                    </View>
                  ) : (
                    <Text style={styles.editText}>编辑</Text>
                  )}
                </Pressable>
              ) : null}
            </View>

          </View>
        )}
        renderItem={({item}) => {
          if (loading && cards.length === 0) {
            return <ActivityIndicator color={colors.primary} style={styles.cardsLoading} />;
          }
          if (cards.length === 0) {
            return <EmptySelfSelectState onAdd={() => openSearch('offer')} />;
          }
          return (
            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                {item.leftColumn.map((card: HomeCardItem, index: number) => (
                  <CardWithEdit
                    key={`l-${card.cardType}-${card.historyId ?? index}`}
                    card={card}
                    editMode={editMode}
                    onPress={() => openHomeCard(navigation, category, card)}
                    onArchiveDelete={() => onArchiveDelete(card)}
                  />
                ))}
              </View>
              <View style={styles.gridCol}>
                {item.rightColumn.map((card: HomeCardItem, index: number) => (
                  <CardWithEdit
                    key={`r-${card.cardType}-${card.historyId ?? index}`}
                    card={card}
                    editMode={editMode}
                    onPress={() => openHomeCard(navigation, category, card)}
                    onArchiveDelete={() => onArchiveDelete(card)}
                  />
                ))}
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
        showsVerticalScrollIndicator={false}
      />

      {/* 手动吸顶的 stat + tabs 覆盖层 */}
      {headerSticky ? (
        <View style={[styles.stickyOverlay, {top: fixedTopBottom}]}>
          <View style={styles.tabsBar}>
            <Tab
              text="自选数据"
              active
              icon={<CandleIcon active />}
              onPress={() => undefined}
            />
            <View style={styles.tabsSpace} />
            {cards.length > 0 ? (
              <Pressable onPress={handleEditToggle} style={styles.editButton}>
                {editMode ? (
                  <View style={styles.editDoneBadge}>
                    <Text style={styles.editDoneText}>完成</Text>
                  </View>
                ) : (
                  <Text style={styles.editText}>编辑</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {menuOpen ? (
        <View style={styles.categoryMenuOverlay}>
          <Pressable style={styles.categoryMenuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.categoryMenu}>
            {categories.map(item => (
              <Pressable key={item} onPress={() => switchCategory(item)} style={styles.categoryMenuItem}>
                <Text style={[styles.categoryMenuText, item === category && styles.categoryMenuTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {showScrollTop ? (
        <Pressable
          style={styles.scrollTopButton}
          onPress={scrollHomeToTop}>
          <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
            <Path d="M12.2499 22.1666C17.7267 22.1666 22.1666 17.7268 22.1666 12.25C22.1666 6.77316 17.7267 2.33331 12.2499 2.33331C6.77309 2.33331 2.33325 6.77316 2.33325 12.25C2.33325 17.7268 6.77309 22.1666 12.2499 22.1666Z" stroke="white" strokeWidth={1.5} strokeLinejoin="round"/>
            <Path d="M19.3795 19.3794L24.3292 24.3291" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
          </Svg>
        </Pressable>
      ) : null}
    </View>
  );
}

function Tab({
  text,
  active,
  icon,
  onPress,
}: {
  text: string;
  active: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={tabStyles.wrap}>
      <View style={tabStyles.row}>
        {icon}
        <Text style={[tabStyles.text, active && tabStyles.textActive]}>{text}</Text>
      </View>
      <View style={[tabStyles.indicator, active && tabStyles.indicatorActive]} />
    </Pressable>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatViewButton({onPress}: {onPress: () => void}) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.statViewButton}>
      <Text style={styles.statViewText}>查看</Text>
      <Svg width={10} height={10} viewBox="0 0 10 10" fill="none">
        <Path d="M3.75 2.25L6.25 5L3.75 7.75" stroke="#FFFFFF" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

function TradingGuideSection({
  offerCount,
  inquiries,
  tickerTranslateY,
  onInquiryPress,
  onOfferSearchPress,
  onMerchantSearchPress,
}: {
  offerCount?: string | number | null;
  inquiries: OfferFeedItem[];
  tickerTranslateY: Animated.Value;
  onInquiryPress: () => void;
  onOfferSearchPress: () => void;
  onMerchantSearchPress: () => void;
}) {
  const hasInquiry = inquiries.length > 0;

  return (
    <View style={styles.tradeGuideWrap}>
      <View style={styles.tradeGuideGrid}>
        <Pressable
          onPress={onInquiryPress}
          style={({pressed}) => [styles.tradeInquiryCard, pressed && styles.tradeCardPressed]}>
            <View style={styles.tradeHeadingRow}>
              <View style={styles.tradeIconBubble}>
              <ClipboardListIcon size={18} />
            </View>
            <View style={styles.tradeTitleRow}>
              <Text style={styles.tradeMainTitle} numberOfLines={1}>求购专区</Text>
              <SmallChevronIcon color={colors.text} />
            </View>
          </View>
          <Text style={styles.tradeSubtitle}>看看今日市场需求</Text>

          <View style={styles.inquiryTickerClip}>
            {hasInquiry ? (
              <Animated.View style={[styles.inquiryTickerTrack, {transform: [{translateY: tickerTranslateY}]}]}>
                {inquiries.map((item, index) => (
                  <HomeInquiryTickerRow
                    key={`${item.offerId ?? 'inquiry'}-${index}`}
                    item={item}
                    showDivider={index < inquiries.length - 1}
                  />
                ))}
              </Animated.View>
            ) : (
              <View style={styles.inquiryTickerEmpty}>
                <Text style={styles.inquiryTickerEmptyText}>暂无求购动态</Text>
              </View>
            )}
          </View>
        </Pressable>

        <View style={styles.tradeSideColumn}>
          <Pressable
            onPress={onOfferSearchPress}
            style={({pressed}) => [styles.tradeSideCard, pressed && styles.tradeCardPressed]}>
            <View style={styles.tradeSideHeadingRow}>
              <View style={styles.tradeIconBubbleSmall}>
                <OfferSearchIcon size={15} />
              </View>
              <View style={styles.tradeSideTitleRow}>
                <Text
                  style={styles.tradeSideTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  maxFontSizeMultiplier={1}>
                  搜报盘
                </Text>
                <SmallChevronIcon color={colors.text} />
              </View>
            </View>
            <Text style={styles.tradeSideSubtitle}>按产品/厂号/集团搜索</Text>
            <Text style={styles.tradeSideStat}>
              近两日报盘 <Text style={styles.tradeSideStatValue}>{formatHomeCount(offerCount)}</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={onMerchantSearchPress}
            style={({pressed}) => [styles.tradeSideCard, pressed && styles.tradeCardPressed]}>
            <View style={styles.tradeSideHeadingRow}>
              <View style={styles.tradeIconBubbleSmall}>
                <MerchantSearchIcon size={15} />
              </View>
              <View style={styles.tradeSideTitleRow}>
                <Text
                  style={styles.tradeSideTitle}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  maxFontSizeMultiplier={1}>
                  搜商家
                </Text>
                <SmallChevronIcon color={colors.text} />
              </View>
            </View>
            <Text style={styles.tradeSideSubtitle}>查商家 看报盘求购</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function FollowUpSection({
  intentCount,
  recentCount,
  onIntentPress,
  onRecentPress,
}: {
  intentCount: number;
  recentCount: number;
  onIntentPress: () => void;
  onRecentPress: () => void;
}) {
  return (
    <View style={styles.followWrap}>
      <View style={styles.followHeader}>
        <Text style={styles.followTitle}>我的跟进</Text>
      </View>
      <View style={styles.followGrid}>
        <FollowEntryCard
          title="意向盘"
          count={intentCount}
          subtitle="暂存感兴趣的盘"
          icon={<IntentBookmarkIcon />}
          onPress={onIntentPress}
        />
        <FollowEntryCard
          title="最近沟通"
          count={recentCount}
          subtitle="找回联系过的盘"
          icon={<RecentChatIcon />}
          onPress={onRecentPress}
        />
      </View>
    </View>
  );
}

function FollowEntryCard({
  title,
  count,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  count: number;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.followCard, pressed && styles.tradeCardPressed]}>
      <View style={styles.followCardTop}>
        <View style={styles.followIconBubble}>{icon}</View>
        <View style={styles.followCountBadge}>
          <Text style={styles.followCountText}>{count}</Text>
        </View>
      </View>
      <Text style={styles.followCardTitle}>{title}</Text>
      <Text style={styles.followCardSubtitle} numberOfLines={1}>{subtitle}</Text>
    </Pressable>
  );
}

function HomeInquiryTickerRow({
  item,
  showDivider,
}: {
  item: OfferFeedItem;
  showDivider: boolean;
}) {
  return (
    <View style={[styles.inquiryTickerRow, showDivider && styles.inquiryTickerDivider]}>
      <View style={styles.homeInquiryBadge}>
        <Text style={styles.homeInquiryBadgeText}>求</Text>
      </View>
      <Text style={styles.inquiryTickerTitle} numberOfLines={1}>
        {buildHomeInquiryTitle(item)}
      </Text>
      <SmallChevronIcon color="#9DA4A3" />
    </View>
  );
}

function buildHomeInquiryTitle(item: OfferFeedItem) {
  const productName = cleanText(item.productName) || '求购';
  const country = cleanText(item.country);
  const factoryNo = cleanText(item.factoryNo);
  let scope = '国家厂号不限';

  if (country && factoryNo) {
    scope = `${country}${factoryNo}`;
  } else if (country) {
    scope = `${country}厂号不限`;
  } else if (factoryNo) {
    scope = factoryNo;
  }

  return `${productName} ${scope}`;
}

function cleanText(value?: string | null) {
  return value?.trim() ?? '';
}

function formatHomeCount(value?: string | number | null) {
  if (value == null || value === '') return '--';
  return String(value);
}

function CardWithEdit({
  card,
  editMode,
  onPress,
  onArchiveDelete,
}: {
  card: HomeCardItem;
  editMode: boolean;
  onPress: () => void;
  onArchiveDelete: () => void;
}) {
  return (
    <View style={styles.cardWrap}>
      <HomeCardSwitcher
        card={card}
        onPress={editMode ? undefined : onPress}
      />
      {card.isExample && !editMode ? (
        <View style={styles.exampleBadge}>
          <Text style={styles.exampleBadgeText}>例</Text>
        </View>
      ) : null}
      {editMode && card.historyId ? (
        <Pressable hitSlop={4} onPress={onArchiveDelete} style={styles.editIconSingle}>
          <SvgXml xml={archiveDelIconXml} width={16} height={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

function splitColumns(cards: HomeCardItem[]) {
  const leftColumn: HomeCardItem[] = [];
  const rightColumn: HomeCardItem[] = [];
  cards.forEach((card, index) => {
    if (index % 2 === 0) leftColumn.push(card);
    else rightColumn.push(card);
  });
  return {leftColumn, rightColumn};
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

/* ===== Inline icons ===== */

function ClipboardListIcon({size = 24}: {size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.75 5.25H7.6C6.72 5.25 6 5.97 6 6.85V18.4C6 19.28 6.72 20 7.6 20H16.4C17.28 20 18 19.28 18 18.4V6.85C18 5.97 17.28 5.25 16.4 5.25H15.25"
        stroke="#006A61"
        strokeWidth={1.55}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 5.6C9 4.72 9.72 4 10.6 4H13.4C14.28 4 15 4.72 15 5.6V6.6H9V5.6Z"
        stroke="#006A61"
        strokeWidth={1.55}
        strokeLinejoin="round"
      />
      <Path d="M9 11H15M9 14H14M9 17H12.8" stroke="#006A61" strokeWidth={1.55} strokeLinecap="round" />
    </Svg>
  );
}

function OfferSearchIcon({size = 24}: {size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4.5H14.4L18 8.1V19.5H7V4.5Z"
        stroke="#006A61"
        strokeWidth={1.55}
        strokeLinejoin="round"
      />
      <Path d="M14.2 4.8V8.3H17.7" stroke="#006A61" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 15.5L11.5 13.3L13.2 14.8L15.8 11.6" stroke="#006A61" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 11.6H15.8V12.4" stroke="#006A61" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MerchantSearchIcon({size = 24}: {size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 10.2H18.5L17.7 19.5H6.3L5.5 10.2Z"
        stroke="#006A61"
        strokeWidth={1.55}
        strokeLinejoin="round"
      />
      <Path d="M7.1 10.2L8 5H16L16.9 10.2" stroke="#006A61" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 19.4V15.2H12.8V19.4" stroke="#006A61" strokeWidth={1.55} strokeLinejoin="round" />
      <Path d="M14.8 15.1C15.96 15.1 16.9 14.16 16.9 13C16.9 11.84 15.96 10.9 14.8 10.9C13.64 10.9 12.7 11.84 12.7 13C12.7 14.16 13.64 15.1 14.8 15.1Z" fill="#006A61" fillOpacity={0.16} />
      <Path d="M16.35 14.55L18.1 16.3" stroke="#006A61" strokeWidth={1.55} strokeLinecap="round" />
    </Svg>
  );
}

function IntentBookmarkIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M6.15 2.5H13.85C15.05 2.5 16 3.48 16 4.68V16.18C16 16.92 15.2 17.4 14.55 17.05L10.45 14.83C10.17 14.68 9.83 14.68 9.55 14.83L5.45 17.05C4.8 17.4 4 16.92 4 16.18V4.68C4 3.48 4.95 2.5 6.15 2.5Z"
        fill="#006A61"
        fillOpacity={0.12}
        stroke="#006A61"
        strokeWidth={1.45}
        strokeLinejoin="round"
      />
      <Path d="M10 6.1V10.9M7.6 8.5H12.4" stroke="#006A61" strokeWidth={1.45} strokeLinecap="round" />
    </Svg>
  );
}

function RecentChatIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3.2 9.15C3.2 5.85 6.08 3.25 10 3.25C13.92 3.25 16.8 5.85 16.8 9.15C16.8 12.45 13.92 15.05 10 15.05C9.28 15.05 8.58 14.96 7.94 14.79L4.58 16.4C4.14 16.61 3.7 16.17 3.9 15.73L5.04 13.18C3.9 12.13 3.2 10.73 3.2 9.15Z"
        fill="#006A61"
        fillOpacity={0.12}
        stroke="#006A61"
        strokeWidth={1.45}
        strokeLinejoin="round"
      />
      <Path d="M7.25 9.1H7.3M9.95 9.1H10M12.65 9.1H12.7" stroke="#006A61" strokeWidth={2.1} strokeLinecap="round" />
    </Svg>
  );
}

function SmallChevronIcon({color = colors.primary}: {color?: string}) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M5.25 3.5L8.75 7L5.25 10.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function InventoryIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.17 7.44L12 12.55l8.77-5.08M12 21.61V12.54"
        stroke="#006A61"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.93 2.48L4.59 5.44c-1.21.67-2.2 2.35-2.2 3.73v5.65c0 1.38.99 3.06 2.2 3.73l5.34 2.97c1.14.63 3.01.63 4.15 0l5.34-2.97c1.21-.67 2.2-2.35 2.2-3.73V9.17c0-1.38-.99-3.06-2.2-3.73l-5.34-2.97c-1.15-.63-3.01-.63-4.15.01Z"
        stroke="#006A61"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function UserSquareIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 22h6c5 0 7-2 7-7V9c0-5-2-7-7-7H9C4 2 2 4 2 9v6c0 5 2 7 7 7Z"
        stroke="#171D1C"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 12c1.93 0 3.5-1.57 3.5-3.5S13.93 5 12 5 8.5 6.57 8.5 8.5 10.07 12 12 12Z"
        stroke="#171D1C"
        strokeWidth={1.5}
      />
      <Path
        d="M18.71 19.51c-.96-2.09-3.18-3.51-5.71-3.51-2.53 0-4.75 1.42-5.71 3.51"
        stroke="#171D1C"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function SearchIcon24() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={11.5} cy={11.5} r={7} stroke="#006A61" strokeWidth={1.6} />
      <Path d="M22 22L18 18" stroke="#006A61" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronDownSmall() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M4 6L8 10L12 6" stroke="#171D1C" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CandleIcon({active}: {active: boolean}) {
  const color = active ? colors.primary : '#9DA4A3';
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M4.33325 14.6667V10" stroke={color} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M4.33325 3.33337V1.33337" stroke={color} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M11.6667 14.6666V12.6666" stroke={color} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M11.6667 6.00004V1.33337" stroke={color} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M6.33325 4.66671V8.66671C6.33325 9.40004 5.99992 10 4.99992 10H3.66659C2.66659 10 2.33325 9.40004 2.33325 8.66671V4.66671C2.33325 3.93337 2.66659 3.33337 3.66659 3.33337H4.99992C5.99992 3.33337 6.33325 3.93337 6.33325 4.66671Z" stroke={color} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round"/>
      <Path d="M13.6667 7.33333V11.3333C13.6667 12.0667 13.3334 12.6667 12.3334 12.6667H11.0001C10.0001 12.6667 9.66675 12.0667 9.66675 11.3333V7.33333C9.66675 6.6 10.0001 6 11.0001 6H12.3334C13.3334 6 13.6667 6.6 13.6667 7.33333Z" stroke={color} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F4FBF8'},
  safeTop: {backgroundColor: '#FFFFFF'},
  // 永远吸顶的 Logo+用户 栏
  fixedTop: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcons: {flexDirection: 'row', alignItems: 'center', gap: 16},
  headerIconButton: {width: 24, height: 24, alignItems: 'center', justifyContent: 'center'},

  // ScrollView 顶部（搜索框 + 热门搜索）：跟随滚动
  scrollableTop: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    overflow: 'visible',
  },
  searchWrap: {position: 'relative', overflow: 'visible'},
  searchBox: {
    height: 50,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#EFF5F3',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: 'rgba(0,106,97,0.15)',
    shadowOpacity: 1,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 3},
    elevation: 2,
  },
  searchCategory: {
    width: 60,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  searchCategoryText: {color: colors.text, fontSize: 14, fontWeight: '600'},
  searchVDivider: {width: 0.8, height: 24, backgroundColor: colors.border},
  searchPlaceholder: {flex: 1, justifyContent: 'center', paddingHorizontal: 12},
  searchPlaceholderText: {color: 'rgba(108,122,119,0.5)', fontSize: 14},
  searchIcon: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  categoryMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    elevation: 999,
  },
  categoryMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  categoryMenu: {
    position: 'absolute',
    top: 110,
    left: 16,
    width: 78,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
  },
  categoryMenuItem: {paddingHorizontal: 12, paddingVertical: 10},
  categoryMenuText: {color: colors.text, fontSize: 14},
  categoryMenuTextActive: {color: colors.primary, fontWeight: '700'},
  hotRow: {flexDirection: 'row', alignItems: 'center', paddingTop: 12, gap: 8},
  hotLabel: {color: colors.text, fontSize: 11, fontWeight: '400'},
  hotList: {gap: 8, paddingRight: 8, alignItems: 'center'},
  hotChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  hotChipText: {color: colors.text, fontSize: 12, fontWeight: '500', lineHeight: 16},
  hotEmpty: {color: '#9DA4A3', fontSize: 11, paddingHorizontal: 8},

  tradeGuideWrap: {
    backgroundColor: '#F4FBF8',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  tradeGuideGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  tradeInquiryCard: {
      flex: 1.38,
      minWidth: 0,
      minHeight: 154,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CFE2DF',
    backgroundColor: '#F8FFFD',
    shadowColor: 'rgba(0, 40, 36, 0.08)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
    elevation: 1,
  },
    tradeSideColumn: {
      flex: 0.76,
      minWidth: 0,
      gap: 6,
    },
  tradeSideCard: {
      flex: 1,
      minHeight: 73,
      paddingHorizontal: 9,
      paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D7E1DF',
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(0, 40, 36, 0.06)',
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 1,
  },
  tradeCardPressed: {
    opacity: 0.72,
  },
  tradeIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2F4F0',
  },
  tradeIconBubbleSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7F4',
  },
  tradeHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tradeTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  tradeMainTitle: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '700',
  },
  tradeSubtitle: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  inquiryTickerClip: {
      height: HOME_INQUIRY_ROW_HEIGHT * HOME_INQUIRY_VISIBLE_COUNT,
      marginTop: 6,
      borderRadius: 7,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
  },
  inquiryTickerTrack: {
    minHeight: HOME_INQUIRY_ROW_HEIGHT * (HOME_INQUIRY_VISIBLE_COUNT + 1),
  },
  inquiryTickerRow: {
    height: HOME_INQUIRY_ROW_HEIGHT,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  inquiryTickerDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E9E7',
  },
  homeInquiryBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C8D8FF',
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  homeInquiryBadgeText: {
    color: '#3767D6',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  inquiryTickerTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  inquiryTickerEmpty: {
    height: HOME_INQUIRY_ROW_HEIGHT * HOME_INQUIRY_VISIBLE_COUNT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inquiryTickerEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  tradeSideHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tradeSideTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  tradeSideTitle: {
    flex: 1,
    flexShrink: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
    tradeSideSubtitle: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 15,
    },
  tradeSideStat: {
      marginTop: 3,
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 15,
  },
  tradeSideStatValue: {
    fontFamily: fonts.manropeBold,
    color: colors.primary,
    fontSize: 14,
    lineHeight: 18,
  },
  followWrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDEAE7',
    backgroundColor: '#F8FFFD',
  },
  followHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  followTitle: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  followGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  followCard: {
    flex: 1,
    minHeight: 72,
    padding: 10,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2ECE9',
    backgroundColor: '#FFFFFF',
  },
  followCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5F3',
  },
  followCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: '#E8F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followCountText: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  followCardTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  followCardSubtitle: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },

  // sticky stat + tabs
  stickyBlock: {
    backgroundColor: '#F4FBF8',
    zIndex: 50,
    elevation: 0,
  },
  stickyOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#F4FBF8',
    zIndex: 90,
    elevation: 0,
  },
  statBar: {
    height: 38,
    backgroundColor: '#3B5C59',
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statBarLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0},
  statBarRight: {flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0},
  statBadge: {
    paddingHorizontal: 4,
    borderRadius: 2,
    backgroundColor: '#3F706B',
    height: 20,
    justifyContent: 'center',
  },
  statBadgeText: {color: '#FFFFFF', fontSize: 11, fontWeight: '500', lineHeight: 20},
  statItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  statLabel: {color: '#FFFFFF', fontSize: 11, lineHeight: 18},
  statValue: {fontFamily: fonts.manropeBold, color: '#FFFFFF', fontSize: 12, lineHeight: 16},
  statTime: {color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 18},
  statViewButton: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  statViewText: {color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '600'},

  tabsBar: {
    height: 40,
    paddingHorizontal: 16,
    paddingTop: 2,
    backgroundColor: '#F4FBF8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabsSpace: {flex: 1},
  editButton: {paddingVertical: 6, paddingLeft: 12, paddingRight: 0},
  editText: {color: '#9DA4A3', fontSize: 14, lineHeight: 18},
  editDoneBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 2,
  },
  editDoneText: {color: '#FFFFFF', fontSize: 14, lineHeight: 18},
  editHint: {paddingHorizontal: 16, paddingTop: 4, backgroundColor: '#F4FBF8'},
  editHintText: {color: colors.text, fontSize: 12, lineHeight: 18},

  content: {paddingBottom: 32},
  cardsLoading: {marginTop: 32},
  emptySelfWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingBottom: 140,
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
  gridRow: {flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 12},
  gridCol: {flex: 1, gap: 12},
  cardWrap: {position: 'relative'},
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
  editIconColumn: {
    position: 'absolute',
    top: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  editIconAdd: {
    width: 28,
    height: 28,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconDel: {
    width: 28,
    height: 28,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(0,106,97,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
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
  scrollTopButton: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A9488',
    shadowColor: 'rgba(1,106,97,0.4)',
    shadowOpacity: 1,
    shadowRadius: 5,
    shadowOffset: {width: 0, height: 1},
    elevation: 6,
    zIndex: 50,
  },
});

const tabStyles = StyleSheet.create({
  wrap: {alignItems: 'center', gap: 2, paddingVertical: 6, marginRight: 24},
  row: {flexDirection: 'row', alignItems: 'center', gap: 4},
  text: {color: '#3C4947', fontSize: 14, lineHeight: 18},
  textActive: {color: colors.primary, fontWeight: '500'},
  indicator: {height: 3, width: 16, borderRadius: 12, backgroundColor: 'transparent'},
  indicatorActive: {backgroundColor: colors.primary},
});
