package com.mooket.social.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mooket.social.dto.*;
import com.mooket.social.entity.*;
import com.mooket.social.mapper.*;
import com.mooket.social.service.BrandService;
import com.mooket.social.service.SearchHistoryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 搜索历史服务实现
 */
@Slf4j
@Service
public class SearchHistoryServiceImpl implements SearchHistoryService {

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    @Autowired
    private BizSearchHistoryMapper searchHistoryMapper;

    @Autowired
    private DictProductMapper productMapper;

    @Autowired
    private DictFactoryMapper factoryMapper;

    @Autowired
    private DictBrandMapper brandMapper;

    @Autowired
    private DictMerchantMapper merchantMapper;

    @Autowired
    private StatProductMapper statProductMapper;

    @Autowired
    private StatCountryMapper statCountryMapper;

    @Autowired
    private StatFactoryMapper statFactoryMapper;

    @Autowired
    private StatBrandMapper statBrandMapper;

    @Autowired
    private StatCountryProductMapper statCountryProductMapper;

    @Autowired
    private StatBrandProductMapper statBrandProductMapper;

    @Autowired
    private StatFactoryProductMapper statFactoryProductMapper;

    @Autowired
    private StatMerchantMapper statMerchantMapper;

    @Autowired
    private StatPriceTrendMapper statPriceTrendMapper;

    @Autowired
    private BizOfferMapper bizOfferMapper;

    @Autowired
    private BrandService brandService;

    @Override
    @CacheEvict(value = {"recentSearchCards", "selfSelectCards"}, allEntries = true)
    @Transactional
    public void addSearchHistory(Long userId, String searchWord, String searchType) {
        Long existingId = searchHistoryMapper.findExistingHistory(userId, searchWord, searchType);
        if (existingId != null) {
            searchHistoryMapper.updateCreateTime(existingId);
        } else {
            searchHistoryMapper.insertOrIgnore(userId, searchWord, searchType, 0);
        }
    }

    @Override
    public List<SearchHistoryDTO> getRecentSearches(Long userId, int limit) {
        List<BizSearchHistory> histories = searchHistoryMapper.findRecentSearches(userId, limit);
        return convertToDTO(histories);
    }

    @Override
    public List<SearchHistoryDTO> getSelfSelectSearches(Long userId, int limit) {
        List<BizSearchHistory> histories = searchHistoryMapper.findSelfSelectSearches(userId, limit);
        return convertToDTO(histories);
    }

    @Override
    @Cacheable(value = "recentSearchCards", key = "#userId + '_' + #category")
    public HomeCardsResponseDTO getRecentSearchCards(Long userId, String category) {
        List<BizSearchHistory> histories = searchHistoryMapper.findRecentSearches(userId, 50);
        return buildCardsFromHistory(histories, category);
    }

    @Override
    @Cacheable(value = "selfSelectCards", key = "#userId + '_' + #category")
    public HomeCardsResponseDTO getSelfSelectCards(Long userId, String category) {
        List<BizSearchHistory> histories = searchHistoryMapper.findSelfSelectSearches(userId, 50);
        return buildCardsFromHistory(histories, category);
    }

