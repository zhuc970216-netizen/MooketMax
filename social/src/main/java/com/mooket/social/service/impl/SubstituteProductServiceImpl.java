package com.mooket.social.service.impl;

import com.mooket.social.dto.SubstituteProductDTO;
import com.mooket.social.dto.SubstituteProductDTO.*;
import com.mooket.social.dto.GroupedOfferFilterOptionsDTO;
import com.mooket.social.entity.BizOffer;
import com.mooket.social.entity.DictMerchant;
import com.mooket.social.entity.DictProduct;
import com.mooket.social.mapper.*;
import com.mooket.social.service.SubstituteProductService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 平替产品服务实现
 */
@Service
public class SubstituteProductServiceImpl implements SubstituteProductService {

    private final FactoryTierMapper factoryTierMapper;
    private final BizOfferMapper offerMapper;
    private final StatPriceTrendMapper trendMapper;
    private final DictProductMapper productMapper;
    private final DictMerchantMapper merchantMapper;

    public SubstituteProductServiceImpl(FactoryTierMapper factoryTierMapper,
                                         BizOfferMapper offerMapper,
                                         StatPriceTrendMapper trendMapper,
                                         DictProductMapper productMapper,
                                         DictMerchantMapper merchantMapper) {
        this.factoryTierMapper = factoryTierMapper;
        this.offerMapper = offerMapper;
        this.trendMapper = trendMapper;
        this.productMapper = productMapper;
        this.merchantMapper = merchantMapper;
    }

    @Override
    public SubstituteProductDTO getSubstituteProducts(String country, String factoryNo, String productName, String category) {
        // 1. 查询当前厂号的等级
        List<String> tierLookupProductNames = resolveTierLookupProductNames(category, productName, null);
        String tier = tierLookupProductNames.isEmpty()
                ? null
                : factoryTierMapper.selectTierByFactoryNoAndProductNames(category, tierLookupProductNames, factoryNo);
        if (tier == null) {
            return new SubstituteProductDTO();
        }

        // 2. 查询同产品同等级的所有厂号
        List<String> factoryNos = factoryTierMapper.selectFactoryNosByTierAndProductNames(
                category,
                tierLookupProductNames,
                tier
        );
        if (factoryNos == null || factoryNos.isEmpty()) {
            return new SubstituteProductDTO();
        }

        // 3. 构建平替产品DTO
        SubstituteProductDTO dto = new SubstituteProductDTO();
        dto.setCategory(category);
        dto.setProductName(productName);
        dto.setCurrentFactoryNo(factoryNo);
        dto.setTier(tier);

        // 4. 获取每个厂号的价格区间和统计数据
        List<SubstituteFactory> factories = new ArrayList<>();
        for (String fn : factoryNos) {
            BizOfferMapper.PriceRange priceRange = offerMapper.selectFilteredPriceRangeByCountryFactoryProduct(
                    country, fn, productName, category, "报盘");
            BizOfferMapper.CountryFactoryProductStats stats = offerMapper.selectCountryFactoryProductStats(
                    country, fn, productName, category);

            SubstituteFactory sf = new SubstituteFactory();
            sf.setFactoryNo(fn);
            sf.setPriceMin(priceRange != null ? priceRange.priceMin : null);
            sf.setPriceMax(priceRange != null ? priceRange.priceMax : null);
            sf.setOfferCount(stats != null && stats.totalOfferCount != null ? stats.totalOfferCount : 0L);
            sf.setMerchantCount(stats != null && stats.merchantCount != null ? stats.merchantCount : 0);
            sf.setSelected(fn.equals(factoryNo));
            factories.add(sf);
        }

        dto.setFactories(factories);

        // 5. 计算总体价格区间
        BigDecimal minPrice = factories.stream()
                .map(SubstituteFactory::getPriceMin)
                .filter(Objects::nonNull)
                .min(BigDecimal::compareTo)
                .orElse(null);
        BigDecimal maxPrice = factories.stream()
                .map(SubstituteFactory::getPriceMax)
                .filter(Objects::nonNull)
                .max(BigDecimal::compareTo)
                .orElse(null);
        dto.setPriceMin(minPrice);
        dto.setPriceMax(maxPrice);

        // 6. 统计总报盘数和商家数
        long totalOfferCount = factories.stream()
                .mapToLong(SubstituteFactory::getOfferCount)
                .sum();
        int totalMerchantCount = factories.stream()
                .mapToInt(SubstituteFactory::getMerchantCount)
                .sum();
        dto.setOfferCount(totalOfferCount);
        dto.setMerchantCount(totalMerchantCount);

        return dto;
    }

