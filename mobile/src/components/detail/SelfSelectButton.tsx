import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SvgXml } from 'react-native-svg';
import { mooketApi } from '../../api/mooketApi';
import type { HomeCardItem, SearchHistory } from '../../types/api';
import { getHomeCardEntityKey } from '../../utils/homeFallbackCards';
import { getSelfSelectEntityName } from '../../utils/selfSelectEntity';

type SelfSelectPayload = {
  searchWord: string;
  searchType: string;
  isSelfSelect?: number;
  productId?: number | null;
  productName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  brandId?: number | null;
  merchantId?: number | string | null;
};

type Props = {
  category: string;
  card: HomeCardItem | null;
  payload: SelfSelectPayload | null;
};

const archiveAddIconXml = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.51562 6.98914H6.23438" stroke="#171D1C" stroke-width="1.125" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.875 5.38782V8.66907" stroke="#171D1C" stroke-width="1.125" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.0382 1.3125H4.71196C3.31415 1.3125 2.17883 2.45438 2.17883 3.84563V13.0922C2.17883 14.2734 3.0254 14.7722 4.06227 14.2012L7.26477 12.4228C7.60602 12.2325 8.15727 12.2325 8.49196 12.4228L11.6945 14.2012C12.7313 14.7787 13.5779 14.28 13.5779 13.0922V3.84563C13.5713 2.45438 12.436 1.3125 11.0382 1.3125Z" stroke="#171D1C" stroke-width="1.125" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const archiveDelIconXml = `<svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M12.6152 1.5C14.2125 1.50013 15.5098 2.80482 15.5176 4.39453V14.9629C15.5174 16.32 14.5499 16.8901 13.3652 16.2305L9.70508 14.1973C9.32267 13.9798 8.69274 13.9799 8.30273 14.1973L4.64258 16.2305C3.45775 16.8828 2.49042 16.3126 2.49023 14.9629V4.39453C2.49049 2.80482 3.78753 1.50012 5.38477 1.5H12.6152ZM7.125 7.4248C6.81756 7.4248 6.5626 7.67989 6.5625 7.9873C6.5625 8.2948 6.8175 8.5498 7.125 8.5498H10.875C11.1825 8.5498 11.4375 8.2948 11.4375 7.9873C11.4374 7.67989 11.1824 7.4248 10.875 7.4248H7.125Z" fill="#006A61"/></svg>`;
const keySeparator = '\u001f';

export function SelfSelectButton({ category, card, payload }: Props) {
  const supported = isSupportedSelfSelectCard(card);
  const [selected, setSelected] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const candidateSignature = useMemo(
    () => (supported && card ? getSelfSelectCandidateKeys(card).join(keySeparator) : ''),
    [card, supported],
  );
  const payloadSignature = useMemo(
    () =>
      payload
        ? getSearchCandidateKey(payload.searchType, payload.searchWord)
        : '',
    [payload],
  );
  const entityName = payload?.searchWord.trim() || getSelfSelectEntityName(card);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function refresh() {
        if (!candidateSignature) {
          if (!cancelled) {
            setSelected(false);
            setHistoryId(null);
          }
          return;
        }

        try {
          const match = await findSelfSelectRecord(
            category,
            candidateSignature,
            payloadSignature,
          );
          if (!cancelled) {
            setSelected(Boolean(match));
            setHistoryId(match?.historyId ?? null);
          }
        } catch {
          // Keep the current optimistic UI if the status check fails.
        }
      }

      refresh().catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }, [candidateSignature, category, payloadSignature]),
  );

  if (!supported) return null;

  const disabled = pending || !candidateSignature || (!selected && !payload);

  function handlePress() {
    if (disabled || !candidateSignature) return;

    if (selected) {
      Alert.alert(
        '\u79fb\u51fa\u81ea\u9009',
        entityName
          ? `\u786e\u5b9a\u5c06\u201c${entityName}\u201d\u79fb\u51fa\u81ea\u9009\u5417\uff1f`
          : '\u786e\u5b9a\u79fb\u51fa\u81ea\u9009\u5417\uff1f',
        [
          { text: '\u53d6\u6d88', style: 'cancel' },
          {
            text: '\u79fb\u51fa',
            style: 'destructive',
            onPress: () => performToggle().catch(() => undefined),
          },
        ],
      );
      return;
    }

    Alert.alert(
      '\u52a0\u5165\u81ea\u9009',
      entityName
        ? `\u786e\u5b9a\u5c06\u201c${entityName}\u201d\u6dfb\u52a0\u4e3a\u81ea\u9009\u5417\uff1f`
        : '\u786e\u5b9a\u52a0\u5165\u81ea\u9009\u5417\uff1f',
      [
        { text: '\u53d6\u6d88', style: 'cancel' },
        {
          text: '\u786e\u5b9a',
          onPress: () => performToggle().catch(() => undefined),
        },
      ],
    );
  }

  async function performToggle() {
    setPending(true);
    try {
      if (selected) {
        let targetHistoryId = historyId;
        if (!targetHistoryId) {
          const match = await findSelfSelectRecord(
            category,
            candidateSignature,
            payloadSignature,
          );
          targetHistoryId = match?.historyId ?? null;
        }
        if (!targetHistoryId) {
          throw new Error(
            '\u672a\u627e\u5230\u5bf9\u5e94\u7684\u81ea\u9009\u8bb0\u5f55',
          );
        }
        await mooketApi.cancelSelfSelect(targetHistoryId);
        setSelected(false);
        setHistoryId(null);
      } else if (payload) {
        await mooketApi.saveSearchHistory({ ...payload, isSelfSelect: 1 });
        setSelected(true);
        setHistoryId(null);
        findSelfSelectRecord(
          category,
          candidateSignature,
          payloadSignature,
        )
          .then(match => setHistoryId(match?.historyId ?? null))
          .catch(() => undefined);
      }
    } catch (error) {
      Alert.alert(
        '\u64cd\u4f5c\u5931\u8d25',
        error instanceof Error
          ? error.message
          : '\u8bf7\u7a0d\u540e\u91cd\u8bd5',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        selected ? '\u53d6\u6d88\u81ea\u9009' : '\u6dfb\u52a0\u81ea\u9009'
      }
      disabled={disabled}
      hitSlop={10}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        (pressed || pending) && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <SvgXml
        xml={selected ? archiveDelIconXml : archiveAddIconXml}
        width={22}
        height={22}
      />
    </Pressable>
  );
}

