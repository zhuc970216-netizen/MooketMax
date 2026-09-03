import React from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/routes';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoSync'>;

const guideImage = require('../../assets/auto-sync-guide.png');
const IMAGE_WIDTH = 1500;
const IMAGE_HEIGHT = 6606;

export function AutoSyncScreen({navigation}: Props) {
  const screenWidth = Dimensions.get('window').width;
  const imageHeight = Math.round((screenWidth * IMAGE_HEIGHT) / IMAGE_WIDTH);

  function handleStart() {
    if (Platform.OS === 'android') {
      ToastAndroid.show('自动同步功能即将开放', ToastAndroid.SHORT);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <View style={[styles.imageWrap, {height: imageHeight}]}>
          <Image source={guideImage} style={[styles.guideImage, {height: imageHeight}]} resizeMode="stretch" />
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backHitArea} />
          <Pressable onPress={handleStart} style={styles.startHitArea} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#EFFFFB'},
  imageWrap: {width: '100%', position: 'relative'},
  guideImage: {width: '100%'},
  backHitArea: {
    position: 'absolute',
    left: 16,
    top: 68,
    width: 48,
    height: 48,
  },
  startHitArea: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 33,
    height: 58,
  },
});
