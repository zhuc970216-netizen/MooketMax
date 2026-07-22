import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SvgXml} from 'react-native-svg';
import {mooketApi} from '../api/mooketApi';
import {ChevronDownIcon, DeleteIcon, HistoryIcon, SearchIcon} from '../components/common/AppIcons';
import {merchantBuildingXml} from '../components/detail/productIcons';
import type {OfferTab} from '../components/detail/TabAndSortBar';
import {SelfSelectButton, toHistoryMerchantId} from '../components/detail/SelfSelectButton';
import {ArrowLeftIcon, ClearInputIcon} from '../components/login/LoginIcons';
import type {RootStackParamList} from '../navigation/routes';
import {colors} from '../theme/colors';
import type {HomeCardItem, OfferFeedItem, SearchHistory, SearchSuggest} from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;
type SearchTab = OfferTab | 'merchant';
const categoryOptions = ['牛', '猪'] as const;
const merchantSearchCategories = ['牛', '猪'] as const;
const merchantSearchTypes = ['offer', 'inquiry'] as const;
const merchantSearchPageSize = 80;
const merchantSearchCountries = [
  '巴西',
  '乌拉圭',
  '阿根廷',
  '澳大利亚',
  '新西兰',
  '美国',
  '加拿大',
  '墨西哥',
  '智利',
  '玻利维亚',
  '俄罗斯',
  '西班牙',
  '法国',
  '英国',
  '德国',
  '爱尔兰',
  '波兰',
  '白俄罗斯',
  '日本',
  '韩国',
  '中国',
];

type MerchantSearchSample = {
  type: OfferTab;
  category?: string | null;
  productName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  publishTime?: string | null;
};

type MerchantSearchResult = {
  merchantId?: number | string | null;
  merchantName: string;
  merchantShortName?: string | null;
  offerCount: number;
  inquiryCount: number;
  samples: MerchantSearchSample[];
  factoryKeys?: string[];
  seenFeedKeys?: Set<string>;
};

type MerchantSearchCondition = {
  raw: string;
  matchType?: string | null;
  targetId?: number | string | null;
  merchantName?: string | null;
  brandName?: string | null;
  country?: string | null;
  factoryNo?: string | null;
  productName?: string | null;
};

type MerchantBrandQuery = {
  brandName: string;
  productName?: string | null;
};

type MerchantSearchSelection = {
  display: string;
  matchType: string;
  type: string;
  targetId?: number | string | null;
  country?: string | null;
  factoryNo?: string | null;
  productName?: string | null;
  brandName?: string | null;
  merchantName?: string | null;
};

type MerchantFeedParamVariant = {
  keyword?: string;
  merchantId?: number | string;
  brandName?: string;
  productName?: string;
  country?: string | null;
  factoryNo?: string | null;
};

const examples: Array<[string, string]> = [
  ['巴西', '查找国家相关信息'],
  ['SIF504', '查找厂号'],
  ['牛腱', '查找产品'],
  ['巴西 牛腱', '组合搜索'],
  ['JBS 牛腱', '品牌加产品搜索'],
  ['河南冠乐食品有限公司', '查找商家'],
];

function fireAndForget(task?: Promise<unknown>) {
  task?.catch(() => undefined);
}

function prefetchProduct(category: string, productId?: number | null) {
  if (!productId) return;
  fireAndForget(mooketApi.getProductDetail(productId, category));
}

function prefetchCountry(category: string, country?: string | null) {
  if (!country) return;
  fireAndForget(mooketApi.getCountryDetail(country, category));
}

function prefetchBrand(category: string, brandName?: string | null) {
  if (!brandName) return;
  fireAndForget(mooketApi.getBrandDetail(brandName, category));
}

function prefetchMerchant(category: string, merchantId?: number | string | null) {
  if (!merchantId) return;
  fireAndForget(mooketApi.getMerchantDetail(merchantId, category));
}

function prefetchFactory(category: string, country?: string | null, factoryNo?: string | null) {
  if (!country || !factoryNo) return;
  fireAndForget(mooketApi.getFactoryDetail(country, factoryNo, category));
}

function prefetchCountryProduct(category: string, country?: string | null, productName?: string | null) {
  if (!country || !productName) return;
  fireAndForget(mooketApi.getCountryProductDetail(country, productName, category));
}

function prefetchCountryFactoryProduct(
  category: string,
  country?: string | null,
  factoryNo?: string | null,
  productName?: string | null,
) {
  if (!country || !factoryNo || !productName) return;
  fireAndForget(mooketApi.getCountryFactoryProductDetail(country, factoryNo, productName, category));
}

function prefetchBrandProduct(category: string, brandName?: string | null, productName?: string | null) {
  if (!brandName || !productName) return;
  fireAndForget(mooketApi.getBrandProductDetail(brandName, productName, category));
}

function mergeSearchSuggestions(groups: SearchSuggest[][]): SearchSuggest[] {
  const result = new Map<string, SearchSuggest>();
  groups.flat().forEach(item => {
    const key = [
      item.matchType,
      item.targetId,
      item.text,
      item.country ?? '',
      item.factoryNo ?? '',
      item.productName ?? '',
      item.brandName ?? '',
      item.merchantName ?? '',
    ].join('|');
    const current = result.get(key);
    if (!current || item.priority < current.priority) {
      result.set(key, item);
    }
  });
  return Array.from(result.values()).sort((left, right) => left.priority - right.priority);
}

async function loadSuggestionsForInput(tab: SearchTab, category: string, value: string) {
  const countryProduct = parseCountryProductInput(value);
  const loadForCategory = async (targetCategory: string) => {
    const primary = mooketApi.getSearchSuggestions(targetCategory, value);
    if (!countryProduct) return primary;

    const [primaryItems, productItems] = await Promise.all([
      primary,
      mooketApi.getSearchSuggestions(targetCategory, countryProduct.productKeyword),
    ]);
    return mergeSearchSuggestions([
      buildCountryProductSuggestions(countryProduct.country, countryProduct.productKeyword, productItems),
      primaryItems,
    ]);
  };

  if (tab === 'merchant') {
    return Promise.all(merchantSearchCategories.map(loadForCategory)).then(mergeSearchSuggestions);
  }
  return loadForCategory(category);
}

function parseCountryProductInput(value: string) {
  const compact = getStandardSearchWord(value).replace(/\s+/g, '');
  const country = [...merchantSearchCountries]
    .sort((left, right) => right.length - left.length)
    .find(item => compact.startsWith(item));
  if (!country) return null;

  const productKeyword = compact.slice(country.length).trim();
  if (!productKeyword || /\d/.test(productKeyword)) return null;
  return {country, productKeyword};
}

function buildCountryProductSuggestions(
  country: string,
  productKeyword: string,
  productItems: SearchSuggest[],
): SearchSuggest[] {
  return productItems
    .filter(item => item.matchType === 'product')
    .flatMap(item => {
      const productName =
        item.productName ??
        item.standardName ??
        getProductFromSuggestion(item, getStandardSearchWord(item.text).split(/\s+/).filter(Boolean));
      if (!productName || !normalizeSearchComparable(productName).includes(normalizeSearchComparable(productKeyword))) {
        return [];
      }
      const suggestion: SearchSuggest = {
        ...item,
        text: `${country} ${productName}`,
        keyword: `${country}${productKeyword}`,
        type: '国家+产品',
        matchType: 'combined',
        country,
        factoryNo: null,
        productName,
        priority: item.priority - 1,
      };
      return [suggestion];
    });
}