    private HomeCardsResponseDTO buildCardsFromHistory(List<BizSearchHistory> histories, String category) {
        HomeCardsResponseDTO response = new HomeCardsResponseDTO();
        List<HomeCardItemDTO> cards = new ArrayList<>();
        int rank = 1;
        LocalDate today = LocalDate.now();

        // 用于去重的 key 集合（防止同一实体被多个搜索历史重复添加）
        java.util.Set<String> seenEntityKeys = new java.util.HashSet<>();

        for (BizSearchHistory history : histories) {
            HomeCardItemDTO card = buildCardFromHistory(history, category, today, rank);
            if (card != null) {
                // 过滤：无有效统计数据的卡片不显示（用户选择猪大类后，无数据的卡片应隐藏）
                if (!hasValidStatData(card)) {
                    continue;
                }
                // 去重：根据卡片的实体类型和 ID 过滤重复
                String entityKey = getCardEntityKey(card);
                if (entityKey != null && !seenEntityKeys.contains(entityKey)) {
                    seenEntityKeys.add(entityKey);
                    card.setRank(rank);
                    cards.add(card);
                    rank++;
                }
            }
            if (cards.size() >= 20) break; // 最多20张卡片
        }

        response.setCards(cards);
        response.setUpdateTime(LocalDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm")));
        return response;
    }

    /**
     * 根据卡片类型获取实体唯一标识 key，用于去重
     */
    private String getCardEntityKey(HomeCardItemDTO card) {
        String cardType = card.getCardType();
        if (cardType == null) return null;
        switch (cardType) {
            case "merchant":
                return "merchant:" + ((MerchantCardDTO) card).getMerchantId();
            case "brand":
                return "brand:" + ((BrandCardDTO) card).getBrandId();
            case "product":
                return "product:" + ((ProductCardDTO) card).getProductId();
            case "factory":
                FactoryCardDTO fc = (FactoryCardDTO) card;
                return "factory:" + fc.getCountry() + ":" + fc.getFactoryNo();
            case "countryProduct":
                CountryProductCardDTO cpc = (CountryProductCardDTO) card;
                return "countryProduct:" + cpc.getCountry() + ":" + cpc.getProductName();
            case "factoryProduct":
                FactoryProductCardDTO fpc = (FactoryProductCardDTO) card;
                return "factoryProduct:" + fpc.getCountry() + ":" + fpc.getFactoryNo() + ":" + fpc.getProductName();
            case "brandProduct":
                BrandProductCardDTO bpc = (BrandProductCardDTO) card;
                return "brandProduct:" + bpc.getBrandId() + ":" + bpc.getProductName();
            case "country":
                return "country:" + ((CountryCardDTO) card).getCountry();
            default:
                return null;
        }
    }

    /**
     * 检查卡片是否有有效的统计数据
     * 如果 stat 表中没有今日数据，过滤掉该卡片避免显示"--"
     */
    private boolean hasValidStatData(HomeCardItemDTO card) {
        String cardType = card.getCardType();
        if (cardType == null) return false;

        switch (cardType) {
            case "country": {
                CountryCardDTO c = (CountryCardDTO) card;
                return c.getTodayOfferCount() != null && c.getTodayOfferCount() > 0;
            }
            case "brand": {
                BrandCardDTO b = (BrandCardDTO) card;
                return b.getTodayOfferCount() != null && b.getTodayOfferCount() > 0;
            }
            case "factory": {
                FactoryCardDTO f = (FactoryCardDTO) card;
                // stat_factory 无数据但 biz_offer 有热门产品时也放行
                if (f.getTodayOfferCount() != null && f.getTodayOfferCount() > 0) return true;
                return f.getHotProducts() != null && !f.getHotProducts().isEmpty();
            }
            case "countryProduct": {
                CountryProductCardDTO cp = (CountryProductCardDTO) card;
                // stat_country_product 无数据但 biz_offer 有热门厂号时也放行
                if (cp.getTodayOfferCount() != null && cp.getTodayOfferCount() > 0) return true;
                return cp.getTopFactories() != null && !cp.getTopFactories().isEmpty();
            }
            case "brandProduct": {
                BrandProductCardDTO bp = (BrandProductCardDTO) card;
                if (bp.getTodayOfferCount() != null && bp.getTodayOfferCount() > 0) return true;
                // stat_brand_product 无数据但有热门厂号时也放行
                return bp.getHotFactories() != null && !bp.getHotFactories().isEmpty();
            }
            case "factoryProduct": {
                FactoryProductCardDTO fp = (FactoryProductCardDTO) card;
                return fp.getTodayOfferCount() != null && fp.getTodayOfferCount() > 0;
            }
            case "product": {
                ProductCardDTO p = (ProductCardDTO) card;
                return p.getTodayOfferCount() != null && p.getTodayOfferCount() > 0;
            }
            case "merchant": {
                MerchantCardDTO m = (MerchantCardDTO) card;
                if (m.getTodayOfferCount() != null && m.getTodayOfferCount() > 0) return true;
                return m.getLatestOffers() != null && !m.getLatestOffers().isEmpty();
            }
            default:
                return true; // 其他类型默认通过
        }
    }

    private HomeCardItemDTO buildCardFromHistory(BizSearchHistory history, String category, LocalDate today, int rank) {
        String type = history.getSearchType();
        if (type == null) return null;

        try {
            // 规范化类型名称（兼容"国家+厂号"和"国家厂号"两种格式）
            String normalizedType = type.replace("+", "");

            switch (normalizedType) {
                case "产品":
                    return buildProductCard(history, category, today, rank);
                case "国家":
                    return buildCountryCard(history, category, today, rank);
                case "品牌": {
                    // 尝试构建品牌+产品卡片（搜索词可能同时包含品牌和产品，如"巴西JBS 前腱"）
                    // suggest API 只返回 type="品牌"，但 searchWord 中可能含产品名
                    BrandProductCardDTO bpCard = buildBrandProductCard(history, category, today, rank);
                    if (bpCard != null) return bpCard;
                    // 回落：普通品牌卡片
                    return buildBrandCard(history, category, today, rank);
                }
                case "商家":
                    return buildMerchantCard(history, today, rank, category);
                case "国家厂号":
                    return buildFactoryCard(history, category, today, rank);
                case "国家产品":
                    return buildCountryProductCard(history, category, today, rank);
                case "品牌产品":
                    return buildBrandProductCard(history, category, today, rank);
                case "国家厂号产品":
                    return buildFactoryProductCard(history, category, today, rank);
                default:
                    // 兼容：检查 searchWord 是否包含特定模式
                    String keyword = history.getSearchWord();
                    if (keyword != null) {
                        if (type.contains("厂号") && type.contains("产品")) {
                            return buildFactoryProductCard(history, category, today, rank);
                        } else if (type.contains("国家") && type.contains("产品")) {
                            return buildCountryProductCard(history, category, today, rank);
                        } else if (type.contains("品牌") && type.contains("产品")) {
                            return buildBrandProductCard(history, category, today, rank);
                        } else if (type.contains("厂号")) {
                            return buildFactoryCard(history, category, today, rank);
                        }
                    }
                    return null;
            }
        } catch (Exception e) {
            log.warn("构建卡片失败: historyId={}, type={}, error={}", history.getHistoryId(), type, e.getMessage());
            return null;
        }
    }

    private ProductCardDTO buildProductCard(BizSearchHistory history, String category, LocalDate today, int rank) {
        Integer productId = history.getProductId() != null ? history.getProductId().intValue() : null;
        if (productId == null) {
            String productName = history.getSearchWord();
            // 如果搜索词包含"别名："格式，提取标准产品名（括号前的部分）
            if (productName != null && productName.contains("(别名：")) {
                int idx = productName.indexOf("(别名：");
                productName = productName.substring(0, idx);
            }
            DictProduct product = productMapper.selectByProductName(productName);
            if (product != null) {
                productId = product.getProductId();
            }
        }
        if (productId == null) return null;

        StatProduct stat = statProductMapper.selectByProductIdAndCategory(productId, category);

        ProductCardDTO card = new ProductCardDTO();
        card.setCardType("product");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setProductId(productId);
        card.setProductName(stat != null && stat.getProductName() != null ? stat.getProductName() : history.getSearchWord());
        card.setTodayOfferCount(stat != null ? stat.getTodayOfferCount() : null);
        card.setMerchantCount(stat != null ? stat.getTodayMerchantCount() : null);
        card.setFactoryCount(stat != null ? stat.getTodayFactoryCount() : null);
        card.setPriceMin(stat != null ? stat.getPriceMin() : null);
        card.setPriceMax(stat != null ? stat.getPriceMax() : null);
        return card;
    }

    private CountryCardDTO buildCountryCard(BizSearchHistory history, String category, LocalDate today, int rank) {
        String country = history.getCountry();
        if (country == null) {
            country = history.getSearchWord();
        }

        StatCountry stat = statCountryMapper.selectByCountryAndCategory(country, category);
        // 如果直接查询为空，尝试模糊匹配（处理搜索词和标准名不完全匹配的情况）
        if (stat == null && country != null) {
            stat = statCountryMapper.selectByCountryKeyword(country, category);
        }

        CountryCardDTO card = new CountryCardDTO();
        card.setCardType("country");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setCountry(stat != null ? stat.getCountry() : country);
        card.setCountryAlias(stat != null ? stat.getCountry() : country);
        card.setTodayOfferCount(stat != null ? stat.getTodayOfferCount() : null);

        // 如果 stat_country 表中的 hotFactories 为空，直接从 biz_offer 查询
        List<CountryCardDTO.HotFactoryDTO> hotFactories = parseHotFactoriesFromJson(stat.getHotFactories());
        if (hotFactories.isEmpty()) {
            hotFactories = queryHotFactoriesFromOffers(country, category, 3);
        }
        card.setHotFactories(hotFactories);

        // 如果 stat_country 表中的 hotProducts 为空，直接从 biz_offer 查询
        List<CountryCardDTO.HotProductDTO> hotProducts = parseHotProductsFromJson(stat.getHotProducts());
        if (hotProducts.isEmpty()) {
            hotProducts = queryHotProductsFromOffers(country, category, 3);
        }
        card.setHotProducts(hotProducts);
        return card;
    }

    /**
     * 从 biz_offer 表查询热门厂号
     */
    private List<CountryCardDTO.HotFactoryDTO> queryHotFactoriesFromOffers(String country, String category, int limit) {
        List<CountryCardDTO.HotFactoryDTO> result = new ArrayList<>();
        try {
            List<BizOfferMapper.HotFactoryAgg> hotFactories = bizOfferMapper.selectHotFactories(country, category, "报盘");
            for (BizOfferMapper.HotFactoryAgg f : hotFactories) {
                if (result.size() >= limit) break;
                CountryCardDTO.HotFactoryDTO dto = new CountryCardDTO.HotFactoryDTO();
                dto.setFactoryNo(f.factoryNo);
                dto.setOfferCount(f.offerCount);
                result.add(dto);
            }
        } catch (Exception e) {
            log.warn("查询热门厂号失败: country={}, error={}", country, e.getMessage());
        }
        return result;
    }

    /**
     * 从 biz_offer 表查询热门产品
     */
    private List<CountryCardDTO.HotProductDTO> queryHotProductsFromOffers(String country, String category, int limit) {
        List<CountryCardDTO.HotProductDTO> result = new ArrayList<>();
        try {
            List<BizOfferMapper.HotProductAgg> hotProducts = bizOfferMapper.selectHotProducts(country, category, "报盘");
            for (BizOfferMapper.HotProductAgg p : hotProducts) {
                if (result.size() >= limit) break;
                CountryCardDTO.HotProductDTO dto = new CountryCardDTO.HotProductDTO();
                dto.setProductName(p.productName);
                dto.setOfferCount(p.offerCount);
                result.add(dto);
            }
        } catch (Exception e) {
            log.warn("查询热门产品失败: country={}, error={}", country, e.getMessage());
        }
        return result;
    }

    private BrandCardDTO buildBrandCard(BizSearchHistory history, String category, LocalDate today, int rank) {
        Long brandId = history.getBrandId();
        if (brandId == null) {
            brandMapper.findByName(history.getSearchWord()).ifPresent(b -> {
                if (b.getBrandId() != null) {
                    history.setBrandId(b.getBrandId().longValue());
                }
            });
            brandId = history.getBrandId();
        }
        if (brandId == null) return null;

        BrandCardDTO card = new BrandCardDTO();
        card.setCardType("brand");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setBrandId(brandId.intValue());

        // 优先从 stat_brand 查今日统计（满足 today_offer_count >= 10 才在 hotBrands 里）
        List<StatBrandMapper.HotBrand> hotBrands = statBrandMapper.findHotBrands(today, 100, category);
        for (StatBrandMapper.HotBrand hb : hotBrands) {
            if (hb.brandId != null && hb.brandId.equals(brandId.intValue())) {
                card.setBrandName(hb.brandName);
                card.setTodayOfferCount(hb.todayOfferCount);
                card.setProductCount(hb.productCount);
                card.setFactoryCount(hb.factoryCount);
                return card;
            }
        }

        // stat_brand 没有则查 dict_brand 本身（即使统计数 < 10 也展示）
        DictBrand brand = brandMapper.selectById(brandId.intValue());
        if (brand == null) return null;

        // 获取品牌名，用 brandName 查所有 brandId（一个品牌有多个厂号=多个brandId）
        String brandName = brand.getBrandName();
        card.setBrandName(brandName);
        List<DictBrand> allBrands = brandMapper.selectByName(brandName);
        List<Integer> allBrandIds = allBrands.stream()
                .map(DictBrand::getBrandId)
                .filter(id -> id != null)
                .collect(Collectors.toList());

        // 直接查聚合SQL，不走 BrandService.getBrandDetail（避免重复计算）
        try {
            if (!allBrandIds.isEmpty()) {
                List<BizOfferMapper.BrandProductAgg> aggList = bizOfferMapper.selectBrandProductAggByBrandIds(
                        allBrandIds, category, "报盘", "comprehensive", 1000, 0);
                // factoryCount = 所有 factory_no 去重数量
                long factoryCount = aggList.stream()
                        .flatMap(a -> Arrays.stream(a.factoryNos.split(",")))
                        .filter(f -> f != null && !f.trim().isEmpty())
                        .distinct()
                        .count();
                long productCount = aggList.size();
                card.setFactoryCount((int) factoryCount);
                card.setProductCount((int) productCount);

                // 查今日报盘数（stat_brand 里没有时，通过 biz_offer 实时聚合）
                BizOfferMapper.BrandStatByType brandStat = bizOfferMapper.countByBrandIdsAndType(allBrandIds, category, "报盘");
                if (brandStat != null) {
                    long todayCount = brandStat.todayCount != null ? brandStat.todayCount : 0L;
                    long yesterdayCount = brandStat.yesterdayCount != null ? brandStat.yesterdayCount : 0L;
                    card.setTodayOfferCount((int) (todayCount + yesterdayCount));
                } else {
                    card.setTodayOfferCount(null);
                }
            }
        } catch (Exception e) {
            log.warn("获取品牌统计失败: brandId={}, error={}", brandId, e.getMessage());
            card.setFactoryCount(null);
            card.setProductCount(null);
        }
        return card;
    }

    private MerchantCardDTO buildMerchantCard(BizSearchHistory history, LocalDate today, int rank, String category) {
        Long merchantId = history.getMerchantId();
        if (merchantId == null) {
            String searchWord = history.getSearchWord();
            // 如果搜索词包含"别名："格式，提取标准商家名（括号前的部分）
            if (searchWord != null && searchWord.contains("(别名：")) {
                int idx = searchWord.indexOf("(别名：");
                searchWord = searchWord.substring(0, idx);
            }
            merchantMapper.findByName(searchWord).ifPresent(m -> {
                history.setMerchantId(m.getMerchantId());
            });
            merchantId = history.getMerchantId(); // Refresh after potential update
        }
        if (merchantId == null) return null;

        StatMerchant stat = statMerchantMapper.selectByMerchantIdAndDate(merchantId, today, category);

        DictMerchant merchant = merchantMapper.selectById(merchantId);
        MerchantCardDTO card = new MerchantCardDTO();
        card.setCardType("merchant");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setMerchantId(merchantId);
        if (merchant != null) {
            card.setMerchantName(merchant.getMerchantName() != null ? merchant.getMerchantName() : "商家-" + merchantId);
            card.setMerchantShortName(merchant.getMerchantShortName());
            card.setMerchantTags(merchant.getMerchantTags());
        } else {
            card.setMerchantName("商家-" + merchantId);
        }

        // 最新报盘
        List<BizOffer> latestOffers = bizOfferMapper.findLatestByMerchant(merchantId, 2, category);
        List<MerchantCardDTO.LatestOfferDTO> latestOfferDTOs = new ArrayList<>();
        for (BizOffer offer : latestOffers) {
            MerchantCardDTO.LatestOfferDTO dto = new MerchantCardDTO.LatestOfferDTO();
            dto.setProductName(offer.getProductName());
            dto.setCountry(offer.getCountry());
            dto.setFactoryNo(offer.getFactoryNo());
            dto.setPrice(offer.getPrice() != null ? offer.getPrice().doubleValue() : null);
            dto.setWeight(offer.getWeight());
            dto.setPublishTime(offer.getPublishTime() != null ? offer.getPublishTime().toString() : null);
            latestOfferDTOs.add(dto);
        }
        card.setLatestOffers(latestOfferDTOs);
        // 无最新报盘数据则不显示该卡片
        if (latestOfferDTOs.isEmpty()) {
            return null;
        }
        Integer offerCount = stat != null ? stat.getTodayOfferCount() : null;
        if (offerCount == null || offerCount <= 0) {
            BizOfferMapper.MerchantDashboardStats dashboardStats =
                    bizOfferMapper.selectMerchantDashboardStats(merchantId, category);
            if (dashboardStats != null && dashboardStats.recentOfferCount != null) {
                offerCount = dashboardStats.recentOfferCount.intValue();
            } else {
                offerCount = latestOfferDTOs.size();
            }
        }
        card.setTodayOfferCount(offerCount);
        return card;
    }

    private FactoryCardDTO buildFactoryCard(BizSearchHistory history, String category, LocalDate today, int rank) {
        String factoryNo = history.getFactoryNo();
        String country = history.getCountry();
        // 如果字段为 NULL，尝试从 searchWord 解析
        if (factoryNo == null || country == null) {
            String keyword = history.getSearchWord();
            // 优先用 extractCountry 提取国家名（处理"阿根廷1014"等中文国家名）
            if (country == null) {
                country = extractCountry(keyword);
            }
            // 然后处理厂号：从 keyword 中找字母+数字模式
            if (factoryNo == null) {
                int idx = parseCountryAndFactory(keyword);
                if (idx > 0) {
                    factoryNo = keyword.substring(idx);
                }
                // 如果 factoryNo 为空或不是有效的厂号格式（不以数字开头），用剩余部分
                if (factoryNo == null || factoryNo.isEmpty() || !Character.isDigit(factoryNo.charAt(0))) {
                    if (country != null && !country.isEmpty()) {
                        String remaining = keyword.substring(country.length()).trim();
                        if (!remaining.isEmpty()) {
                            factoryNo = remaining;
                        }
                    }
                }
            }
        }
        if (factoryNo == null) return null;
        if (country == null) country = "";

        StatFactory stat = statFactoryMapper.selectByFactoryNoAndCategory(factoryNo, category);

        FactoryCardDTO card = new FactoryCardDTO();
        card.setCardType("factory");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setCountry(stat != null && stat.getCountry() != null ? stat.getCountry() : country);
        card.setCountryAlias(stat != null && stat.getCountry() != null ? stat.getCountry() : country);
        card.setFactoryNo(stat != null && stat.getFactoryNo() != null ? stat.getFactoryNo() : factoryNo);
        card.setTodayOfferCount(stat != null ? stat.getTodayOfferCount() : null);

        // 热门产品（按 country + factoryNo + category 精确过滤）
        List<FactoryProductStatDTO> factoryProducts = bizOfferMapper.aggregateByFactoryProductFiltered(today, card.getCountry(), card.getFactoryNo(), category);
        List<FactoryCardDTO.HotProductDTO> hotProductsList = new ArrayList<>();
        for (FactoryProductStatDTO fp : factoryProducts) {
            FactoryCardDTO.HotProductDTO dto = new FactoryCardDTO.HotProductDTO();
            dto.setProductName(fp.getProductName());
            dto.setOfferCount(fp.getTodayOfferCount());
            hotProductsList.add(dto);
        }
        hotProductsList.sort((a, b) -> Integer.compare(
                b.getOfferCount() != null ? b.getOfferCount() : 0,
                a.getOfferCount() != null ? a.getOfferCount() : 0));
        if (hotProductsList.size() > 3) {
            hotProductsList = hotProductsList.subList(0, 3);
        }
        card.setHotProducts(hotProductsList);
        return card;
    }

    private CountryProductCardDTO buildCountryProductCard(BizSearchHistory history, String category, LocalDate today, int rank) {
        String country = history.getCountry();
        Integer productId = history.getProductId() != null ? history.getProductId().intValue() : null;

        if (country == null) {
            country = extractCountry(history.getSearchWord());
        }
        if (productId == null) {
            // 尝试从 productName 获取
            if (history.getProductName() != null) {
                String productName = history.getProductName();
                if (productName.contains("(别名：")) {
                    int idx = productName.indexOf("(别名：");
                    productName = productName.substring(0, idx);
                }
                DictProduct product = productMapper.selectByProductName(productName);
                if (product != null) {
                    productId = product.getProductId();
                }
            }
            // 如果还是 null，尝试从 searchWord 解析产品名
            if (productId == null) {
                String productName = history.getProductName();
                if (productName == null) {
                    // 从 searchWord 提取产品名（去除国家前缀和厂号）
                    String keyword = history.getSearchWord();
                    String extractedCountry = extractCountry(keyword);
                    String remaining = keyword;
                    if (!extractedCountry.isEmpty()) {
                        remaining = keyword.substring(extractedCountry.length()).trim();
                    }
                    // 再去掉厂号部分
                    int factoryIdx = parseCountryAndFactory(remaining);
                    if (factoryIdx > 0) {
                        remaining = remaining.substring(factoryIdx).trim();
                    }
                    if (!remaining.isEmpty()) {
                        productName = remaining;
                    }
                }
                // 如果产品名包含"别名："格式，提取标准产品名（括号前的部分）
                if (productName != null && productName.contains("(别名：")) {
                    int idx = productName.indexOf("(别名：");
                    productName = productName.substring(0, idx);
                }
                if (productName != null && !productName.isEmpty()) {
                    DictProduct product = productMapper.selectByProductName(productName);
                    if (product != null) {
                        productId = product.getProductId();
                    }
                }
            }
        }
        if (country == null || country.isEmpty() || productId == null) return null;

        StatCountryProduct stat = statCountryProductMapper.selectByCountryAndProductId(country, productId, category);

        CountryProductCardDTO card = new CountryProductCardDTO();
        card.setCardType("countryProduct");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setCountry(stat != null ? stat.getCountry() : country);
        card.setCountryAlias(stat != null ? stat.getCountry() : country);
        card.setProductId(stat != null ? stat.getProductId() : productId);
        card.setProductName(stat != null ? stat.getProductName() : null);
        card.setTodayOfferCount(stat != null ? stat.getTodayOfferCount() : null);
        card.setFactoryCount(stat != null ? stat.getTodayFactoryCount() : null);
        card.setPriceMin(stat != null ? stat.getPriceMin() : null);
        card.setPriceMax(stat != null ? stat.getPriceMax() : null);

        // 查询热门工厂
        try {
            List<FactoryStatWithPriceDTO> factoryStats = bizOfferMapper.aggregateByFactoryForCountryProduct(today, country, productId, category);
            if (factoryStats != null && !factoryStats.isEmpty()) {
                List<CountryProductCardDTO.FactoryPriceDTO> topFactories = new ArrayList<>();
                for (FactoryStatWithPriceDTO fs : factoryStats) {
                    CountryProductCardDTO.FactoryPriceDTO dto = new CountryProductCardDTO.FactoryPriceDTO();
                    dto.setFactoryNo(fs.getFactoryNo());
                    dto.setPriceMin(fs.getPriceMin());
                    dto.setPriceMax(fs.getPriceMax());
                    topFactories.add(dto);
                }
                card.setTopFactories(topFactories);
            }
        } catch (Exception e) {
            log.warn("获取热门工厂失败: country={}, productId={}, error={}", country, productId, e.getMessage());
        }

        return card;
    }

    private BrandProductCardDTO buildBrandProductCard(BizSearchHistory history, String category, LocalDate today, int rank) {
        Long brandId = history.getBrandId();
        Integer productId = history.getProductId() != null ? history.getProductId().intValue() : null;
        log.info("[DEBUG] buildBrandProductCard historyId={} searchWord={} brandId={} productId={}",
                history.getHistoryId(), history.getSearchWord(), brandId, productId);

        // 如果 history 没有 brandId，从 searchWord 中提取品牌名（不能用 searchByKeyword 直接查 searchWord，
        // 因为 SQL LIKE pattern 是 brand_name LIKE '%keyword%'，品牌名短于 searchWord 时匹配失败）
        // 注意：品牌全名可能是"巴西JBS"，搜索词是"JBS前腱"，用全名匹配会失败。
        // 必须用品牌简称（空格后的部分，如"JBS"）去包含匹配，才能处理短形式搜索。
        if (brandId == null) {
            String searchWord = history.getSearchWord();
            if (searchWord != null) {
                List<DictBrand> allBrands = brandMapper.selectAll();
                String searchWordNoSpace = searchWord.replace(" ", "");
                for (DictBrand b : allBrands) {
                    if (b.getBrandId() == null) continue;
                    String bn = b.getBrandName();
                    if (bn == null) continue;
                    // 提取品牌简称（"巴西JBS" → "JBS"，"JBS" → "JBS"）
                    String brandShortName = bn.contains(" ") ? bn.substring(bn.indexOf(" ") + 1).trim() : bn;
                    String brandShortNoSpace = brandShortName.replace(" ", "");
                    // 用简称去匹配：短形式搜索"JBS前腱" contains "JBS" → true
                    // 全形式搜索"巴西JBS 前腱"不经过此逻辑（brandId 已有值）
                    if (searchWordNoSpace.contains(brandShortNoSpace)) {
                        brandId = b.getBrandId().longValue();
                        log.info("[DEBUG] buildBrandProductCard brandId extracted searchWord={} -> brandId={} brandName={} brandShort={}",
                                searchWord, brandId, bn, brandShortName);
                        break;
                    }
                }
            }
        }

        // 如果 history 没有 productId，从 searchWord 中解析产品名
        if (productId == null) {
            String searchWord = history.getSearchWord();
            if (searchWord != null && brandId != null) {
                DictBrand brand = brandMapper.selectById(brandId.intValue());
                if (brand != null && brand.getBrandName() != null) {
                    String bn = brand.getBrandName();
                    String brandNameOnly = bn.contains(" ") ? bn.substring(bn.indexOf(" ") + 1).trim() : bn;
                    String productNameForSearch;
                    if (searchWord.contains(brandNameOnly)) {
                        // 取品牌名之后的内容作为产品名
                        int brandIdx = searchWord.indexOf(brandNameOnly);
                        productNameForSearch = searchWord.substring(brandIdx + brandNameOnly.length()).trim();
                    } else {
                        productNameForSearch = searchWord;
                    }
                    // 去掉"别名："格式
                    if (productNameForSearch.contains("(别名：")) {
                        int idx = productNameForSearch.indexOf("(别名：");
                        productNameForSearch = productNameForSearch.substring(0, idx);
                    }
                    if (!productNameForSearch.isEmpty()) {
                        DictProduct product = productMapper.selectByProductName(productNameForSearch);
                        if (product != null) {
                            productId = product.getProductId();
                        }
                    }
                }
            }
        }

        if (brandId == null || productId == null) {
            log.info("[DEBUG] buildBrandProductCard returning NULL: brandId={} productId={} searchWord={}", brandId, productId, history.getSearchWord());
            return null;
        }

        // 获取品牌名和产品名（用于聚合查询）
        String brandNameForStat = null;
        String productNameForStat = null;
        DictBrand brand = brandMapper.selectById(brandId.intValue());
        if (brand != null) {
            brandNameForStat = brand.getBrandName();
        }
        DictProduct product = productMapper.selectById(productId.longValue());
        if (product != null) {
            productNameForStat = product.getProductName();
        }
        if (brandNameForStat == null || productNameForStat == null) return null;

        // 从 stat_brand_product 表聚合查询（一个品牌名可能对应多条 brand_id 记录）
        StatBrandProduct stat = statBrandProductMapper.selectAggregatedByBrandNameAndProductName(brandNameForStat, productNameForStat, category);
        log.info("[DEBUG] buildBrandProductCard stat query brandName={} productName={} -> stat={}", brandNameForStat, productNameForStat, stat);

        BrandProductCardDTO card = new BrandProductCardDTO();
        card.setCardType("brandProduct");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setBrandId(stat != null ? stat.getBrandId() : null);
        card.setBrandName(stat != null ? stat.getBrandName() : brandNameForStat);
        card.setProductId(stat != null ? stat.getProductId() : productId);
        card.setProductName(stat != null ? stat.getProductName() : productNameForStat);
        card.setPriceMin(stat != null ? stat.getPriceMin() : null);
        card.setPriceMax(stat != null ? stat.getPriceMax() : null);
        card.setPriceChange(stat != null ? stat.getPriceChange() : null);
        card.setPriceChangeRate(stat != null ? stat.getPriceChangeRate() : null);
        card.setTodayOfferCount(stat != null ? stat.getTodayOfferCount() : null);
        card.setFactoryCount(stat != null ? stat.getTodayFactoryCount() : null);

        // 热门工厂（通过 dict_brand.brand_name 匹配，一个品牌有多个 brandId）
        List<FactoryStatWithPriceDTO> factoryStats = bizOfferMapper.aggregateByFactoryForBrandProduct(today, brandNameForStat, productId, category);
        log.info("[DEBUG] buildBrandProductCard hotFactory query brandName={} productId={} -> count={}", brandNameForStat, productId, factoryStats.size());
        List<BrandProductCardDTO.HotFactoryDTO> hotFactories = new ArrayList<>();
        for (FactoryStatWithPriceDTO fs : factoryStats) {
            BrandProductCardDTO.HotFactoryDTO dto = new BrandProductCardDTO.HotFactoryDTO();
            dto.setFactoryNo(fs.getFactoryNo());
            dto.setOfferCount(fs.getTodayOfferCount());
            dto.setPriceMin(fs.getPriceMin());
            dto.setPriceMax(fs.getPriceMax());
            hotFactories.add(dto);
        }
        card.setHotFactories(hotFactories);

        // 7日价格趋势：从 stat_brand_product 历史数据读取
        try {
            List<StatBrandProduct> trendRows = statBrandProductMapper.selectTrendByBrandNameAndProductName(brandNameForStat, productNameForStat, category);
            if (trendRows != null && !trendRows.isEmpty()) {
                List<BrandProductCardDTO.TrendPointDTO> trendPointDTOs = new ArrayList<>();
                for (StatBrandProduct tp : trendRows) {
                    BrandProductCardDTO.TrendPointDTO dto = new BrandProductCardDTO.TrendPointDTO();
                    dto.setDate(tp.getStatDate() != null ? tp.getStatDate().toString() : "");
                    dto.setAvgPrice(tp.getAvgPrice() != null ? tp.getAvgPrice().doubleValue() : null);
                    trendPointDTOs.add(dto);
                }
                card.setTrendPoints(trendPointDTOs);
                log.info("[DEBUG] buildBrandProductCard trend loaded brandName={} productName={} -> count={}", brandNameForStat, productNameForStat, trendPointDTOs.size());
            }
        } catch (Exception e) {
            log.warn("获取品牌产品价格趋势失败: {}", e.getMessage());
        }

        log.info("[DEBUG] buildBrandProductCard SUCCESS brandName={} productName={} hotFactoryCount={}", card.getBrandName(), card.getProductName(), hotFactories.size());
        return card;
    }

    private FactoryProductCardDTO buildFactoryProductCard(BizSearchHistory history, String category, LocalDate today, int rank) {
        String factoryNo = history.getFactoryNo();
        String country = history.getCountry();
        Integer productId = history.getProductId() != null ? history.getProductId().intValue() : null;

        if (factoryNo == null || country == null) {
            String keyword = history.getSearchWord();
            String extractedCountry = extractCountry(keyword);
            if (!extractedCountry.isEmpty()) {
                country = extractedCountry;
            }
            int idx = parseCountryAndFactory(keyword);
            if (idx >= 0 && factoryNo == null) {
                factoryNo = keyword.substring(idx);
                // 如果 factoryNo 包含空格（如 "SIF112 上脑"），只取第一部分
                if (factoryNo != null && factoryNo.contains(" ")) {
                    factoryNo = factoryNo.split(" ")[0];
                }
            }
        }
        // 产品名解析：当 productId 为 null 时从 keyword 解析
        if (productId == null) {
            String keyword = history.getSearchWord();
            // 去掉国家前缀
            String extractedCountry = extractCountry(keyword);
            String remaining = keyword;
            if (!extractedCountry.isEmpty()) {
                remaining = keyword.substring(extractedCountry.length()).trim();
            }
            // 如果剩余部分包含空格，按空格分割处理
            if (remaining.contains(" ")) {
                String[] parts = remaining.split(" ");
                // 跳过第一个可能是厂号的部分，取后续部分作为产品名
                // 例如 "SIF112 上脑" -> 跳过 "SIF112"，取 "上脑"
                // 例如 "SIF112 上脑 牛腩" -> 取 "上脑"
                StringBuilder productPart = new StringBuilder();
                for (int i = 1; i < parts.length; i++) {
                    String part = parts[i];
                    // 跳过包含连续数字的部分（认为是厂号的一部分）
                    if (part.length() >= 3 && part.length() <= 10 &&
                        Character.isLetter(part.charAt(0)) &&
                        part.matches(".*\\d.*")) {
                        continue;
                    }
                    if (productPart.length() > 0) {
                        productPart.append(" ");
                    }
                    productPart.append(part);
                }
                if (productPart.length() > 0) {
                    remaining = productPart.toString();
                }
            }
            if (!remaining.isEmpty()) {
                // 如果产品名包含"别名："格式，提取标准产品名（括号前的部分）
                if (remaining.contains("(别名：")) {
                    int idx = remaining.indexOf("(别名：");
                    remaining = remaining.substring(0, idx);
                }
                DictProduct product = productMapper.selectByProductName(remaining);
                if (product != null) {
                    productId = product.getProductId();
                }
            }
        }
        if (factoryNo == null || productId == null) return null;
        if (country == null) country = "";

        // 获取 factoryId 用于查询热门商家
        Integer factoryId = null;
        List<DictFactory> factories = factoryMapper.findByCountryAndFactoryNo(category, country, factoryNo);
        if (factories != null && !factories.isEmpty()) {
            factoryId = factories.get(0).getFactoryId();
        }

        StatFactoryProduct stat = statFactoryProductMapper.selectByFactoryNoAndProductId(factoryNo, productId, category);

        // 获取产品名用于 IQR 过滤查询
        String productName = stat != null ? stat.getProductName() : null;
        if (productName == null) {
            DictProduct product = productMapper.selectById(productId);
            if (product != null) {
                productName = product.getProductName();
            }
        }

        FactoryProductCardDTO card = new FactoryProductCardDTO();
        card.setCardType("factoryProduct");
        card.setRank(rank);
        card.setHistoryId(history.getHistoryId());
        card.setCountry(stat != null && stat.getCountry() != null ? stat.getCountry() : country);
        card.setCountryAlias(stat != null && stat.getCountry() != null ? stat.getCountry() : country);
        card.setFactoryNo(stat != null && stat.getFactoryNo() != null ? stat.getFactoryNo() : factoryNo);
        card.setProductId(stat != null ? stat.getProductId() : productId);
        card.setProductName(productName);
        // 价格区间：从实时 IQR 过滤 SQL 获取（口径与详情页一致）
        try {
            BizOfferMapper.PriceRange priceRange = bizOfferMapper.selectFilteredPriceRangeByCountryFactoryProduct(
                    country, factoryNo, productName, category, "报盘");
            card.setPriceMin(priceRange != null ? priceRange.priceMin : null);
            card.setPriceMax(priceRange != null ? priceRange.priceMax : null);
        } catch (Exception e) {
            log.warn("获取价格区间失败: country={}, factoryNo={}, product={}, error={}",
                    country, factoryNo, productName, e.getMessage());
            card.setPriceMin(stat != null ? stat.getPriceMin() : null);
            card.setPriceMax(stat != null ? stat.getPriceMax() : null);
        }
        // 价格涨跌：从 stat_price_trend 读取今日/昨日数据计算（口径与详情页一致）
        try {
            List<StatPriceTrendMapper.PriceTrendPoint> trendPoints = statPriceTrendMapper.selectTrendPointsByCountryFactoryProduct(
                    StatPriceTrendMapper.DIMENSION_COUNTRY_FACTORY_PRODUCT,
                    country,
                    productId,
                    factoryNo,
                    "报盘"
            );
            if (trendPoints != null && trendPoints.size() >= 2) {
                StatPriceTrendMapper.PriceTrendPoint todayPoint = null;
                StatPriceTrendMapper.PriceTrendPoint yesterdayPoint = null;
                for (StatPriceTrendMapper.PriceTrendPoint p : trendPoints) {
                    if (p.date != null && p.date.equals(today)) {
                        todayPoint = p;
                    } else if (p.date != null && p.date.equals(today.minusDays(1))) {
                        yesterdayPoint = p;
                    }
                }
                if (todayPoint != null && yesterdayPoint != null
                        && todayPoint.avgPrice != null && yesterdayPoint.avgPrice != null) {
                    BigDecimal todayPrice = todayPoint.avgPrice;
                    BigDecimal yesterdayPrice = yesterdayPoint.avgPrice;
                    BigDecimal change = todayPrice.subtract(yesterdayPrice).setScale(2, RoundingMode.HALF_UP);
                    card.setPriceChange(change);
                    // price_change_rate: ±999.99 上限约束（DECIMAL(5,2)）
                    if (yesterdayPrice.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal rate = change.divide(yesterdayPrice, 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100))
                                .setScale(2, RoundingMode.HALF_UP);
                        if (rate.abs().compareTo(new BigDecimal("999.99")) > 0) {
                            rate = rate.signum() == 1 ? new BigDecimal("999.99") : new BigDecimal("-999.99");
                        }
                        card.setPriceChangeRate(rate);
                    } else {
                        card.setPriceChangeRate(null);
                    }
                } else {
                    card.setPriceChange(stat != null ? stat.getPriceChange() : null);
                    card.setPriceChangeRate(stat != null ? stat.getPriceChangeRate() : null);
                }
            } else {
                card.setPriceChange(stat != null ? stat.getPriceChange() : null);
                card.setPriceChangeRate(stat != null ? stat.getPriceChangeRate() : null);
            }
        } catch (Exception e) {
            log.warn("获取价格趋势失败: country={}, factoryNo={}, productId={}, error={}",
                    country, factoryNo, productId, e.getMessage());
            card.setPriceChange(stat != null ? stat.getPriceChange() : null);
            card.setPriceChangeRate(stat != null ? stat.getPriceChangeRate() : null);
        }
        card.setTodayOfferCount(stat != null ? stat.getTodayOfferCount() : null);
        card.setInquiryCount(stat != null ? stat.getTodayInquiryCount() : null);

        // 价格趋势
        try {
            List<StatPriceTrendMapper.PriceTrendPoint> trendPoints = statPriceTrendMapper.selectTrendPointsByCountryFactoryProduct(
                    StatPriceTrendMapper.DIMENSION_COUNTRY_FACTORY_PRODUCT,
                    country,
                    productId,
                    factoryNo,
                    "报盘"
            );
            if (trendPoints != null && !trendPoints.isEmpty()) {
                List<FactoryProductCardDTO.TrendPointDTO> trendPointDTOs = new ArrayList<>();
                for (StatPriceTrendMapper.PriceTrendPoint p : trendPoints) {
                    FactoryProductCardDTO.TrendPointDTO dto = new FactoryProductCardDTO.TrendPointDTO();
                    dto.setDate(p.date != null ? p.date.toString() : "");
                    dto.setAvgPrice(p.avgPrice != null ? p.avgPrice.doubleValue() : null);
                    trendPointDTOs.add(dto);
                }
                card.setTrendPoints(trendPointDTOs);
            }
        } catch (Exception e) {
            log.warn("获取价格趋势失败: {}", e.getMessage());
        }

        // 热门商家（SQL 已 JOIN dict_merchant 返回 merchantName）
        if (factoryId != null) {
            List<MerchantStatWithPriceDTO> merchantStats = bizOfferMapper.aggregateByMerchantForFactoryProduct(today, factoryId, productId, category);
            List<FactoryProductCardDTO.HotMerchantDTO> hotMerchants = new ArrayList<>();
            for (MerchantStatWithPriceDTO ms : merchantStats) {
                FactoryProductCardDTO.HotMerchantDTO dto = new FactoryProductCardDTO.HotMerchantDTO();
                dto.setMerchantId(ms.getMerchantId());
                // SQL 已 LEFT JOIN dict_merchant.short_name，fallback 到 ID
                if (ms.getMerchantName() != null && !ms.getMerchantName().isEmpty() && !"NULL".equalsIgnoreCase(ms.getMerchantName())) {
                    dto.setMerchantName(ms.getMerchantName());
                } else {
                    dto.setMerchantName("商家-" + ms.getMerchantId());
                }
                dto.setOfferCount(ms.getTodayOfferCount());
                dto.setPriceMin(ms.getPriceMin());
                dto.setPriceMax(ms.getPriceMax());
                hotMerchants.add(dto);
            }
            card.setHotMerchants(hotMerchants);
        }

        return card;
    }

