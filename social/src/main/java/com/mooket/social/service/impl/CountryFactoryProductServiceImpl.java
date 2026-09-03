package com.mooket.social.service.impl;

import com.mooket.social.dto.CountryFactoryProductDetailDTO;
import com.mooket.social.dto.CountryFactoryProductDetailDTO.DailyPrice;
import com.mooket.social.dto.CountryFactoryProductDetailDTO.EmployeeOfferDTO;
import com.mooket.social.dto.CountryFactoryProductDetailDTO.MerchantOfferGroup;
import com.mooket.social.dto.GroupedOfferFilterOptionsDTO;
import com.mooket.social.entity.BizOffer;
import com.mooket.social.entity.DictMerchant;
import com.mooket.social.entity.DictProduct;
import com.mooket.social.mapper.BizOfferMapper;
import com.mooket.social.mapper.DictMerchantMapper;
import com.mooket.social.mapper.DictProductMapper;
import com.mooket.social.mapper.FactoryTierMapper;
import com.mooket.social.mapper.StatFactoryProductMapper;
import com.mooket.social.mapper.StatPriceTrendMapper;
import com.mooket.social.entity.StatFactoryProduct;
import com.mooket.social.service.CountryFactoryProductService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 国家+厂号+产品服务实现
 */
@Service
public class CountryFactoryProductServiceImpl implements CountryFactoryProductService {

private final BizOfferMapper offerMapper;
    private final StatPriceTrendMapper trendMapper;
    private final DictProductMapper productMapper;
    private final DictMerchantMapper merchantMapper;
    private final FactoryTierMapper factoryTierMapper;
    private final StatFactoryProductMapper statFactoryProductMapper;

        public CountryFactoryProductServiceImpl(BizOfferMapper offerMapper, StatPriceTrendMapper trendMapper, DictProductMapper productMapper, DictMerchantMapper merchantMapper, FactoryTierMapper factoryTierMapper, StatFactoryProductMapper statFactoryProductMapper) {
        this.offerMapper = offerMapper;
        this.trendMapper = trendMapper;
        this.productMapper = productMapper;
        this.merchantMapper = merchantMapper;
        this.factoryTierMapper = factoryTierMapper;
        this.statFactoryProductMapper = statFactoryProductMapper;
    }

    @Override
    @Cacheable(value = "countryFactoryProductDetail", key = "#country + '_' + #factoryNo + '_' + #productName + '_' + #type + '_' + #category + '_' + #sortBy + '_' + #page + '_' + #pageSize")
    public CountryFactoryProductDetailDTO getCountryFactoryProductDetail(String country, String factoryNo,
                                                                          String productName, String type,
                                                                          String category, String sortBy,
                                                                          int page, int pageSize) {
        return buildCountryFactoryProductDetail(country, factoryNo, productName, type, category, sortBy, page, pageSize);
    }

    @Override
    public String getOfferOriginalText(Long offerId) {
        if (offerId == null) {
            return "";
        }
        String text = offerMapper.selectOfferOriginalText(offerId);
        return text != null ? text : "";
    }

