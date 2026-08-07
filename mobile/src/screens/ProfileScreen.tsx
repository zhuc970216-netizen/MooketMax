import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {mooketApi} from '../api/mooketApi';
import {UpdateModal} from '../components/common/UpdateModal';
import {CURRENT_APP_VERSION, CURRENT_APP_VERSION_CODE, IOS_APP_STORE_URL} from '../config/env';
import type {RootStackParamList} from '../navigation/routes';
import {sessionStore} from '../store/sessionStore';
import {colors} from '../theme/colors';
import type {AppVersionInfo, UserProfile} from '../types/api';
import {getPlateFollowCounts} from '../utils/plateFollowStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export function ProfileScreen({navigation}: Props) {
  const insets = useSafeAreaInsets();
  const {user, setUser, clear} = sessionStore();
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [followCounts, setFollowCounts] = useState({intentCount: 0, recentCount: 0});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [next, version, counts] = await Promise.all([
        mooketApi.getUserProfile(),
        mooketApi.getAppVersion().catch(() => null),
        getPlateFollowCounts().catch(() => ({intentCount: 0, recentCount: 0})),
      ]);
      setProfile(next);
      await setUser(next);
      setVersionInfo(version);
      setFollowCounts(counts);
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function logout() {
    try {
      await mooketApi.logout().catch(() => undefined);
      await clear();
      navigation.reset({index: 0, routes: [{name: 'Login'}]});
    } catch (error) {
      Alert.alert('退出失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  async function cancelAccount() {
    try {
      await mooketApi.cancelAccount();
      await clear();
      navigation.reset({index: 0, routes: [{name: 'Login'}]});
    } catch (error) {
      Alert.alert('注销失败', error instanceof Error ? error.message : '请稍后重试');
    }
  }

  async function handleUpdate() {
    if (!versionInfo) {
      Alert.alert('提示', '当前已是最新版本');
      return;
    }

    if (Platform.OS === 'ios') {
      try {
        const supported = await Linking.canOpenURL(IOS_APP_STORE_URL);
        if (!supported) {
          Alert.alert('提示', '暂时无法打开 App Store 更新页面');
          return;
        }
        await Linking.openURL(IOS_APP_STORE_URL);
      } catch (error) {
        Alert.alert('提示', error instanceof Error ? error.message : '暂时无法打开 App Store 更新页面');
      }
      return;
    }

    setShowUpdateModal(true);
  }

  const hasUpdate = !!versionInfo?.hasUpdate && (versionInfo.versionCode ?? 0) > CURRENT_APP_VERSION_CODE;

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} topInset={insets.top} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <UserCard profile={profile} onEdit={() => navigation.navigate('EditProfile')} />

        <SectionCard>
          <MenuRow
            label="意向盘"
            value={followCounts.intentCount > 0 ? String(followCounts.intentCount) : undefined}
            onPress={() => navigation.navigate('PlateFollow', {initialTab: 'intent'})}
          />
          <MenuRow
            label="最近沟通"
            value={followCounts.recentCount > 0 ? String(followCounts.recentCount) : undefined}
            onPress={() => navigation.navigate('PlateFollow', {initialTab: 'recent'})}
            divider={false}
          />
        </SectionCard>

        <SectionCard>
          <MenuRow label="用户协议" onPress={() => Alert.alert('用户协议', '即将上线')} />
          <MenuRow label="隐私协议" onPress={() => Alert.alert('隐私协议', '即将上线')} />
          <MenuRow
            label="关于牧集"
            onPress={() => Alert.alert('关于牧集', '全球肉类供应链 B2B 商机与行情搜索平台')}
          />
          <MenuRow label="注销账号" onPress={() => setCancelDialog(true)} danger divider={false} />
        </SectionCard>

        <SectionCard>
          <MenuRow label="版本号" value={`v${CURRENT_APP_VERSION}`} chevron={false} divider={hasUpdate} />
          {hasUpdate ? (
            <Pressable style={styles.menuRow} onPress={handleUpdate}>
              <Text style={styles.menuLabel}>
                {Platform.OS === 'ios' ? '前往 App Store 更新' : '检查更新'}
              </Text>
              <View style={styles.menuValueWrap}>
                {Platform.OS === 'android' ? (
                  <Text style={styles.menuValueAccent} numberOfLines={1}>
                    发现新版本 {versionInfo?.version ?? ''}
                  </Text>
                ) : null}
                <ChevronRight />
              </View>
            </Pressable>
          ) : null}
        </SectionCard>

        <Pressable style={styles.logoutButton} onPress={() => setLogoutDialog(true)}>
          <Text style={styles.logoutText}>退出登录</Text>
        </Pressable>
      </ScrollView>

      <ConfirmDialog
        visible={logoutDialog}
        title="确认退出"
        message="确定要退出当前账号吗？"
        confirmText="退出"
        onConfirm={() => {
          setLogoutDialog(false);
          logout().catch(() => undefined);
        }}
        onCancel={() => setLogoutDialog(false)}
      />

      <ConfirmDialog
        visible={cancelDialog}
        title="确认注销"
        message="注销后将清除所有历史数据，且无法恢复。确定要注销账号吗？"
        confirmText="注销"
        danger
        onConfirm={() => {
          setCancelDialog(false);
          cancelAccount().catch(() => undefined);
        }}
        onCancel={() => setCancelDialog(false)}
      />

      {Platform.OS === 'android' && versionInfo ? (
        <UpdateModal
          visible={showUpdateModal}
          versionInfo={versionInfo}
          onClose={() => setShowUpdateModal(false)}
        />
      ) : null}
    </View>
  );
}

