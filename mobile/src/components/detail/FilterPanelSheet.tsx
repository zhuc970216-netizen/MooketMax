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
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (option: string) => void;
}) {
  if (options.length === 0) {
    return <Text style={chipStyles.empty}>暂无可选项</Text>;
  }
  return (
    <View style={chipStyles.wrap}>
      {options.map(option => {
        const active = selected.has(option);
        return (
          <Pressable
            key={option}
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
      })}
    </View>
  );
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