    private List<CountryCardDTO.HotFactoryDTO> parseHotFactoriesFromJson(String json) {
        List<CountryCardDTO.HotFactoryDTO> result = new ArrayList<>();
        if (json == null || json.isEmpty()) return result;
        try {
            List<?> list = objectMapper.readValue(json, new TypeReference<List<?>>() {});
            for (int i = 0; i < Math.min(list.size(), 3); i++) {
                if (list.get(i) instanceof String) {
                    CountryCardDTO.HotFactoryDTO dto = new CountryCardDTO.HotFactoryDTO();
                    dto.setFactoryNo((String) list.get(i));
                    result.add(dto);
                }
            }
        } catch (Exception e) {
            log.warn("解析hotFactories失败: {}", e.getMessage());
        }
        return result;
    }

    private List<CountryCardDTO.HotProductDTO> parseHotProductsFromJson(String json) {
        List<CountryCardDTO.HotProductDTO> result = new ArrayList<>();
        if (json == null || json.isEmpty()) return result;
        try {
            List<?> list = objectMapper.readValue(json, new TypeReference<List<?>>() {});
            for (int i = 0; i < Math.min(list.size(), 3); i++) {
                if (list.get(i) instanceof String) {
                    CountryCardDTO.HotProductDTO dto = new CountryCardDTO.HotProductDTO();
                    dto.setProductName((String) list.get(i));
                    result.add(dto);
                }
            }
        } catch (Exception e) {
            log.warn("解析hotProducts失败: {}", e.getMessage());
        }
        return result;
    }

