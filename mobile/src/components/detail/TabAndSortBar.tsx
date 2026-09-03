import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {colors} from '../../theme/colors';

export type OfferTab = 'offer' | 'inquiry';
export type SearchResultTab = OfferTab | 'merchant';
export type SortOrder = 'none' | 'asc' | 'desc';
export type SortMode =
  | {kind: 'comprehensive'}
  | {kind: 'publishTime'}
  | {kind: 'price'; order: SortOrder};

type Props = {
  tab: OfferTab;
  onTabChange: (next: OfferTab) => void;
  sort: SortMode;
  onSortChange: (next: SortMode) => void;
  showTabs?: boolean;
  showRecommend?: boolean;
  showPublishTime?: boolean;
  offerLabel?: string;
  inquiryLabel?: string;
};

type OfferInquiryTabsProps = {
  tab: SearchResultTab;
  onTabChange: (next: OfferTab) => void;
  style?: ViewStyle;
  offerLabel?: string;
  inquiryLabel?: string;
  showMerchant?: boolean;
  onMerchantPress?: () => void;
};

export function OfferInquiryTabs({
  tab,
  onTabChange,
  style,
  offerLabel = '报盘',
  inquiryLabel = '求购',
  showMerchant = false,
  onMerchantPress,
}: OfferInquiryTabsProps) {
  const [visualTab, setVisualTab] = React.useState<SearchResultTab>(tab);
  const pendingFrame = React.useRef<number | null>(null);

  React.useEffect(() => {
    setVisualTab(tab);
  }, [tab]);

  React.useEffect(
    () => () => {
      if (pendingFrame.current != null) {
        cancelAnimationFrame(pendingFrame.current);
      }
    },
    [],
  );

  const handleTabPress = React.useCallback(
    (next: OfferTab) => {
      if (next === visualTab) return;
      setVisualTab(next);
      if (pendingFrame.current != null) {
        cancelAnimationFrame(pendingFrame.current);
      }
      pendingFrame.current = requestAnimationFrame(() => {
        pendingFrame.current = null;
        onTabChange(next);
      });
    },
    [onTabChange, visualTab],
  );

  return (
    <View style={[styles.topTabs, style]}>
      <TopTabItem text={offerLabel} active={visualTab === 'offer'} onPress={() => handleTabPress('offer')} />
      <TopTabItem
        text={inquiryLabel}
        active={visualTab === 'inquiry'}
        onPress={() => handleTabPress('inquiry')}
      />
      {showMerchant ? (
        <TopTabItem
          text="商家"
          active={visualTab === 'merchant'}
          onPress={() => {
            if (pendingFrame.current != null) {
              cancelAnimationFrame(pendingFrame.current);
              pendingFrame.current = null;
            }
            onMerchantPress?.();
          }}
        />
      ) : null}
    </View>
  );
}

export function TabAndSortBar({
  tab,
  onTabChange,
  sort,
  onSortChange,
  showTabs = true,
  showRecommend = true,
  showPublishTime = false,
  offerLabel = '报盘',
  inquiryLabel = '求购',
}: Props) {
  const priceOrder = sort.kind === 'price' ? sort.order : 'none';

  return (
    <View style={styles.bar}>
      {showTabs ? (
        <View style={styles.left}>
          <TabItem text={offerLabel} active={tab === 'offer'} onPress={() => onTabChange('offer')} />
          <TabItem
            text={inquiryLabel}
            active={tab === 'inquiry'}
            onPress={() => onTabChange('inquiry')}
          />
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.sortScroll, !showTabs && styles.sortScrollOnly]}
        contentContainerStyle={styles.sortContent}>
        {showRecommend ? (
          <SortItem
            text="综合推荐"
            active={sort.kind === 'comprehensive'}
            onPress={() => onSortChange({kind: 'comprehensive'})}
          />
        ) : null}
        {showPublishTime ? (
          <SortItem
            text="发布时间"
            active={sort.kind === 'publishTime'}
            onPress={() => onSortChange({kind: 'publishTime'})}
          />
        ) : null}
        <SortItem
          text="价格从低到高↑"
          active={sort.kind === 'price' && priceOrder === 'asc'}
          onPress={() => onSortChange({kind: 'price', order: 'asc'})}
        />
        <SortItem
          text="价格从高到低↓"
          active={sort.kind === 'price' && priceOrder === 'desc'}
          onPress={() => onSortChange({kind: 'price', order: 'desc'})}
        />
      </ScrollView>
    </View>
  );
}

function TabItem({text, active, onPress}: {text: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Text style={[styles.text, active && styles.textActive]}>{text}</Text>
      <View style={[styles.indicator, active && styles.indicatorActive]} />
    </Pressable>
  );
}

function TopTabItem({text, active, onPress}: {text: string; active: boolean; onPress: () => void}) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Text style={[styles.topTabText, active && styles.topTabTextActive]}>{text}</Text>
      <View style={[styles.indicator, active && styles.indicatorActive]} />
    </Pressable>
  );
}

function SortItem({
  text,
  active,
  onPress,
}: {
  text: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <View style={styles.labelRow}>
        <Text style={[styles.text, active && styles.textActive]}>{text}</Text>
      </View>
      <View style={[styles.indicator, active && styles.indicatorActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topTabs: {
    minHeight: 40,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 32,
    paddingTop: 6,
    paddingBottom: 4,
  },
  bar: {
    minHeight: 44,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 20,
    flexShrink: 0,
  },
  sortScroll: {
    flex: 1,
    marginLeft: 10,
    flexShrink: 1,
  },
  sortScrollOnly: {
    marginLeft: 0,
  },
  sortContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 32,
    paddingHorizontal: 0,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  topTabText: {
    color: '#171D1C',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  topTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  text: {
    color: '#3C4947',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
  },
  textActive: {
    color: colors.text,
    fontWeight: '600',
  },
  indicator: {
    width: 18,
    height: 3,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.primary,
  },
});