function Header({onBack, topInset}: {onBack: () => void; topInset: number}) {
  return (
    <View style={[headerStyles.bar, {paddingTop: topInset, minHeight: topInset + 56}]}>
      <Pressable hitSlop={8} onPress={onBack} style={headerStyles.back}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 5L8 12L15 19"
            stroke={colors.text}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      <Text style={headerStyles.title}>个人中心</Text>
      <View style={headerStyles.placeholder} />
    </View>
  );
}

function UserCard({profile, onEdit}: {profile: UserProfile | null; onEdit: () => void}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.row}>
        <View style={cardStyles.avatar}>
          {profile?.avatarUrl ? (
            <Image source={{uri: profile.avatarUrl}} style={cardStyles.avatarImage} />
          ) : (
            <Text style={cardStyles.avatarText}>{(profile?.nickname ?? '牧').slice(0, 1)}</Text>
          )}
        </View>
        <View style={cardStyles.info}>
          <View style={cardStyles.nameRow}>
            <Text style={cardStyles.name} numberOfLines={1}>
              {profile?.nickname || '未登录'}
            </Text>
            <View style={cardStyles.statusBadge}>
              <Text style={cardStyles.statusText}>{realNameStatusText(profile?.realNameStatus)}</Text>
            </View>
          </View>
          {profile?.phone ? <Text style={cardStyles.phone}>{maskPhone(profile.phone)}</Text> : null}
          {profile?.mooketNo ? <Text style={cardStyles.mooketNo}>牧集号：{profile.mooketNo}</Text> : null}
        </View>
        <Pressable style={cardStyles.editButton} onPress={onEdit}>
          <Text style={cardStyles.editText}>编辑资料</Text>
        </Pressable>
      </View>

      {profile?.identityTags && profile.identityTags.length > 0 ? (
        <View style={cardStyles.tagWrap}>
          {profile.identityTags.map(tag => (
            <View key={tag} style={cardStyles.tag}>
              <Text style={cardStyles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SectionCard({children}: {children: React.ReactNode}) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function MenuRow({
  label,
  value,
  onPress,
  chevron = true,
  divider = true,
  danger = false,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
  danger?: boolean;
}) {
  const Container = onPress ? Pressable : View;
  return (
    <>
      <Container onPress={onPress} style={styles.menuRow}>
        <Text style={[styles.menuLabel, danger && styles.dangerText]}>{label}</Text>
        <View style={styles.menuValueWrap}>
          {value ? <Text style={styles.menuValue}>{value}</Text> : null}
          {chevron ? <ChevronRight /> : null}
        </View>
      </Container>
      {divider ? <View style={styles.menuDivider} /> : null}
    </>
  );
}

function ChevronRight() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path
        d="M5 3L9 7L5 11"
        stroke="#9DA4A3"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function ConfirmDialog({
  visible,
  title,
  message,
  confirmText,
  danger,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={dialogStyles.backdrop}>
        <View style={dialogStyles.card}>
          <Text style={dialogStyles.title}>{title}</Text>
          <Text style={dialogStyles.message}>{message}</Text>
          <View style={dialogStyles.actions}>
            <Pressable style={[dialogStyles.button, dialogStyles.cancelButton]} onPress={onCancel}>
              <Text style={dialogStyles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              style={[dialogStyles.button, danger ? dialogStyles.dangerButton : dialogStyles.confirmButton]}
              onPress={onConfirm}>
              <Text style={dialogStyles.confirmTextStyle}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function realNameStatusText(status?: string | null) {
  if (status === 'verified') return '已认证';
  if (status === 'pending') return '认证中';
  return '未认证';
}

function maskPhone(phone: string) {
  if (phone.length !== 11) return phone;
  return `${phone.slice(0, 3)} **** ${phone.slice(7)}`;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {flex: 1},
  content: {padding: 16, gap: 16, paddingBottom: 48},
  sectionCard: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
  },
  menuRow: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLabel: {color: colors.text, fontSize: 14},
  menuValueWrap: {flexDirection: 'row', alignItems: 'center', gap: 6},
  menuValue: {color: '#9DA4A3', fontSize: 13},
  menuValueAccent: {color: colors.primary, fontSize: 13, fontWeight: '600', maxWidth: 200},
  menuDivider: {
    marginHorizontal: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dangerText: {color: colors.danger},
  logoutButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {color: colors.danger, fontSize: 15, fontWeight: '600'},
});

const headerStyles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {width: 24, height: 24, alignItems: 'center', justifyContent: 'center'},
  title: {flex: 1, textAlign: 'center', color: colors.text, fontSize: 18, fontWeight: '600'},
  placeholder: {width: 24},
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {width: '100%', height: '100%'},
  avatarText: {color: colors.primary, fontSize: 22, fontWeight: '700'},
  info: {flex: 1, minWidth: 0},
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  name: {color: colors.text, fontSize: 18, fontWeight: '600'},
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  statusText: {color: colors.primary, fontSize: 11, fontWeight: '600'},
  phone: {marginTop: 6, color: colors.textSecondary, fontSize: 13},
  mooketNo: {marginTop: 4, color: colors.textMuted, fontSize: 12},
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  editText: {color: colors.primary, fontSize: 12, fontWeight: '600'},
  tagWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F3F6F5',
  },
  tagText: {color: colors.textSecondary, fontSize: 12},
});

const dialogStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
  },
  title: {color: colors.text, fontSize: 18, fontWeight: '600'},
  message: {marginTop: 16, color: colors.textSecondary, fontSize: 14, textAlign: 'center'},
  actions: {marginTop: 24, flexDirection: 'row', gap: 12, alignSelf: 'stretch'},
  button: {flex: 1, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center'},
  cancelButton: {backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border},
  cancelText: {color: colors.text, fontSize: 14},
  confirmButton: {backgroundColor: colors.primary},
  dangerButton: {backgroundColor: colors.danger},
  confirmTextStyle: {color: '#FFFFFF', fontSize: 14, fontWeight: '600'},
});
