import React, {useEffect, useRef, useState} from 'react';
import {InteractionManager, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {DeferredOriginalTextSheet} from '../detail/DeferredOriginalTextSheet';
import {colors} from '../../theme/colors';
import type {OfferFeedItem} from '../../types/api';
import {buildOriginalTextPayload} from '../../utils/originalText';

type Props = {
  visible: boolean;
  item: OfferFeedItem | null;
  feedType: 'offer' | 'inquiry';
  intentAdded: boolean;
  onClose: () => void;
  onMerchant: () => void;
  onPhone: () => void;
  onCopyPhone: () => void;
  onIntent: () => void;
  onOnlineChat: () => void;
};

export function OfferActionSheetFast({
  visible,
  item,
  feedType,
  intentAdded,
  onClose,
  onMerchant,
  onPhone,
  onCopyPhone,
  onIntent,
  onOnlineChat,
}: Props) {
  const [originalVisible, setOriginalVisible] = useState(false);
  const [originalLoading, setOriginalLoading] = useState(false);
  const [originalPayload, setOriginalPayload] = useState<{text: string; keywords: string[]} | null>(null);
  const originalTaskRef = useRef<{cancel?: () => void} | null>(null);
  const originalSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      originalTaskRef.current?.cancel?.();
    };
  }, []);

  useEffect(() => {
    if (visible && item) {
      return;
    }
    resetOriginalState();
  }, [item, visible]);

  if (!item) return null;

  const merchantAvailable = item.merchantId != null && String(item.merchantId).trim().length > 0;
  const phoneAvailable = Boolean(item.contactPhone?.trim());
  const title = [item.country, item.factoryNo, item.productName].filter(Boolean).join(' · ');

  function resetOriginalState() {
    originalSeqRef.current += 1;
    originalTaskRef.current?.cancel?.();
    setOriginalVisible(false);
    setOriginalLoading(false);
    setOriginalPayload(null);
  }

  function handleOriginalOpen() {
    const seq = ++originalSeqRef.current;
    originalTaskRef.current?.cancel?.();
    setOriginalVisible(true);
    setOriginalLoading(true);
    setOriginalPayload(null);
    originalTaskRef.current = InteractionManager.runAfterInteractions(() => {
      if (seq !== originalSeqRef.current) {
        return;
      }
      const payload = buildOriginalTextPayload({
        text: item.offerOriginalText,
        intent: feedType === 'inquiry' ? 'inquiry' : 'offer',
        offerType: item.offerType,
        country: item.country,
        factoryNo: item.factoryNo,
        productName: item.productName,
        price: item.price,
        priceMax: item.priceMax,
        goodsLocation: item.goodsLocation,
        goodsType: item.goodsType,
        feedingType: item.feedingType,
        fatRatio: item.fatRatio,
        cattleBreed: item.cattleBreed,
        tags: item.tags,
        remark: item.remark,
        publishTime: item.publishTime,
        userNickname: item.userNickname,
        merchantName: item.merchantName,
        merchantShortName: item.merchantShortName,
      });
      setOriginalPayload({text: payload.text, keywords: payload.keywords});
      setOriginalLoading(false);
    });
  }

  function handleOriginalClose() {
    originalSeqRef.current += 1;
    originalTaskRef.current?.cancel?.();
    setOriginalVisible(false);
    setOriginalLoading(false);
    setOriginalPayload(null);
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <View style={styles.panel}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.headerMain}>
                <Text style={styles.publisher} numberOfLines={1}>
                  {item.userNickname || '未知发布人'}
                </Text>
                <View style={styles.merchantLine}>
                  <Text style={styles.merchant} numberOfLines={1}>
                    {item.merchantShortName || item.merchantName || '暂未关联商家'}
                  </Text>
                  {merchantAvailable ? (
                    <Pressable onPress={onMerchant} hitSlop={8} style={styles.viewMerchantButton}>
                      <Text style={styles.viewMerchantText}>查看&gt;</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.sku} numberOfLines={2}>
              {title || '报价详情'}
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.price}>{formatPrice(item)}</Text>
              <Text style={styles.time}>{formatPublishTime(item.publishTime)}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={2}>
              {buildMeta(item)}
            </Text>

            <Pressable onPress={handleOriginalOpen} style={styles.originalButton}>
              <Text style={styles.originalText}>查看原文</Text>
              <Text style={styles.originalArrow}>›</Text>
            </Pressable>

            <View style={styles.actions}>
              <Action
                title={intentAdded ? '已收藏' : '收藏'}
                icon={<StarLineIcon filled={intentAdded} />}
                onPress={onIntent}
              />
              <Action
                title="添加微信"
                icon={<WechatLineIcon />}
                disabled={!phoneAvailable}
                onPress={onCopyPhone}
              />
              <Action
                title="拨打电话"
                icon={<PhoneLineIcon />}
                disabled={!phoneAvailable}
                onPress={onPhone}
              />
              <Action title="在线沟通" icon={<ChatLineIcon />} onPress={onOnlineChat} />
            </View>

            {!merchantAvailable || !phoneAvailable ? (
              <Text style={styles.hint}>
                {!merchantAvailable ? '该报价暂未关联商家' : '该报价暂未提供联系电话'}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>
      <DeferredOriginalTextSheet
        visible={originalVisible}
        text={originalPayload?.text ?? ''}
        keywords={originalPayload?.keywords ?? []}
        loading={originalLoading}
        onClose={handleOriginalClose}
      />
    </>
  );
}

