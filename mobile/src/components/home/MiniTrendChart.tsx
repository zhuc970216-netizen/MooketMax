import React from 'react';
import {View} from 'react-native';
import Svg, {Polyline} from 'react-native-svg';
import {colors} from '../../theme/colors';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
};

export type TrendChartPoint = {
  x: number;
  y: number;
};

export function buildTrendChartPoints(
  data: number[],
  width: number,
  height: number,
  padX = 4,
  padY = 3,
): TrendChartPoint[] {
  if (data.length < 2) {
    return [];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);

  return data.map((value, index) => {
    const x = padX + (index / (data.length - 1)) * (width - padX * 2);
    const ratio = max === min ? 0.5 : (value - min) / (max - min);
    const y = height - padY - ratio * (height - padY * 2);
    return {x, y};
  });
}

export function buildTrendPointString(data: number[], width: number, height: number, padX = 4, padY = 3) {
  return buildTrendChartPoints(data, width, height, padX, padY)
    .map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
}

export function MiniTrendChart({data, width = 280, height = 46, color = colors.primary}: Props) {
  if (data.length < 2) {
    return <View style={{width, height}} />;
  }

  const points = buildTrendPointString(data, width, height);
  if (!points) {
    return <View style={{width, height}} />;
  }

  return (
    <View style={{width, height}}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
