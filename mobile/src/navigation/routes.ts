export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Search: {category: string; keyword?: string; initialTab?: 'offer' | 'inquiry' | 'merchant'};
  MerchantSearchResults: {
    category: string;
    searchKeyword: string;
    tags: string[];
    merchantSearch: {
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
    target:
      | {screen: 'Search'; keyword: string}
      | {screen: 'Merchant'; merchantId: number | string}
      | {screen: 'Product'; productId: number; productName: string}
      | {screen: 'Country'; country: string}
      | {screen: 'Factory'; country: string; factoryNo: string}
      | {screen: 'CountryProduct'; country: string; productName: string}
      | {screen: 'CountryFactoryProduct'; country: string; factoryNo: string; productName: string}
      | {screen: 'Brand'; brandName: string}
      | {screen: 'BrandProduct'; brandName: string; productName: string};
  };
  OfferFeed: {
    category: string;
    initialTab?: 'offer' | 'inquiry' | 'merchant';
    disableTransition?: boolean;
    inquiryOnly?: boolean;
    keyword?: string;
    queryKeyword?: string;
    merchantId?: number | string;
    brandName?: string;
    productName?: string;
    keywordScope?: 'all' | 'product';
    merchantSearch?: {
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
    initialFilters?: {
      country?: string | null;
      factoryNo?: string | null;
    };
  };
  PlateFollow: {initialTab?: 'intent' | 'recent'; category?: string} | undefined;
  HomeCards: {category?: string} | undefined;
  Chat: {
    conversationId?: string;
    category: string;
    merchantId?: number | string | null;
    merchantName?: string | null;
    contactPhone?: string | null;
    offer: {
      offerId?: number | null;
      productName?: string | null;
      country?: string | null;
      factoryNo?: string | null;
      price?: number | null;
      priceMax?: number | null;
      weight?: string | null;
      goodsLocation?: string | null;
      region?: string | null;
      tags?: string | null;
      feedingType?: string | null;
      goodsType?: string | null;
      publishTime?: string | null;
    };
  };
  Merchant: {
    merchantId: number | string;
    category: string;
    initialTab?: 'offer' | 'inquiry';
    initialCategory?: 'all' | '牛' | '猪';
    initialCountry?: string | null;
    initialFactoryNo?: string | null;
    initialFactoryKeys?: string[];
    initialProductName?: string | null;
  };
  Product: {productId: number; category: string; productName: string; searchKeyword?: string; initialTab?: 'offer' | 'inquiry'; disableTransition?: boolean};
  Country: {country: string; category: string; searchKeyword?: string; initialTab?: 'offer' | 'inquiry'; disableTransition?: boolean};
  Factory: {country: string; factoryNo: string; category: string; searchKeyword?: string; initialTab?: 'offer' | 'inquiry'; disableTransition?: boolean};
  CountryProduct: {country: string; productName: string; category: string; searchKeyword?: string; initialTab?: 'offer' | 'inquiry'; disableTransition?: boolean};
  CountryFactoryProduct: {
    country: string;
    factoryNo: string;
    productName: string;
    category: string;
    searchKeyword?: string;
    initialTab?: 'offer' | 'inquiry';
    disableTransition?: boolean;
  };
  SubstituteProduct: {
    country: string;
    factoryNo: string;
    productName: string;
    category: string;
    searchKeyword?: string;
  };
  DataComparison: {
    country: string;
    factoryNos: string[];
    productName: string;
    category: string;
    excludeFactoryNo?: string | null;
  };
  Brand: {brandName: string; category: string; searchKeyword?: string; initialTab?: 'offer' | 'inquiry'; disableTransition?: boolean};
  BrandProduct: {brandName: string; productName: string; category: string; searchKeyword?: string; initialTab?: 'offer' | 'inquiry'; disableTransition?: boolean};
  Profile: undefined;
  EditProfile: undefined;
  Inventory: undefined;
};