    @Override
    @CacheEvict(value = {"recentSearchCards", "selfSelectCards"}, allEntries = true)
    @Transactional
    public void deleteSearchHistory(Long historyId) {
        searchHistoryMapper.deleteById(historyId);
    }

    @Override
    @CacheEvict(value = {"recentSearchCards", "selfSelectCards"}, allEntries = true)
    @Transactional
    public void batchDeleteSearchHistory(List<Long> historyIds) {
        searchHistoryMapper.batchDelete(historyIds);
    }

    @Override
    @CacheEvict(value = {"recentSearchCards", "selfSelectCards"}, allEntries = true)
    @Transactional
    public void addSelfSelect(Long userId, String searchWord, String searchType) {
        Long existingId = searchHistoryMapper.findExistingHistory(userId, searchWord, searchType);
        if (existingId != null) {
            BizSearchHistory history = new BizSearchHistory();
            history.setHistoryId(existingId);
            history.setIsSelfSelect(1);
            searchHistoryMapper.updateById(history);
        } else {
            searchHistoryMapper.insertOrIgnore(userId, searchWord, searchType, 1);
        }
    }

    @Override
    @CacheEvict(value = {"recentSearchCards", "selfSelectCards"}, allEntries = true)
    @Transactional
    public void cancelSelfSelect(Long historyId) {
        BizSearchHistory history = new BizSearchHistory();
        history.setHistoryId(historyId);
        history.setIsSelfSelect(0);
        searchHistoryMapper.updateById(history);
    }

