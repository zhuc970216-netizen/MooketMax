import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {getCountryFlag} from '../../utils/country';
import type {HotFactory, HotProduct} from '../../types/api';
import {formatCount} from '../../utils/format';
import {FeedStatLink} from './FeedStatLink';

type Props = {
  country: string;
  isInquiry?: boolean;
  factoryCount?: number | null;
  merchantCount?: number | null;
  offerCount?: number | null;
  hotFactories?: HotFactory[];
  hotProducts?: HotProduct[];
  onFactoryClick?: (factoryNo: string) => void;
  onProductClick?: (productName: string) => void;
  onFeedPress?: () => void;
};

/**
 * 国家详情看板（与 Figma 1796:2757 对齐）
 * 左：国旗 + 国家名 + 工厂数/商家数横排
 * 右：76w 边线 + "近2日报盘" + 36px 主色 Manrope Bold
 * 下方：折叠的"热门厂号/产品 展开"
 */
export function CountryDashboard({
  country,
  isInquiry = false,
  factoryCount,
  merchantCount,
  offerCount,
  hotFactories = [],
  hotProducts = [],
  onFactoryClick,
  onProductClick,
  onFeedPress,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const flag = getCountryFlag(country);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.titleRow}>
            {flag ? <Text style={styles.flag}>{flag}</Text> : null}
            <Text style={styles.title}>{country}</Text>
          </View>
          <View style={styles.statsRow}>
            <Stat label="工厂数" value={factoryCount} />
            <Stat label="商家数" value={merchantCount} />
          </View>
        </View>

        <FeedStatLink
          label={isInquiry ? '近2日求购' : '近2日报盘'}
          value={formatCount(offerCount ?? 0)}
          layout="large"
          align="end"
          onPress={onFeedPress}
          style={styles.right}
        />
      </View>

      <View style={styles.hr} />

      <Pressable style={styles.toggleRow} onPress={() => setExpanded(prev => !prev)}>
        <Text style={styles.toggleLabel}>热门厂号/产品</Text>
        <View style={styles.toggleRight}>
          <Text style={styles.toggleAction}>{expanded ? '收起' : '展开'}</Text>
          <ToggleArrow expanded={expanded} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.hotRow}>
          <View style={styles.hotCol}>
            {hotFactories.map(item => (
              <HotItem
                key={`f-${item.factoryNo}-${item.rank ?? 0}`}
                rank={item.rank ?? 0}
                title={item.factoryNo}
                count={item.offerCount}
                onPress={() => onFactoryClick?.(item.factoryNo)}
              />
            ))}
            {hotFactories.length === 0 ? <Text style={styles.empty}>暂无</Text> : null}
          </View>
          <View style={styles.hotDivider} />
          <View style={styles.hotCol}>
            {hotProducts.map(item => (
              <HotItem
                key={`p-${item.productName}-${item.rank ?? 0}`}
                rank={item.rank ?? 0}
                title={item.productName}
                count={item.offerCount}
                onPress={() => onProductClick?.(item.productName)}
              />
            ))}
            {hotProducts.length === 0 ? <Text style={styles.empty}>暂无</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Stat({label, value}: {label: string; value: number | null | undefined}) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={styles.statValue}>{value ?? '--'}</Text>
    </View>
  );
}

function HotItem({
  rank,
  title,
  count,
  onPress,
}: {
  rank: number;
  title: string;
  count: number;
  onPress: () => void;
}) {
  const palette = rankPalette(rank);
  return (
    <Pressable onPress={onPress} style={[styles.hotItem, {backgroundColor: palette.bg}]}>
      <View style={[styles.rankBadge, {backgroundColor: palette.fg}]}>
        <Text style={styles.rankText}>{rank}</Text>
      </View>
      <Text style={styles.hotTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.hotCount}>{formatCount(count)}</Text>
    </Pressable>
  );
}

function rankPalette(rank: number): {bg: string; fg: string} {
  switch (rank) {
    case 1:
      return {bg: '#FFF9F0', fg: '#906134'};
    case 2:
      return {bg: '#F5F8FF', fg: '#4B5462'};
    case 3:
      return {bg: '#FFF9F8', fg: '#80521E'};
    default:
      return {bg: '#F3F6F5', fg: '#9DA4A3'};
  }
}

function ToggleArrow({expanded}: {expanded: boolean}) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path
        d={expanded ? 'M4 6L8 10L12 6' : 'M6 4L10 8L6 12'}
        stroke="#171D1C"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flag: {fontSize: 22, lineHeight: 24},
  title: {color: colors.text, fontSize: 20, fontWeight: '500', lineHeight: 30},
  statsRow: {flexDirection: 'row', gap: 24},
  statItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  smallLabel: {color: 'rgba(60,73,71,0.5)', fontSize: 10, lineHeight: 14},
  statValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  right: {
    minWidth: 76,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#EFF5F3',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  bigValue: {
    fontFamily: fonts.manropeBold,
    color: colors.primary,
    fontSize: 36,
    lineHeight: 42,
    textAlign: 'right',
  },
  hr: {
    marginTop: 12,
    height: 1,
    backgroundColor: '#EFF5F3',
  },
  toggleRow: {
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {color: colors.text, fontSize: 12, lineHeight: 15},
  toggleRight: {flexDirection: 'row', alignItems: 'center', gap: 2},
  toggleAction: {color: colors.text, fontSize: 12, lineHeight: 15},
  hotRow: {
    paddingTop: 12,
    flexDirection: 'row',
  },
  hotCol: {flex: 1, gap: 8},
  hotDivider: {width: 1, backgroundColor: colors.border, marginHorizontal: 12},
  hotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 2,
  },
  rankBadge: {
    width: 15,
    height: 15,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: fonts.manropeBold,
    color: '#FFFFFF',
    fontSize: 10,
  },
  hotTitle: {flex: 1, color: colors.text, fontSize: 11, lineHeight: 18},
  hotCount: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 13,
  },
  empty: {color: '#9DA4A3', fontSize: 11, paddingVertical: 4},
});