export function SearchScreen({route, navigation}: Props) {
  const {category, keyword: routeKeyword, initialTab: routeInitialTab} = route.params;
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<(typeof categoryOptions)[number]>(
    categoryOptions.includes(category as (typeof categoryOptions)[number])
      ? (category as (typeof categoryOptions)[number])
      : '牛',
  );
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [keyword, setKeyword] = useState(routeKeyword ?? '');
  const [selectedTab, setSelectedTab] = useState<SearchTab>(routeInitialTab ?? 'offer');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggest[]>([]);
  const [merchantSelection, setMerchantSelection] = useState<MerchantSearchSelection | null>(null);
  const [merchantResults, setMerchantResults] = useState<MerchantSearchResult[]>([]);
  const [merchantLoading, setMerchantLoading] = useState(false);
  const [histories, setHistories] = useState<SearchHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const suggestionSearchSeqRef = useRef(0);
  const merchantSearchSeqRef = useRef(0);

  const activeMerchantSelection = selectedTab === 'merchant' ? merchantSelection : null;

  const loadHistories = useCallback(async () => {
    try {
      const next = await mooketApi.getRecentSearches(12);
      setHistories(next);
    } catch {
      setHistories([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistories().catch(() => undefined);
    }, [loadHistories]),
  );

  useEffect(() => {
    setKeyword(routeKeyword ?? '');
  }, [routeKeyword]);

  useEffect(() => {
    if (routeInitialTab) {
      setSelectedTab(routeInitialTab);
    }
  }, [routeInitialTab]);

  useEffect(() => {
    if (categoryOptions.includes(category as (typeof categoryOptions)[number])) {
      setSelectedCategory(category as (typeof categoryOptions)[number]);
    }
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      const value = keyword.trim();
      const requestSeq = (suggestionSearchSeqRef.current += 1);
      if (!value) {
        setSuggestions([]);
        setLoading(false);
        return undefined;
      }

      setLoading(true);
      const timer = setTimeout(() => {
        const request = loadSuggestionsForInput(selectedTab, selectedCategory, value);

        request
          .then(result => {
            if (requestSeq !== suggestionSearchSeqRef.current) return;
            setSuggestions(result);
            setLoading(false);
          })
          .catch(() => {
            if (requestSeq !== suggestionSearchSeqRef.current) return;
            setSuggestions([]);
            setLoading(false);
          });
      }, 250);

      return () => clearTimeout(timer);
    }, [selectedCategory, keyword, selectedTab]),
  );

  useEffect(() => {
    if (selectedTab !== 'merchant' || !activeMerchantSelection) {
      merchantSearchSeqRef.current += 1;
      setMerchantResults([]);
      setMerchantLoading(false);
      return undefined;
    }

    const requestSeq = (merchantSearchSeqRef.current += 1);
    setMerchantLoading(true);
    const timer = setTimeout(() => {
      loadMerchantSearchResults(activeMerchantSelection)
        .then(result => {
          if (requestSeq !== merchantSearchSeqRef.current) return;
          setMerchantResults(result);
          setMerchantLoading(false);
        })
        .catch(() => {
          if (requestSeq !== merchantSearchSeqRef.current) return;
          setMerchantResults([]);
          setMerchantLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [activeMerchantSelection, selectedTab]);

  const historyEntries = useMemo(
    () => uniqueBySearchWord(histories.filter(item => item.searchWord)),
    [histories],
  );

  function handleSelect(item: SearchSuggest) {
    Keyboard.dismiss();
    const parts = item.text.split(/\s+/).filter(Boolean);
    const hasCountry = ['country', 'factory', 'combined'].includes(item.matchType) || item.type.includes('国家');
    const hasFactory = ['factory', 'combined'].includes(item.matchType) || item.type.includes('厂号');
    const country = item.country ?? (hasCountry ? getCountryFromText(parts[0]) : null);
    const factoryNo = item.factoryNo ?? (hasFactory ? getFactoryFromText(parts[1]) : null);
    const productName = item.productName ?? getProductFromSuggestion(item, parts);
    const brandName = item.brandName ?? getBrandFromSuggestion(item, parts);
    fireAndForget(
      mooketApi
        .saveSearchHistory({
          searchWord: item.text,
          searchType: item.type,
          productId: item.matchType === 'product' ? item.targetId : null,
          productName,
          country: ['country', 'factory', 'combined'].includes(item.matchType) ? country : null,
          factoryNo: ['factory', 'combined'].includes(item.matchType) ? factoryNo : null,
          brandId: item.matchType === 'brand' ? item.targetId : null,
          merchantId: item.matchType === 'merchant' ? item.targetId : null,
        })
        .then(loadHistories),
    );

    if (selectedTab === 'merchant') {
      const display = getStandardSearchWord(item.text);
      const target = buildMerchantSearchTarget(item, parts, {country, factoryNo, productName, brandName});
      const merchantSearch = {
        display,
        matchType: item.matchType,
        type: item.type,
        targetId: item.targetId,
        country,
        factoryNo,
        productName,
        brandName,
        merchantName: item.matchType === 'merchant' ? item.merchantName ?? item.standardName ?? display : null,
      };
      navigation.navigate('MerchantSearchResults', {
        category: selectedCategory,
        searchKeyword: display,
        tags: buildMerchantSearchTags(target, display),
        merchantSearch,
        target,
      });
      return;
    }

    navigateSuggestion(item, parts, {country, factoryNo, productName, brandName});
  }

  async function handleHistorySelect(history: SearchHistory) {
    Keyboard.dismiss();
    const searchWord = getStandardSearchWord(history.searchWord);
    if (!searchWord) return;
    const detailTab = selectedTab === 'merchant' ? 'offer' : selectedTab;

    if (history.merchantId) {
      prefetchMerchant(selectedCategory, history.merchantId);
      navigation.navigate('Merchant', {
        merchantId: history.merchantId,
        category: selectedCategory,
        initialTab: detailTab,
        initialCategory: 'all',
      });
      return;
    }

    const historyBrandProduct = parseHistoryBrandProduct(history, searchWord);
    if (historyBrandProduct && selectedTab !== 'merchant') {
      prefetchBrandProduct(selectedCategory, historyBrandProduct.brandName, historyBrandProduct.productName);
      navigation.navigate('BrandProduct', {
        brandName: historyBrandProduct.brandName,
        productName: historyBrandProduct.productName,
        category: selectedCategory,
        searchKeyword: searchWord,
        initialTab: detailTab,
      });
      return;
    }

    if (selectedTab === 'merchant') {
      navigateHistoryToMerchantResults(history, searchWord);
      return;
    }

    const historyCountry = history.country ?? null;
    const historyFactoryNo = history.factoryNo ?? null;
    const historyProductName = history.productName ?? null;

    if (historyCountry && historyFactoryNo && historyProductName) {
      prefetchCountryFactoryProduct(selectedCategory, historyCountry, historyFactoryNo, historyProductName);
      navigation.navigate('CountryFactoryProduct', {
        country: historyCountry,
        factoryNo: historyFactoryNo,
        productName: historyProductName,
        category: selectedCategory,
        searchKeyword: searchWord,
        initialTab: detailTab,
      });
      return;
    }

    if (historyCountry && historyProductName) {
      prefetchCountryProduct(selectedCategory, historyCountry, historyProductName);
      navigation.navigate('CountryProduct', {
        country: historyCountry,
        productName: historyProductName,
        category: selectedCategory,
        searchKeyword: searchWord,
        initialTab: detailTab,
      });
      return;
    }

    if (historyCountry && historyFactoryNo) {
      prefetchFactory(selectedCategory, historyCountry, historyFactoryNo);
      navigation.navigate('Factory', {
        country: historyCountry,
        factoryNo: historyFactoryNo,
        category: selectedCategory,
        searchKeyword: searchWord,
        initialTab: detailTab,
      });
      return;
    }

    if (history.productId) {
      prefetchProduct(selectedCategory, history.productId);
      navigation.navigate('Product', {
        productId: history.productId,
        category: selectedCategory,
        productName: history.productName ?? searchWord,
        searchKeyword: searchWord,
        initialTab: detailTab,
      });
      return;
    }

    if (history.brandId) {
      prefetchBrand(selectedCategory, searchWord);
      navigation.navigate('Brand', {
        brandName: searchWord,
        category: selectedCategory,
        searchKeyword: searchWord,
        initialTab: detailTab,
      });
      return;
    }

    if (historyCountry) {
      prefetchCountry(selectedCategory, historyCountry);
      navigation.navigate('Country', {
        country: historyCountry,
        category: selectedCategory,
        searchKeyword: searchWord,
        initialTab: detailTab,
      });
      return;
    }

    try {
      const historySuggestions = await loadSuggestionsForInput(selectedTab, selectedCategory, searchWord);
      const bestSuggestion = findExactHistorySuggestion(historySuggestions, searchWord);
      if (bestSuggestion) {
        handleSelect(bestSuggestion);
        return;
      }
    } catch {
      // Fall through to the no-match hint below.
    }

    Alert.alert('暂无匹配结果', '这个历史搜索词暂时没有可进入的结果页');
  }

  function navigateHistoryToMerchantResults(history: SearchHistory, searchWord: string) {
    const merchantSearch = buildMerchantSearchSelectionFromHistory(history, searchWord);
    const target = buildMerchantSearchTargetFromHistory(history, searchWord);
    navigation.navigate('MerchantSearchResults', {
      category: selectedCategory,
      searchKeyword: searchWord,
      tags: buildMerchantSearchTags(target, searchWord),
      merchantSearch,
      target,
    });
  }

  function navigateSuggestion(
    item: SearchSuggest,
    parts: string[],
    standard: {
      country?: string | null;
      factoryNo?: string | null;
      productName?: string | null;
      brandName?: string | null;
    },
  ) {
    const detailTab = selectedTab === 'merchant' ? 'offer' : selectedTab;

    switch (item.matchType) {
      case 'merchant':
        prefetchMerchant(selectedCategory, item.targetId);
        navigation.navigate('Merchant', {
          merchantId: item.targetId,
          category: selectedCategory,
          initialTab: detailTab,
          initialCategory: 'all',
        });
        return;
      case 'product':
        prefetchProduct(selectedCategory, item.targetId);
        navigation.navigate('Product', {
          productId: item.targetId,
          category: selectedCategory,
          productName: standard.productName ?? item.text,
          searchKeyword: item.text,
          initialTab: detailTab,
        });
        return;
      case 'country':
        prefetchCountry(selectedCategory, standard.country ?? getStandardSearchWord(item.text));
        navigation.navigate('Country', {
          country: standard.country ?? getStandardSearchWord(item.text),
          category: selectedCategory,
          searchKeyword: item.text,
          initialTab: detailTab,
        });
        return;
      case 'brand':
        if (item.type === '品牌+产品' && (standard.brandName || parts.length >= 2)) {
          prefetchBrandProduct(selectedCategory, standard.brandName ?? parts[0], standard.productName ?? parts.slice(1).join(' '));
          navigation.navigate('BrandProduct', {
            brandName: standard.brandName ?? parts[0],
            productName: standard.productName ?? parts.slice(1).join(' '),
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        } else {
          prefetchBrand(selectedCategory, standard.brandName ?? getStandardSearchWord(item.text));
          navigation.navigate('Brand', {
            brandName: standard.brandName ?? getStandardSearchWord(item.text),
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        }
        return;
      case 'factory':
        if (standard.country && standard.factoryNo) {
          prefetchFactory(selectedCategory, standard.country, standard.factoryNo);
          navigation.navigate('Factory', {
            country: standard.country,
            factoryNo: standard.factoryNo,
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        } else if (parts.length >= 2) {
          prefetchFactory(selectedCategory, getCountryFromText(parts[0]), parts[1]);
          navigation.navigate('Factory', {
            country: getCountryFromText(parts[0]),
            factoryNo: parts[1],
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        }
        return;
      case 'combined':
        if (item.type === '国家+产品' && (standard.country || parts.length >= 2)) {
          prefetchCountryProduct(selectedCategory, standard.country ?? getCountryFromText(parts[0]), standard.productName ?? parts.slice(1).join(' '));
          navigation.navigate('CountryProduct', {
            country: standard.country ?? getCountryFromText(parts[0]),
            productName: standard.productName ?? parts.slice(1).join(' '),
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        } else if (standard.country && standard.factoryNo && standard.productName) {
          prefetchCountryFactoryProduct(selectedCategory, standard.country, standard.factoryNo, standard.productName);
          navigation.navigate('CountryFactoryProduct', {
            country: standard.country,
            factoryNo: standard.factoryNo,
            productName: standard.productName,
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        } else if (parts.length >= 3) {
          prefetchCountryFactoryProduct(selectedCategory, getCountryFromText(parts[0]), parts[1], parts.slice(2).join(' '));
          navigation.navigate('CountryFactoryProduct', {
            country: getCountryFromText(parts[0]),
            factoryNo: parts[1],
            productName: parts.slice(2).join(' '),
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        }
        return;
      default:
        if (item.type === '国家+产品' && parts.length >= 2) {
          prefetchCountryProduct(selectedCategory, standard.country ?? getCountryFromText(parts[0]), standard.productName ?? parts.slice(1).join(' '));
          navigation.navigate('CountryProduct', {
            country: standard.country ?? getCountryFromText(parts[0]),
            productName: standard.productName ?? parts.slice(1).join(' '),
            category: selectedCategory,
            searchKeyword: item.text,
            initialTab: detailTab,
          });
        }
    }
  }

  async function clearHistories() {
    const ids = histories.map(item => item.historyId).filter((id): id is number => Number.isFinite(id));
    if (ids.length === 0) {
      setHistories([]);
      return;
    }
    try {
      await mooketApi.batchDeleteSearchHistory(ids);
      setHistories([]);
    } catch {
      Alert.alert('清除失败', '请稍后重试');
    }
  }

  function confirmClearHistories() {
    if (histories.length === 0) return;
    Alert.alert('清除全部', '确定清除最近搜索记录吗？', [
      {text: '取消', style: 'cancel'},
      {text: '清除', style: 'destructive', onPress: () => clearHistories().catch(() => undefined)},
    ]);
  }

  function clearMerchantSelection() {
    setKeyword('');
    setMerchantSelection(null);
    setSuggestions([]);
    setMerchantResults([]);
    setCategoryMenuOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, {paddingTop: insets.top + 8}]}>
        <View style={styles.topTabRow}>
          <Pressable hitSlop={8} onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeftIcon size={18} />
          </Pressable>
          <SearchModeTabs tab={selectedTab} onTabChange={setSelectedTab} />
          <View style={styles.topRightSpacer} />
        </View>
        <View style={styles.searchInputWrap}>
          {selectedTab !== 'merchant' ? (
            <>
              <Pressable onPress={() => setCategoryMenuOpen(prev => !prev)} style={styles.categoryButton}>
                <Text style={styles.categoryText}>{selectedCategory}</Text>
                <ChevronDownIcon size={14} color="#3C4947" />
              </Pressable>
              <View style={styles.searchDivider} />
            </>
          ) : null}
          {activeMerchantSelection ? (
            <>
              <View style={styles.selectedSearchChip}>
                <Text style={styles.selectedSearchChipText} numberOfLines={1}>
                  {activeMerchantSelection.display}
                </Text>
                <Pressable hitSlop={8} onPress={clearMerchantSelection} style={styles.selectedSearchChipClose}>
                  <Text style={styles.selectedSearchChipCloseText}>×</Text>
                </Pressable>
              </View>
              <View style={styles.inputSpacer} />
              <SearchIcon size={16} color="#ADB7B5" />
            </>
          ) : (
            <>
              {!isInputFocused ? <SearchIcon size={16} color="#ADB7B5" /> : null}
          <TextInput
            ref={inputRef}
            autoFocus
            value={keyword}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onChangeText={text => {
              setKeyword(text);
              setMerchantSelection(null);
              setCategoryMenuOpen(false);
            }}
            placeholder={selectedTab === 'merchant' ? '搜索商家、产品、国家厂号' : '搜索国家、厂号、产品、商家、品牌'}
            placeholderTextColor="#ADB7B5"
            style={[styles.input, isInputFocused && styles.inputFocused]}
          />
          {keyword.length > 0 ? (
            <Pressable
              hitSlop={8}
              onPress={() => {
                setKeyword('');
                setMerchantSelection(null);
              }}
              style={styles.inputClear}>
              <ClearInputIcon size={16} />
            </Pressable>
          ) : null}
            </>
          )}
        </View>
      </View>

      {categoryMenuOpen && selectedTab !== 'merchant' ? (
        <>
          <Pressable style={styles.categoryMenuBackdrop} onPress={() => setCategoryMenuOpen(false)} />
          <View style={[styles.categoryMenu, {top: insets.top + 92}]}>
            {categoryOptions.map(item => (
              <Pressable
                key={item}
                onPress={() => {
                  setSelectedCategory(item);
                  setCategoryMenuOpen(false);
                  setSuggestions([]);
                }}
                style={[styles.categoryMenuItem, item === selectedCategory && styles.categoryMenuItemActive]}>
                <Text style={[styles.categoryMenuText, item === selectedCategory && styles.categoryMenuTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {keyword.trim() ? (
        <View style={styles.resultContent}>
          {selectedTab === 'merchant' && activeMerchantSelection ? (
            <FlatList
              data={merchantResults}
              keyExtractor={(item, index) => `${item.merchantId ?? item.merchantName}-${index}`}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.merchantResultList}
              renderItem={({item}) => (
                <MerchantSearchResultItem
                  item={item}
                  category={selectedCategory}
                  onPress={() => {
                    if (item.merchantId == null) return;
                    navigation.navigate('Merchant', {
                      merchantId: item.merchantId,
                      category: selectedCategory,
                      initialTab: getMerchantDefaultTab(item),
                      initialCategory: 'all',
                      ...buildMerchantDetailInitialFilters(activeMerchantSelection, item),
                    });
                  }}
                />
              )}
              ListEmptyComponent={
                merchantLoading ? (
                  <ActivityIndicator color={colors.primary} style={styles.loading} />
                ) : (
                  <Text style={styles.empty}>暂未找到包含“{keyword.trim()}”的商家</Text>
                )
              }
            />
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item, index) => `${item.type}-${item.targetId}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({item}) => (
                <SuggestionItem item={item} keyword={keyword} onPress={() => handleSelect(item)} />
              )}
              ListEmptyComponent={
                loading ? (
                  <Text style={styles.loadingText}>搜索中...</Text>
                ) : (
                  <Text style={styles.empty}>当前'{selectedCategory}'大类下暂未找到相关内容</Text>
                )
              }
            />
          )}
        </View>
      ) : (
        <FlatList
          data={historyEntries}
          keyExtractor={(item, index) => `${item.searchWord}-${index}`}
          keyboardShouldPersistTaps="always"
          ListHeaderComponent={
            <View>
              {historyEntries.length > 0 ? (
                <>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>最近搜索</Text>
                    <Pressable style={styles.clearAllWrap} onPress={confirmClearHistories}>
                      <Text style={styles.clearAllText}>清除全部</Text>
                      <DeleteIcon />
                    </Pressable>
                  </View>
                  <View style={styles.historyWrap}>
                    {historyEntries.map((item, index) => (
                      <Pressable
                        key={`${item.searchWord}-${index}`}
                        onPress={() => handleHistorySelect(item)}
                        style={styles.historyChip}>
                        <HistoryIcon />
                        <Text style={styles.historyChipText} numberOfLines={1}>
                          {item.searchWord}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              <View style={styles.helperWrap}>
                <Text style={styles.helperTitle}>
                  输入<Text style={styles.helperKeyword}>关键词</Text>开始搜索
                </Text>
                <Text style={styles.helperDesc}>支持搜索国家、厂号、产品、商家、品牌</Text>
              </View>

              <View style={styles.examplesWrap}>
                <Text style={styles.examplesTitle}>搜索示例</Text>
                {examples.map(([word, desc]) => (
                  <View key={word} style={styles.exampleRow}>
                    <SearchIcon size={14} color="#171D1C" />
                    <View style={styles.exampleDivider} />
                    <Text style={styles.exampleWord}>{word}</Text>
                    <Text style={styles.exampleDesc}>- {desc}</Text>
                  </View>
                ))}
              </View>
            </View>
          }
          renderItem={() => null}
        />
      )}
    </View>
  );
}

function SearchModeTabs({
  tab,
  onTabChange,
}: {
  tab: SearchTab;
  onTabChange: (next: SearchTab) => void;
}) {
  return (
    <View style={styles.searchTabs}>
      {(['offer', 'inquiry', 'merchant'] as const).map(item => (
        <Pressable key={item} onPress={() => onTabChange(item)} style={styles.searchTabItem}>
          <Text style={[styles.searchTabText, tab === item && styles.searchTabTextActive]}>
            {item === 'offer' ? '报盘' : item === 'inquiry' ? '求购' : '商家'}
          </Text>
          <View style={[styles.searchTabLine, tab === item && styles.searchTabLineActive]} />
        </Pressable>
      ))}
    </View>
  );
}

function MerchantSearchResultItem({
  item,
  category,
  onPress,
}: {
  item: MerchantSearchResult;
  category: string;
  onPress: () => void;
}) {
  const displayName = item.merchantShortName || item.merchantName || '未知商家';
  const card: HomeCardItem = {
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
    <Pressable onPress={onPress} style={({pressed}) => [styles.merchantResultCard, pressed && styles.merchantResultPressed]}>
      <View style={styles.merchantResultHeader}>
        <View style={styles.merchantResultTitleWrap}>
          <View style={styles.merchantResultIcon}>
            <SvgXml xml={merchantBuildingXml} width={22} height={21} />
          </View>
          <Text style={styles.merchantResultName} numberOfLines={1}>{displayName}</Text>
        </View>
        <SelfSelectButton category={category} card={card} payload={payload} />
      </View>

      <Text style={styles.merchantResultMeta} numberOfLines={1}>
        报盘 {item.offerCount}  求购 {item.inquiryCount}
      </Text>

      {item.samples.length > 0 ? (
        <View style={styles.merchantSampleList}>
          {item.samples.slice(0, 3).map((sample, index) => (
            <View key={`${sample.type}-${sample.category}-${sample.productName}-${sample.country}-${sample.factoryNo}-${index}`} style={styles.merchantSampleCard}>
              <View style={styles.merchantSampleTopLine}>
                <View style={[styles.merchantSampleBadge, sample.type === 'inquiry' && styles.merchantSampleBadgeInquiry]}>
                  <Text style={[styles.merchantSampleBadgeText, sample.type === 'inquiry' && styles.merchantSampleBadgeTextInquiry]}>
                    {sample.type === 'offer' ? '报盘' : '求购'}
                  </Text>
                </View>
                <Text style={styles.merchantSampleProduct} numberOfLines={1}>
                  {sample.productName?.trim() || '未知产品'}
                </Text>
              </View>
              <Text style={styles.merchantSampleFactory} numberOfLines={1}>
                {buildMerchantSampleFactoryText(sample)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.merchantResultFooter}>
        <Text style={styles.merchantResultMore}>查看</Text>
        <Text style={styles.merchantResultArrow}>›</Text>
      </View>
    </Pressable>
  );
}

async function loadMerchantSearchResults(selection: MerchantSearchSelection): Promise<MerchantSearchResult[]> {
  const condition = buildMerchantSearchConditionFromSelection(selection);
  if (!condition.raw) return [];

  const map = new Map<string, MerchantSearchResult>();
  const feedTasks = merchantSearchCategories.flatMap(category =>
    merchantSearchTypes.map(type => ({category, type})),
  );
  const paramVariants = buildMerchantFeedParamVariants(condition);

  const feedResponses = await Promise.allSettled(
    feedTasks.flatMap(task =>
      paramVariants.map(params =>
        mooketApi
          .getOfferFeed({
            category: task.category,
            type: task.type,
            ...params,
            page: 1,
            pageSize: merchantSearchPageSize,
            sortBy: 'publish_time',
            skipCache: true,
          })
          .then(page => ({...task, params, items: page.items ?? []})),
      ),
    ),
  );

  feedResponses.forEach(response => {
    if (response.status !== 'fulfilled') return;
    const isStructuredResponse = Boolean(
      response.value.params.merchantId ||
        response.value.params.brandName ||
        response.value.params.productName ||
        response.value.params.country ||
        response.value.params.factoryNo,
    );
    response.value.items
      .filter(item => isStructuredResponse || merchantFeedItemMatchesCondition(item, condition))
      .forEach(item => addMerchantFeedItem(map, item, response.value.type, response.value.category));
  });

  if (condition.matchType === 'merchant' && map.size === 0) {
    addMerchantSuggestion(map, {
      text: condition.merchantName || condition.raw,
      keyword: condition.raw,
      type: '商家',
      priority: 0,
      targetId: Number(condition.targetId) || 0,
      matchType: 'merchant',
      merchantName: condition.merchantName || condition.raw,
      standardName: condition.merchantName || condition.raw,
    });
  }

  return Array.from(map.values()).sort((left, right) => {
    const rightTime = getMerchantLatestTime(right);
    const leftTime = getMerchantLatestTime(left);
    if (rightTime !== leftTime) return rightTime - leftTime;
    const rightScore = right.offerCount + right.inquiryCount;
    const leftScore = left.offerCount + left.inquiryCount;
    return rightScore - leftScore;
  });
}

function buildMerchantSearchConditionFromSelection(selection: MerchantSearchSelection): MerchantSearchCondition {
  const raw = getStandardSearchWord(selection.display || '').trim();
  const parsed = buildMerchantSearchCondition(raw);
  const condition: MerchantSearchCondition = {
    ...parsed,
    raw,
    matchType: selection.matchType,
    targetId: selection.targetId,
    merchantName: selection.merchantName,
    brandName: selection.brandName ?? parsed.brandName ?? null,
    country: selection.country ?? parsed.country ?? null,
    factoryNo: selection.factoryNo ?? parsed.factoryNo ?? null,
    productName: selection.productName ?? parsed.productName ?? null,
  };

  if (selection.matchType === 'product') {
    condition.productName = selection.productName ?? raw;
  }
  if (selection.matchType === 'country') {
    condition.country = selection.country ?? raw;
    condition.productName = null;
  }
  if (selection.matchType === 'brand') {
    condition.brandName = selection.brandName ?? getBrandFromSuggestion(
      {
        text: raw,
        keyword: raw,
        type: selection.type,
        priority: 0,
        targetId: Number(selection.targetId) || 0,
        matchType: 'brand',
      },
      raw.split(/\s+/).filter(Boolean),
    ) ?? raw.split(/\s+/)[0];
  }

  return condition;
}

function buildMerchantFeedKeyword(condition: MerchantSearchCondition) {
  if (condition.matchType === 'merchant') {
    return condition.merchantName || condition.raw;
  }
  if (condition.matchType === 'merchant' || condition.brandName || condition.productName || condition.country || condition.factoryNo) {
    return undefined;
  }
  return condition.raw;
}

function buildMerchantFeedParamVariants(condition: MerchantSearchCondition): MerchantFeedParamVariant[] {
  const map = new Map<string, MerchantFeedParamVariant>();
  const add = (params: MerchantFeedParamVariant) => {
    const cleanParams: MerchantFeedParamVariant = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        (cleanParams as Record<string, string | number>)[key] = value as string | number;
      }
    });
    if (Object.keys(cleanParams).length === 0) return;
    const key = Object.entries(cleanParams)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([itemKey, value]) => `${itemKey}:${String(value)}`)
      .join('|');
    if (!map.has(key)) map.set(key, cleanParams);
  };

  const keyword = buildMerchantFeedKeyword(condition);
  if (condition.matchType === 'merchant') {
    add({merchantId: condition.targetId ?? undefined});
    add({keyword});
  } else {
    add({
      brandName: condition.brandName ?? undefined,
      productName: condition.productName ?? undefined,
      country: condition.country,
      factoryNo: condition.factoryNo,
    });
    add({keyword});
  }

  if (!condition.brandName && !condition.productName && !condition.country && !condition.factoryNo) {
    add({productName: condition.raw});
    if (looksLikeBrandKeyword(condition.raw)) {
      add({brandName: condition.raw});
    }
    if (looksLikeFactoryNo(condition.raw)) {
      add({factoryNo: condition.raw});
    }
  }

  return Array.from(map.values());
}

function buildMerchantSearchTarget(
  item: SearchSuggest,
  parts: string[],
  standard: {
    country?: string | null;
    factoryNo?: string | null;
    productName?: string | null;
    brandName?: string | null;
  },
): RootStackParamList['MerchantSearchResults']['target'] {
  const display = getStandardSearchWord(item.text);
  const countryValue = standard.country ?? getCountryFromText(parts[0]);
  const factoryValue = standard.factoryNo ?? getFactoryFromText(parts[1]);
  const productValue = standard.productName ?? getProductFromSuggestion(item, parts) ?? display;
  const brandValue = standard.brandName ?? getBrandFromSuggestion(item, parts) ?? display;

  switch (item.matchType) {
    case 'merchant':
      return item.targetId == null
        ? {screen: 'Search', keyword: display}
        : {screen: 'Merchant', merchantId: item.targetId};
    case 'product': {
      const productId = toNumericId(item.targetId);
      return productId == null
        ? {screen: 'Search', keyword: display}
        : {
            screen: 'Product',
            productId,
            productName: productValue,
          };
    }
    case 'country':
      return {screen: 'Country', country: countryValue || display};
    case 'factory':
      if (countryValue && factoryValue) {
        return {screen: 'Factory', country: countryValue, factoryNo: factoryValue};
      }
      return {screen: 'Search', keyword: display};
    case 'brand':
      if (item.type === '品牌+产品' && (standard.brandName || parts.length >= 2)) {
        return {
          screen: 'BrandProduct',
          brandName: brandValue,
          productName: productValue,
        };
      }
      return {screen: 'Brand', brandName: brandValue};
    case 'combined':
      if (item.type === '国家+产品' && (countryValue || parts.length >= 2)) {
        return {
          screen: 'CountryProduct',
          country: countryValue || getCountryFromText(parts[0]),
          productName: productValue,
        };
      }
      if (countryValue && factoryValue && productValue) {
        return {
          screen: 'CountryFactoryProduct',
          country: countryValue,
          factoryNo: factoryValue,
          productName: productValue,
        };
      }
      return {screen: 'Search', keyword: display};
    default:
      return {screen: 'Search', keyword: display};
  }
}

function buildMerchantSearchTags(
  target: RootStackParamList['MerchantSearchResults']['target'],
  fallback: string,
): string[] {
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

function addMerchantFeedItem(map: Map<string, MerchantSearchResult>, item: OfferFeedItem, type: OfferTab, category: string) {
  const merchantName = getKnownMerchantName(item);
  if (!merchantName) return;
  const key = buildMerchantResultKey(item.merchantId, merchantName);
  const current = map.get(key) ?? {
    merchantId: item.merchantId,
    merchantName,
    merchantShortName: item.merchantShortName,
    offerCount: 0,
    inquiryCount: 0,
    samples: [],
    factoryKeys: [],
    seenFeedKeys: new Set<string>(),
  };

  const feedKey = buildMerchantFeedKey(item, type);
  if (current.seenFeedKeys?.has(feedKey)) {
    map.set(key, current);
    return;
  }
  current.seenFeedKeys?.add(feedKey);

  if (type === 'offer') current.offerCount += 1;
  else current.inquiryCount += 1;

  const factoryKey = buildMerchantFactoryKey(item.country, item.factoryNo);
  if (factoryKey && !current.factoryKeys?.includes(factoryKey)) {
    current.factoryKeys = [...(current.factoryKeys ?? []), factoryKey];
  }

  const sample: MerchantSearchSample = {
    type,
    category: item.category ?? category,
    productName: item.productName,
    country: item.country,
    factoryNo: item.factoryNo,
    publishTime: item.publishTime,
  };
  const sampleKey = `${sample.type}-${sample.productName ?? ''}-${sample.country ?? ''}-${sample.factoryNo ?? ''}`;
  const hasSample = current.samples.some(
    existing => `${existing.type}-${existing.productName ?? ''}-${existing.country ?? ''}-${existing.factoryNo ?? ''}` === sampleKey,
  );
  if (!hasSample) {
    current.samples.push(sample);
    current.samples = current.samples
      .sort((left, right) => parseMerchantTime(right.publishTime) - parseMerchantTime(left.publishTime))
      .slice(0, 5);
  }
  map.set(key, current);
}

function addMerchantSuggestion(map: Map<string, MerchantSearchResult>, item: SearchSuggest) {
  const merchantName = item.merchantName || item.text || '未知商家';
  const key = buildMerchantResultKey(item.targetId, merchantName);
  if (map.has(key)) return;
  map.set(key, {
    merchantId: item.targetId,
    merchantName,
    merchantShortName: item.standardName ?? null,
    offerCount: 0,
    inquiryCount: 0,
    samples: [],
    factoryKeys: [],
    seenFeedKeys: new Set<string>(),
  });
}

function buildMerchantResultKey(merchantId?: number | string | null, merchantName?: string | null) {
  if (merchantId != null && String(merchantId).trim()) return `id:${String(merchantId).trim()}`;
  return `name:${normalizeText(merchantName)}`;
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

function getKnownMerchantName(item: OfferFeedItem) {
  const names = [item.merchantShortName, item.merchantName]
    .map(name => name?.trim())
    .filter((name): name is string => Boolean(name));
  return names.find(name => !isUnknownMerchantName(name)) ?? null;
}

function isUnknownMerchantName(value?: string | null) {
  return normalizeText(value) === normalizeText('未知商家');
}

function toNumericId(value?: number | string | null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildMerchantFeedKey(item: OfferFeedItem, type: OfferTab) {
  if (item.offerId != null) return `${type}:id:${item.offerId}`;
  return [
    type,
    item.merchantId ?? '',
    item.productName ?? '',
    item.country ?? '',
    item.factoryNo ?? '',
    item.publishTime ?? '',
    item.price ?? '',
  ].join('|');
}

function getMerchantLatestTime(item: MerchantSearchResult) {
  return Math.max(0, ...item.samples.map(sample => parseMerchantTime(sample.publishTime)));
}

function parseMerchantTime(value?: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value.replace(/-/g, '/'));
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getMerchantCategoryMark(item: MerchantSearchResult, fallback: string) {
  const categories = Array.from(new Set(item.samples.map(sample => getSampleCategoryMark(sample, fallback)).filter(Boolean)));
  if (categories.length === 1) return categories[0];
  if (categories.includes('牛') && categories.includes('猪')) return '牛/猪';
  return fallback === '猪' ? '猪' : '牛';
}

function getSampleCategoryMark(sample: MerchantSearchSample, fallback: string) {
  return sample.category === '猪' || fallback === '猪' ? '猪' : '牛';
}

function getMerchantDefaultTab(item: MerchantSearchResult): OfferTab {
  if (item.offerCount === 0 && item.inquiryCount > 0) return 'inquiry';
  return 'offer';
}

function buildMerchantDetailInitialFilters(
  selection: MerchantSearchSelection,
  result?: MerchantSearchResult,
) {
  if (selection.matchType === 'merchant') return {};
  const factoryKeys = getMerchantDetailInitialFactoryKeys(selection, result);
  return {
    initialCountry: selection.country ?? null,
    initialFactoryNo: selection.factoryNo ?? null,
    initialFactoryKeys: factoryKeys,
    initialProductName: selection.productName ?? null,
  };
}

function getMerchantDetailInitialFactoryKeys(
  selection: MerchantSearchSelection,
  result?: MerchantSearchResult,
) {
  if (selection.factoryNo || selection.matchType === 'merchant') return undefined;
  const isBrandSearch = selection.matchType === 'brand' || Boolean(selection.brandName);
  if (!isBrandSearch) return undefined;
  const keys = result?.factoryKeys?.filter(Boolean) ?? [];
  return keys.length > 0 ? keys : undefined;
}

function buildMerchantFactoryKey(country?: string | null, factoryNo?: string | null) {
  const countryText = country?.trim();
  const factoryText = factoryNo?.trim();
  if (!countryText || !factoryText) return '';
  return `${countryText}${factoryText}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildMerchantBrandQueries(
  keyword: string,
  suggestions: SearchSuggest[],
  condition: MerchantSearchCondition,
): MerchantBrandQuery[] {
  const map = new Map<string, MerchantBrandQuery>();
  const addQuery = (brandName?: string | null, productName?: string | null) => {
    const brand = brandName?.trim();
    if (!brand) return;
    const product = productName?.trim() || null;
    const key = `${normalizeSearchComparable(brand)}|${normalizeSearchComparable(product)}`;
    if (!map.has(key)) {
      map.set(key, {brandName: brand, productName: product});
    }
  };

  suggestions
    .filter(item => item.matchType === 'brand')
    .forEach(item => {
      const parts = getStandardSearchWord(item.text).split(/\s+/).filter(Boolean);
      addQuery(getBrandFromSuggestion(item, parts), getProductFromSuggestion(item, parts));
    });

  const raw = getStandardSearchWord(keyword).trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && looksLikeBrandKeyword(parts[0])) {
    addQuery(parts[0], condition.productName || parts.slice(1).join(' '));
  } else if (looksLikeBrandKeyword(raw)) {
    addQuery(raw, null);
  }

  return Array.from(map.values());
}

function looksLikeBrandKeyword(value?: string | null) {
  const text = value?.trim();
  return Boolean(text && /^[a-zA-Z][a-zA-Z0-9-]{1,24}$/.test(text) && !looksLikeFactoryNo(text));
}

function buildMerchantSearchCondition(keyword: string): MerchantSearchCondition {
  const raw = getStandardSearchWord(keyword).trim();
  const compact = normalizeSearchComparable(raw);
  const compactCondition = splitCompactCountryFactoryProduct(raw, compact);
  if (compactCondition) return compactCondition;

  const parts = raw.split(/\s+/).filter(Boolean);
  const countryFactoryIndex = parts.findIndex(part => Boolean(splitCountryFactoryPart(part)));
  if (countryFactoryIndex >= 0) {
    const countryFactory = splitCountryFactoryPart(parts[countryFactoryIndex]);
    if (countryFactory) {
      const productName = [
        ...parts.slice(0, countryFactoryIndex),
        ...parts.slice(countryFactoryIndex + 1),
      ].join(' ');
      return {
        raw,
        country: countryFactory.country,
        factoryNo: countryFactory.factoryNo,
        productName: productName || null,
      };
    }
  }

  const factoryIndex = parts.findIndex(looksLikeFactoryNo);
  if (factoryIndex >= 0) {
    const beforeFactory = parts.slice(0, factoryIndex).join('');
    const productName = parts.slice(factoryIndex + 1).join(' ');
    return {
      raw,
      country: looksLikeCountryText(beforeFactory) ? beforeFactory : null,
      factoryNo: parts[factoryIndex],
      productName: productName || null,
    };
  }

  if (parts.length >= 2 && looksLikeCountryText(parts[0]) && looksLikeFactoryNo(parts[1])) {
    return {
      raw,
      country: parts[0],
      factoryNo: parts[1],
      productName: parts.slice(2).join(' ') || null,
    };
  }

  if (parts.length >= 2 && looksLikeCountryText(parts[0])) {
    return {
      raw,
      country: parts[0],
      productName: parts.slice(1).join(' '),
    };
  }

  if (parts.length >= 2 && looksLikeBrandKeyword(parts[0])) {
    return {
      raw,
      brandName: parts[0],
      productName: parts.slice(1).join(' '),
    };
  }

  if (parts.length >= 2) {
    return {
      raw,
      productName: parts.slice(1).join(' '),
    };
  }

  return {raw};
}

function splitCompactCountryFactoryProduct(raw: string, compact: string): MerchantSearchCondition | null {
  const country = [...merchantSearchCountries]
    .sort((left, right) => right.length - left.length)
    .find(item => compact.startsWith(normalizeSearchComparable(item)));
  if (!country) return null;
  const tail = raw.replace(/\s+/g, '').slice(country.length);
  const factoryMatch = tail.match(/^([A-Za-z]*\d[A-Za-z0-9-]*)(.*)$/);
  if (factoryMatch) {
    return {
      raw,
      country,
      factoryNo: factoryMatch[1],
      productName: factoryMatch[2] || null,
    };
  }
  return tail
    ? {
        raw,
        country,
        productName: tail,
      }
    : {raw, country};
}

function splitCountryFactoryPart(value: string) {
  const compact = value.replace(/\s+/g, '');
  const country = [...merchantSearchCountries]
    .sort((left, right) => right.length - left.length)
    .find(item => compact.startsWith(item));
  if (!country) return null;
  const factoryNo = compact.slice(country.length);
  if (!looksLikeFactoryNo(factoryNo)) return null;
  return {country, factoryNo};
}

function looksLikeFactoryNo(value: string) {
  return /^[a-zA-Z]{0,12}\d[\w-]*$/.test(normalizeSearchComparable(value));
}

function looksLikeCountryText(value?: string | null) {
  const text = value?.trim();
  return Boolean(text && merchantSearchCountries.includes(text));
}

function merchantFeedItemMatchesCondition(item: OfferFeedItem, condition: MerchantSearchCondition) {
  if (condition.matchType === 'merchant') {
    const idMatches =
      condition.targetId != null &&
      String(item.merchantId ?? '').trim() === String(condition.targetId).trim();
    const nameMatches =
      fieldIncludes(item.merchantName, condition.merchantName ?? condition.raw) ||
      fieldIncludes(item.merchantShortName, condition.merchantName ?? condition.raw);
    return idMatches || nameMatches;
  }

  const hasStructuredCondition = Boolean(condition.country || condition.factoryNo || condition.productName || condition.brandName);
  if (condition.brandName && !fieldIncludes(item.brandName, condition.brandName)) return false;
  if (condition.country && !fieldIncludes(item.country, condition.country)) return false;
  if (condition.factoryNo && !fieldIncludes(item.factoryNo, condition.factoryNo)) return false;
  if (condition.productName && !fieldIncludes(item.productName, condition.productName)) return false;
  if (hasStructuredCondition) return true;

  const raw = condition.raw;

  return (
    fieldIncludes(item.productName, raw) ||
    fieldIncludes(item.brandName, raw) ||
    fieldIncludes(item.country, raw) ||
    fieldIncludes(item.factoryNo, raw) ||
    fieldIncludes(item.merchantName, raw) ||
    fieldIncludes(item.merchantShortName, raw) ||
    fieldIncludes(item.goodsType, raw) ||
    fieldIncludes(item.region, raw) ||
    fieldIncludes(item.tags, raw) ||
    fieldIncludes(item.fatRatio, raw) ||
    fieldIncludes(item.feedingType, raw) ||
    fieldIncludes(item.cattleBreed, raw)
  );
}

function fieldIncludes(value: string | null | undefined, keyword: string | null | undefined) {
  const left = normalizeSearchComparable(value);
  const right = normalizeSearchComparable(keyword);
  return Boolean(left && right && left.includes(right));
}

function normalizeSearchComparable(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, '') || '';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildMerchantSampleText(sample: MerchantSearchSample) {
  const productName = sample.productName?.trim() || '未知产品';
  const country = sample.country?.trim() ?? '';
  const factoryNo = sample.factoryNo?.trim() ?? '';
  const countryFactory = `${country}${factoryNo}`.trim();
  return countryFactory ? `${productName} ${countryFactory}` : productName;
}

function buildMerchantSampleFactoryText(sample: MerchantSearchSample) {
  const country = sample.country?.trim() ?? '';
  const factoryNo = sample.factoryNo?.trim() ?? '';
  const countryFactory = `${country}${factoryNo}`.trim();
  return countryFactory || '国家厂号不限';
}

function SuggestionItem({
  item,
  keyword,
  onPress,
}: {
  item: SearchSuggest;
  keyword: string;
  onPress: () => void;
}) {
  const {main, alias} = parseSuggestionText(item.text);
  return (
    <Pressable onPress={onPress} style={styles.resultRow}>
      <View style={styles.resultMain}>
        <SearchIcon size={16} color="#ADB7B5" />
        <View style={styles.resultText}>
          <Text style={styles.resultPrimary} numberOfLines={1}>
            {renderHighlight(main, keyword)}
          </Text>
          {alias ? <Text style={styles.resultAlias}>(别名：{alias})</Text> : null}
        </View>
      </View>
      <Text style={styles.resultType}>{item.type}</Text>
    </Pressable>
  );
}

function parseSuggestionText(text: string): {main: string; alias: string | null} {
  const aliasMarker = '(别名：';
  const index = text.indexOf(aliasMarker);
  if (index >= 0 && text.endsWith(')')) {
    return {
      main: text.slice(0, index).trim(),
      alias: text.slice(index + aliasMarker.length, -1).trim(),
    };
  }
  return {main: text, alias: null};
}

function renderHighlight(text: string, keyword: string): React.ReactNode[] {
  const trimmed = keyword.trim();
  if (!trimmed) return [text];

  const lowerText = text.toLowerCase();
  const lowerKeyword = trimmed.toLowerCase();
  const result: React.ReactNode[] = [];
  let cursor = 0;
  let index = lowerText.indexOf(lowerKeyword, cursor);

  while (index >= 0) {
    if (index > cursor) result.push(text.slice(cursor, index));
    result.push(
      <Text key={`hi-${index}`} style={styles.highlight}>
        {text.slice(index, index + trimmed.length)}
      </Text>,
    );
    cursor = index + trimmed.length;
    index = lowerText.indexOf(lowerKeyword, cursor);
  }

  if (cursor < text.length) result.push(text.slice(cursor));
  return result;
}

function uniqueBySearchWord(items: SearchHistory[]): SearchHistory[] {
  const set = new Set<string>();
  const out: SearchHistory[] = [];
  for (const item of items) {
    if (!set.has(item.searchWord)) {
      set.add(item.searchWord);
      out.push(item);
    }
  }
  return out;
}

function findExactHistorySuggestion(items: SearchSuggest[], searchWord: string): SearchSuggest | null {
  const target = normalizeSearchComparable(searchWord);
  if (!target) return null;
  return items.find(item => normalizeSearchComparable(getStandardSearchWord(item.text)) === target) ?? null;
}

function buildMerchantSearchSelectionFromHistory(history: SearchHistory, display: string): MerchantSearchSelection {
  const brandProduct = parseHistoryBrandProduct(history, display);
  return {
    display,
    matchType: brandProduct ? 'brand' : getHistoryMatchType(history),
    type: brandProduct ? '品牌+产品' : getHistorySearchType(history),
    targetId: history.productId ?? history.brandId ?? history.merchantId ?? null,
    country: history.country ?? null,
    factoryNo: history.factoryNo ?? null,
    productName: brandProduct?.productName ?? history.productName ?? null,
    brandName: brandProduct?.brandName ?? (history.brandId ? display : null),
    merchantName: history.merchantId ? display : null,
  };
}

function buildMerchantSearchTargetFromHistory(
  history: SearchHistory,
  display: string,
): RootStackParamList['MerchantSearchResults']['target'] {
  const brandProduct = parseHistoryBrandProduct(history, display);
  if (brandProduct) {
    return {
      screen: 'BrandProduct',
      brandName: brandProduct.brandName,
      productName: brandProduct.productName,
    };
  }

  if (history.country && history.factoryNo && history.productName) {
    return {
      screen: 'CountryFactoryProduct',
      country: history.country,
      factoryNo: history.factoryNo,
      productName: history.productName,
    };
  }

  if (history.country && history.productName) {
    return {screen: 'CountryProduct', country: history.country, productName: history.productName};
  }

  if (history.country && history.factoryNo) {
    return {screen: 'Factory', country: history.country, factoryNo: history.factoryNo};
  }

  if (history.productId) {
    return {screen: 'Product', productId: history.productId, productName: history.productName ?? display};
  }

  if (history.brandId) {
    return {screen: 'Brand', brandName: display};
  }

  if (history.country) {
    return {screen: 'Country', country: history.country};
  }

  return {screen: 'Search', keyword: display};
}

function parseHistoryBrandProduct(history: SearchHistory, display: string): MerchantBrandQuery | null {
  if (history.brandId && history.productName) {
    return {brandName: getHistoryBrandName(display, history.productName), productName: history.productName};
  }

  const parts = display.split(/\s+/).filter(Boolean);
  const isBrandProduct = history.searchType === '品牌+产品' || (parts.length >= 2 && looksLikeBrandKeyword(parts[0]));
  if (!isBrandProduct || parts.length < 2) return null;
  return {
    brandName: parts[0],
    productName: parts.slice(1).join(' '),
  };
}

function getHistoryBrandName(display: string, productName: string) {
  const withoutProduct = display.replace(productName, '').trim();
  return withoutProduct || display.split(/\s+/).filter(Boolean)[0] || display;
}

function getHistoryMatchType(history: SearchHistory): string {
  if (history.merchantId) return 'merchant';
  if (history.brandId) return 'brand';
  if (history.country && (history.factoryNo || history.productName)) return 'combined';
  if (history.country) return 'country';
  if (history.factoryNo) return 'factory';
  if (history.productId || history.productName) return 'product';
  return 'keyword';
}

function getHistorySearchType(history: SearchHistory): string {
  if (history.searchType) return history.searchType;
  if (history.merchantId) return '商家';
  if (history.brandId) return '品牌';
  if (history.country && history.factoryNo && history.productName) return '国家+厂号+产品';
  if (history.country && history.productName) return '国家+产品';
  if (history.country && history.factoryNo) return '国家+厂号';
  if (history.country) return '国家';
  if (history.factoryNo) return '厂号';
  if (history.productId || history.productName) return '产品';
  return '关键词';
}

function getStandardSearchWord(text: string): string {
  return parseSuggestionText(text).main;
}

function getCountryFromText(text?: string | null): string {
  return getStandardSearchWord(text ?? '');
}

function getFactoryFromText(text?: string | null): string | null {
  if (!text) return null;
  return getStandardSearchWord(text);
}

function getProductFromSuggestion(item: SearchSuggest, parts: string[]): string | null {
  if (item.productName) return item.productName;
  if (item.matchType === 'product') return getStandardSearchWord(item.text);
  if (item.type === '国家+产品' && parts.length >= 2) return getStandardSearchWord(parts.slice(1).join(' '));
  if (item.type === '国家+厂号+产品' && parts.length >= 3) return getStandardSearchWord(parts.slice(2).join(' '));
  if (item.type === '品牌+产品' && parts.length >= 2) return getStandardSearchWord(parts.slice(1).join(' '));
  return null;
}

function getBrandFromSuggestion(item: SearchSuggest, parts: string[]): string | null {
  if (item.brandName) return item.brandName;
  if (item.matchType !== 'brand') return null;
  if (item.type === '品牌+产品' && parts.length >= 1) return getStandardSearchWord(parts[0]);
  return getStandardSearchWord(item.text);
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    zIndex: 20,
  },
  topTabRow: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchTabs: {
    flex: 1,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 24,
  },
  searchTabItem: {
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  searchTabText: {
    color: '#171D1C',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
  },
  searchTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  searchTabLine: {
    width: 18,
    height: 3,
    backgroundColor: 'transparent',
  },
  searchTabLineActive: {
    backgroundColor: colors.primary,
  },
  merchantSearchTitleWrap: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  merchantSearchTitle: {
    color: colors.primary,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
  },
  merchantSearchTitleLine: {
    width: 18,
    height: 3,
    backgroundColor: colors.primary,
  },
  topRightSpacer: {
    width: 24,
  },
  backButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputWrap: {
    height: 40,
    borderRadius: 4,
    backgroundColor: '#EFF5F3',
    borderWidth: 1,
    borderColor: 'rgba(187,202,198,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  categoryButton: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 6,
  },
  categoryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  searchDivider: {
    width: StyleSheet.hairlineWidth,
    height: 16,
    backgroundColor: '#D4DFDC',
    marginRight: 8,
  },
  categoryMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  categoryMenu: {
    position: 'absolute',
    left: 48,
    width: 72,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DEE4E1',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
    overflow: 'hidden',
    zIndex: 30,
  },
  categoryMenuItem: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryMenuItemActive: {
    backgroundColor: '#EFF5F3',
  },
  categoryMenuText: {
    color: '#3C4947',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryMenuTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    marginLeft: 8,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  inputFocused: {
    marginLeft: 0,
  },
  inputClear: {width: 18, height: 18, alignItems: 'center', justifyContent: 'center'},
  inputSpacer: {flex: 1},
  selectedSearchChip: {
    maxWidth: '78%',
    minHeight: 28,
    borderRadius: 3,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 9,
    paddingRight: 6,
    gap: 4,
  },
  selectedSearchChipText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  selectedSearchChipClose: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedSearchChipCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '600',
  },
  resultContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  merchantResultList: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
  merchantResultCard: {
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0EAE7',
  },
  merchantResultPressed: {opacity: 0.82},
  merchantResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  merchantResultTitleWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  merchantResultIcon: {
    width: 22,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantResultName: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  merchantResultMeta: {
    marginTop: 2,
    marginLeft: 28,
    color: '#6C7A77',
    fontSize: 12,
    lineHeight: 17,
  },
  merchantSampleList: {
    marginTop: 10,
    marginLeft: 28,
    flexDirection: 'row',
    gap: 8,
  },
  merchantSampleCard: {
    width: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 58,
    borderRadius: 3,
    backgroundColor: '#FBFDFD',
    borderWidth: 1,
    borderColor: '#D8E5E2',
    paddingHorizontal: 7,
    paddingVertical: 7,
    justifyContent: 'space-between',
  },
  merchantSampleTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  merchantSampleBadge: {
    minWidth: 30,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#BDE9E4',
    backgroundColor: '#EAF9F7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  merchantSampleBadgeInquiry: {
    borderColor: '#C8D8FF',
    backgroundColor: '#EEF4FF',
  },
  merchantSampleBadgeText: {
    color: colors.primary,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '400',
  },
  merchantSampleBadgeTextInquiry: {
    color: '#3767D6',
  },
  merchantSampleProduct: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  merchantSampleFactory: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  merchantSampleEmpty: {
    flex: 1,
    minHeight: 58,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#D8E5E2',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#9DA4A3',
    fontSize: 12,
    lineHeight: 58,
  },
  merchantResultFooter: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
  },
  merchantResultMore: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  merchantResultArrow: {
    color: colors.primary,
    fontSize: 18,
    lineHeight: 20,
  },
  resultRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFF5F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultMain: {flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8},
  resultText: {flex: 1},
  resultPrimary: {color: colors.text, fontSize: 15},
  resultAlias: {marginTop: 2, color: '#9DA4A3', fontSize: 12},
  resultType: {color: '#3C4947', fontSize: 12},
  highlight: {color: colors.primary, fontWeight: '600'},
  loading: {marginTop: 32},
  loadingText: {marginTop: 32, textAlign: 'center', color: '#9DA4A3', fontSize: 12},
  empty: {marginTop: 32, color: colors.textMuted, textAlign: 'center', fontSize: 12},
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  historyTitle: {color: '#3C4947', fontSize: 14, fontWeight: '500'},
  clearAllWrap: {flexDirection: 'row', alignItems: 'center', gap: 4},
  clearAllText: {color: '#9DA4A3', fontSize: 12},
  historyWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16},
  historyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: '#EFF5F3',
    borderWidth: 1,
    borderColor: 'rgba(187,202,198,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  historyChipText: {color: colors.text, fontSize: 12, maxWidth: 180},
  helperWrap: {alignItems: 'center', marginTop: 32},
  helperTitle: {color: colors.text, fontSize: 16},
  helperKeyword: {color: colors.primary, fontWeight: '700'},
  helperDesc: {marginTop: 4, color: '#3C4947', fontSize: 12},
  examplesWrap: {marginTop: 22, alignItems: 'center', paddingBottom: 32, gap: 8},
  examplesTitle: {color: '#000000', fontSize: 12, fontWeight: '500', marginBottom: 4},
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#DEE4E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  exampleDivider: {
    width: 0.5,
    height: 7,
    backgroundColor: '#3C4947',
    marginHorizontal: 4,
  },
  exampleWord: {color: '#171D1C', fontSize: 12, fontWeight: '500'},
  exampleDesc: {color: '#3C4947', fontSize: 12, marginLeft: 4},
});