    @Override
    @CacheEvict(value = {"recentSearchCards", "selfSelectCards"}, allEntries = true)
    @Transactional
    public void moveToSelfSelect(Long historyId) {
        BizSearchHistory history = new BizSearchHistory();
        history.setHistoryId(historyId);
        history.setIsSelfSelect(1);
        searchHistoryMapper.updateById(history);
    }

    private List<SearchHistoryDTO> convertToDTO(List<BizSearchHistory> histories) {
        List<SearchHistoryDTO> result = new ArrayList<>();
        for (BizSearchHistory h : histories) {
            SearchHistoryDTO dto = new SearchHistoryDTO();
            dto.historyId = h.getHistoryId();
            dto.searchWord = h.getSearchWord();
            dto.searchType = h.getSearchType();
            dto.isSelfSelect = h.getIsSelfSelect();
            dto.createTime = h.getCreateTime() != null ? h.getCreateTime().format(DATE_FORMATTER) : "";

            fillDetailInfo(dto);

            result.add(dto);
        }
        return result;
    }

    private void fillDetailInfo(SearchHistoryDTO dto) {
        String keyword = dto.searchWord;
        String type = dto.searchType;

        try {
            switch (type) {
                case "产品":
                    DictProduct product = productMapper.selectByProductName(keyword);
                    if (product != null) {
                        dto.productId = product.getProductId();
                        dto.productName = product.getProductName();
                    }
                    break;
                case "国家":
                    dto.country = keyword;
                    break;
                case "品牌":
                    brandMapper.findByName(keyword).ifPresent(b -> {
                        dto.brandId = b.getBrandId();
                    });
                    break;
                case "商家":
                    merchantMapper.findByName(keyword).ifPresent(m -> {
                        dto.merchantId = m.getMerchantId();
                    });
                    break;
                case "国家厂号":
                    int idx = parseCountryAndFactory(keyword);
                    if (idx > 0) {
                        dto.country = keyword.substring(0, idx);
                        dto.factoryNo = keyword.substring(idx);
                    }
                    break;
                case "国家产品":
                    dto.country = extractCountry(keyword);
                    dto.productName = keyword.substring(dto.country.length()).trim();
                    break;
                case "品牌产品":
                    int spaceIdx = keyword.lastIndexOf(" ");
                    if (spaceIdx > 0) {
                        dto.productName = keyword.substring(spaceIdx + 1);
                    }
                    break;
                case "国家厂号产品":
                    parseCountryFactoryProduct(keyword, dto);
                    break;
            }
        } catch (Exception e) {
            log.warn("解析搜索历史详情失败: keyword={}, type={}, error={}", keyword, type, e.getMessage());
        }
    }