    @Override
    public SubstituteProductDetailDTO getSubstituteProductDetail(String country, String factoryNo,
                                                                   String productName, String category,
                                                                   String type, String sortBy,
                                                                   int page, int pageSize) {
        SubstituteProductDetailDTO dto = new SubstituteProductDetailDTO();
        dto.setCountry(country);
        dto.setFactoryNo(factoryNo);
        dto.setProductName(productName);

        // 获取 productId
        DictProduct product = productMapper.findByName(category, productName);
        if (product != null && product.getProductId() != null) {
            dto.setProductId(product.getProductId());
        }

        // 获取等级
        List<String> tierLookupProductNames = resolveTierLookupProductNames(category, productName, product);
        String tier = tierLookupProductNames.isEmpty()
                ? null
                : factoryTierMapper.selectTierByFactoryNoAndProductNames(category, tierLookupProductNames, factoryNo);
        dto.setTier(tier);

        // 看板统计
        BizOfferMapper.CountryFactoryProductStats stats = offerMapper.selectCountryFactoryProductStats(
                country, factoryNo, productName, category);
        dto.setOfferCount(stats != null && stats.totalOfferCount != null ? stats.totalOfferCount : 0L);
        dto.setInquiryCount(stats != null && stats.totalInquiryCount != null ? stats.totalInquiryCount : 0L);
        dto.setMerchantCount(stats != null && stats.merchantCount != null ? stats.merchantCount : 0);

        // 价格区间
        String offerType = "offer".equalsIgnoreCase(type) ? "报盘" : ("inquiry".equalsIgnoreCase(type) ? "求购" : null);
        BizOfferMapper.PriceRange priceRange = offerMapper.selectFilteredPriceRangeByCountryFactoryProduct(
                country, factoryNo, productName, category, offerType);
        dto.setPriceMin(priceRange != null ? priceRange.priceMin : null);
        dto.setPriceMax(priceRange != null ? priceRange.priceMax : null);

        // 涨跌
        calculatePriceChange(country, factoryNo, dto.getProductId(), productName, category, offerType, dto);

        // 价格走势
        dto.setPriceHistory7Days(getPriceHistory7Days(country, factoryNo, dto.getProductId(), productName, category, offerType));
        dto.setPriceHistory30Days(getPriceHistory30Days(country, factoryNo, dto.getProductId(), productName, category, offerType));

        // 报盘列表：统一改为数据库全局排序 + 分页
        int offset = (page - 1) * pageSize;
        List<BizOfferMapper.MerchantGroupAgg> merchantAggs = offerMapper.selectCountryFactoryProductMerchantAgg(
                country, factoryNo, productName, category, offerType, normalizeSortBy(sortBy), pageSize, offset);
        int totalCount = offerMapper.countCountryFactoryProductMerchantAgg(country, factoryNo, productName, category, offerType);
        int totalPages = (int) Math.ceil((double) totalCount / pageSize);
        List<MerchantOfferGroup> pagedGroups = buildMerchantOfferGroupsPage(
                country, factoryNo, productName, category, offerType, merchantAggs);
        List<BizOffer> allOffers = offerMapper.selectOfferListByCountryFactoryProductAll(
                country, factoryNo, productName, category, offerType);

        dto.setMerchantOffers(pagedGroups);
        dto.setFilterOptions(buildFilterOptions(allOffers, merchantMapByOffers(allOffers)));
        dto.setTotalCount(totalCount);
        dto.setPage(page);
        dto.setPageSize(pageSize);
        dto.setTotalPages(totalPages);

        return dto;
    }

