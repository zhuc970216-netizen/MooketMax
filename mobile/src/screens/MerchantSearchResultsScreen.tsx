import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SvgXml} from 'react-native-svg';
import {DetailTopBar} from '../components/detail/DetailTopBar';
import {merchantBuildingXml} from '../components/detail/productIcons';
import {SelfSelectButton, toHistoryMerchantId} from '../components/detail/SelfSelectButton';
import {OfferInquiryTabs, type OfferTab} from '../components/detail/TabAndSortBar';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import {
  buildMerchantDetailInitialFilters,
  buildMerchantSelectionFromRoute,
  getMerchantDefaultTab,
  loadMerchantSearchResults,
  type MerchantSearchResult,
  type MerchantSearchSelection,
} from '../utils/merchantSearchResults';

type Props = NativeStackScreenProps<RootStackParamList, 'MerchantSearchResults'>;
type Target = RootStackParamList['MerchantSearchResults']['target'];

export function MerchantSearchResultsScreen({navigation, route}: Props) {
  const {category, searchKeyword, tags, merchantSearch, target} = route.params;
  const [results, setResults] = useState<MerchantSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadMerchantSearchResults(merchantSearch);
      setResults(next);
    } finally {
      setLoading(false);
    }
  }, [merchantSearch]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const openSearch = useCallback(() => {
    navigation.popToTop();
    navigation.navigate('Search', {category, keyword: searchKeyword, initialTab: 'merchant'});
  }, [category, navigation, searchKeyword]);
  const handleTagClose = useCallback(
    (index: number) => {
      if (tags.length <= 1) {
        openSearch();
        return;
      }
      const nextTarget = removeMerchantSearchTargetTag(target, index);
      if (!nextTarget) {
        openSearch();
        return;
      }
      const nextSearchKeyword = getMerchantSearchKeywordFromTarget(nextTarget);
      const nextMerchantSearch = buildMerchantSelectionFromTarget(nextTarget);
      if (!nextMerchantSearch) {
        navigation.popToTop();
        navigation.navigate('Search', {category, keyword: nextSearchKeyword || searchKeyword, initialTab: 'merchant'});
        return;
      }
      navigation.replace('MerchantSearchResults', {
        category,
        searchKeyword: nextSearchKeyword || searchKeyword,
        tags: buildMerchantSearchResultTags(nextTarget, nextSearchKeyword || searchKeyword),
        merchantSearch: nextMerchantSearch,
        target: nextTarget,
      });
    },
    [category, navigation, openSearch, searchKeyword, tags.length, target],
  );

  return (
    <View style={styles.container}>
      <DetailTopBar
        onBack={() => navigation.goBack()}
        onSearchPress={openSearch}
        tags={tags.map((text, index) => ({text, onClose: () => handleTagClose(index)}))}
        topSlot={
          <OfferInquiryTabs
            tab="merchant"
            onTabChange={nextTab => navigateToTarget(navigation, target, category, searchKeyword, nextTab)}
            showMerchant
          />
        }
      />

      <FlatList
        data={results}
        keyExtractor={(item, index) => `${item.merchantId ?? item.merchantName}-${index}`}
        renderItem={({item}) => (
          <MerchantResultCard
            item={item}
            category={category}
            selection={merchantSearch}
            onPress={() => {
              if (item.merchantId == null) return;
              navigation.navigate('Merchant', {
                merchantId: item.merchantId,
                category,
                initialTab: getMerchantDefaultTab(item),
                initialCategory: 'all',
                ...buildMerchantDetailInitialFilters(merchantSearch, item),
              });
            }}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load().catch(() => undefined)} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loading} />
          ) : (
            <Text style={styles.empty}>暂无匹配商家</Text>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function navigateToTarget(
  navigation: Props['navigation'],
  target: Target,
  category: string,
  searchKeyword: string,
  initialTab: OfferTab,
) {
  switch (target.screen) {
    case 'Search':
      navigation.popToTop();
      navigation.navigate('Search', {category, keyword: target.keyword || searchKeyword, initialTab});
      return;
    case 'Merchant':
      navigation.replace('Merchant', {
        merchantId: target.merchantId,
        category,
        initialTab,
        initialCategory: 'all',
      });
      return;
    case 'Product':
      navigation.replace('Product', {
        productId: target.productId,
        productName: target.productName,
        category,
        searchKeyword,
        initialTab,
        disableTransition: true,
      });
      return;
    case 'Country':
      navigation.replace('Country', {country: target.country, category, searchKeyword, initialTab, disableTransition: true});
      return;
    case 'Factory':
      navigation.replace('Factory', {
        country: target.country,
        factoryNo: target.factoryNo,
        category,
        searchKeyword,
        initialTab,
        disableTransition: true,
      });
      return;
    case 'CountryProduct':
      navigation.replace('CountryProduct', {
        country: target.country,
        productName: target.productName,
        category,
        searchKeyword,
        initialTab,
        disableTransition: true,
      });
      return;
    case 'CountryFactoryProduct':
      navigation.replace('CountryFactoryProduct', {
        country: target.country,
        factoryNo: target.factoryNo,
        productName: target.productName,
        category,
        searchKeyword,
        initialTab,
        disableTransition: true,
      });
      return;
    case 'Brand':
      navigation.replace('Brand', {brandName: target.brandName, category, searchKeyword, initialTab, disableTransition: true});
      return;
    case 'BrandProduct':
      navigation.replace('BrandProduct', {
        brandName: target.brandName,
        productName: target.productName,
        category,
        searchKeyword,
        initialTab,
        disableTransition: true,
      });
      return;
  }
}

function removeMerchantSearchTargetTag(target: Target, index: number): Target | null {
  switch (target.screen) {
    case 'CountryFactoryProduct':
      return index === 0
        ? {screen: 'Search', keyword: target.productName}
        : {screen: 'Factory', country: target.country, factoryNo: target.factoryNo};
    case 'CountryProduct':
      return index === 0
        ? {screen: 'Search', keyword: target.productName}
        : {screen: 'Country', country: target.country};
    case 'BrandProduct':
      return index === 0
        ? {screen: 'Search', keyword: target.productName}
        : {screen: 'Brand', brandName: target.brandName};
    default:
      return null;
  }
}

function buildMerchantSelectionFromTarget(target: Target): MerchantSearchSelection | null {
  switch (target.screen) {
    case 'Search':
      return buildMerchantSelectionFromRoute({keyword: target.keyword});
    case 'Merchant':
      return buildMerchantSelectionFromRoute({keyword: String(target.merchantId), merchantId: target.merchantId});
    case 'Product':
      return buildMerchantSelectionFromRoute({keyword: target.productName, productName: target.productName});
    case 'Country':
      return buildMerchantSelectionFromRoute({keyword: target.country, country: target.country});
    case 'Factory':
      return buildMerchantSelectionFromRoute({
        keyword: `${target.country}${target.factoryNo}`,
        country: target.country,
        factoryNo: target.factoryNo,
      });
    case 'CountryProduct':
      return buildMerchantSelectionFromRoute({
        keyword: `${target.country} ${target.productName}`,
        country: target.country,
        productName: target.productName,
      });
    case 'CountryFactoryProduct':
      return buildMerchantSelectionFromRoute({
        keyword: `${target.country}${target.factoryNo} ${target.productName}`,
        country: target.country,
        factoryNo: target.factoryNo,
        productName: target.productName,
      });
    case 'Brand':
      return buildMerchantSelectionFromRoute({keyword: target.brandName, brandName: target.brandName});
    case 'BrandProduct':
      return buildMerchantSelectionFromRoute({
        keyword: `${target.brandName} ${target.productName}`,
        brandName: target.brandName,
        productName: target.productName,
      });
  }
}

function getMerchantSearchKeywordFromTarget(target: Target) {
  switch (target.screen) {
    case 'Search':
      return target.keyword;
    case 'Merchant':
      return '';
    case 'Product':
      return target.productName;
    case 'Country':
      return target.country;
    case 'Factory':
      return `${target.country}${target.factoryNo}`;
    case 'CountryProduct':
      return `${target.country} ${target.productName}`;
    case 'CountryFactoryProduct':
      return `${target.country}${target.factoryNo} ${target.productName}`;
    case 'Brand':
      return target.brandName;
    case 'BrandProduct':
      return `${target.brandName} ${target.productName}`;
  }
}

function buildMerchantSearchResultTags(target: Target, fallback: string): string[] {
  switch (target.screen) {
    case 'Search':
      return [fallback];
    case 'Merchant':
      return [fallback];
    case 'Product':
      return [target.productName];
    case 'Country':
      return [target.country];
    case 'Factory':
      return [`${target.country}${target.factoryNo}`];
    case 'CountryProduct':
      return [target.country, target.productName];
    case 'CountryFactoryProduct':
      return [`${target.country}${target.factoryNo}`, target.productName];
    case 'Brand':
      return [target.brandName];
    case 'BrandProduct':
      return [target.brandName, target.productName];
  }
}

function MerchantResultCard({
  item,
  category,
  selection,
  onPress,
}: {
  item: MerchantSearchResult;
  category: string;
  selection: MerchantSearchSelection;
  onPress: () => void;
}) {
  const displayName = item.merchantShortName || item.merchantName || '未知商家';
  const card = {
    cardType: 'merchant',
    merchantId: item.merchantId,
    merchantName: item.merchantName,
    merchantShortName: item.merchantShortName,
  };
  const payload = {
    searchWord: displayName,
    searchType: '商家',
    merchantId: toHistoryMerchantId(item.merchantId),
  };

  return (
    <Pressable onPress={onPress} style={({pressed}) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleWrap}>
          <View style={styles.iconWrap}>
            <SvgXml xml={merchantBuildingXml} width={22} height={21} />
          </View>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        </View>
        <SelfSelectButton category={category} card={card} payload={payload} />
      </View>

      <Text style={styles.meta} numberOfLines={1}>
        报盘 {item.offerCount}  求购 {item.inquiryCount}
      </Text>

      {item.samples.length > 0 ? (
        <View style={styles.sampleList}>
          {item.samples.slice(0, 3).map((sample, index) => (
            <View
              key={`${sample.type}-${sample.category}-${sample.productName}-${sample.country}-${sample.factoryNo}-${index}`}
              style={styles.sampleCard}>
              <View style={styles.sampleTopLine}>
                <View style={[styles.badge, sample.type === 'inquiry' && styles.badgeInquiry]}>
                  <Text style={[styles.badgeText, sample.type === 'inquiry' && styles.badgeTextInquiry]}>
                    {sample.type === 'offer' ? '报盘' : '求购'}
                  </Text>
                </View>
                <Text style={styles.sampleProduct} numberOfLines={1}>
                  {sample.productName?.trim() || selection.productName || '未知产品'}
                </Text>
              </View>
              <Text style={styles.sampleFactory} numberOfLines={1}>
                {buildFactoryText(sample)}
              </Text>
              {sample.type === 'offer' ? (
                <View style={styles.sampleOfferInfo}>
                  <View style={styles.samplePriceLine}>
                    {(() => {
                      const price = formatLatestOfferPrice(sample.price);
                      return (
                        <>
                          <Text style={[styles.samplePriceValue, !price.unit && styles.sampleNegotiateValue]}>
                            {price.text}
                          </Text>
                          {price.unit ? <Text style={styles.samplePriceUnit}>{price.unit}</Text> : null}
                        </>
                      );
                    })()}
                  </View>
                  <View style={styles.sampleWeightLine}>
                    <Text style={styles.sampleWeightValue}>{formatWeightNumber(sample.weight)}</Text>
                    <Text style={styles.sampleWeightUnit}>{formatWeightUnit(sample.weight)}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.more}>查看</Text>
        <Text style={styles.arrow}>›</Text>
      </View>
    </Pressable>
  );
}

function buildFactoryText(sample: {country?: string | null; factoryNo?: string | null}) {
  const country = sample.country?.trim();
  const factoryNo = sample.factoryNo?.trim();
  if (country && factoryNo) return `${country}${factoryNo}`;
  return country || factoryNo || '国家厂号不限';
}


function formatLatestOfferPrice(value: unknown): {text: string; unit: string} {
  const text = `${value ?? ''}`.trim();
  if (!text || text === '-' || text === '--') {
    return {text: '\u534F\u5546\u62A5\u4EF7', unit: ''};
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric <= 0) {
    return {text: '\u534F\u5546\u62A5\u4EF7', unit: ''};
  }

  return {text: `\u00A5${text}`, unit: '/kg'};
}

function formatWeightNumber(value: unknown): string {
  const text = `${value ?? ''}`.trim();
  if (!text) return '';
  const match = text.match(/^([\d.]+)/);
  if (match) {
    const num = Number(match[1]);
    if (Number.isFinite(num)) {
      return Number.isInteger(num) ? `${num}` : num.toFixed(1).replace(/\.0$/, '');
    }
  }
  return text;
}

function formatWeightUnit(value: unknown): string {
  const text = `${value ?? ''}`.trim();
  if (!text) return '';
  const parts = text.split(/\s+/);
  if (parts.length >= 2) return parts.slice(1).join(' ');
  return 'kg';
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 28,
  },
  loading: {
    marginTop: 40,
  },
  empty: {
    marginTop: 48,
    textAlign: 'center',
    color: '#9DA4A3',
    fontSize: 14,
  },
  card: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE9E6',
  },
  cardPressed: {
    opacity: 0.86,
  },
  cardHeader: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 22,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  meta: {
    marginTop: 4,
    marginLeft: 28,
    color: '#6C7A77',
    fontSize: 11,
    lineHeight: 16,
  },
  sampleList: {
    marginTop: 8,
    marginLeft: 28,
    flexDirection: 'row',
    gap: 8,
  },
  sampleCard: {
    width: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 58,
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 3,
    backgroundColor: '#FCFEFD',
    borderWidth: 1,
    borderColor: '#E3ECE9',
  },
  sampleTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    minWidth: 24,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: '#EAF9F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInquiry: {
    backgroundColor: '#EEF4FF',
  },
  badgeText: {
    color: colors.primary,
    fontSize: 8,
    lineHeight: 11,
  },
  badgeTextInquiry: {
    color: '#3767D6',
  },
  sampleProduct: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 11,
    lineHeight: 16,
  },
  sampleFactory: {
    marginTop: 2,
    color: '#3C4947',
    fontSize: 11,
    lineHeight: 16,
  },
  sampleOfferInfo: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  samplePriceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minWidth: 0,
    flexShrink: 1,
  },
  samplePriceValue: {
    color: colors.price,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  sampleNegotiateValue: {
    color: colors.primary,
    fontSize: 10,
    lineHeight: 16,
  },
  samplePriceUnit: {
    color: colors.text,
    fontSize: 10,
    lineHeight: 18,
    marginLeft: 1,
  },
  sampleWeightLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
  },
  sampleWeightValue: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  sampleWeightUnit: {
    color: colors.textSecondary,
    fontSize: 9,
    lineHeight: 18,
    marginLeft: 1,
  },
  footer: {
    marginTop: 6,
    minHeight: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
  },
  more: {
    color: colors.primary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  arrow: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 16,
  },
});