    private int parseCountryAndFactory(String keyword) {
        // 如果有空格，尝试按空格分割
        if (keyword.contains(" ")) {
            String[] parts = keyword.split(" ");
            if (parts.length >= 2) {
                // 找第一个包含字母+数字的部分（厂号）
                for (int i = 1; i < parts.length; i++) {
                    String part = parts[i];
                    if (part.length() >= 3 && Character.isLetter(part.charAt(0))) {
                        // 检查是否包含数字（厂号特征）
                        boolean hasDigit = false;
                        for (char c : part.toCharArray()) {
                            if (Character.isDigit(c)) {
                                hasDigit = true;
                                break;
                            }
                        }
                        if (hasDigit) {
                            // 返回这部分在原字符串中的起始位置
                            return keyword.indexOf(part);
                        }
                    }
                }
            }
        }
        // 没有空格的话，在去掉空格的字符串中查找字母+数字模式
        String noSpace = keyword.replace(" ", "");
        for (int i = 0; i < noSpace.length(); i++) {
            char c = noSpace.charAt(i);
            if (Character.isLetter(c) && i + 2 < noSpace.length() && Character.isDigit(noSpace.charAt(i + 1))) {
                return keyword.indexOf(noSpace.charAt(i));
            }
        }
        return -1;
    }

    private String extractCountry(String keyword) {
        String[] countries = {"巴西", "阿根廷", "乌拉圭", "澳大利亚", "新西兰", "美国", "加拿大", "中国"};
        for (String country : countries) {
            if (keyword.startsWith(country)) {
                return country;
            }
        }
        return "";
    }

    private void parseCountryFactoryProduct(String keyword, SearchHistoryDTO dto) {
        String country = extractCountry(keyword);
        dto.country = country;

        String remaining = keyword.substring(country.length());
        int factoryStart = -1;
        for (int i = 0; i < remaining.length(); i++) {
            char c = remaining.charAt(i);
            if (Character.isLetter(c) && i + 1 < remaining.length() && Character.isDigit(remaining.charAt(i + 1))) {
                factoryStart = i;
                break;
            }
        }

        if (factoryStart >= 0) {
            String factoryPart = remaining.substring(factoryStart);
            dto.factoryNo = factoryPart;

            dto.productName = remaining.substring(0, factoryStart).trim();
            if (dto.productName.isEmpty()) {
                dto.productName = factoryPart;
                dto.factoryNo = "";
            }
        } else {
            dto.productName = remaining;
        }
    }
}