    /**
     * 构建国家+厂号+产品详情
     */
    private CountryFactoryProductDetailDTO buildCountryFactoryProductDetail(String country, String factoryNo,
                                                                             String productName, String type,
                                                                             String category, String sortBy,
                                                                             int page, int pageSize) {
        CountryFactoryProductDetailDTO dto = new CountryFactoryProductDetailDTO();
        dto.setCountry(country);
        dto.setFactoryNo(factoryNo);
        dto.setProductName(productName);

// 获取 productId
        DictProduct product = productMapper.findByName(category, productName);
        if (product != null && product.getProductId() != null) {
            dto.setProductId(product.getProductId());
        }

        // 查询是否有平替产品
        // 判断标准：factory_tier 表中同一 category + product_name 下有多个不同 tier 的厂号
        List<String> tierLookupProductNames = resolveTierLookupProductNames(category, productName, product);
        String tier = tierLookupProductNames.isEmpty()
                ? null
                : factoryTierMapper.selectTierByFactoryNoAndProductNames(category, tierLookupProductNames, factoryNo);
        boolean hasSubstitute = false;
        if (tier != null && !tier.isEmpty()) {
            List<String> sameTierFactories = factoryTierMapper.selectFactoryNosByTierAndProductNames(
                    category,
                    tierLookupProductNames,
                    tier
            );
            if (sameTierFactories != null && sameTierFactories.size() > 1) {
                hasSubstitute = true;
            }
        }
        dto.setHasSubstitute(hasSubstitute);

        // 1. 获取看板统计数据（报盘数、求购数、商家数）
        BizOfferMapper.CountryFactoryProductStats stats = offerMapper.selectCountryFactoryProductStats(
                country, factoryNo, productName, category);
        dto.setOfferCount(stats != null && stats.totalOfferCount != null ? stats.totalOfferCount : 0L);
        dto.setInquiryCount(stats != null && stats.totalInquiryCount != null ? stats.totalInquiryCount : 0L);
        dto.setMerchantCount(stats != null && stats.merchantCount != null ? stats.merchantCount : 0);

        // 2. 获取过滤后的价格区间（按type分开计算IQR）
        String priceOfferType = "offer".equalsIgnoreCase(type) ? "报盘" : ("inquiry".equalsIgnoreCase(type) ? "求购" : null);
        BizOfferMapper.PriceRange priceRange = offerMapper.selectFilteredPriceRangeByCountryFactoryProduct(
                country, factoryNo, productName, category, priceOfferType);
        dto.setPriceMin(priceRange != null ? priceRange.priceMin : null);
        dto.setPriceMax(priceRange != null ? priceRange.priceMax : null);

        // 3. 计算日均价涨跌（今日 vs 昨日）
        calculatePriceChange(country, factoryNo, dto.getProductId(), productName, category, priceOfferType, dto);

        // 4. 获取近7日价格走势
        List<DailyPrice> priceHistory7Days = getPriceHistory7Days(country, factoryNo, dto.getProductId(), productName, category, priceOfferType);
        dto.setPriceHistory7Days(priceHistory7Days);

        // 5. 获取近30日价格趋势
        List<DailyPrice> priceHistory30Days = getPriceHistory30Days(country, factoryNo, dto.getProductId(), productName, category, priceOfferType);
        dto.setPriceHistory30Days(priceHistory30Days);

        // 6. 统一走数据库全局排序 + 分页，避免先全量分组再内存排序导致慢且翻页不稳定
        String offerType = "offer".equalsIgnoreCase(type) ? "报盘" : ("inquiry".equalsIgnoreCase(type) ? "求购" : null);
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
                    group.setIsFamousMerchant(isFamous);
                } else {
                    group.setMerchantName(agg.contactPhone);
                    group.setIsFamousMerchant(false);
                }
            } else {
                group.setMerchantName("暂未关联行业商家");
                group.setIsFamousMerchant(false);
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

    /**
     * 按商家分组报盘数据
     */
    private List<MerchantOfferGroup> groupOffersByMerchant(List<BizOffer> offers) {
        // 使用 Map 来分组：key = merchantId 或 "NO_MERCHANT"
        Map<String, List<BizOffer>> groupedByKey = new LinkedHashMap<>();
        Set<Long> merchantIds = offers.stream()
                .map(BizOffer::getMerchantId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, DictMerchant> merchantMap = merchantIds.isEmpty()
                ? Collections.emptyMap()
                : merchantMapper.selectBatchIds(merchantIds).stream()
                    .collect(Collectors.toMap(DictMerchant::getMerchantId, m -> m, (left, right) -> left));

        for (BizOffer offer : offers) {
            String groupKey;
            if (offer.getMerchantId() != null) {
                groupKey = "merchant_" + offer.getMerchantId();
            } else {
                // 没有商家ID的员工报价，统一归为一组
                groupKey = "NO_MERCHANT";
            }

            groupedByKey.computeIfAbsent(groupKey, k -> new ArrayList<>()).add(offer);
        }

        // 转换为 MerchantOfferGroup 列表
        List<MerchantOfferGroup> groups = new ArrayList<>();
        for (Map.Entry<String, List<BizOffer>> entry : groupedByKey.entrySet()) {
            List<BizOffer> groupOffers = entry.getValue();
            if (groupOffers.isEmpty()) continue;

            BizOffer firstOffer = groupOffers.get(0);
            MerchantOfferGroup group = new MerchantOfferGroup();

            // 设置商家信息
            if (entry.getKey().startsWith("merchant_")) {
                // 有商家ID的，查询商家名称
                Long merchantId = firstOffer.getMerchantId();
                group.setMerchantId(merchantId);
                group.setMerchantPhone(firstOffer.getContactPhone());

                // 通过 merchantId 查询商家名称
                DictMerchant merchant = merchantMap.get(merchantId);
                if (merchant != null) {
                    group.setMerchantName(merchant.getMerchantName());
                    // 检查是否为知名商家（通过 merchantTags 判断）
                    boolean isFamous = merchant.getMerchantTags() != null &&
                            merchant.getMerchantTags().contains("知名商家");
                    group.setIsFamousMerchant(isFamous);
                } else {
                    group.setMerchantName(firstOffer.getContactPhone());
                    group.setIsFamousMerchant(false);
                }
            } else {
                // 没有商家ID的，显示"暂未关联行业商家"
                group.setMerchantId(null);
                group.setMerchantName("暂未关联行业商家");
                group.setMerchantPhone(firstOffer.getContactPhone());
                group.setIsFamousMerchant(false);
            }

            group.setOfferCount(groupOffers.size());

            // 转换员工报价列表
            List<EmployeeOfferDTO> employeeOfferDTOs = groupOffers.stream()
                    .map(this::convertToEmployeeOfferDTO)
                    .collect(Collectors.toList());
            group.setEmployeeOffers(employeeOfferDTOs);

            groups.add(group);
        }

        // 按报盘数排序（综合推荐）
        groups.sort((a, b) -> b.getOfferCount().compareTo(a.getOfferCount()));

        return groups;
    }

    /**
     * 转换为员工报价DTO
     */
    private EmployeeOfferDTO convertToEmployeeOfferDTO(BizOffer offer) {
        EmployeeOfferDTO dto = new EmployeeOfferDTO();
        dto.setOfferId(offer.getOfferId());
        dto.setUserNickname(offer.getUserNickname());
        dto.setContactPhone(offer.getContactPhone());
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

        // 发布时间格式化（返回完整日期时间，前端判断今天/昨天）
        if (offer.getPublishTime() != null) {
            dto.setPublishTime(offer.getPublishTime().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        }

        // 处理价格显示
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

    /**
     * 获取员工报价列表中的最低价格
     */
    private BigDecimal getMinPrice(List<EmployeeOfferDTO> offers) {
        return offers.stream()
                .map(EmployeeOfferDTO::getPrice)
                .filter(p -> p != null && !p.equals("协商报价"))
                .map(p -> {
                    // 处理范围价格如 "54.8-55.2"，取最小值
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
                    // 处理范围价格如 "54.8-55.2"，取最大值
                    if (p.contains("-")) {
                        String[] parts = p.split("-");
                        return new BigDecimal(parts[parts.length - 1]);
                    }
                    return new BigDecimal(p);
                })
                .max(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
    }

    /**
     * 计算日均价涨跌
     */
    private void calculatePriceChange(String country, String factoryNo, Integer productId,
                                      String productName, String category, String offerType,
                                      CountryFactoryProductDetailDTO dto) {
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
            BigDecimal change = todayPrice.subtract(yesterdayPrice).setScale(2, RoundingMode.HALF_UP);
            BigDecimal changeRate = change.multiply(new BigDecimal("100"))
                    .divide(yesterdayPrice, 2, RoundingMode.HALF_UP);

            // If stat_price_trend rounds to 0, prefer stat_factory_product's higher precision data
            if (change.compareTo(BigDecimal.ZERO) == 0) {
                try {
                    StatFactoryProduct stat = statFactoryProductMapper.selectByFactoryNoAndProductId(factoryNo, productId, category);
                    if (stat != null && stat.getPriceChange() != null && stat.getPriceChange().compareTo(BigDecimal.ZERO) != 0) {
                        dto.setPriceChange(stat.getPriceChange());
                        dto.setPriceChangeRate(stat.getPriceChangeRate());
                        return;
                    }
                } catch (Exception ignored) {}
            }

            dto.setPriceChange(change);
            dto.setPriceChangeRate(changeRate);
        } else {
            // Fallback: use pre-calculated stat_factory_product data
            try {
                StatFactoryProduct stat = statFactoryProductMapper.selectByFactoryNoAndProductId(factoryNo, productId, category);
                if (stat != null && stat.getPriceChange() != null) {
                    dto.setPriceChange(stat.getPriceChange());
                    dto.setPriceChangeRate(stat.getPriceChangeRate());
                } else {
                    dto.setPriceChange(null);
                    dto.setPriceChangeRate(null);
                }
            } catch (Exception e) {
                dto.setPriceChange(null);
                dto.setPriceChangeRate(null);
            }
        }
    }

    /**
     * 获取近7日价格走势
     */
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

        DateTimeFormatter shortFormatter = DateTimeFormatter.ofPattern("MM-dd");
        DateTimeFormatter fullFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

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

    /**
     * 获取近30日价格趋势
     */
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

        DateTimeFormatter shortFormatter = DateTimeFormatter.ofPattern("MM-dd");
        DateTimeFormatter fullFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");

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
}
