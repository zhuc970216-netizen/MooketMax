import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from 'react-native';
import {colors} from '../../theme/colors';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onReset?: () => void;
  onConfirm?: () => void;
  showActions?: boolean;
  topOffset?: number;
  children: React.ReactNode;
};

export function FilterPanelSheet({
  visible,
  title,
  onClose,
  onReset,
  onConfirm,
  showActions = true,
  topOffset = 0,
  children,
}: Props) {
  const modalTopOffset = Math.max(
    0,
    topOffset + (Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0),
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable style={{height: modalTopOffset}} onPress={onClose} />
        <KeyboardAvoidingView
          style={styles.panelArea}
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
          <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{title}</Text>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {showActions ? (
              <View style={styles.actions}>
                <Pressable style={[styles.button, styles.resetButton]} onPress={onReset}>
                  <Text style={styles.resetText}>重置</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.confirmButton]} onPress={onConfirm ?? onClose}>
                  <Text style={styles.confirmText}>确定</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.mask} onPress={onClose} />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function MultiSelectChips({
  options,
  selected,
  onToggle,
  groupSimilarTags = false,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (option: string) => void;
  groupSimilarTags?: boolean;
}) {
  if (options.length === 0) {
    return <Text style={chipStyles.empty}>暂无可选项</Text>;
  }

  if (groupSimilarTags) {
    return (
      <View style={chipStyles.groupedWrap}>
        {groupSimilarTagOptions(options).map(group => (
          <View key={group.key} style={chipStyles.groupRow}>
            {group.options.map(option => (
              <FilterOptionChip
                key={option}
                option={option}
                active={selected.has(option)}
                onToggle={onToggle}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={chipStyles.wrap}>
      {options.map(option => (
        <FilterOptionChip
          key={option}
          option={option}
          active={selected.has(option)}
          onToggle={onToggle}
        />
      ))}
    </View>
  );
}

function FilterOptionChip({
  option,
  active,
  onToggle,
}: {
  option: string;
  active: boolean;
  onToggle: (option: string) => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        onToggle(option);
      }}
      style={[chipStyles.chip, active && chipStyles.chipActive]}>
      <Text style={[chipStyles.text, active && chipStyles.textActive]} numberOfLines={1}>
        {option}
      </Text>
    </Pressable>
  );
}

type SimilarTagGroupKey = 'date' | 'stock' | 'ticket' | 'shipment' | 'hold' | 'price' | 'other';

const similarTagGroupOrder: SimilarTagGroupKey[] = [
  'date',
  'stock',
  'ticket',
  'shipment',
  'hold',
  'price',
  'other',
];

function groupSimilarTagOptions(options: string[]) {
  const groups = new Map<SimilarTagGroupKey, string[]>();
  options.forEach(option => {
    const text = option.trim();
    if (!text) return;
    const key = getSimilarTagGroupKey(text);
    const current = groups.get(key) ?? [];
    if (!current.includes(text)) {
      current.push(text);
    }
    groups.set(key, current);
  });

  return similarTagGroupOrder
    .map(key => ({key, options: groups.get(key) ?? []}))
    .filter(group => group.options.length > 0);
}

function getSimilarTagGroupKey(text: string): SimilarTagGroupKey {
  if (/\u65E5\u671F|\u65B0\u65E5|\u5927\u65E5|\u65B0\u65F6\u95F4|\u5927\u65F6\u95F4/.test(text)) {
    return 'date';
  }
  if (/\u73B0\u8D27|\u65B0\u8D27|\u671F\u8D27|\u534A\u671F/.test(text)) {
    return 'date';
  }
  if (/\u7968|\u5F00\u7968|\u4E13\u7968|\u4E00\u5BF9\u4E00|\u5F00\u8BC1|\u8BC1/.test(text)) {
    return 'ticket';
  }
  if (/\u6574\u67DC|\u53EF\u62C6|\u62C6\u51FA|\u53EF\u51FA|\u6574\u51FA/.test(text)) {
    return 'shipment';
  }
  if (/\u53EF\u653E|\u653E\u4E00|\u653E\u4E03|\u653E\u5341|\u653E\d|\u653E[0-9]/.test(text)) {
    return 'hold';
  }
  if (/\u4E00\u53E3\u4EF7|\u7279\u4EF7|\u8BAE\u4EF7|\u62A5\u4EF7|\u4F18\u60E0/.test(text)) {
    return 'price';
  }
  return 'other';
}
const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  panelArea: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  mask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  sheet: {
    minHeight: 112,
    maxHeight: '68%',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    backgroundColor: '#F3F6F5',
  },
  resetText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

const chipStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupedWrap: {
    gap: 8,
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  text: {
    color: colors.text,
    fontSize: 12,
  },
  textActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  empty: {
    color: '#9DA4A3',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
