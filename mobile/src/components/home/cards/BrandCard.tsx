import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import {colors} from '../../../theme/colors';
import type {HomeCardItem} from '../../../types/api';
import {cardBaseStyle, formatThousand, sharedStyles} from './shared';

type Props = {card: HomeCardItem; onPress?: () => void; onLongPress?: () => void};

export function BrandCard({card, onPress, onLongPress}: Props) {
  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      delayLongPress={250}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({pressed}) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.titleWrap}>
        <BrandIcon />
        <Text style={styles.titleText} numberOfLines={1}>
          {card.brandName ?? '--'}
        </Text>
      </View>

      <View style={styles.statBlock}>
        <Text style={sharedStyles.smallLabel}>{'近2日报盘数'}</Text>
        <Text style={sharedStyles.bigStat}>{formatThousand(card.todayOfferCount)}</Text>
      </View>

      <View style={sharedStyles.divider} />

      <View style={styles.bottomRow}>
        <View style={styles.col}>
          <Text style={sharedStyles.smallLabel}>{'产品数'}</Text>
          <Text style={sharedStyles.midStat}>{card.productCount ?? '--'}</Text>
        </View>
        <View style={styles.col}>
          <Text style={sharedStyles.smallLabel}>{'工厂数'}</Text>
          <Text style={sharedStyles.midStat}>{card.factoryCount ?? '--'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function BrandIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path
        d="M5 5l6-2 6 2v9c0 2.5-2.5 5-6 5s-6-2.5-6-5V5Z"
        fill="#FFFFFF"
        stroke="#1F2D3A"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path d="M8 9h6M8 12h6" stroke="#1F2D3A" strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {...cardBaseStyle, gap: 8},
  pressed: {opacity: 0.85},
  titleWrap: {flexDirection: 'row', alignItems: 'center', gap: 6},
  titleText: {color: colors.text, fontSize: 16, lineHeight: 28, fontWeight: '500', flex: 1},
  statBlock: {gap: 2},
  bottomRow: {flexDirection: 'row', gap: 32, paddingTop: 8},
  col: {gap: 4, minWidth: 40},
});
