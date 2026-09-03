import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import type {MerchantOfferGroup} from '../../types/api';

export type QuickOfferFilter = 'famous' | 'spot' | 'semiFuture' | 'future' | 'grass' | 'grain';

export type OfferFilterState = {
  quick: Set<QuickOfferFilter>;
  merchants: Set<string>;
  locations: Set<string>;
  goodsTypes: Set<string>;
  feedingTypes: Set<string>;
};

type FilterBucket = Exclude<keyof OfferFilterState, 'quick'>;

const unlinkedMerchantLabel = '暂未关联行业商家';

type Props = {
  groups: MerchantOfferGroup[];
  value: OfferFilterState;
  onChange: (next: OfferFilterState) => void;
};

const quickOptions: Array<{key: QuickOfferFilter; label: string}> = [
  {key: 'famous', label: '知名商家'},
  {key: 'spot', label: '现货'},
  {key: 'semiFuture', label: '半期货'},
  {key: 'future', label: '期货'},
  {key: 'grass', label: '草饲'},
  {key: 'grain', label: '谷饲'},
];

export function createEmptyOfferFilterState(): OfferFilterState {
  return {
    quick: new Set(),
    merchants: new Set(),
    locations: new Set(),
    goodsTypes: new Set(),
    feedingTypes: new Set(),
  };
}

export function hasOfferFilters(value: OfferFilterState) {
  return Object.values(value).some(set => set.size > 0);
}

export function applyOfferFilters(groups: MerchantOfferGroup[], filters: OfferFilterState) {
  if (!hasOfferFilters(filters)) {
    return groups;
  }

  return groups
    .filter(group => {
      if (filters.quick.has('famous') && !group.isFamousMerchant) {
        return false;
      }
      if (filters.merchants.size === 0) {
        return true;
      }
      return filters.merchants.has(merchantFilterKey(group));
    })
    .map(group => ({
      ...group,
      employeeOffers: group.employeeOffers.filter(offer => {
        const goodsType = offer.goodsType ?? '';
        const feedingType = offer.feedingType ?? '';
        const tags = offer.tags ?? '';
        const location = offer.goodsLocation ?? '';

        if (filters.quick.has('spot') && !goodsType.includes('现货')) return false;
        if (filters.quick.has('semiFuture') && !goodsType.includes('半期货')) return false;
        if (filters.quick.has('future') && !goodsType.includes('期货')) return false;
        if (filters.quick.has('grass') && !(feedingType.includes('草饲') || tags.includes('草饲'))) {
          return false;
        }
        if (filters.quick.has('grain') && !(feedingType.includes('谷饲') || tags.includes('谷饲'))) {
          return false;
        }
        if (filters.locations.size > 0 && !filters.locations.has(location)) return false;
        if (filters.goodsTypes.size > 0 && !filters.goodsTypes.has(goodsType)) return false;
        if (filters.feedingTypes.size > 0 && !filters.feedingTypes.has(feedingType)) return false;
        return true;
      }),
    }))
    .filter(group => group.employeeOffers.length > 0);
}

export function OfferFilterPanel({groups, value, onChange}: Props) {
  const merchants = uniqueOptions(
    groups.map(group => merchantFilterKey(group)).filter(name => name && name !== unlinkedMerchantLabel),
  );
  const locations = uniqueOptions(
    groups.flatMap(group => group.employeeOffers.map(offer => offer.goodsLocation ?? '')).filter(Boolean),
  );
  const goodsTypes = uniqueOptions(
    groups.flatMap(group => group.employeeOffers.map(offer => offer.goodsType ?? '')).filter(Boolean),
  );
  const feedingTypes = uniqueOptions(
    groups.flatMap(group => group.employeeOffers.map(offer => offer.feedingType ?? '')).filter(Boolean),
  );

  const clear = () => onChange(createEmptyOfferFilterState());

  return (
    <View style={styles.wrap}>
      <View style={styles.quickRow}>
        {quickOptions.map(option => (
          <FilterChip
            key={option.key}
            label={option.label}
            active={value.quick.has(option.key)}
            onPress={() => onChange(toggleQuick(value, option.key))}
          />
        ))}
        {hasOfferFilters(value) ? <FilterChip label="清除" danger onPress={clear} /> : null}
      </View>

      <FilterSection
        title="商家"
        options={merchants}
        selected={value.merchants}
        onToggle={option => onChange(toggleBucket(value, 'merchants', option))}
      />
      <FilterSection
        title="地区"
        options={locations}
        selected={value.locations}
        onToggle={option => onChange(toggleBucket(value, 'locations', option))}
      />
      <FilterSection
        title="货物"
        options={goodsTypes}
        selected={value.goodsTypes}
        onToggle={option => onChange(toggleBucket(value, 'goodsTypes', option))}
      />
      <FilterSection
        title="饲养"
        options={feedingTypes}
        selected={value.feedingTypes}
        onToggle={option => onChange(toggleBucket(value, 'feedingTypes', option))}
      />
    </View>
  );
}

function FilterSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: Set<string>;
  onToggle: (option: string) => void;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
        {options.slice(0, 20).map(option => (
          <FilterChip
            key={`${title}-${option}`}
            label={option}
            active={selected.has(option)}
            onPress={() => onToggle(option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  active = false,
  danger = false,
  label,
  onPress,
}: {
  active?: boolean;
  danger?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, danger && styles.chipDanger]}>
      <Text style={[styles.chipText, active && styles.chipTextActive, danger && styles.chipTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

function toggleQuick(value: OfferFilterState, key: QuickOfferFilter): OfferFilterState {
  const next = cloneFilters(value);
  toggleSet(next.quick, key);
  return next;
}

function toggleBucket(value: OfferFilterState, bucket: FilterBucket, option: string): OfferFilterState {
  const next = cloneFilters(value);
  toggleSet(next[bucket], option);
  return next;
}

function cloneFilters(value: OfferFilterState): OfferFilterState {
  return {
    quick: new Set(value.quick),
    merchants: new Set(value.merchants),
    locations: new Set(value.locations),
    goodsTypes: new Set(value.goodsTypes),
    feedingTypes: new Set(value.feedingTypes),
  };
}

function toggleSet<T>(set: Set<T>, value: T) {
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
}

function merchantFilterKey(group: MerchantOfferGroup) {
  return group.merchantName || (group.merchantId != null ? `商家-${group.merchantId}` : '');
}

function uniqueOptions(items: string[]) {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean))).slice(0, 30);
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  optionRow: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipDanger: {
    backgroundColor: colors.surfaceMuted,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.primary,
  },
  chipTextDanger: {
    color: colors.textSecondary,
  },
});
