import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import type {OfferFeedItem} from '../../types/api';
import {colors} from '../../theme/colors';

type Props = {
  visible: boolean;
  item: OfferFeedItem | null;
  intentAdded: boolean;
  onClose: () => void;
  onMerchant: () => void;
  onPhone: () => void;
  onCopyPhone: () => void;
  onIntent: () => void;
  onOriginal: () => void;
};

export function OfferActionSheet({visible, item, intentAdded, onClose, onMerchant, onPhone, onCopyPhone, onIntent, onOriginal}: Props) {
  if (!item) return null;
  const merchantAvailable = item.merchantId != null && String(item.merchantId).trim().length > 0;
  const phoneAvailable = Boolean(item.contactPhone?.trim());
  const title = [item.country, item.factoryNo, item.productName].filter(Boolean).join(' · ');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerMain}>
              <Text style={styles.publisher} numberOfLines={1}>{item.userNickname || '未知发布人'}</Text>
              <Text style={styles.merchant} numberOfLines={1}>{item.merchantShortName || item.merchantName || '暂未关联商家'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          <Text style={styles.sku} numberOfLines={2}>{title || '报价详情'}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.price}>{formatPrice(item)}</Text>
            <Text style={styles.time}>{item.publishTime || '-'}</Text>
          </View>
          <Text style={styles.meta} numberOfLines={2}>{buildMeta(item)}</Text>
          <Pressable onPress={onOriginal} style={styles.originalButton}>
            <Text style={styles.originalText}>查看原文</Text>
            <Text style={styles.originalArrow}>›</Text>
          </Pressable>
          <View style={styles.actions}>
            <Action title="查看商家" icon="店" disabled={!merchantAvailable} onPress={onMerchant} />
            <Action title="拨打电话" icon="电" disabled={!phoneAvailable} onPress={onPhone} />
            <Action title="复制手机号" icon="复" disabled={!phoneAvailable} onPress={onCopyPhone} />
            <Action title={intentAdded ? '移出意向盘' : '加入意向盘'} icon={intentAdded ? '移' : '加'} onPress={onIntent} />
          </View>
          {!merchantAvailable || !phoneAvailable ? (
            <Text style={styles.hint}>{!merchantAvailable ? '该报价暂未关联商家' : '该报价暂未提供联系电话'}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Action({title, icon, disabled = false, onPress}: {title: string; icon: string; disabled?: boolean; onPress: () => void}) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({pressed}) => [styles.action, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      <View style={[styles.actionIcon, disabled && styles.actionIconDisabled]}><Text style={[styles.actionIconText, disabled && styles.disabledText]}>{icon}</Text></View>
      <Text style={[styles.actionText, disabled && styles.disabledText]} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

function formatPrice(item: OfferFeedItem) {
  const values = [item.price, item.priceMax].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return '协商报价';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `¥${min}/kg` : `¥${min}-${max}/kg`;
}

function buildMeta(item: OfferFeedItem) {
  return [item.feedingType, item.weight, item.goodsLocation || item.region, item.tags].filter(value => value?.trim()).join(' · ') || '暂无更多报盘属性';
}

const styles = StyleSheet.create({
  overlay: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.32)'},
  panel: {minHeight: 370, paddingHorizontal: 16, paddingBottom: 24, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#FFFFFF'},
  handle: {width: 36, height: 4, marginTop: 8, marginBottom: 8, borderRadius: 2, backgroundColor: '#D7DFDD', alignSelf: 'center'},
  header: {height: 48, flexDirection: 'row', alignItems: 'center'},
  headerMain: {flex: 1, minWidth: 0},
  publisher: {color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900'},
  merchant: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  close: {width: 34, height: 34, alignItems: 'center', justifyContent: 'center'},
  closeText: {color: colors.textSecondary, fontSize: 26, lineHeight: 30},
  sku: {marginTop: 8, color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '800'},
  summaryRow: {marginTop: 12, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12},
  price: {color: colors.price, fontSize: 20, lineHeight: 26, fontWeight: '900'},
  time: {color: colors.textMuted, fontSize: 11, lineHeight: 16},
  meta: {marginTop: 8, minHeight: 36, color: colors.textSecondary, fontSize: 12, lineHeight: 18},
  originalButton: {height: 42, marginTop: 10, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#F4F8F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  originalText: {color: colors.primary, fontSize: 13, fontWeight: '800'},
  originalArrow: {color: colors.primary, fontSize: 22},
  actions: {marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 8},
  action: {flex: 1, minWidth: 0, height: 76, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 7, borderWidth: 1, borderColor: '#D8E7E4', backgroundColor: '#FFFFFF'},
  actionIcon: {width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center'},
  actionIconDisabled: {backgroundColor: '#F1F3F2'},
  actionIconText: {color: colors.primary, fontSize: 13, fontWeight: '900'},
  actionText: {color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '700'},
  disabled: {backgroundColor: '#FAFBFB', borderColor: '#EBEFEE'},
  disabledText: {color: '#AAB2B0'},
  pressed: {backgroundColor: colors.primaryLight},
  hint: {marginTop: 12, color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center'},
});