function Action({
  title,
  icon,
  disabled = false,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.action,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={[styles.actionIcon, disabled && styles.actionIconDisabled]}>{icon}</View>
      <Text style={[styles.actionText, disabled && styles.disabledText]} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

function StarLineIcon({filled = false}: {filled?: boolean}) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill={filled ? colors.primary : 'none'}>
      <Path
        d="M12 3.2l2.72 5.51 6.08.88-4.4 4.29 1.04 6.05L12 17.07l-5.44 2.86 1.04-6.05-4.4-4.29 6.08-.88L12 3.2z"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WechatLineIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.2 5.3C6.2 5.3 3 7.72 3 10.7c0 1.72 1.05 3.2 2.72 4.18l-.48 1.92 2.1-1.02c.88.22 1.84.34 2.86.34 4 0 7.2-2.42 7.2-5.42s-3.2-5.4-7.2-5.4z"
        stroke={colors.primary}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M14.1 10.32c3.36.4 5.9 2.44 5.9 4.9 0 1.42-.82 2.72-2.18 3.62l.38 1.56-1.74-.86c-.72.2-1.5.32-2.34.32-2.62 0-4.88-1.22-5.86-2.98"
        stroke={colors.primary}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={8.1} cy={10.2} r={0.95} fill={colors.primary} />
      <Circle cx={12.7} cy={10.2} r={0.95} fill={colors.primary} />
    </Svg>
  );
}

function PhoneLineIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 16.92v2.22a2.1 2.1 0 01-2.29 2.1A18.2 18.2 0 012.76 4.29 2.1 2.1 0 014.86 2h2.22a2.1 2.1 0 012.08 1.8c.13.96.35 1.88.66 2.76a2.1 2.1 0 01-.47 2.18L8.4 9.7a14.1 14.1 0 005.9 5.9l.96-.95a2.1 2.1 0 012.18-.47c.88.31 1.8.53 2.76.66A2.1 2.1 0 0122 16.92z"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChatLineIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a7.5 7.5 0 01-7.5 7.5H9l-4.5 2 1.05-3.5A7.5 7.5 0 1113.5 4 7.5 7.5 0 0121 11.5z"
        stroke={colors.primary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8.5 11.5h7M8.5 14h4" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function formatPrice(item: OfferFeedItem) {
  const values = [item.price, item.priceMax].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  if (!values.length) return '协商报价';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `¥${min}/kg` : `¥${min}-${max}/kg`;
}

function buildMeta(item: OfferFeedItem) {
  const meta = [item.feedingType, item.weight, item.goodsLocation || item.region, item.tags]
    .filter(value => value?.trim())
    .join(' · ');
  return meta || '暂无更多报盘信息';
}

function formatPublishTime(value?: string | null) {
  const text = value?.trim();
  if (!text) return '-';
  return text.replace('T', ' ');
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  panel: {
    minHeight: 370,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    width: 36,
    height: 4,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 2,
    backgroundColor: '#D7DFDD',
    alignSelf: 'center',
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  publisher: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  merchantLine: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  merchant: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
  },
  viewMerchantButton: {
    height: 20,
    justifyContent: 'center',
  },
  viewMerchantText: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  close: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 26,
    lineHeight: 30,
  },
  sku: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  summaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  price: {
    color: colors.price,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  time: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  meta: {
    marginTop: 8,
    minHeight: 36,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  originalButton: {
    height: 42,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F4F8F7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  originalText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  originalArrow: {
    color: colors.primary,
    fontSize: 22,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  action: {
    flex: 1,
    minWidth: 0,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#D8E7E4',
    backgroundColor: '#FFFFFF',
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDisabled: {
    backgroundColor: '#F1F3F2',
    opacity: 0.58,
  },
  actionText: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  disabled: {
    backgroundColor: '#FAFBFB',
    borderColor: '#EBEFEE',
  },
  disabledText: {
    color: '#AAB2B0',
  },
  pressed: {
    backgroundColor: colors.primaryLight,
  },
  hint: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
