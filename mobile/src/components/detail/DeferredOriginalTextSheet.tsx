import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, InteractionManager, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../theme/colors';
import {analyzeOriginalText, type AnalyzeResult} from '../../utils/originalText';

type Props = {
  visible: boolean;
  text: string;
  keywords?: string[];
  loading?: boolean;
  onClose: () => void;
  title?: string;
};

const EMPTY_ANALYSIS: AnalyzeResult = {
  keywords: [],
  segments: [],
  bestSegmentIndex: -1,
  bestSegmentIndexes: [],
};

export function DeferredOriginalTextSheet({
  visible,
  text,
  keywords = [],
  loading = false,
  onClose,
  title = '查看原文',
}: Props) {
  const insets = useSafeAreaInsets();
  const analysisTaskRef = useRef<{cancel?: () => void} | null>(null);
  const analysisSeqRef = useRef(0);
  const [analysis, setAnalysis] = useState<AnalyzeResult>(EMPTY_ANALYSIS);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      analysisSeqRef.current += 1;
      analysisTaskRef.current?.cancel?.();
      setAnalysis(EMPTY_ANALYSIS);
      setAnalysisLoading(false);
      return;
    }

    if (!text.trim()) {
      setAnalysis(EMPTY_ANALYSIS);
      setAnalysisLoading(false);
      return;
    }

    const seq = ++analysisSeqRef.current;
    analysisTaskRef.current?.cancel?.();
    setAnalysisLoading(true);
    analysisTaskRef.current = InteractionManager.runAfterInteractions(() => {
      if (seq !== analysisSeqRef.current) {
        return;
      }
      setAnalysis(analyzeOriginalText(text, keywords));
      setAnalysisLoading(false);
    });

    return () => {
      analysisTaskRef.current?.cancel?.();
    };
  }, [keywords, text, visible]);

  const activeSegmentIndexes = new Set(
    analysis.bestSegmentIndexes.length
      ? analysis.bestSegmentIndexes
      : analysis.bestSegmentIndex >= 0
        ? [analysis.bestSegmentIndex]
        : [],
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, {paddingBottom: Math.max(insets.bottom, 24)}]}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable hitSlop={12} onPress={onClose} style={styles.closeButton}>
              <Text style={styles.close}>关闭</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled">
            {loading || analysisLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>正在整理原文...</Text>
              </View>
            ) : null}
            {text ? (
              !loading && !analysisLoading && analysis.segments.length > 0 ? (
                analysis.segments.map((segment, index) => {
                  const active = activeSegmentIndexes.has(index);
                  return (
                    <View key={`${index}-${segment.slice(0, 12)}`} style={styles.segmentBlock}>
                      <Text style={[styles.text, active && styles.textActive]}>{renderTextWithPhones(segment)}</Text>
                    </View>
                  );
                })
              ) : !loading && !analysisLoading ? (
                <Text style={styles.text}>{renderTextWithPhones(text)}</Text>
              ) : null
            ) : (
              <Text style={[styles.text, styles.textMuted]}>{loading ? '' : '抱歉，暂时无原文。'}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function renderTextWithPhones(text: string) {
  return text.split(/(1\d{10})/g).map((part, index) => {
    if (/^1\d{10}$/.test(part)) {
      return (
        <Text key={`${part}-${index}`} style={styles.phoneText} onPress={() => { dialPhone(part).catch(() => undefined); }}>
          {part}
        </Text>
      );
    }
    return <Text key={`${index}`}>{part}</Text>;
  });
}

async function dialPhone(phone: string) {
  const url = `tel:${phone}`;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DEE4E1',
    marginBottom: 8,
  },
  titleRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  close: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    minWidth: 56,
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  loadingWrap: {
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#6C7775',
    fontSize: 13,
  },
  segmentBlock: {
    marginBottom: 6,
  },
  text: {
    color: '#3C4947',
    fontSize: 14,
    lineHeight: 22,
  },
  textActive: {
    alignSelf: 'flex-start',
    backgroundColor: '#CFEFE7',
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  phoneText: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  textMuted: {
    color: '#9DA4A3',
  },
});
