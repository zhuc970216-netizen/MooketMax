import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Path} from 'react-native-svg';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {buildTrendChartPoints, MiniTrendChart} from '../home/MiniTrendChart';
import type {DailyPrice} from '../../types/api';
import {FeedStatLink} from './FeedStatLink';

type Props = {
  country: string;
  productName: string;
  isInquiry?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
  priceChange?: number | null;
  priceChangeRate?: number | null;
  offerCount?: number | null;
  inquiryCount?: number | null;
  merchantCount?: number | null;
  history7Days?: DailyPrice[] | null;
  history30Days?: DailyPrice[] | null;
  hideProductTitle?: boolean;
  onOfferPress?: () => void;
  onInquiryPress?: () => void;
};

export function CountryProductDashboard({
  country,
  productName,
  isInquiry = false,
  priceMin,
  priceMax,
  priceChange,
  priceChangeRate,
  offerCount,
  inquiryCount,
  merchantCount,
  history7Days,
  history30Days,
  hideProductTitle = false,
  onOfferPress,
  onInquiryPress,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const priceText = formatPrice(priceMin, priceMax);
  const isMissingPrice = !priceText.unit;
  const trend7 = (history7Days ?? [])
    .map(d => Number(d.avgPrice))
    .filter(v => Number.isFinite(v) && v > 0) as number[];
  const hasTrend7 = trend7.length > 1;
  const effectiveChange = priceChange;
  const effectiveRate = priceChangeRate;
  const showChange = true;
  const hasDuplicate =
    productName && country && (country.includes(productName) || country.endsWith(productName));

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.titlePart} numberOfLines={1}>
          {country}
        </Text>
        {!hideProductTitle && productName && !hasDuplicate ? (
          <>
            <View style={styles.dot} />
            <Text style={styles.titlePart} numberOfLines={1}>
              {productName}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.midRow}>
        <View style={styles.left}>
          <Text style={styles.smallLabel}>
            近2日{isInquiry ? '求购' : '报盘'}价格区间（RMB）
          </Text>
          <View style={styles.priceLine}>
            <Text
              style={[styles.priceValue, isMissingPrice && styles.priceMuted]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {priceText.value}
            </Text>
            {priceText.unit ? <Text style={styles.priceUnit}>{priceText.unit}</Text> : null}
            {showChange ? <PriceChange value={effectiveChange} rate={effectiveRate} /> : null}
          </View>
        </View>

        {hasTrend7 ? (
          <View style={styles.right}>
            <Text style={styles.trendLabel}>7日报价走势</Text>
            <View style={styles.trendChart}>
              <MiniTrendChart data={trend7} width={82} height={28} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.statsFooter}>
        <View style={styles.statsRow}>
          <FeedStatLink label="报盘数" value={offerCount ?? '--'} onPress={onOfferPress} />
          <FeedStatLink label="求购数" value={inquiryCount ?? '--'} onPress={onInquiryPress} />
          <Stat label="商家数" value={merchantCount ?? '--'} />
        </View>
        <Pressable onPress={() => setExpanded(prev => !prev)} style={styles.expandButton}>
          <Text style={styles.expandText}>{expanded ? '收起数据' : '展开数据'}</Text>
          <Svg width={12} height={12} viewBox="0 0 12 12">
            <Path
              d={expanded ? 'M3 7.5L6 4.5L9 7.5' : 'M3 4.5L6 7.5L9 4.5'}
              stroke="#171D1C"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </Pressable>
      </View>

      {expanded ? <ExpandedChart history={history30Days ?? []} /> : null}
    </View>
  );
}

function ExpandedChart({history}: {history: DailyPrice[]}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const chartWidth = 343;
  const chartHeight = 88;

  const filtered = useMemo(() => {
    return history
      .map(d => ({date: d.date, price: Number(d.avgPrice)}))
      .filter(d => Number.isFinite(d.price) && d.price > 0);
  }, [history]);

  const data = useMemo(() => filtered.map(d => d.price), [filtered]);
  const dates = useMemo(() => filtered.map(d => d.date), [filtered]);
  const chartPoints = useMemo(
    () => buildTrendChartPoints(data, chartWidth, chartHeight),
    [data, chartHeight, chartWidth],
  );

  if (data.length < 2) {
    return <Text style={styles.empty}>暂无30日趋势数据</Text>;
  }

  const length = data.length;
  const indices =
    length > 4
      ? [0, Math.floor(length / 4), Math.floor(length / 2), Math.floor((length * 3) / 4), length - 1]
      : data.map((_, i) => i);
  const labels = indices.map(i => formatShort(dates[i]));
  const selectedPoint = selectedIdx != null ? chartPoints[selectedIdx] : null;

  function handlePress(event: {nativeEvent: {locationX: number}}) {
    const x = event.nativeEvent.locationX;
    const padX = 4;
    const dataX = x - padX;
    const dataWidth = chartWidth - padX * 2;
    const idx = Math.round((dataX / dataWidth) * (length - 1));
    const clamped = Math.max(0, Math.min(length - 1, idx));
    setSelectedIdx(prev => (prev === clamped ? null : clamped));
  }

  const tooltipDate = selectedIdx != null ? formatShort(dates[selectedIdx]) : null;
  const tooltipPrice = selectedIdx != null && data[selectedIdx] != null ? data[selectedIdx] : null;

  return (
    <View style={styles.expandedWrap}>
      <Pressable onPress={handlePress} style={styles.bigChart}>
        <MiniTrendChart data={data} width={chartWidth} height={chartHeight} />
        {selectedPoint ? (
          <Svg
            pointerEvents="none"
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            style={styles.chartOverlay}>
            <Line
              x1={selectedPoint.x}
              y1={0}
              x2={selectedPoint.x}
              y2={chartHeight}
              stroke="#9DA4A3"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Circle
              cx={selectedPoint.x}
              cy={selectedPoint.y}
              r={4}
              fill={colors.primary}
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          </Svg>
        ) : null}
      </Pressable>
      {tooltipDate ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipDate}>{tooltipDate}</Text>
          <Text style={styles.tooltipPrice}>
            日均价 ¥{tooltipPrice != null ? tooltipPrice.toFixed(1) : '--'}/kg
          </Text>
        </View>
      ) : null}
      <View style={styles.dateRow}>
        {labels.map((label, i) => (
          <Text key={`${label}-${i}`} style={styles.dateText}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Stat({label, value}: {label: string; value: number | string}) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.smallLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PriceChange({value, rate}: {value?: number | null; rate?: number | null}) {
  const isNeutral = value == null || rate == null || (value === 0 && rate === 0);
  const up = !isNeutral && value > 0;
  const fg = isNeutral ? '#9DA4A3' : up ? '#A53321' : '#0E8D41';

  return (
    <View style={styles.changeRow}>
      <Svg width={10} height={6} viewBox="0 0 10 6">
        {isNeutral ? (
          <Path d="M1 3H9" stroke={fg} strokeWidth={1.4} strokeLinecap="round" />
        ) : (
          <Path
            d={
              up
                ? 'M0.7 6L0 5.3L3.7 1.575L5.7 3.575L8.3 1H7V0H10V3H9V1.7L5.7 5L3.7 3L0.7 6Z'
                : 'M0.7 0L0 0.7L3.7 4.425L5.7 2.425L8.3 5H7V6H10V3H9V4.3L5.7 1L3.7 3L0.7 0Z'
            }
            fill={fg}
          />
        )}
      </Svg>
      <Text style={[styles.changeText, {color: fg}]} numberOfLines={1}>
        {isNeutral
          ? '0.0 0.0%'
          : `${value > 0 ? '+' : ''}${value.toFixed(2)} ${Math.abs(rate).toFixed(2)}%`}
      </Text>
    </View>
  );
}

function formatPrice(min?: number | null, max?: number | null) {
  if (min != null && max != null && min > 0 && max >= min) {
    if (min === max) {
      return {value: `¥${num(min)}`, unit: '/kg'};
    }
    return {value: `¥${num(min)}-${num(max)}`, unit: '/kg'};
  }
  if (min != null && min > 0) {
    return {value: `¥${num(min)}`, unit: '/kg'};
  }
  return {value: '暂无报价', unit: ''};
}

function num(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatShort(date?: string | null) {
  if (!date) {
    return '--';
  }
  const m = date.match(/(\d{2,4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) {
    return `${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
  }
  return date;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  titlePart: {color: colors.text, fontSize: 20, fontWeight: '500', lineHeight: 30, flexShrink: 1},
  dot: {width: 4, height: 4, borderRadius: 2, backgroundColor: '#171D1C'},
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  left: {
    flex: 1,
    gap: 0,
  },
  smallLabel: {color: 'rgba(60,73,71,0.5)', fontSize: 10, lineHeight: 14},
  priceLine: {flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'nowrap'},
  priceValue: {
    fontFamily: fonts.manropeBold,
    color: colors.price,
    fontSize: 24,
    lineHeight: 32,
    flexShrink: 1,
  },
  priceMuted: {
    color: colors.primary,
    fontSize: 16,
  },
  priceUnit: {
    fontFamily: fonts.manropeRegular,
    color: colors.text,
    fontSize: 12,
    lineHeight: 32,
  },
  changeRow: {flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0},
  changeText: {
    fontFamily: fonts.manropeSemiBold,
    fontSize: 10,
    letterSpacing: -0.25,
    lineHeight: 15,
  },
  right: {
    width: 82,
    gap: 4,
    paddingTop: 0,
  },
  trendLabel: {color: '#9DA4A3', fontSize: 10, lineHeight: 14, textAlign: 'right'},
  trendChart: {height: 28, width: 82, overflow: 'hidden'},
  statsFooter: {
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsRow: {flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1},
  statItem: {flexDirection: 'row', alignItems: 'center', gap: 8},
  statValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(23,29,28,0.1)',
    backgroundColor: 'rgba(23,29,28,0.05)',
  },
  expandText: {color: colors.text, fontSize: 10, lineHeight: 14},
  expandedWrap: {paddingBottom: 12, gap: 6},
  bigChart: {height: 100, position: 'relative'},
  chartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  tooltip: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tooltipDate: {color: '#FFFFFF', fontSize: 11, fontWeight: '600'},
  tooltipPrice: {color: '#FFFFFF', fontSize: 11},
  dateRow: {flexDirection: 'row', justifyContent: 'space-between'},
  dateText: {color: '#9DA4A3', fontSize: 10, lineHeight: 14},
  empty: {color: '#9DA4A3', fontSize: 12, paddingVertical: 16, textAlign: 'center'},
});