    private void calculatePriceChange(String country, String factoryNo, Integer productId,
                                       String productName, String category, String offerType,
                                       SubstituteProductDetailDTO dto) {
        List<StatPriceTrendMapper.PriceTrendPoint> trendPoints = trendMapper.selectTrendPointsByCountryFactoryProduct(
                StatPriceTrendMapper.DIMENSION_COUNTRY_FACTORY_PRODUCT,
                country,
                productId,
                factoryNo,
                offerType
        );

        if (trendPoints == null || trendPoints.isEmpty()) {
            dto.setPriceChange(null);
            dto.setPriceChangeRate(null);
            return;
        }

        trendPoints.sort(Comparator.comparing(p -> p.date));

        BigDecimal todayPrice = null;
        BigDecimal yesterdayPrice = null;

        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);

        for (StatPriceTrendMapper.PriceTrendPoint point : trendPoints) {
            if (point.date.equals(today)) {
                todayPrice = point.avgPrice;
            } else if (point.date.equals(yesterday)) {
                yesterdayPrice = point.avgPrice;
            }
        }

        if (todayPrice != null && yesterdayPrice != null && yesterdayPrice.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal change = todayPrice.subtract(yesterdayPrice).setScale(1, RoundingMode.HALF_UP);
            BigDecimal changeRate = change.multiply(new BigDecimal("100"))
                    .divide(yesterdayPrice, 1, RoundingMode.HALF_UP);
            dto.setPriceChange(change);
            dto.setPriceChangeRate(changeRate);
        } else {
            dto.setPriceChange(null);
            dto.setPriceChangeRate(null);
        }
    }

    private List<DailyPrice> getPriceHistory7Days(String country, String factoryNo, Integer productId,
                                                   String productName, String category, String offerType) {
        if (productId == null) {
            return Collections.emptyList();
        }

        List<StatPriceTrendMapper.PriceTrendPoint> trendPoints = trendMapper.selectTrendPointsByCountryFactoryProduct(
                StatPriceTrendMapper.DIMENSION_COUNTRY_FACTORY_PRODUCT,
                country,
                productId,
                factoryNo,
                offerType
        );

        if (trendPoints == null || trendPoints.isEmpty()) {
            return Collections.emptyList();
        }

        LocalDate sevenDaysAgo = LocalDate.now().minusDays(6);
        List<StatPriceTrendMapper.PriceTrendPoint> recentPoints = trendPoints.stream()
                .filter(p -> p.date != null && !p.date.isBefore(sevenDaysAgo))
                .collect(Collectors.toList());

        if (recentPoints.isEmpty()) {
            return Collections.emptyList();
        }

        java.time.format.DateTimeFormatter shortFormatter = java.time.format.DateTimeFormatter.ofPattern("MM-dd");
        java.time.format.DateTimeFormatter fullFormatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd");

        return recentPoints.stream()
                .map(point -> {
                    DailyPrice dp = new DailyPrice();
                    dp.setDate(point.date.format(shortFormatter));
                    dp.setFullDate(point.date.format(fullFormatter));
                    dp.setAvgPrice(point.avgPrice != null ? point.avgPrice.setScale(1, RoundingMode.HALF_UP) : null);
                    dp.setPriceUnit("元/kg");
                    dp.setOfferCount(null);
                    return dp;
                })
                .collect(Collectors.toList());
    }

    private List<DailyPrice> getPriceHistory30Days(String country, String factoryNo, Integer productId,
                                                    String productName, String category, String offerType) {
        if (productId == null) {
            return Collections.emptyList();
        }

        List<StatPriceTrendMapper.PriceTrendPoint> trendPoints = trendMapper.selectTrendPointsByCountryFactoryProduct(
                StatPriceTrendMapper.DIMENSION_COUNTRY_FACTORY_PRODUCT,
                country,
                productId,
                factoryNo,
                offerType
        );

        if (trendPoints == null || trendPoints.isEmpty()) {
            return Collections.emptyList();
        }

        java.time.format.DateTimeFormatter shortFormatter = java.time.format.DateTimeFormatter.ofPattern("MM-dd");
        java.time.format.DateTimeFormatter fullFormatter = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd");

        return trendPoints.stream()
                .map(point -> {
                    DailyPrice dp = new DailyPrice();
                    dp.setDate(point.date.format(shortFormatter));
                    dp.setFullDate(point.date.format(fullFormatter));
                    dp.setAvgPrice(point.avgPrice != null ? point.avgPrice.setScale(1, RoundingMode.HALF_UP) : null);
                    dp.setPriceUnit("元/kg");
                    dp.setOfferCount(null);
                    return dp;
                })
                .collect(Collectors.toList());
    }

    private List<MerchantOfferGroup> buildMerchantOfferGroupsPage(String country, String factoryNo,
                                                                  String productName, String category,
                                                                  String offerType,
                                                                  List<BizOfferMapper.MerchantGroupAgg> merchantAggs) {
        if (merchantAggs == null || merchantAggs.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> merchantIds = merchantAggs.stream()
                .map(agg -> agg.merchantId)
                .filter(Objects::nonNull)
                .filter(merchantId -> merchantId > 0)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, DictMerchant> merchantMap = merchantIds.isEmpty()
                ? Collections.emptyMap()
                : merchantMapper.selectBatchIds(merchantIds).stream()
                .collect(Collectors.toMap(DictMerchant::getMerchantId, merchant -> merchant, (left, right) -> left));

        List<BizOffer> offerDetails = new ArrayList<>();
        if (!merchantIds.isEmpty()) {
            offerDetails.addAll(offerMapper.selectOfferListByCountryFactoryProductMerchantIds(
                    country, factoryNo, productName, category, offerType, merchantIds));
        }
        offerDetails.addAll(offerMapper.selectOfferListByCountryFactoryProductNoMerchant(
                country, factoryNo, productName, category, offerType));

        Map<String, List<BizOffer>> offersByGroup = offerDetails.stream()
                .collect(Collectors.groupingBy(
                        offer -> merchantGroupKey(offer.getMerchantId()),
                        LinkedHashMap::new,
                        Collectors.toList()));

        List<MerchantOfferGroup> groups = new ArrayList<>();
        for (BizOfferMapper.MerchantGroupAgg agg : merchantAggs) {
            List<BizOffer> groupOffers = offersByGroup.getOrDefault(
                    merchantGroupKey(agg.merchantId),
                    Collections.emptyList());

            MerchantOfferGroup group = new MerchantOfferGroup();
            group.setMerchantId(agg.merchantId != null && agg.merchantId > 0 ? agg.merchantId : null);
            group.setMerchantPhone(agg.contactPhone);
            group.setOfferCount(agg.offerCount != null ? agg.offerCount : groupOffers.size());

            if (agg.merchantId != null && agg.merchantId > 0) {
                DictMerchant merchant = merchantMap.get(agg.merchantId);
                if (merchant != null) {
                    group.setMerchantName(merchant.getMerchantName());
                    boolean isFamous = merchant.getMerchantTags() != null &&
                            merchant.getMerchantTags().contains("知名商家");
                    group.setFamousMerchant(isFamous);
                } else {
                    group.setMerchantName(agg.contactPhone);
                    group.setFamousMerchant(false);
                }
            } else {
                group.setMerchantId(null);
                group.setMerchantName("暂未关联行业商家");
                group.setMerchantPhone(agg.contactPhone);
                group.setFamousMerchant(false);
            }

            List<EmployeeOfferDTO> employeeOfferDTOs = groupOffers.stream()
                    .sorted(Comparator.comparing(BizOffer::getPublishTime, Comparator.nullsLast(Comparator.reverseOrder())))
                    .map(this::convertToEmployeeOfferDTO)
                    .collect(Collectors.toList());
            group.setEmployeeOffers(employeeOfferDTOs);
            groups.add(group);
        }
        return groups;
    }

    private String merchantGroupKey(Long merchantId) {
        return merchantId != null && merchantId > 0 ? "merchant_" + merchantId : "NO_MERCHANT";
    }

    private String normalizeSortBy(String sortBy) {
        if (sortBy == null || sortBy.isBlank()) {
            return "comprehensive";
        }
        return sortBy;
    }

    private List<String> resolveTierLookupProductNames(String category, String productName, DictProduct product) {
        LinkedHashSet<String> productNames = new LinkedHashSet<>();
        addTierLookupProductName(productNames, productName);

        DictProduct resolvedProduct = product;
        if (resolvedProduct == null && productName != null && !productName.isBlank()) {
            resolvedProduct = productMapper.findByName(category, productName);
            if (resolvedProduct == null) {
                resolvedProduct = productMapper.selectByProductName(productName);
            }
        }

        if (resolvedProduct != null) {
            addTierLookupProductName(productNames, resolvedProduct.getProductName());
            for (String alias : splitAliasValues(resolvedProduct.getAliasList())) {
                addTierLookupProductName(productNames, alias);
            }
        }

        return new ArrayList<>(productNames);
    }

    private void addTierLookupProductName(Set<String> productNames, String value) {
        if (value == null) {
            return;
        }
        String trimmed = value.trim();
        if (!trimmed.isEmpty()) {
            productNames.add(trimmed);
        }
    }

    private List<String> splitAliasValues(String aliasList) {
        if (aliasList == null || aliasList.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(aliasList.split("[,\uFF0C\u3001]"))
                .map(String::trim)
                .filter(alias -> !alias.isEmpty())
                .toList();
    }

    private GroupedOfferFilterOptionsDTO buildFilterOptions(List<BizOffer> offers, Map<Long, DictMerchant> merchantMap) {
        GroupedOfferFilterOptionsDTO dto = new GroupedOfferFilterOptionsDTO();
        dto.setMerchants(uniqueMerchantOptions(offers, merchantMap));
        dto.setRegions(uniqueStrings(offers.stream()
                .map(BizOffer::getGoodsLocation)
                .map(this::extractCity)
                .toList()));
        dto.setGoodsTypes(uniqueStrings(offers.stream().map(BizOffer::getGoodsType).toList()));
        dto.setFeedingMethods(uniqueStrings(offers.stream().map(BizOffer::getFeedingType).toList()));
        dto.setTags(uniqueStrings(offers.stream().flatMap(offer -> splitTags(offer.getTags()).stream()).toList()));
        return dto;
    }

    private Map<Long, DictMerchant> merchantMapByOffers(List<BizOffer> offers) {
        List<Long> merchantIds = offers.stream()
                .map(BizOffer::getMerchantId)
                .filter(Objects::nonNull)
                .filter(id -> id > 0)
                .distinct()
                .toList();
        if (merchantIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return merchantMapper.selectBatchIds(merchantIds).stream()
                .collect(Collectors.toMap(DictMerchant::getMerchantId, merchant -> merchant, (left, right) -> left));
    }

    private List<GroupedOfferFilterOptionsDTO.OptionItem> uniqueMerchantOptions(List<BizOffer> offers, Map<Long, DictMerchant> merchantMap) {
        LinkedHashMap<String, GroupedOfferFilterOptionsDTO.OptionItem> map = new LinkedHashMap<>();
        for (BizOffer offer : offers) {
            String key = offer.getMerchantId() != null && offer.getMerchantId() > 0
                    ? String.valueOf(offer.getMerchantId())
                    : Objects.toString(offer.getContactPhone(), "NO_MERCHANT");
            String label = "暂未关联行业商家";
            if (offer.getMerchantId() != null && offer.getMerchantId() > 0) {
                DictMerchant merchant = merchantMap.get(offer.getMerchantId());
                label = merchant != null && merchant.getMerchantName() != null && !merchant.getMerchantName().isBlank()
                        ? merchant.getMerchantName()
                        : Objects.toString(offer.getContactPhone(), "暂未关联行业商家");
            }
            final String labelValue = label;
            map.computeIfAbsent(key, ignored -> {
                GroupedOfferFilterOptionsDTO.OptionItem item = new GroupedOfferFilterOptionsDTO.OptionItem();
                item.setKey(key);
                item.setLabel(labelValue);
                return item;
            });
        }
        return new ArrayList<>(map.values());
    }

    private List<String> uniqueStrings(List<String> values) {
        LinkedHashSet<String> set = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null) {
                continue;
            }
            String trimmed = value.trim();
            if (!trimmed.isEmpty()) {
                set.add(trimmed);
            }
        }
        return new ArrayList<>(set);
    }

    private String extractCity(String goodsLocation) {
        if (goodsLocation == null) {
            return null;
        }
        String trimmed = goodsLocation.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        int dashIndex = trimmed.indexOf('-');
        return dashIndex > 0 ? trimmed.substring(0, dashIndex).trim() : trimmed;
    }

    private List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(tags.split("[,，、/]"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }

    private EmployeeOfferDTO convertToEmployeeOfferDTO(BizOffer offer) {
        EmployeeOfferDTO dto = new EmployeeOfferDTO();
        dto.setOfferId(offer.getOfferId());
        dto.setUserNickname(offer.getUserNickname());
        dto.setWeight(offer.getWeight());
        dto.setGoodsLocation(offer.getGoodsLocation());
        dto.setGoodsType(offer.getGoodsType());
        dto.setFeedingType(offer.getFeedingType());
        dto.setFatRatio(offer.getFatRatio());
        dto.setCattleBreed(offer.getCattleBreed());
        dto.setTags(offer.getTags());
        dto.setRemark(offer.getRemark());
        dto.setOfferType(offer.getOfferType());
        dto.setOfferOriginalText(offer.getOfferOriginalText());

        if (offer.getPublishTime() != null) {
            dto.setPublishTime(offer.getPublishTime().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        }

        if (offer.getPrice() != null) {
            if (offer.getPriceMax() != null && !offer.getPriceMax().equals(offer.getPrice())) {
                dto.setPrice(String.format("%.1f-%.1f", offer.getPrice(), offer.getPriceMax()));
            } else {
                dto.setPrice(String.format("%.1f", offer.getPrice()));
            }
        } else {
            dto.setPrice("协商报价");
        }

        return dto;
    }

    private BigDecimal getMinPrice(List<EmployeeOfferDTO> offers) {
        return offers.stream()
                .map(EmployeeOfferDTO::getPrice)
                .filter(p -> p != null && !p.equals("协商报价"))
                .map(p -> {
                    if (p.contains("-")) {
                        return new BigDecimal(p.split("-")[0]);
                    }
                    return new BigDecimal(p);
                })
                .min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
    }

    private BigDecimal getMaxPrice(List<EmployeeOfferDTO> offers) {
        return offers.stream()
                .map(EmployeeOfferDTO::getPrice)
                .filter(p -> p != null && !p.equals("协商报价"))
                .map(p -> {
                    if (p.contains("-")) {
                        String[] parts = p.split("-");
                        return new BigDecimal(parts[parts.length - 1]);
                    }
                    return new BigDecimal(p);
                })
                .max(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
    }
}
