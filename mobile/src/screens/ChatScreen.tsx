import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Path, Rect} from 'react-native-svg';
import {colors} from '../theme/colors';
import type {RootStackParamList} from '../navigation/routes';
import {dialPhone} from '../utils/contact';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
type Message = {
  id: string;
  from: 'me' | 'them';
  type: 'text' | 'listing' | 'file' | 'voice' | 'account';
  text?: string;
  time: string;
  read?: boolean;
  listing?: ChatListing;
  file?: {name: string; desc: string; icon: string};
  account?: AccountOption;
};
type ChatListing = {
  id: string;
  type: '报盘' | '求购';
  productName: string;
  country: string;
  factoryNo: string;
  priceText: string;
  location: string;
  weight: string;
  tags: string;
  goodsType: string;
};
type PanelKey = 'actions' | 'listings' | 'files' | 'phrases' | 'accounts' | null;
type AccountOption = {
  type: 'wechat' | 'bank';
  title: string;
  desc: string;
  detail: string;
};

const wechatPaymentCode = require('../../assets/wechat-payment-code.jpg') as number;

const quickReplies = ['这个还有货吗？', '价格能优惠吗？', '能发实拍图吗？', '什么日期的货？', '能开票吗？', '需要多少起订？'];
const phraseTemplates = [
  '您好，我看到您在平台上发布的报盘，想了解一下详细情况，方便沟通吗？',
  '您好，我是做进口冻品的，对您这批货比较感兴趣，请问还有货吗？',
  '您好，请问这个价格是含税价吗？可以做整柜吗？',
  '您好，能发一下实拍图和最新报盘吗？我们这边有意向客户。',
  '您好，请问这个厂号的货还有多少？什么时候能到港？',
  '您好，我们长期有这类品类需求，想建立稳定合作，方便聊聊吗？',
];
const fileLibrary = [
  {name: '营业执照', desc: '企业资质 · 有效期内', icon: '企'},
  {name: '食品经营许可证', desc: '食品安全 · 有效期内', icon: '证'},
  {name: '报关单', desc: '进口报关 · 最新批次', icon: '关'},
  {name: '检验检疫报告', desc: '质检报告 · 最新批次', icon: '检'},
  {name: '冷链运输协议', desc: '物流协议 · 已签署', icon: '链'},
  {name: '产品实拍图', desc: '货品图片 · 可发送', icon: '图'},
];
const accountOptions: AccountOption[] = [
  {type: 'wechat', title: '微信收款码', desc: '推荐使用微信支付', detail: '扫码付款'},
  {type: 'bank', title: '对公账户', desc: '晟源国际贸易有限公司', detail: '1111 2222 3333 4444\n中国银行郑州科技路支行'},
];

