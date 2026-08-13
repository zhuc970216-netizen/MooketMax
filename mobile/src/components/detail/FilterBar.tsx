import React, {useCallback, useRef} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../theme/colors';

export type FilterKey =
  | 'sort'
  | 'category'
  | 'followedMerchant'
  | 'famousMerchant'
  | 'merchant'
  | 'countryFactory'
  | 'region'
  | 'product'
  | 'priceRange'
  | 'goodsType'
  | 'feedingMethod'
  | 'tag';

export type FilterDef = {
  key: FilterKey;
  label: string;
  hasSelection: boolean;
  toggle?: boolean;
  onClear?: () => void;
};

type Props = {
  filters: FilterDef[];
  active: FilterKey | null;
  onPress: (key: FilterKey) => void;
  onBottomLayout?: (bottom: number) => void;
};

export function FilterBar({filters, active, onPress, onBottomLayout}: Props) {
  const wrapRef = useRef<View>(null);
  const heightRef = useRef(0);

  const measureBottom = useCallback((afterMeasure?: () => void) => {
    if (!onBottomLayout) {
      afterMeasure?.();
      return;
    }
    requestAnimationFrame(() => {
      if (!wrapRef.current) {
        afterMeasure?.();
        return;
      }
      wrapRef.current.measureInWindow((_x, y, _width, height) => {
        if (Number.isFinite(y) && Number.isFinite(height)) {
          const measuredHeight = height > 0 ? height : heightRef.current;
          onBottomLayout(y + measuredHeight);
        }
        afterMeasure?.();
      });
    });
  }, [onBottomLayout]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      heightRef.current = event.nativeEvent.layout.height;
      measureBottom();
    },
    [measureBottom],
  );

  const handlePress = useCallback(
    (key: FilterKey) => {
      measureBottom(() => onPress(key));
    },
    [measureBottom, onPress],
  );

  return (
    <View ref={wrapRef} collapsable={false} onLayout={handleLayout} style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {filters.map(item => (
          <FilterChip
            key={item.key}
            label={item.label}
            selected={item.hasSelection}
            active={active === item.key}
            toggle={item.toggle}
            famous={item.key === 'famousMerchant'}
            onPress={() => handlePress(item.key)}
            onClear={item.onClear}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  active,
  toggle,
  famous,
  onPress,
  onClear,
}: {
  label: string;
  selected: boolean;
  active: boolean;
  toggle?: boolean;
  famous?: boolean;
  onPress: () => void;
  onClear?: () => void;
}) {
  if (famous) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.chip,
          styles.famousChip,
          selected ? styles.famousActive : styles.famousIdle,
          active && styles.chipPressed,
        ]}>
        <Text style={[styles.famousText, {color: selected ? '#FFFFFF' : '#254D5A'}]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  }

  const borderColor = selected ? colors.primary : 'transparent';
  const textColor = selected ? colors.primary : '#3C4947';
  const showClear = selected && Boolean(onClear);

  if (showClear) {
    return (
      <View style={[styles.chip, styles.clearableChip, {borderColor}, active && styles.chipPressed]}>
        <Pressable onPress={onPress} style={styles.chipMain} hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}>
          <Text style={[styles.chipText, {color: textColor}]} numberOfLines={1}>
            {label}
          </Text>
          {!toggle ? (
            <Svg width={10} height={10} viewBox="0 0 10 10">
              <Path
                d={active ? 'M2.5 6L5 3.5L7.5 6' : 'M2.5 4L5 6.5L7.5 4'}
                stroke={colors.primary}
                strokeWidth={1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          ) : null}
        </Pressable>
        <View style={styles.clearDivider} />
        <Pressable
          onPress={event => {
            event.stopPropagation();
            onClear?.();
          }}
          hitSlop={6}
          style={styles.clearButton}>
          <Text style={styles.clearText}>×</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.chip, {borderColor}, active && styles.chipPressed]}>
      <Text style={[styles.chipText, {color: textColor}]} numberOfLines={1}>
        {label}
      </Text>
      {!toggle ? (
        <Svg width={10} height={10} viewBox="0 0 10 10">
          <Path
            d={active ? 'M2.5 6L5 3.5L7.5 6' : 'M2.5 4L5 6.5L7.5 4'}
            stroke={active || selected ? colors.primary : '#3C4947'}
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#FFFFFF',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  chip: {
    minHeight: 30,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: '#F3F6F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  famousChip: {
    paddingHorizontal: 10,
  },
  chipPressed: {
    opacity: 0.7,
  },
  clearableChip: {
    paddingRight: 5,
  },
  chipMain: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  clearDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: 'rgba(0,106,97,0.35)',
    marginHorizontal: 2,
  },
  clearButton: {
    width: 14,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  chipText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  famousIdle: {
    borderColor: 'transparent',
    backgroundColor: '#F3F6F5',
  },
  famousActive: {
    borderColor: '#254D5A',
    backgroundColor: '#254D5A',
  },
  famousText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