async function findSelfSelectRecord(
  category: string,
  candidateSignature: string,
  payloadSignature: string,
) {
  const targetKeys = new Set(
    candidateSignature.split(keySeparator).filter(Boolean),
  );
  if (payloadSignature) targetKeys.add(payloadSignature);

  const response = await mooketApi.getSelfSelectCards(category);
  const card = (response.cards ?? []).find(item =>
    getSelfSelectCandidateKeys(item).some(key => targetKeys.has(key)),
  );
  if (card?.historyId != null) return { historyId: card.historyId };

  try {
    const histories = await mooketApi.getSelfSelectSearches();
    const history = histories.find(item =>
      getSelfSelectHistoryCandidateKeys(item).some(key => targetKeys.has(key)),
    );
    if (history) return { historyId: history.historyId };
  } catch {
    // Older servers may not expose raw self-select history. Keep the card match if it exists.
  }

  return card ? { historyId: card.historyId ?? null } : null;
}

function isSupportedSelfSelectCard(card: HomeCardItem | null) {
  return card?.cardType === 'factoryProduct' || card?.cardType === 'merchant';
}

export function toHistoryMerchantId(value: number | string | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function getSelfSelectCandidateKeys(card: HomeCardItem) {
  const keys = new Set<string>();
  const primary = getHomeCardEntityKey(card);
  if (primary) keys.add(primary);

  switch (card.cardType) {
    case 'product':
      addTextKey(keys, 'product-name', card.productName);
      break;
    case 'country':
      addTextKey(keys, 'country', card.country);
      break;
    case 'brand':
      addTextKey(keys, 'brand-name', card.brandName);
      break;
    case 'merchant':
      addTextKey(keys, 'merchant-name', card.merchantName);
      addTextKey(keys, 'merchant-name', card.merchantShortName);
      break;
    case 'factory':
      addJoinedKey(keys, 'factory', [card.country, card.factoryNo]);
      break;
    case 'countryProduct':
      addJoinedKey(keys, 'countryProduct', [card.country, card.productName]);
      break;
    case 'factoryProduct':
      addJoinedKey(keys, 'factoryProduct', [
        card.country,
        card.factoryNo,
        card.productName,
      ]);
      break;
    case 'brandProduct':
      addJoinedKey(keys, 'brandProductName', [
        card.brandName,
        card.productName,
      ]);
      break;
    default:
      break;
  }

  return Array.from(keys);
}

function getSelfSelectHistoryCandidateKeys(history: SearchHistory) {
  const keys = new Set<string>();
  keys.add(getSearchCandidateKey(history.searchType, history.searchWord));

  switch (history.searchType.trim()) {
    case '\u4ea7\u54c1':
      addIdKey(keys, 'product', history.productId);
      addTextKey(keys, 'product-name', history.productName ?? history.searchWord);
      break;
    case '\u56fd\u5bb6':
      addTextKey(keys, 'country', history.country ?? history.searchWord);
      break;
    case '\u54c1\u724c':
      addIdKey(keys, 'brand', history.brandId);
      addTextKey(keys, 'brand-name', history.searchWord);
      break;
    case '\u5546\u5bb6':
      addIdKey(keys, 'merchant', history.merchantId);
      addTextKey(keys, 'merchant-name', history.searchWord);
      break;
    case '\u56fd\u5bb6\u5382\u53f7':
      addJoinedKey(keys, 'factory', [history.country, history.factoryNo]);
      break;
    case '\u56fd\u5bb6\u4ea7\u54c1':
      addJoinedKey(keys, 'countryProduct', [
        history.country,
        history.productName,
      ]);
      break;
    case '\u56fd\u5bb6\u5382\u53f7\u4ea7\u54c1':
      addJoinedKey(keys, 'factoryProduct', [
        history.country,
        history.factoryNo,
        history.productName,
      ]);
      break;
    case '\u54c1\u724c\u4ea7\u54c1':
      addJoinedKey(keys, 'brandProduct', [
        history.brandId == null ? null : String(history.brandId),
        history.productName,
      ]);
      break;
    default:
      break;
  }

  return Array.from(keys).filter(Boolean);
}

function getSearchCandidateKey(searchType: string, searchWord: string) {
  return `search:${normalizeText(searchType)}:${normalizeText(searchWord)}`;
}

function addIdKey(
  keys: Set<string>,
  prefix: string,
  value?: number | string | null,
) {
  if (value != null && String(value).trim()) {
    keys.add(`${prefix}:${String(value).trim()}`);
  }
}

function addTextKey(keys: Set<string>, prefix: string, value?: string | null) {
  const normalized = normalizeText(value);
  if (normalized) keys.add(`${prefix}:${normalized}`);
}

function addJoinedKey(
  keys: Set<string>,
  prefix: string,
  values: Array<string | null | undefined>,
) {
  const normalized = values.map(normalizeText);
  if (normalized.every(Boolean)) keys.add(`${prefix}:${normalized.join(':')}`);
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

const styles = StyleSheet.create({
  button: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
});