export function ChatScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const {merchantName, contactPhone, category} = route.params;
  const merchant = clean(merchantName) || '认证商家';
  const mainListing = useMemo(() => buildListing(route.params), [route.params]);
  const peerListings = useMemo(() => buildPeerListings(mainListing, category), [category, mainListing]);
  const visibleListings = peerListings.slice(0, 3);
  const [messages, setMessages] = useState<Message[]>(() => seedMessages(merchant, mainListing, contactPhone));
  const [input, setInput] = useState('');
  const [panel, setPanel] = useState<PanelKey>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({animated: false}));
  }, [messages, panel]);

  function appendMessage(message: Omit<Message, 'id' | 'time'>) {
    setMessages(prev => [...prev, {...message, id: `${Date.now()}-${prev.length}`, time: nowTime()}]);
  }

  function sendText(text: string) {
    const value = text.trim();
    if (!value) return;
    appendMessage({from: 'me', type: 'text', text: value, read: false});
    setInput('');
    setPanel(null);
    setTimeout(() => {
      appendMessage({from: 'them', type: 'text', text: autoReply(value), read: true});
    }, 650);
  }

  function sendListing(listing: ChatListing) {
    appendMessage({from: 'me', type: 'listing', listing, read: false});
    setPanel(null);
  }

  function sendFile(file: {name: string; desc: string; icon: string}) {
    appendMessage({from: 'me', type: 'file', file, read: false});
    setPanel(null);
  }

  function sendAccount(account: AccountOption) {
    appendMessage({from: 'me', type: 'account', account, read: false});
    setPanel(null);
  }

  function handleDialPhone() {
    dialPhone(contactPhone);
  }

  function sendVoiceMessage() {
    setRecording(false);
    appendMessage({from: 'me', type: 'voice', text: '8"', read: false});
    setPanel(null);
  }

  function togglePanel(nextPanel: Exclude<PanelKey, null>) {
    setPanel(current => (current === nextPanel ? null : nextPanel));
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={[styles.header, {paddingTop: Math.max(insets.top, 10)}]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={10}>
          <ChevronLeftIcon />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{merchant}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>商家认证 · 在线沟通</Text>
        </View>
        <Pressable onPress={handleDialPhone} style={styles.contactButton}>
          <PhoneTinyIcon />
          <Text style={styles.contactText}>拨打电话</Text>
        </Pressable>
      </View>

      <View style={styles.listingStrip}>
        <View style={styles.stripLabel}>
          <BoxIcon />
          <Text style={styles.stripLabelText}>对方盘源（点击发送）</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
          {visibleListings.map(listing => (
            <Pressable key={listing.id} onPress={() => sendListing(listing)} style={styles.stripCard}>
              <Text style={styles.stripType}>{listing.type}</Text>
              <Text style={styles.stripName} numberOfLines={1}>{listing.productName}</Text>
              <Text style={styles.stripMeta} numberOfLines={1}>{listing.country}{listing.factoryNo}</Text>
              <Text style={styles.stripPrice} numberOfLines={1}>{listing.priceText}</Text>
              <View style={styles.stripSend}>
                <SendSmallIcon />
                <Text style={styles.stripSendText}>发送</Text>
              </View>
            </Pressable>
          ))}
          {peerListings.length > visibleListings.length ? (
            <Pressable onPress={() => setPanel('listings')} style={[styles.stripCard, styles.stripMoreCard]}>
              <View style={styles.stripMoreIcon}>
                <BoxIcon />
              </View>
              <Text style={styles.stripMoreTitle}>更多盘源</Text>
              <Text style={styles.stripMoreMeta}>共 {peerListings.length} 条</Text>
              <Text style={styles.stripMoreAction}>查看 ›</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <View style={styles.typing}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotMid]} />
          <View style={styles.dot} />
          <Text style={styles.typingText}>对方正在输入...</Text>
        </View>
      </ScrollView>

      {panel && panel !== 'actions' ? (
        <ChatPanel
          panel={panel}
          listings={peerListings}
          onClose={() => setPanel(null)}
          onSendListing={sendListing}
          onSendFile={sendFile}
          onSendPhrase={sendText}
          onSendAccount={sendAccount}
        />
      ) : null}
      {panel === 'actions' ? (
        <View style={styles.plusPanel}>
          {[
            {key: 'photo' as const, label: '相册'},
            {key: 'camera' as const, label: '拍摄'},
            {key: 'voiceCall' as const, label: '语音通话'},
            {key: 'videoCall' as const, label: '视频通话'},
            {key: 'files' as const, label: '文件库'},
            {key: 'phrases' as const, label: '常用语'},
            {key: 'listings' as const, label: '询报盘'},
            {key: 'accounts' as const, label: '账户信息'},
          ].map(item => (
            <Pressable
              key={item.key}
              style={styles.plusItem}
              onPress={() => {
                if (item.key === 'photo' || item.key === 'camera' || item.key === 'voiceCall' || item.key === 'videoCall') {
                  Alert.alert(item.label, '真实上传能力稍后接入');
                } else {
                  togglePanel(item.key);
                }
              }}>
              <View style={styles.plusIcon}><ChatActionIcon type={item.key} /></View>
              <Text style={styles.plusLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickReplyBar}
          contentContainerStyle={styles.quickRepliesContent}>
          <Pressable onPress={() => togglePanel('phrases')} style={[styles.quickReply, styles.quickReplyPrimary]}>
            <Text style={styles.quickReplyPrimaryText}>常用语</Text>
          </Pressable>
          {quickReplies.map(reply => (
            <Pressable key={reply} onPress={() => sendText(reply)} style={styles.quickReply}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={[styles.inputBar, {paddingBottom: Math.max(insets.bottom, 8)}]}>
        <Pressable
          onPress={() => setVoiceMode(current => !current)}
          style={styles.roundTool}>
          {voiceMode ? <KeyboardIcon /> : <VoiceIcon />}
        </Pressable>
        {voiceMode ? (
          <Pressable
            onPressIn={() => setRecording(true)}
            onPressOut={sendVoiceMessage}
            style={[styles.voiceInput, recording && styles.voiceInputRecording]}>
            <Text style={[styles.voiceInputText, recording && styles.voiceInputTextRecording]}>
              {recording ? '松开发送' : '按住 说话'}
            </Text>
          </Pressable>
        ) : (
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="输入消息..."
            placeholderTextColor="#9AA4A1"
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={() => sendText(input)}
          />
        )}
        <Pressable
          onPress={() => setPanel(current => (current === 'actions' ? null : 'actions'))}
          style={[styles.plusButton, panel === 'actions' && styles.plusButtonActive]}>
          <Text style={[styles.plusButtonText, panel === 'actions' && styles.plusButtonTextActive]}>+</Text>
        </Pressable>
        <Pressable onPress={() => sendText(input)} style={styles.sendButton}>
          <SendIcon />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({message}: {message: Message}) {
  const mine = message.from === 'me';
  if (message.type === 'listing' && message.listing) {
    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        <View style={[styles.listingMessage, mine && styles.listingMessageMine]}>
          <View style={styles.listingMessageTop}>
            <Text style={[styles.listingBadge, message.listing.type === '求购' && styles.listingBadgeInquiry]}>{message.listing.type}</Text>
            <Text style={styles.listingMessageHint}>盘源卡片</Text>
          </View>
          <Text style={styles.listingMessageTitle}>{message.listing.productName} {message.listing.country}{message.listing.factoryNo}</Text>
          <Text style={styles.listingMessageMeta}>{message.listing.location} · {message.listing.weight || '-'} · {message.listing.tags || '-'}</Text>
          <Text style={styles.listingMessagePrice}>{message.listing.priceText}</Text>
          <View style={styles.listingMessageFooter}>
            <Text style={styles.listingMessageFooterText}>点击查看详情</Text>
            <Text style={styles.listingMessageArrow}>→</Text>
          </View>
        </View>
        <MessageStatus message={message} />
      </View>
    );
  }
  if (message.type === 'file' && message.file) {
    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        <View style={[styles.fileBubble, mine && styles.bubbleMine]}>
          <View style={styles.fileIcon}><Text style={styles.fileIconText}>{message.file.icon}</Text></View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName}>{message.file.name}</Text>
            <Text style={styles.fileDesc}>{message.file.desc}</Text>
          </View>
        </View>
        <MessageStatus message={message} />
      </View>
    );
  }
  if (message.type === 'account' && message.account) {
    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        <View style={[styles.accountBubble, mine && styles.bubbleMine]}>
          <Text style={[styles.accountBubbleTitle, mine && styles.bubbleTextMine]}>{message.account.title}</Text>
          {message.account.type === 'wechat' ? (
            <Image source={wechatPaymentCode} style={styles.accountBubbleQr} resizeMode="cover" />
          ) : (
            <Text style={[styles.accountBubbleDetail, mine && styles.bubbleTextMine]}>{message.account.detail}</Text>
          )}
          <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{message.time}</Text>
        </View>
        <MessageStatus message={message} />
      </View>
    );
  }
  if (message.type === 'voice') {
    return (
      <View style={[styles.messageRow, mine && styles.messageRowMine]}>
        <View style={[styles.voiceBubble, mine && styles.voiceBubbleMine]}>
          <VoiceWaveIcon color={mine ? '#FFFFFF' : colors.primary} />
          <Text style={[styles.voiceBubbleText, mine && styles.voiceBubbleTextMine]}>{message.text || '8"'}</Text>
        </View>
        <MessageStatus message={message} />
      </View>
    );
  }
  return (
    <View style={[styles.messageRow, mine && styles.messageRowMine]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleThem]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
        <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{message.time}</Text>
      </View>
      <MessageStatus message={message} />
    </View>
  );
}

function MessageStatus({message}: {message: Message}) {
  if (message.from !== 'me') return null;
  return <Text style={styles.readState}>{message.read ? '已读' : '未读'}</Text>;
}

function ChatPanel({
  panel,
  listings,
  onClose,
  onSendListing,
  onSendFile,
  onSendPhrase,
  onSendAccount,
}: {
  panel: Exclude<PanelKey, null | 'actions'>;
  listings: ChatListing[];
  onClose: () => void;
  onSendListing: (listing: ChatListing) => void;
  onSendFile: (file: {name: string; desc: string; icon: string}) => void;
  onSendPhrase: (text: string) => void;
  onSendAccount: (account: AccountOption) => void;
}) {
  const title = panel === 'listings' ? '选择盘源发送' : panel === 'files' ? '文件库' : panel === 'accounts' ? '账户信息' : '打招呼';
  return (
    <View style={styles.chatPanel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={8}><Text style={styles.panelClose}>关闭</Text></Pressable>
      </View>
      <ScrollView style={styles.panelList}>
        {panel === 'listings'
          ? listings.map(listing => (
              <Pressable key={listing.id} onPress={() => onSendListing(listing)} style={styles.panelListing}>
                <View style={styles.panelListingInfo}>
                  <Text style={styles.panelListingTitle}>{listing.productName} {listing.factoryNo} {listing.country}</Text>
                  <Text style={styles.panelListingSub}>{listing.goodsType} {listing.weight} {listing.location}</Text>
                </View>
                <View style={styles.panelListingAction}>
                  <Text style={styles.panelListingPrice}>{listing.priceText}</Text>
                  <View style={styles.panelSendButton}>
                    <SendSmallIcon />
                    <Text style={styles.panelSendText}>发送</Text>
                  </View>
                </View>
              </Pressable>
            ))
          : null}
        {panel === 'files'
          ? fileLibrary.map(file => (
              <Pressable key={file.name} onPress={() => onSendFile(file)} style={styles.fileRow}>
                <View style={styles.fileIcon}><Text style={styles.fileIconText}>{file.icon}</Text></View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{file.name}</Text>
                  <Text style={styles.fileDesc}>{file.desc}</Text>
                </View>
                <Text style={styles.fileSend}>发送 →</Text>
              </Pressable>
            ))
          : null}
        {panel === 'phrases'
          ? phraseTemplates.map(phrase => (
              <Pressable key={phrase} onPress={() => onSendPhrase(phrase)} style={styles.phraseRow}>
                <Text style={styles.phraseText}>{phrase}</Text>
              </Pressable>
            ))
          : null}
        {panel === 'accounts' ? (
          <View style={styles.accountPanelBody}>
            {accountOptions.map(option => (
              <Pressable key={option.type} onPress={() => onSendAccount(option)} style={styles.accountChoiceCard}>
                {option.type === 'wechat' ? (
                  <Image source={wechatPaymentCode} style={styles.accountChoiceQr} resizeMode="cover" />
                ) : (
                  <View style={styles.accountChoiceBankIcon}>
                    <Text style={styles.accountChoiceBankIconText}>户</Text>
                  </View>
                )}
                <Text style={styles.accountCardTitle} numberOfLines={1}>{option.title}</Text>
                <Text style={styles.accountCardSub} numberOfLines={option.type === 'wechat' ? 1 : 2}>{option.type === 'wechat' ? option.detail : option.desc}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function buildListing(params: RootStackParamList['Chat']): ChatListing {
  const {offer} = params;
  return {
    id: String(offer.offerId ?? 'current'),
    type: '报盘',
    productName: clean(offer.productName) || '报盘',
    country: clean(offer.country),
    factoryNo: clean(offer.factoryNo),
    priceText: formatPrice(offer.price, offer.priceMax),
    location: clean(offer.goodsLocation) || clean(offer.region) || '-',
    weight: clean(offer.weight) || '-',
    tags: clean(offer.tags) || clean(offer.goodsType) || '-',
    goodsType: clean(offer.goodsType) || '-',
  };
}

function buildPeerListings(base: ChatListing, category: string): ChatListing[] {
  const product = base.productName || (category === '猪' ? '猪副' : '牛肉');
  const list = [
    base,
    {...base, id: `${base.id}-a`, productName: product, priceText: shiftPrice(base.priceText, 0.3), location: '天津', weight: '24吨', tags: '现货'},
    {...base, id: `${base.id}-b`, productName: product.includes('腩') ? '胸肉' : product, factoryNo: base.factoryNo || 'SIF504', priceText: shiftPrice(base.priceText, -0.2), location: '上海', weight: '18吨', tags: '可开票'},
    {...base, id: `${base.id}-c`, productName: product.includes('前') ? '前腱' : product, priceText: '协商', location: '青岛', weight: '整柜', tags: '可拆出'},
  ];
  return dedupeListings(list).slice(0, 8);
}

function seedMessages(merchant: string, listing: ChatListing, phone?: string | null): Message[] {
  return [
    {
      id: 'hello-1',
      from: 'them',
      type: 'text',
      text: `您好，看到您关注了我们的${listing.country}${listing.factoryNo}${listing.productName}报盘，有什么可以帮您？`,
      time: '14:20',
    },
    {
      id: 'listing-1',
      from: 'them',
      type: 'listing',
      listing,
      time: '14:21',
    },
    {
      id: 'hello-2',
      from: 'me',
      type: 'text',
      text: '你好，这批货现在还在吗？想确认一下日期和起订量。',
      time: '14:25',
      read: true,
    },
    {
      id: 'hello-3',
      from: 'them',
      type: 'text',
      text: `${merchant}这边还有货，${listing.location}现货，${phone ? '可以先线上聊，确认后再电话沟通。' : '可以先线上确认细节。'}`,
      time: '14:30',
    },
  ];
}

function formatPrice(price?: number | null, priceMax?: number | null) {
  const values = [price, priceMax].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return '协商';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${trimNumber(min)}` : `${trimNumber(min)}~${trimNumber(max)}`;
}

function shiftPrice(text: string, delta: number) {
  const value = Number(text.split('~')[0]);
  if (!Number.isFinite(value)) return text;
  return `${trimNumber(value + delta)}`;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/u, '');
}

function nowTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function clean(value?: string | null) {
  return value?.trim() ?? '';
}

function dedupeListings(listings: ChatListing[]) {
  const seen = new Set<string>();
  return listings.filter(item => {
    const key = `${item.productName}-${item.country}-${item.factoryNo}-${item.location}-${item.priceText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function autoReply(text: string) {
  if (text.includes('价格') || text.includes('优惠')) return '可以谈，您这边大概需要多少件？量大我帮您申请更低价。';
  if (text.includes('实拍') || text.includes('图片')) return '可以，我稍后发您今天仓库实拍和外箱标签。';
  if (text.includes('日期')) return '这批日期还可以，具体批次我发质检和报关资料给您确认。';
  if (text.includes('开票')) return '可以开票，票点和结算方式我们可以线上先确认。';
  return '好的，我确认一下库存和货权，稍等回复您。';
}

function ChevronLeftIcon() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function BoxIcon() {
  return <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M21 8l-9-5-9 5 9 5 9-5z" stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" /><Path d="M3 8v8l9 5 9-5V8" stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" /><Path d="M12 13v8" stroke={colors.primary} strokeWidth={2} /></Svg>;
}
function SendSmallIcon() {
  return <Svg width={11} height={11} viewBox="0 0 24 24" fill="none"><Path d="M22 2L11 13" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" /><Path d="M22 2l-7 20-4-9-9-4 20-7z" stroke={colors.primary} strokeWidth={2.2} strokeLinejoin="round" /></Svg>;
}
function SendIcon() {
  return <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"><Path d="M22 2L11 13" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" /><Path d="M22 2l-7 20-4-9-9-4 20-7z" stroke="#fff" strokeWidth={2.2} strokeLinejoin="round" /></Svg>;
}
function VoiceIcon() {
  return <Svg width={17} height={17} viewBox="0 0 24 24" fill="none"><Rect x={9} y={3} width={6} height={11} rx={3} stroke="#7A8582" strokeWidth={2} /><Path d="M5 11a7 7 0 0014 0M12 18v3" stroke="#7A8582" strokeWidth={2} strokeLinecap="round" /><Path d="M9 21h6" stroke="#7A8582" strokeWidth={2} strokeLinecap="round" /></Svg>;
}
function KeyboardIcon() {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Rect x={3} y={5} width={18} height={14} rx={2} stroke="#7A8582" strokeWidth={2} /><Path d="M7 9h.01M11 9h.01M15 9h.01M19 9h.01M7 13h.01M11 13h.01M15 13h.01M8 17h8" stroke="#7A8582" strokeWidth={2.4} strokeLinecap="round" /></Svg>;
}
function PhoneTinyIcon() {
  return <Svg width={13} height={13} viewBox="0 0 24 24" fill="none"><Path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.12.91.33 1.8.62 2.65a2 2 0 01-.45 2.11L8 9.76a16 16 0 006.24 6.24l1.28-1.28a2 2 0 012.11-.45c.85.29 1.74.5 2.65.62A2 2 0 0122 16.92z" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
function VoiceWaveIcon({color}: {color: string}) {
  return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M8 9v6M12 6v12M16 9v6" stroke={color} strokeWidth={2.2} strokeLinecap="round" /></Svg>;
}
function ChatActionIcon({type}: {type: 'listings' | 'files' | 'phrases' | 'accounts' | 'photo' | 'camera' | 'voiceCall' | 'videoCall'}) {
  const stroke = colors.primary;
  if (type === 'listings') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (type === 'files') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke={stroke} strokeWidth={2} strokeLinejoin="round" /></Svg>;
  if (type === 'phrases') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 5h16M4 10h12M4 15h9M17 14l3 3-3 3" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (type === 'photo') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x={3} y={5} width={18} height={14} rx={2} stroke={stroke} strokeWidth={2} /><Path d="M8 13l2.2-2.2L15 16M14 14l1.3-1.3L19 16" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M8 9h.01" stroke={stroke} strokeWidth={3} strokeLinecap="round" /></Svg>;
  if (type === 'camera') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2z" stroke={stroke} strokeWidth={2} strokeLinejoin="round" /><Path d="M12 17a3 3 0 100-6 3 3 0 000 6z" stroke={stroke} strokeWidth={2} /></Svg>;
  if (type === 'voiceCall') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.8 19.8 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.12.91.33 1.8.62 2.65a2 2 0 01-.45 2.11L8 9.76a16 16 0 006.24 6.24l1.28-1.28a2 2 0 012.11-.45c.85.29 1.74.5 2.65.62A2 2 0 0122 16.92z" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (type === 'videoCall') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x={3} y={6} width={13} height={12} rx={2} stroke={stroke} strokeWidth={2} /><Path d="M16 10l5-3v10l-5-3v-4z" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (type === 'accounts') return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Rect x={3} y={5} width={18} height={14} rx={3} stroke={stroke} strokeWidth={2} /><Path d="M6 10h12M7 15h5M15.5 15h1.5" stroke={stroke} strokeWidth={2} strokeLinecap="round" /></Svg>;
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M7 3h7l4 4v14H7V3z" stroke={stroke} strokeWidth={2} strokeLinejoin="round" /><Path d="M14 3v5h5M9 13h6M9 17h6" stroke={stroke} strokeWidth={2} strokeLinecap="round" /></Svg>;
}

const styles = StyleSheet.create({
  page: {flex: 1, backgroundColor: '#F5F7F8'},
  header: {minHeight: 62, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 8},
  backButton: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  headerTitleWrap: {flex: 1, minWidth: 0},
  headerTitle: {color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900'},
  headerSub: {marginTop: 1, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  contactButton: {height: 28, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 4},
  contactText: {color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  listingStrip: {backgroundColor: '#F8FAFA', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingTop: 7, paddingBottom: 8},
  stripLabel: {paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5},
  stripLabelText: {color: colors.textMuted, fontSize: 12, lineHeight: 16, fontWeight: '700'},
  stripContent: {paddingTop: 7, paddingHorizontal: 12, gap: 8},
  stripCard: {width: 118, minHeight: 94, borderRadius: 8, borderWidth: 1, borderColor: '#D9E7E4', backgroundColor: '#FFFFFF', padding: 8},
  stripType: {alignSelf: 'flex-start', paddingHorizontal: 5, height: 18, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.primaryLight, color: colors.primary, fontSize: 10, lineHeight: 18, fontWeight: '800'},
  stripName: {marginTop: 5, color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '900'},
  stripMeta: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '700'},
  stripPrice: {marginTop: 3, color: colors.price, fontSize: 14, lineHeight: 18, fontWeight: '900'},
  stripSend: {marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 3},
  stripSendText: {color: colors.primary, fontSize: 11, lineHeight: 14, fontWeight: '800'},
  stripMoreCard: {alignItems: 'center', justifyContent: 'center'},
  stripMoreIcon: {width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 6},
  stripMoreTitle: {color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '900'},
  stripMoreMeta: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  stripMoreAction: {marginTop: 5, color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  messages: {flex: 1},
  messagesContent: {padding: 12, gap: 9},
  messageRow: {alignItems: 'flex-start'},
  messageRowMine: {alignItems: 'flex-end'},
  bubble: {maxWidth: '78%', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8},
  bubbleThem: {backgroundColor: '#FFFFFF', borderTopLeftRadius: 3},
  bubbleMine: {backgroundColor: colors.primary, borderTopRightRadius: 3},
  bubbleText: {color: colors.text, fontSize: 14, lineHeight: 20},
  bubbleTextMine: {color: '#FFFFFF'},
  messageTime: {marginTop: 4, color: colors.textMuted, fontSize: 10, lineHeight: 13},
  messageTimeMine: {color: 'rgba(255,255,255,0.72)'},
  readState: {marginTop: 2, color: colors.textMuted, fontSize: 10, lineHeight: 13},
  listingMessage: {width: 260, borderRadius: 9, borderWidth: 1, borderColor: '#D8E5E2', backgroundColor: '#FFFFFF', overflow: 'hidden'},
  listingMessageMine: {borderColor: '#C8E6DF'},
  listingMessageTop: {height: 30, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F7FAF9'},
  listingBadge: {height: 18, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.primaryLight, color: colors.primary, fontSize: 10, lineHeight: 18, fontWeight: '800'},
  listingBadgeInquiry: {backgroundColor: '#FFF2D8', color: '#B67500'},
  listingMessageHint: {color: colors.textMuted, fontSize: 10, lineHeight: 14},
  listingMessageTitle: {paddingHorizontal: 10, paddingTop: 9, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900'},
  listingMessageMeta: {paddingHorizontal: 10, marginTop: 4, color: colors.textMuted, fontSize: 12, lineHeight: 16},
  listingMessagePrice: {paddingHorizontal: 10, marginTop: 5, color: colors.price, fontSize: 18, lineHeight: 23, fontWeight: '900'},
  listingMessageFooter: {marginTop: 9, height: 32, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4ECEA', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  listingMessageFooterText: {color: colors.textMuted, fontSize: 12, lineHeight: 16},
  listingMessageArrow: {color: colors.primary, fontSize: 17, lineHeight: 20, fontWeight: '800'},
  fileBubble: {maxWidth: '78%', minWidth: 210, borderRadius: 10, backgroundColor: '#FFFFFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9},
  accountBubble: {maxWidth: '72%', minWidth: 190, borderRadius: 10, backgroundColor: '#FFFFFF', padding: 10},
  accountBubbleTitle: {color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: '800'},
  accountBubbleQr: {marginTop: 8, width: 118, height: 86, borderRadius: 6, backgroundColor: '#FFFFFF'},
  accountBubbleDetail: {marginTop: 7, color: colors.textSecondary, fontSize: 13, lineHeight: 19},
  fileIcon: {width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center'},
  fileIconText: {color: colors.primary, fontSize: 13, fontWeight: '900'},
  fileInfo: {flex: 1, minWidth: 0},
  fileName: {color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '800'},
  fileDesc: {marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  voiceBubble: {minWidth: 86, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8},
  voiceBubbleMine: {backgroundColor: colors.primary},
  voiceBubbleText: {color: colors.primary, fontSize: 13, lineHeight: 17, fontWeight: '800'},
  voiceBubbleTextMine: {color: '#FFFFFF'},
  typing: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6},
  dot: {width: 4, height: 4, borderRadius: 2, backgroundColor: '#B4BDBA'},
  dotMid: {backgroundColor: '#8E9996'},
  typingText: {marginLeft: 4, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  quickReplyBar: {height: 44, maxHeight: 44, flexGrow: 0, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
  quickRepliesContent: {height: 44, paddingHorizontal: 10, paddingVertical: 8, gap: 6, alignItems: 'center'},
  quickReply: {height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F1F6F5', alignItems: 'center', justifyContent: 'center'},
  quickReplyPrimary: {backgroundColor: colors.primary},
  quickReplyText: {color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700'},
  quickReplyPrimaryText: {color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '800'},
  inputBar: {paddingTop: 8, paddingHorizontal: 10, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 7},
  roundTool: {width: 31, height: 31, borderRadius: 16, borderWidth: 1.5, borderColor: '#B6C0BD', alignItems: 'center', justifyContent: 'center'},
  input: {flex: 1, height: 36, borderRadius: 18, backgroundColor: '#F3F5F5', paddingHorizontal: 13, color: colors.text, fontSize: 14},
  voiceInput: {flex: 1, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#D1D8D6', backgroundColor: '#F8FAFA', alignItems: 'center', justifyContent: 'center'},
  voiceInputRecording: {backgroundColor: '#EAF4F2', borderColor: colors.primary},
  voiceInputText: {color: colors.textSecondary, fontSize: 14, lineHeight: 18, fontWeight: '800'},
  voiceInputTextRecording: {color: colors.primary},
  plusButton: {width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F5F5', alignItems: 'center', justifyContent: 'center'},
  plusButtonActive: {backgroundColor: colors.primary, transform: [{rotate: '45deg'}]},
  plusButtonText: {color: colors.textMuted, fontSize: 24, lineHeight: 28, fontWeight: '400'},
  plusButtonTextActive: {color: '#FFFFFF'},
  sendButton: {width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center'},
  plusPanel: {paddingHorizontal: 14, paddingVertical: 16, backgroundColor: '#F8F9FA', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, flexDirection: 'row', flexWrap: 'wrap'},
  plusItem: {width: '25%', alignItems: 'center', gap: 6, marginBottom: 16},
  plusIcon: {width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center'},
  plusLabel: {color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontWeight: '700'},
  chatPanel: {maxHeight: 360, backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
  panelHeader: {height: 42, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  panelTitle: {color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: '900'},
  panelClose: {color: colors.textMuted, fontSize: 12, lineHeight: 16},
  panelList: {maxHeight: 318},
  panelListing: {minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EEEC', flexDirection: 'row', alignItems: 'center', gap: 10},
  panelListingInfo: {flex: 1, minWidth: 0},
  panelListingTitle: {color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '800'},
  panelListingSub: {marginTop: 3, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  panelListingAction: {alignItems: 'flex-end', gap: 6},
  panelListingPrice: {color: colors.price, fontSize: 14, lineHeight: 18, fontWeight: '900'},
  panelSendButton: {height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.primaryLight, flexDirection: 'row', alignItems: 'center', gap: 3},
  panelSendText: {color: colors.primary, fontSize: 11, lineHeight: 14, fontWeight: '800'},
  fileRow: {minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EEEC', flexDirection: 'row', alignItems: 'center', gap: 10},
  fileSend: {color: colors.primary, fontSize: 12, lineHeight: 16, fontWeight: '800'},
  phraseRow: {paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EEEC'},
  phraseText: {color: colors.textSecondary, fontSize: 13, lineHeight: 19},
  accountPanelBody: {paddingHorizontal: 12, paddingVertical: 12, gap: 10, flexDirection: 'row'},
  accountChoiceCard: {flex: 1, height: 104, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DCE8E5', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 9, alignItems: 'center', justifyContent: 'center'},
  accountChoiceQr: {width: 44, height: 44, borderRadius: 4, marginBottom: 7, backgroundColor: '#F6FAF9'},
  accountChoiceBankIcon: {width: 44, height: 44, borderRadius: 8, marginBottom: 7, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center'},
  accountChoiceBankIconText: {color: colors.primary, fontSize: 16, lineHeight: 20, fontWeight: '900'},
  wechatPayCard: {borderRadius: 10, borderWidth: 1, borderColor: '#CFE8E2', backgroundColor: '#F8FCFB', padding: 12},
  accountCardHeader: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12},
  accountCardTitle: {color: colors.text, fontSize: 14, lineHeight: 18, fontWeight: '900'},
  accountCardSub: {marginTop: 3, color: colors.textMuted, fontSize: 11, lineHeight: 15},
  accountCardTag: {height: 22, paddingHorizontal: 8, borderRadius: 11, overflow: 'hidden', backgroundColor: '#E4F5EF', color: colors.primary, fontSize: 11, lineHeight: 22, fontWeight: '800'},
  wechatPayImage: {alignSelf: 'center', marginTop: 10, width: 190, height: 230, borderRadius: 8, backgroundColor: '#FFFFFF'},
  bankAccountCard: {borderRadius: 8, borderWidth: 1, borderColor: '#DCE8E5', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12},
  bankAccountName: {color: colors.textSecondary, fontSize: 14, lineHeight: 20, fontWeight: '800'},
  bankAccountNumber: {marginTop: 6, color: colors.text, fontSize: 15, lineHeight: 21, fontWeight: '900', letterSpacing: 0.2},
  bankAccountBank: {marginTop: 4, color: colors.textSecondary, fontSize: 13, lineHeight: 18},
});
