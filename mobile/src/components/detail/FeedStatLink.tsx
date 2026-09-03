import React from 'react';
import {Pressable, StyleProp, StyleSheet, Text, View, ViewStyle} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';

type Props = {
  label: string;
  value: string | number | null | undefined;
  onPress?: () => void;
  layout?: 'inline' | 'stacked' | 'large';
  align?: 'start' | 'end';
  style?: StyleProp<ViewStyle>;
};

export function FeedStatLink({
  label,
  value,
  onPress,
  layout = 'inline',
  align = 'start',
  style,
}: Props) {
  const displayValue = value == null || value === '' ? '--' : String(value);
  const isLarge = layout === 'large';
  const isStacked = layout === 'stacked';
  const content = (
    <>
      <Text style={[styles.label, align === 'end' && styles.labelAlignEnd]}>{label}</Text>
      <View
        style={[
          isLarge ? styles.largeValueRow : isStacked ? styles.stackedValueRow : styles.inlineValueRow,
          align === 'end' && styles.alignEnd,
        ]}>
        <Text
          style={isLarge ? styles.largeValue : styles.inlineValue}
          numberOfLines={1}
          adjustsFontSizeToFit={isLarge}
          minimumFontScale={0.78}>
          {displayValue}
        </Text>
        {onPress && !isLarge ? (
          <View style={styles.linkHint}>
            <Text style={styles.linkText}>查看</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        ) : null}
      </View>
      {onPress && isLarge ? (
        <View style={styles.largeLinkHint}>
          <Text style={styles.linkText}>查看</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      ) : null}
    </>
  );

  const containerStyle = [
    styles.base,
    isLarge ? styles.large : isStacked ? styles.stacked : styles.inline,
    align === 'end' && styles.alignEnd,
    style,
  ];

  if (!onPress) {
    return <View style={containerStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`查看${label}对应的报盘和求购`}
      android_ripple={{color: 'rgba(0, 123, 112, 0.08)', borderless: false}}
      hitSlop={4}
      onPress={onPress}
      style={({pressed}) => [containerStyle, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 0,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  large: {
    gap: 0,
  },
  stacked: {
    gap: 4,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  label: {
    color: 'rgba(60,73,71,0.5)',
    fontSize: 10,
    lineHeight: 14,
  },
  labelAlignEnd: {
    textAlign: 'right',
  },
  inlineValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  largeValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  stackedValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inlineValue: {
    fontFamily: fonts.manropeSemiBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  largeValue: {
    fontFamily: fonts.manropeBold,
    color: colors.primary,
    fontSize: 36,
    lineHeight: 42,
  },
  linkHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  largeLinkHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: -2,
    minHeight: 14,
  },
  linkText: {
    color: colors.primary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  chevron: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.65,
  },
});
