package com.mooket.social.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mooket.social.dto.*;
import com.mooket.social.entity.*;
import com.mooket.social.mapper.*;
import com.mooket.social.service.HomeStatService;
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
import java.util.*;

@Slf4j
@Service
public class HomeStatServiceImpl implements HomeStatService {

    private static final ObjectMapper objectMapper = new ObjectMapper();

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
    private DictMerchantMapper dictMerchantMapper;

    @Autowired
    private DictBrandMapper dictBrandMapper;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    @Override
    @CacheEvict(value = {"homeHotSearch", "homeStatData", "homeHotOfferSkus", "homeCards", "recentSearchCards", "selfSelectCards"}, allEntries = true)
    @Transactional
    public void computeAllStats() {
        LocalDate today = LocalDate.now();
        log.info("开始计算首页统计数据，日期：{}", today);

        computeProductStats(today);
        computeCountryStats(today);
        computeFactoryStats(today);
        computeBrandStats(today);
        computeCountryProductStats(today);
        computeBrandProductStats(today);
        computeFactoryProductStats(today);
        computeMerchantStats(today);

        log.info("首页统计数据计算完成");
    }

    @Override
    @Transactional
    public void computeProductStats(LocalDate statDate) {
        log.info("计算产品维度统计，日期：{}", statDate);

        // 按 productId 去重，stat_product 主键是 (stat_date, product_id) 不含 category
        Map<Integer, StatProduct> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            // 使用和产品详情页一致的查询逻辑：近1天，只统计报盘
            List<BizOfferMapper.ProductDashboardStatsWithName> rows =
                    bizOfferMapper.selectProductDashboardStatsBatch(category);
            for (BizOfferMapper.ProductDashboardStatsWithName row : rows) {
                if (row.totalOfferCount == null || row.totalOfferCount == 0) {
                    continue;
                }
                if (row.productId == null) continue;

                Integer productId = row.productId;
                StatProduct existing = statsMap.get(productId);
                if (existing != null) {
                    // 合并不同 category 的统计
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.totalOfferCount.intValue()));
                    existing.setTodayMerchantCount(existing.getTodayMerchantCount() + nonNull(row.merchantCount));
                    existing.setTodayFactoryCount(existing.getTodayFactoryCount() + nonNull(row.factoryCount));
                    if (row.priceMin != null && (existing.getPriceMin() == null || row.priceMin.compareTo(existing.getPriceMin()) < 0)) {
                        existing.setPriceMin(row.priceMin);
                    }
                    if (row.priceMax != null && (existing.getPriceMax() == null || row.priceMax.compareTo(existing.getPriceMax()) > 0)) {
                        existing.setPriceMax(row.priceMax);
                    }
                } else {
                    StatProduct stat = new StatProduct();
                    stat.setStatDate(statDate);
                    stat.setCategory(category);
                    stat.setProductId(productId);
                    stat.setProductName(row.productName);
                    stat.setTodayOfferCount(row.totalOfferCount != null ? row.totalOfferCount.intValue() : 0);
                    stat.setTodayInquiryCount(0); // 报盘统计不包含求购
                    stat.setTodayMerchantCount(row.merchantCount != null ? row.merchantCount : 0);
                    stat.setTodayFactoryCount(row.factoryCount != null ? row.factoryCount : 0);
                    stat.setPriceMin(row.priceMin);
                    stat.setPriceMax(row.priceMax);
                    stat.setUpdateTime(LocalDateTime.now());
                    statsMap.put(productId, stat);
                }
            }
        }

        List<StatProduct> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statProductMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    @Override
    @Transactional
    public void computeCountryStats(LocalDate statDate) {
        log.info("计算国家维度统计，日期：{}", statDate);

        // 按 (country, category) 组合去重，每个国家每个category独立统计
        Map<String, StatCountry> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            // 使用与国家详情页一致的查询逻辑（近1天，只统计报盘）
            String offerType = "报盘";
            List<BizOfferMapper.CountryDashboardStats> dashboardStats =
                    bizOfferMapper.selectCountryDashboardStatsBatch(category);

            for (BizOfferMapper.CountryDashboardStats row : dashboardStats) {
                if (row.totalOfferCount == null || row.totalOfferCount == 0) {
                    continue;
                }
                String country = row.country;
                String mapKey = country + "_" + category;  // key包含category，避免覆盖
                StatCountry existing = statsMap.get(mapKey);
                if (existing != null) {
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.totalOfferCount.intValue()));
                    existing.setTodayFactoryCount(existing.getTodayFactoryCount() + nonNull(row.factoryCount != null ? row.factoryCount : 0));
                    existing.setTodayMerchantCount(existing.getTodayMerchantCount() + nonNull(row.merchantCount != null ? row.merchantCount : 0));
                } else {
                    StatCountry stat = new StatCountry();
                    stat.setStatDate(statDate);
                    stat.setCategory(category);
                    stat.setCountry(country);
                    stat.setTodayOfferCount(nonNull(row.totalOfferCount != null ? row.totalOfferCount.intValue() : 0));
                    stat.setTodayInquiryCount(0);
                    stat.setTodayFactoryCount(nonNull(row.factoryCount != null ? row.factoryCount : 0));
                    stat.setTodayMerchantCount(nonNull(row.merchantCount != null ? row.merchantCount : 0));
                    stat.setUpdateTime(LocalDateTime.now());

                    // 查询热门厂号（Top 3）
                    List<BizOfferMapper.HotFactoryAgg> hotFactoryAggList =
                            bizOfferMapper.selectHotFactories(country, category, offerType);
                    String hotFactoriesJson = buildHotFactoriesJson(hotFactoryAggList, 3);
                    stat.setHotFactories(hotFactoriesJson);

                    // 查询热门产品（Top 3）
                    List<BizOfferMapper.HotProductAgg> hotProductAggList =
                            bizOfferMapper.selectHotProducts(country, category, offerType);
                    String hotProductsJson = buildHotProductsJson(hotProductAggList, 3);
                    stat.setHotProducts(hotProductsJson);

                    statsMap.put(mapKey, stat);
                }
            }
        }

        List<StatCountry> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statCountryMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    /**
     * 构建热门厂号JSON字符串
     */
    private String buildHotFactoriesJson(List<BizOfferMapper.HotFactoryAgg> hotFactories, int limit) {
        if (hotFactories == null || hotFactories.isEmpty()) {
            return "[]";
        }
        StringBuilder sb = new StringBuilder("[");
        int count = 0;
        for (BizOfferMapper.HotFactoryAgg f : hotFactories) {
            if (count >= limit) break;
            if (count > 0) sb.append(",");
            sb.append("{\"factoryNo\":\"").append(f.factoryNo != null ? f.factoryNo : "").append("\",\"offerCount\":").append(f.offerCount != null ? f.offerCount : 0).append("}");
            count++;
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 构建热门产品JSON字符串
     */
    private String buildHotProductsJson(List<BizOfferMapper.HotProductAgg> hotProducts, int limit) {
        if (hotProducts == null || hotProducts.isEmpty()) {
            return "[]";
        }
        StringBuilder sb = new StringBuilder("[");
        int count = 0;
        for (BizOfferMapper.HotProductAgg p : hotProducts) {
            if (count >= limit) break;
            if (count > 0) sb.append(",");
            sb.append("{\"productName\":\"").append(p.productName != null ? p.productName : "").append("\",\"offerCount\":").append(p.offerCount != null ? p.offerCount : 0).append("}");
            count++;
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 解析热门厂号JSON字符串为DTO列表
     */
    private List<CountryCardDTO.HotFactoryDTO> parseHotFactoriesFromJson(String json) {
        List<CountryCardDTO.HotFactoryDTO> result = new ArrayList<>();
        if (json == null || json.isEmpty() || "[]".equals(json)) {
            return result;
        }
        try {
            List<Map<String, Object>> list = objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
            for (Map<String, Object> item : list) {
                CountryCardDTO.HotFactoryDTO dto = new CountryCardDTO.HotFactoryDTO();
                dto.setFactoryNo(item.get("factoryNo") != null ? item.get("factoryNo").toString() : null);
                Object offerCountObj = item.get("offerCount");
                dto.setOfferCount(offerCountObj != null ? ((Number) offerCountObj).intValue() : 0);
                result.add(dto);
            }
        } catch (Exception e) {
            log.warn("解析热门厂号JSON失败: {}, json={}", e.getMessage(), json);
        }
        return result;
    }

    /**
     * 解析热门产品JSON字符串为DTO列表
     */
    private List<CountryCardDTO.HotProductDTO> parseHotProductsFromJson(String json) {
        List<CountryCardDTO.HotProductDTO> result = new ArrayList<>();
        if (json == null || json.isEmpty() || "[]".equals(json)) {
            return result;
        }
        try {
            List<Map<String, Object>> list = objectMapper.readValue(json, new TypeReference<List<Map<String, Object>>>() {});
            for (Map<String, Object> item : list) {
                CountryCardDTO.HotProductDTO dto = new CountryCardDTO.HotProductDTO();
                dto.setProductName(item.get("productName") != null ? item.get("productName").toString() : null);
                Object offerCountObj = item.get("offerCount");
                dto.setOfferCount(offerCountObj != null ? ((Number) offerCountObj).intValue() : 0);
                result.add(dto);
            }
        } catch (Exception e) {
            log.warn("解析热门产品JSON失败: {}, json={}", e.getMessage(), json);
        }
        return result;
    }

    @Override
    @Transactional
    public void computeFactoryStats(LocalDate statDate) {
        log.info("计算国家厂号维度统计，日期：{}", statDate);

        // 按 factoryId + category 去重，stat_factory 主键是 (stat_date, factory_id)，每条记录带 category
        Map<String, StatFactory> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            List<FactoryStatDTO> rows = bizOfferMapper.aggregateByFactory(statDate, category);
            for (FactoryStatDTO row : rows) {
                if ((row.getTodayOfferCount() == null || row.getTodayOfferCount() == 0)
                        && (row.getTodayInquiryCount() == null || row.getTodayInquiryCount() == 0)) {
                    continue;
                }
                if (row.getCountry() == null) continue;

                Integer factoryId = row.getFactoryId();
                String key = factoryId + "|" + category;
                StatFactory existing = statsMap.get(key);
                if (existing != null) {
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.getTodayOfferCount()));
                    existing.setTodayInquiryCount(existing.getTodayInquiryCount() + nonNull(row.getTodayInquiryCount()));
                    existing.setTodayMerchantCount(existing.getTodayMerchantCount() + nonNull(row.getTodayMerchantCount()));
                    if (row.getPriceMin() != null && (existing.getPriceMin() == null || row.getPriceMin().compareTo(existing.getPriceMin()) < 0)) {
                        existing.setPriceMin(row.getPriceMin());
                    }
                    if (row.getPriceMax() != null && (existing.getPriceMax() == null || row.getPriceMax().compareTo(existing.getPriceMax()) > 0)) {
                        existing.setPriceMax(row.getPriceMax());
                    }
                } else {
                    StatFactory stat = new StatFactory();
                    stat.setStatDate(statDate);
                    stat.setCategory(category);
                    stat.setCountry(row.getCountry());
                    stat.setFactoryNo(row.getFactoryNo());
                    stat.setFactoryId(factoryId);
                    stat.setTodayOfferCount(nonNull(row.getTodayOfferCount()));
                    stat.setTodayInquiryCount(nonNull(row.getTodayInquiryCount()));
                    stat.setTodayMerchantCount(nonNull(row.getTodayMerchantCount()));
                    stat.setPriceMin(row.getPriceMin());
                    stat.setPriceMax(row.getPriceMax());
                    stat.setUpdateTime(LocalDateTime.now());
                    statsMap.put(key, stat);
                }
            }
        }

        List<StatFactory> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statFactoryMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    @Override
    @Transactional
    public void computeBrandStats(LocalDate statDate) {
        log.info("计算品牌维度统计，日期：{}", statDate);

        // 按 brandId + category 去重，stat_brand 主键是 (stat_date, brand_id, category)
        Map<String, StatBrand> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            List<BrandStatDTO> rows = bizOfferMapper.aggregateByBrand(statDate, category);
            for (BrandStatDTO row : rows) {
                if (row.getTodayOfferCount() == null || row.getTodayOfferCount() == 0) continue;
                if (row.getBrandName() == null) continue;

                Integer brandId = row.getBrandId();
                String key = brandId + "|" + category;
                StatBrand existing = statsMap.get(key);
                if (existing != null) {
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.getTodayOfferCount()));
                    existing.setTodayFactoryCount(existing.getTodayFactoryCount() + nonNull(row.getTodayFactoryCount()));
                    existing.setTodayProductCount(existing.getTodayProductCount() + nonNull(row.getTodayProductCount()));
                    if (row.getPriceMin() != null && (existing.getPriceMin() == null || row.getPriceMin().compareTo(existing.getPriceMin()) < 0)) {
                        existing.setPriceMin(row.getPriceMin());
                    }
                    if (row.getPriceMax() != null && (existing.getPriceMax() == null || row.getPriceMax().compareTo(existing.getPriceMax()) > 0)) {
                        existing.setPriceMax(row.getPriceMax());
                    }
                } else {
                    StatBrand stat = new StatBrand();
                    stat.setStatDate(statDate);
                    stat.setBrandId(brandId);
                    stat.setCategory(category);
                    // 从dict_brand表获取brandName
                    String brandName = row.getBrandName();
                    DictBrand brand = dictBrandMapper.selectById(brandId);
                    if (brand != null && brand.getBrandName() != null) {
                        brandName = brand.getBrandName();
                    }
                    stat.setBrandName(brandName);
                    stat.setTodayOfferCount(row.getTodayOfferCount());
                    stat.setTodayFactoryCount(nonNull(row.getTodayFactoryCount()));
                    stat.setTodayProductCount(nonNull(row.getTodayProductCount()));
                    stat.setPriceMin(row.getPriceMin());
                    stat.setPriceMax(row.getPriceMax());
                    stat.setUpdateTime(LocalDateTime.now());
                    statsMap.put(key, stat);
                }
            }
        }

        List<StatBrand> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statBrandMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    @Override
    @Transactional
    public void computeCountryProductStats(LocalDate statDate) {
        log.info("计算国家产品维度统计，日期：{}", statDate);

        // 先查昨天的统计数据，用昨天的 avg_price 作为今天的 avg_price_yesterday
        LocalDate yesterday = statDate.minusDays(1);
        List<StatCountryProduct> yesterdayStats = statCountryProductMapper.findByDate(yesterday);
        Map<String, BigDecimal> yesterdayAvgPriceMap = new HashMap<>();
        for (StatCountryProduct ys : yesterdayStats) {
            if (ys.getAvgPrice() != null) {
                String key = ys.getCountry() + "|" + ys.getProductId();
                yesterdayAvgPriceMap.put(key, ys.getAvgPrice());
            }
        }

        // 按 country + productId 去重，stat_country_product 主键是 (stat_date, country, product_id) 不含 category
        Map<String, StatCountryProduct> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            List<CountryProductStatDTO> rows = bizOfferMapper.aggregateByCountryProduct(statDate, category);
            for (CountryProductStatDTO row : rows) {
                if ((row.getTodayOfferCount() == null || row.getTodayOfferCount() == 0)
                        && (row.getTodayInquiryCount() == null || row.getTodayInquiryCount() == 0)) continue;

                String key = row.getCountry() + "|" + row.getProductId();
                StatCountryProduct existing = statsMap.get(key);
                if (existing != null) {
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.getTodayOfferCount()));
                    existing.setTodayInquiryCount(existing.getTodayInquiryCount() + nonNull(row.getTodayInquiryCount()));
                    existing.setTodayFactoryCount(existing.getTodayFactoryCount() + nonNull(row.getTodayFactoryCount()));
                    if (row.getPriceMin() != null && (existing.getPriceMin() == null || row.getPriceMin().compareTo(existing.getPriceMin()) < 0)) {
                        existing.setPriceMin(row.getPriceMin());
                    }
                    if (row.getPriceMax() != null && (existing.getPriceMax() == null || row.getPriceMax().compareTo(existing.getPriceMax()) > 0)) {
                        existing.setPriceMax(row.getPriceMax());
                    }
                    if (row.getAvgPrice() != null) {
                        existing.setAvgPrice(row.getAvgPrice());
                    }
                } else {
                    StatCountryProduct stat = new StatCountryProduct();
                    stat.setStatDate(statDate);
                    stat.setCountry(row.getCountry());
                    stat.setProductId(row.getProductId());
                    stat.setProductName(row.getProductName());
                    stat.setCategory(category);
                    stat.setTodayOfferCount(row.getTodayOfferCount());
                    stat.setTodayInquiryCount(nonNull(row.getTodayInquiryCount()));
                    stat.setTodayFactoryCount(nonNull(row.getTodayFactoryCount()));
                    stat.setPriceMin(row.getPriceMin());
                    stat.setPriceMax(row.getPriceMax());
                    stat.setAvgPrice(row.getAvgPrice());
                    // 从昨天的统计表中回填 avg_price_yesterday
                    BigDecimal yesterdayAvg = yesterdayAvgPriceMap.get(key);
                    stat.setAvgPriceYesterday(yesterdayAvg);
                    if (row.getAvgPrice() != null && yesterdayAvg != null
                            && yesterdayAvg.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal priceChange = row.getAvgPrice().subtract(yesterdayAvg);
                        if (priceChange.abs().compareTo(new BigDecimal("999.99")) > 0) {
                            priceChange = priceChange.signum() == 1 ? new BigDecimal("999.99") : new BigDecimal("-999.99");
                        }
                        stat.setPriceChange(priceChange);
                        BigDecimal rate = priceChange
                                .divide(yesterdayAvg, 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100))
                                .setScale(2, RoundingMode.HALF_UP);
                        if (rate.abs().compareTo(new BigDecimal("999.99")) > 0) {
                            rate = rate.signum() == 1 ? new BigDecimal("999.99") : new BigDecimal("-999.99");
                        }
                        stat.setPriceChangeRate(rate);
                    }
                    stat.setUpdateTime(LocalDateTime.now());
                    statsMap.put(key, stat);
                }
            }
        }

        List<StatCountryProduct> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statCountryProductMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    @Override
    @Transactional
    public void computeBrandProductStats(LocalDate statDate) {
        log.info("计算品牌产品维度统计，日期：{}", statDate);

        // 先查昨天的统计数据，用昨天的 avg_price 作为今天的 avg_price_yesterday
        LocalDate yesterday = statDate.minusDays(1);
        List<StatBrandProduct> yesterdayStats = statBrandProductMapper.findByDate(yesterday);
        Map<String, BigDecimal> yesterdayAvgPriceMap = new HashMap<>();
        for (StatBrandProduct ys : yesterdayStats) {
            if (ys.getAvgPrice() != null) {
                String key = ys.getBrandId() + "|" + ys.getProductId() + "|" + ys.getCategory();
                yesterdayAvgPriceMap.put(key, ys.getAvgPrice());
            }
        }

        // 按 brandId + productId + category 去重，stat_brand_product 主键是 (stat_date, brand_id, product_id, category)
        Map<String, StatBrandProduct> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            List<BrandProductStatDTO> rows = bizOfferMapper.aggregateByBrandProduct(statDate, category);
            for (BrandProductStatDTO row : rows) {
                if (row.getTodayOfferCount() == null || row.getTodayOfferCount() == 0) continue;
                if (row.getBrandName() == null) continue;

                String key = row.getBrandId() + "|" + row.getProductId() + "|" + category;
                StatBrandProduct existing = statsMap.get(key);
                if (existing != null) {
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.getTodayOfferCount()));
                    existing.setTodayFactoryCount(existing.getTodayFactoryCount() + nonNull(row.getTodayFactoryCount()));
                    if (row.getPriceMin() != null && (existing.getPriceMin() == null || row.getPriceMin().compareTo(existing.getPriceMin()) < 0)) {
                        existing.setPriceMin(row.getPriceMin());
                    }
                    if (row.getPriceMax() != null && (existing.getPriceMax() == null || row.getPriceMax().compareTo(existing.getPriceMax()) > 0)) {
                        existing.setPriceMax(row.getPriceMax());
                    }
                    if (row.getAvgPrice() != null) {
                        existing.setAvgPrice(row.getAvgPrice());
                    }
                    recomputePriceChange(existing);
                } else {
                    StatBrandProduct stat = new StatBrandProduct();
                    stat.setStatDate(statDate);
                    stat.setBrandId(row.getBrandId());
                    String brandName = row.getBrandName();
                    DictBrand brand = dictBrandMapper.selectById(row.getBrandId());
                    if (brand != null && brand.getBrandName() != null) {
                        brandName = brand.getBrandName();
                    }
                    stat.setBrandName(brandName);
                    stat.setProductId(row.getProductId());
                    stat.setProductName(row.getProductName());
                    stat.setCategory(category);
                    stat.setTodayOfferCount(row.getTodayOfferCount());
                    stat.setTodayFactoryCount(nonNull(row.getTodayFactoryCount()));
                    stat.setPriceMin(row.getPriceMin());
                    stat.setPriceMax(row.getPriceMax());
                    stat.setAvgPrice(row.getAvgPrice());
                    // 从昨天的统计表中回填 avg_price_yesterday
                    BigDecimal yesterdayAvg = yesterdayAvgPriceMap.get(key);
                    stat.setAvgPriceYesterday(yesterdayAvg);
                    recomputePriceChange(stat);
                    stat.setUpdateTime(LocalDateTime.now());
                    statsMap.put(key, stat);
                }
            }
        }

        List<StatBrandProduct> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statBrandProductMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    private void recomputePriceChange(StatBrandProduct stat) {
        if (stat.getAvgPrice() != null && stat.getAvgPriceYesterday() != null
                && stat.getAvgPriceYesterday().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal priceChange = stat.getAvgPrice().subtract(stat.getAvgPriceYesterday());
            if (priceChange.abs().compareTo(new BigDecimal("999.99")) > 0) {
                priceChange = priceChange.signum() == 1 ? new BigDecimal("999.99") : new BigDecimal("-999.99");
            }
            stat.setPriceChange(priceChange);
            BigDecimal rate = priceChange
                    .divide(stat.getAvgPriceYesterday(), 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(2, RoundingMode.HALF_UP);
            if (rate.abs().compareTo(new BigDecimal("999.99")) > 0) {
                rate = rate.signum() == 1 ? new BigDecimal("999.99") : new BigDecimal("-999.99");
            }
            stat.setPriceChangeRate(rate);
        } else {
            stat.setPriceChange(null);
            stat.setPriceChangeRate(null);
        }
    }


    @Override
    @Transactional
    public void computeFactoryProductStats(LocalDate statDate) {
        log.info("计算国家厂号产品维度统计，日期：{}", statDate);

        // 先查昨天的统计数据，用昨天的 avg_price 作为今天的 avg_price_yesterday
        LocalDate yesterday = statDate.minusDays(1);
        List<StatFactoryProduct> yesterdayStats = statFactoryProductMapper.findByDate(yesterday);
        Map<String, BigDecimal> yesterdayAvgPriceMap = new HashMap<>();
        for (StatFactoryProduct ys : yesterdayStats) {
            if (ys.getAvgPrice() != null) {
                String key = ys.getFactoryId() + "|" + ys.getProductId() + "|" + ys.getCategory();
                yesterdayAvgPriceMap.put(key, ys.getAvgPrice());
            }
        }

        // 按 factoryId + productId + category 去重，stat_factory_product 主键是 (stat_date, factory_id, product_id, category)
        Map<String, StatFactoryProduct> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            List<FactoryProductStatDTO> rows = bizOfferMapper.aggregateByFactoryProduct(statDate, category);
            for (FactoryProductStatDTO row : rows) {
                if ((row.getTodayOfferCount() == null || row.getTodayOfferCount() == 0)
                        && (row.getTodayInquiryCount() == null || row.getTodayInquiryCount() == 0)) {
                    continue;
                }
                if (row.getCountry() == null) continue;

                String key = row.getFactoryId() + "|" + row.getProductId() + "|" + category;
                StatFactoryProduct existing = statsMap.get(key);
                if (existing != null) {
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.getTodayOfferCount()));
                    existing.setTodayInquiryCount(existing.getTodayInquiryCount() + nonNull(row.getTodayInquiryCount()));
                    if (row.getPriceMin() != null && (existing.getPriceMin() == null || row.getPriceMin().compareTo(existing.getPriceMin()) < 0)) {
                        existing.setPriceMin(row.getPriceMin());
                    }
                    if (row.getPriceMax() != null && (existing.getPriceMax() == null || row.getPriceMax().compareTo(existing.getPriceMax()) > 0)) {
                        existing.setPriceMax(row.getPriceMax());
                    }
                    if (row.getAvgPrice() != null) {
                        existing.setAvgPrice(row.getAvgPrice());
                    }
                } else {
                    StatFactoryProduct stat = new StatFactoryProduct();
                    stat.setStatDate(statDate);
                    stat.setCountry(row.getCountry());
                    stat.setFactoryNo(row.getFactoryNo());
                    stat.setFactoryId(row.getFactoryId());
                    stat.setProductId(row.getProductId());
                    stat.setProductName(row.getProductName());
                    stat.setCategory(category);
                    stat.setTodayOfferCount(nonNull(row.getTodayOfferCount()));
                    stat.setTodayInquiryCount(nonNull(row.getTodayInquiryCount()));
                    stat.setPriceMin(row.getPriceMin());
                    stat.setPriceMax(row.getPriceMax());
                    stat.setAvgPrice(row.getAvgPrice());
                    // 从昨天的统计表中回填 avg_price_yesterday
                    BigDecimal yesterdayAvg = yesterdayAvgPriceMap.get(key);
                    stat.setAvgPriceYesterday(yesterdayAvg);
                    if (row.getAvgPrice() != null && yesterdayAvg != null
                            && yesterdayAvg.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal priceChange = row.getAvgPrice().subtract(yesterdayAvg);
                        if (priceChange.abs().compareTo(new BigDecimal("999.99")) > 0) {
                            priceChange = priceChange.signum() == 1 ? new BigDecimal("999.99") : new BigDecimal("-999.99");
                        }
                        stat.setPriceChange(priceChange);
                        BigDecimal rate = priceChange
                                .divide(yesterdayAvg, 4, RoundingMode.HALF_UP)
                                .multiply(BigDecimal.valueOf(100))
                                .setScale(2, RoundingMode.HALF_UP);
                        if (rate.abs().compareTo(new BigDecimal("999.99")) > 0) {
                            rate = rate.signum() == 1 ? new BigDecimal("999.99") : new BigDecimal("-999.99");
                        }
                        stat.setPriceChangeRate(rate);
                    }
                    stat.setUpdateTime(LocalDateTime.now());
                    statsMap.put(key, stat);
                }
            }
        }

        List<StatFactoryProduct> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statFactoryProductMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    @Override
    @Transactional
    public void computeMerchantStats(LocalDate statDate) {
        log.info("计算商家维度统计，日期：{}", statDate);

        // 按 merchantId + category 去重，stat_merchant 主键是 (stat_date, merchant_id, category)
        Map<String, StatMerchant> statsMap = new LinkedHashMap<>();

        for (String category : Arrays.asList("牛", "猪")) {
            List<MerchantStatDTO> rows = bizOfferMapper.aggregateByMerchant(statDate, category);
            for (MerchantStatDTO row : rows) {
                if ((row.getTodayOfferCount() == null || row.getTodayOfferCount() == 0)
                        && (row.getTodayInquiryCount() == null || row.getTodayInquiryCount() == 0)) {
                    continue;
                }
                if (row.getMerchantId() == null) continue;

                Long merchantId = row.getMerchantId();
                String key = merchantId + "|" + category;
                StatMerchant existing = statsMap.get(key);
                if (existing != null) {
                    existing.setTodayOfferCount(existing.getTodayOfferCount() + nonNull(row.getTodayOfferCount()));
                    existing.setTodayInquiryCount(existing.getTodayInquiryCount() + nonNull(row.getTodayInquiryCount()));
                    existing.setTodayProductCount(existing.getTodayProductCount() + nonNull(row.getTodayProductCount()));
                    existing.setTodayFactoryCount(existing.getTodayFactoryCount() + nonNull(row.getTodayFactoryCount()));
                } else {
                    StatMerchant stat = new StatMerchant();
                    stat.setStatDate(statDate);
                    stat.setMerchantId(merchantId);
                    stat.setCategory(category);
                    stat.setTodayOfferCount(nonNull(row.getTodayOfferCount()));
                    stat.setTodayInquiryCount(nonNull(row.getTodayInquiryCount()));
                    stat.setTodayProductCount(nonNull(row.getTodayProductCount()));
                    stat.setTodayFactoryCount(nonNull(row.getTodayFactoryCount()));
                    stat.setUpdateTime(LocalDateTime.now());
                    statsMap.put(key, stat);
                }
            }
        }

        List<StatMerchant> allStats = new ArrayList<>(statsMap.values());
        if (!allStats.isEmpty()) {
            int batchSize = 1000;
            for (int i = 0; i < allStats.size(); i += batchSize) {
                int end = Math.min(i + batchSize, allStats.size());
                statMerchantMapper.batchUpsert(allStats.subList(i, end));
            }
        }
    }

    private int nonNull(Integer val) {
        return val != null ? val : 0;
    }

    @Override
    @Cacheable(value = "homeHotSearch", key = "#category")
    public List<HotSearchItem> getHotSearchRecommendations(String category) {
        LocalDate today = LocalDate.now();
        List<HotSearchItem> result = new ArrayList<>();
        Set<String> usedCoreElements = new HashSet<>();

        // 1. 国家厂号产品 - 取前2个
        List<StatFactoryProduct> hotFactoryProducts = statFactoryProductMapper.findHotFactoryProducts(today, category, 5);
        for (StatFactoryProduct fp : hotFactoryProducts) {
            if (result.size() >= 5) break;
            String coreElement = fp.getCountry() + "+" + fp.getFactoryNo() + "+" + fp.getProductName();
            if (!usedCoreElements.contains(coreElement)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = fp.getCountry() + fp.getFactoryNo() + fp.getProductName();
                item.dimension = "国家厂号产品";
                item.todayOfferCount = fp.getTodayOfferCount();
                item.country = fp.getCountry();
                item.factoryNo = fp.getFactoryNo();
                item.productId = fp.getProductId();
                result.add(item);
                usedCoreElements.add(coreElement);
            }
        }

        // 2. 国家产品 - 取前1个
        List<StatCountryProduct> hotCountryProducts = statCountryProductMapper.findHotCountryProducts(today, category, 3);
        for (StatCountryProduct cp : hotCountryProducts) {
            if (result.size() >= 5) break;
            String coreElement = cp.getCountry() + "+" + cp.getProductName();
            if (!usedCoreElements.contains(coreElement)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = cp.getCountry() + " " + cp.getProductName();
                item.dimension = "国家产品";
                item.todayOfferCount = cp.getTodayOfferCount();
                item.country = cp.getCountry();
                item.productId = cp.getProductId();
                result.add(item);
                usedCoreElements.add(coreElement);
            }
        }

        // 3. 国家 - 取前1个
        List<StatCountryMapper.HotCountry> hotCountries = statCountryMapper.findHotCountries(today, category, 3);
        for (StatCountryMapper.HotCountry c : hotCountries) {
            if (result.size() >= 5) break;
            if (!usedCoreElements.contains(c.country)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = c.country;
                item.dimension = "国家";
                item.todayOfferCount = c.todayOfferCount;
                item.country = c.country;
                result.add(item);
                usedCoreElements.add(c.country);
            }
        }

        // 4. 产品 - 取前1个
        List<StatProductMapper.HotProduct> hotProducts = statProductMapper.findHotProducts(today, category, 3);
        for (StatProductMapper.HotProduct p : hotProducts) {
            if (result.size() >= 5) break;
            if (!usedCoreElements.contains(p.productName)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = p.productName;
                item.dimension = "产品";
                item.todayOfferCount = p.todayOfferCount;
                item.productId = p.productId;
                result.add(item);
                usedCoreElements.add(p.productName);
            }
        }

        // 5. 品牌 - 取前1个
        List<StatBrandMapper.HotBrand> hotBrands = statBrandMapper.findHotBrands(today, 3, category);
        for (StatBrandMapper.HotBrand b : hotBrands) {
            if (result.size() >= 5) break;
            String coreElement = "brand:" + b.brandId;
            if (!usedCoreElements.contains(coreElement)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = b.brandName;
                item.dimension = "品牌";
                item.todayOfferCount = b.todayOfferCount;
                item.brandId = b.brandId;
                result.add(item);
                usedCoreElements.add(coreElement);
            }
        }

        // 6. 商家 - 取前1个
        List<StatMerchantMapper.HotMerchant> hotMerchants = statMerchantMapper.findHotMerchants(today, 3, category);
        for (StatMerchantMapper.HotMerchant m : hotMerchants) {
            if (result.size() >= 5) break;
            String coreElement = "merchant:" + m.merchantId;
            if (!usedCoreElements.contains(coreElement)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = "商家-" + m.merchantId; // 商家名称需要单独查询
                item.dimension = "商家";
                item.todayOfferCount = m.todayOfferCount;
                item.merchantId = m.merchantId;
                result.add(item);
                usedCoreElements.add(coreElement);
            }
        }

        // 7. 国家厂号 - 取前1个
        List<StatFactoryMapper.HotFactory> hotFactories = statFactoryMapper.findHotFactories(today, category, 3);
        for (StatFactoryMapper.HotFactory f : hotFactories) {
            if (result.size() >= 5) break;
            String coreElement = "factory:" + f.factoryId;
            if (!usedCoreElements.contains(coreElement)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = f.country + f.factoryNo;
                item.dimension = "国家厂号";
                item.todayOfferCount = f.todayOfferCount;
                item.country = f.country;
                item.factoryNo = f.factoryNo;
                result.add(item);
                usedCoreElements.add(coreElement);
            }
        }

        // 8. 品牌产品 - 取前1个
        List<StatBrandProduct> hotBrandProducts = statBrandProductMapper.findHotBrandProducts(today, category, 3);
        for (StatBrandProduct bp : hotBrandProducts) {
            if (result.size() >= 5) break;
            String coreElement = "brandProduct:" + bp.getBrandId() + "+" + bp.getProductId();
            if (!usedCoreElements.contains(coreElement)) {
                HotSearchItem item = new HotSearchItem();
                item.keyword = bp.getBrandName() + " " + bp.getProductName();
                item.dimension = "品牌产品";
                item.todayOfferCount = bp.getTodayOfferCount();
                item.brandId = bp.getBrandId();
                item.productId = bp.getProductId();
                result.add(item);
                usedCoreElements.add(coreElement);
            }
        }

        return result;
    }

    @Override
    @Cacheable(value = "homeStatData", key = "#category")
    public HomeStatData getHomeStatData(String category) {
        // 直接从biz_offer表查询原始数据，避免stat表的过滤条件导致数据遗漏
        BizOfferMapper.HomeStatResult result = bizOfferMapper.selectHomeStatResult(category);

        int totalOffers = result.totalOfferCount != null ? result.totalOfferCount.intValue() : 0;
        int totalInquiries = result.totalInquiryCount != null ? result.totalInquiryCount.intValue() : 0;
        int totalMerchants = result.totalMerchantCount != null ? result.totalMerchantCount.intValue() : 0;

        String offerStr = formatCount(totalOffers);
        String inquiryStr = formatCount(totalInquiries);
        String merchantStr = formatCount(totalMerchants);
        String statTime = LocalDateTime.now().format(TIME_FORMATTER);

        return new HomeStatData(offerStr, inquiryStr, merchantStr, statTime);
    }

    @Override
    @Cacheable(value = "homeHotOfferSkus", key = "#category + ':' + #limit")
    public List<HomeHotSkuDTO> getHomeHotOfferSkus(String category, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 30));
        List<BizOfferMapper.HomeHotSkuAgg> rows = bizOfferMapper.selectHomeHotSkus(category, "报盘", safeLimit);
        List<HomeHotSkuDTO> result = new ArrayList<>();

        for (BizOfferMapper.HomeHotSkuAgg row : rows) {
            HomeHotSkuDTO dto = new HomeHotSkuDTO();
            dto.setCountry(row.country);
            dto.setFactoryNo(row.factoryNo);
            dto.setProductId(row.productId);
            dto.setProductName(row.productName);
            dto.setPriceMin(row.priceMin);
            dto.setPriceMax(row.priceMax);
            dto.setOfferCount(row.offerCount);
            dto.setMerchantCount(row.merchantCount != null && row.merchantCount > 0 ? row.merchantCount : 1);

            List<BizOfferMapper.HomeHotSkuTrendPoint> trendRows = bizOfferMapper.selectHomeHotSkuTrend(
                    row.country, row.factoryNo, row.productName, category, "报盘");
            List<HomeHotSkuDTO.TrendPointDTO> trendPoints = new ArrayList<>();
            for (BizOfferMapper.HomeHotSkuTrendPoint trendRow : trendRows) {
                HomeHotSkuDTO.TrendPointDTO point = new HomeHotSkuDTO.TrendPointDTO();
                point.setDate(trendRow.dataDate != null ? trendRow.dataDate.toString() : "");
                point.setAvgPrice(trendRow.avgPrice != null ? trendRow.avgPrice.doubleValue() : null);
                point.setOfferCount(trendRow.offerCount);
                trendPoints.add(point);
            }
            dto.setTrendPoints(trendPoints);
            result.add(dto);
        }

        return result;
    }

    @Override
    @Cacheable(value = "homeCards", key = "#category")
    public HomeCardsResponseDTO getHomeCards(String category) {
        LocalDate today = LocalDate.now();
        List<HomeCardItemDTO> cards = new ArrayList<>();
        int rank = 1;

        // 1. 产品卡片 - 取前5个
        // 从 stat_product 表读取产品统计数据（和产品详情页一致的查询逻辑）
        List<StatProduct> statProducts = statProductMapper.selectByDateAndCategory(today, category);
        // 按报盘数排序并取前5
        statProducts.sort((a, b) -> Integer.compare(
                b.getTodayOfferCount() != null ? b.getTodayOfferCount() : 0,
                a.getTodayOfferCount() != null ? a.getTodayOfferCount() : 0
        ));
        int count = 0;
        for (StatProduct p : statProducts) {
            if (count >= 5) break;
            if (p.getTodayOfferCount() == null || p.getTodayOfferCount() < 10) continue;
            ProductCardDTO card = new ProductCardDTO();
            card.setCardType("product");
            card.setRank(rank++);
            card.setProductId(p.getProductId());
            card.setProductName(p.getProductName());
            card.setTodayOfferCount(p.getTodayOfferCount());
            card.setMerchantCount(p.getTodayMerchantCount());
            card.setFactoryCount(p.getTodayFactoryCount());
            card.setPriceMin(p.getPriceMin());
            card.setPriceMax(p.getPriceMax());
            cards.add(card);
            count++;
        }

        // 2. 国家卡片 - 取前3个
        // 直接从stat_country表读取完整数据（包括hotFactories和hotProducts）
        List<StatCountry> statCountries = statCountryMapper.selectByDateAndCategory(today, category);
        int countryCount = 0;
        for (StatCountry c : statCountries) {
            if (countryCount >= 3) break;
            CountryCardDTO card = new CountryCardDTO();
            card.setCardType("country");
            card.setRank(rank++);
            card.setCountry(c.getCountry());
            card.setCountryAlias(c.getCountry());
            card.setTodayOfferCount(c.getTodayOfferCount());
            // 从stat_country表读取热门厂号（JSON格式）
            card.setHotFactories(parseHotFactoriesFromJson(c.getHotFactories()));
            // 从stat_country表读取热门产品（JSON格式）
            card.setHotProducts(parseHotProductsFromJson(c.getHotProducts()));
            cards.add(card);
            countryCount++;
        }

        // 3. 品牌卡片 - 取前3个
        List<StatBrandMapper.HotBrand> hotBrands = statBrandMapper.findHotBrands(today, 3, category);
        for (StatBrandMapper.HotBrand b : hotBrands) {
            BrandCardDTO card = new BrandCardDTO();
            card.setCardType("brand");
            card.setRank(rank++);
            card.setBrandId(b.brandId);
            card.setBrandName(b.brandName);
            card.setTodayOfferCount(b.todayOfferCount);
            card.setProductCount(b.productCount);
            card.setFactoryCount(b.factoryCount);
            cards.add(card);
        }

        // 4. 商家卡片 - 取前3个
        List<StatMerchantMapper.HotMerchant> hotMerchants = statMerchantMapper.findHotMerchants(today, 3, category);
        for (StatMerchantMapper.HotMerchant m : hotMerchants) {
            MerchantCardDTO card = new MerchantCardDTO();
            card.setCardType("merchant");
            card.setRank(rank++);
            card.setMerchantId(m.merchantId);
            // 从dict_merchant获取商家详情
            DictMerchant merchant = dictMerchantMapper.selectById(m.merchantId);
            if (merchant != null && merchant.getMerchantName() != null && !merchant.getMerchantName().isEmpty()) {
                card.setMerchantName(merchant.getMerchantName());
                card.setMerchantShortName(merchant.getMerchantShortName());
                card.setMerchantTags(merchant.getMerchantTags());
            } else {
                card.setMerchantName("商家-" + m.merchantId);
            }
            card.setTodayOfferCount(m.todayOfferCount);
            // 最新报盘需要单独查询
            List<BizOffer> latestOffers = bizOfferMapper.findLatestByMerchant(m.merchantId, 2, category);
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
            cards.add(card);
        }

        // 5. 国家厂号卡片 - 取前3个
        List<StatFactoryMapper.HotFactory> hotFactoriesList = statFactoryMapper.findHotFactories(today, category, 3);
        for (StatFactoryMapper.HotFactory f : hotFactoriesList) {
            FactoryCardDTO card = new FactoryCardDTO();
            card.setCardType("factory");
            card.setRank(rank++);
            card.setCountry(f.country);
            card.setCountryAlias(f.country);
            card.setFactoryNo(f.factoryNo);
            card.setTodayOfferCount(f.todayOfferCount);
            // 热门产品需要单独查询，并按今日报盘数降序排列取前3
            List<StatFactoryProduct> factoryProducts =
                    statFactoryProductMapper.findHotProductsByFactory(today, f.factoryId, category, 3);
            List<FactoryCardDTO.HotProductDTO> hotProductsList2 = new ArrayList<>();
            for (StatFactoryProduct fp : factoryProducts) {
                FactoryCardDTO.HotProductDTO dto = new FactoryCardDTO.HotProductDTO();
                dto.setProductName(fp.getProductName());
                dto.setOfferCount(fp.getTodayOfferCount());
                hotProductsList2.add(dto);
            }
            // 按今日报盘数降序排序后取前3
            hotProductsList2.sort((a, b) -> Integer.compare(
                    b.getOfferCount() != null ? b.getOfferCount() : 0,
                    a.getOfferCount() != null ? a.getOfferCount() : 0));
            if (hotProductsList2.size() > 3) {
                hotProductsList2 = hotProductsList2.subList(0, 3);
            }
            card.setHotProducts(hotProductsList2);
            cards.add(card);
        }

        // 6. 品牌产品卡片 - 取前3个
        List<StatBrandProduct> hotBrandProducts = statBrandProductMapper.findHotBrandProducts(today, category, 3);
        for (StatBrandProduct bp : hotBrandProducts) {
            BrandProductCardDTO card = new BrandProductCardDTO();
            card.setCardType("brandProduct");
            card.setRank(rank++);
            card.setBrandId(bp.getBrandId());
            card.setBrandName(bp.getBrandName());
            card.setProductId(bp.getProductId());
            card.setProductName(bp.getProductName());
            card.setPriceMin(bp.getPriceMin());
            card.setPriceMax(bp.getPriceMax());
            card.setPriceChange(bp.getPriceChange());
            card.setPriceChangeRate(bp.getPriceChangeRate());
            card.setTodayOfferCount(bp.getTodayOfferCount());
            card.setFactoryCount(bp.getTodayFactoryCount());
            // 热门工厂（通过 dict_brand.brand_name 匹配，一个品牌有多个 brandId）
            List<FactoryStatWithPriceDTO> factoryStats = bizOfferMapper.aggregateByFactoryForBrandProduct(today, bp.getBrandName(), bp.getProductId(), category);
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
            // 7日价格趋势
            try {
                List<StatBrandProduct> trendRows = statBrandProductMapper.selectTrendByBrandNameAndProductName(bp.getBrandName(), bp.getProductName(), category);
                if (trendRows != null && !trendRows.isEmpty()) {
                    List<BrandProductCardDTO.TrendPointDTO> trendPointDTOs = new ArrayList<>();
                    for (StatBrandProduct tp : trendRows) {
                        BrandProductCardDTO.TrendPointDTO dto = new BrandProductCardDTO.TrendPointDTO();
                        dto.setDate(tp.getStatDate() != null ? tp.getStatDate().toString() : "");
                        dto.setAvgPrice(tp.getAvgPrice() != null ? tp.getAvgPrice().doubleValue() : null);
                        trendPointDTOs.add(dto);
                    }
                    card.setTrendPoints(trendPointDTOs);
                }
            } catch (Exception e) {
                log.warn("获取品牌产品价格趋势失败 brandName={}: {}", bp.getBrandName(), e.getMessage());
            }
            cards.add(card);
        }

        // 7. 国家厂号产品卡片 - 取前3个
        List<StatFactoryProduct> hotFactoryProducts = statFactoryProductMapper.findHotFactoryProducts(today, category, 3);
        for (StatFactoryProduct fp : hotFactoryProducts) {
            FactoryProductCardDTO card = new FactoryProductCardDTO();
            card.setCardType("factoryProduct");
            card.setRank(rank++);
            card.setCountry(fp.getCountry());
            card.setCountryAlias(fp.getCountry());
            card.setFactoryNo(fp.getFactoryNo());
            card.setProductId(fp.getProductId());
            card.setProductName(fp.getProductName());
            card.setTodayOfferCount(fp.getTodayOfferCount());
            card.setInquiryCount(fp.getTodayInquiryCount());

            // 价格区间：从实时 IQR 过滤 SQL 获取（口径与详情页一致，不再用 stat 表的原始聚合）
            try {
                BizOfferMapper.PriceRange priceRange = bizOfferMapper.selectFilteredPriceRangeByCountryFactoryProduct(
                        fp.getCountry(), fp.getFactoryNo(), fp.getProductName(), category, "报盘");
                card.setPriceMin(priceRange != null ? priceRange.priceMin : null);
                card.setPriceMax(priceRange != null ? priceRange.priceMax : null);
            } catch (Exception e) {
                card.setPriceMin(fp.getPriceMin());
                card.setPriceMax(fp.getPriceMax());
            }

            // 价格涨跌：从 stat_price_trend 读取今日/昨日数据（口径与 CountryFactoryProductServiceImpl 一致）
            try {
                List<StatPriceTrendMapper.PriceTrendPoint> trendPoints = statPriceTrendMapper.selectTrendPointsByCountryFactoryProduct(
                        StatPriceTrendMapper.DIMENSION_COUNTRY_FACTORY_PRODUCT,
                        fp.getCountry(), fp.getProductId(), fp.getFactoryNo(), "报盘");
                if (trendPoints != null && !trendPoints.isEmpty()) {
                    LocalDate yesterday = today.minusDays(1);
                    BigDecimal todayPrice = null;
                    BigDecimal yesterdayPrice = null;
                    for (StatPriceTrendMapper.PriceTrendPoint p : trendPoints) {
                        if (p.date != null && p.date.equals(today)) todayPrice = p.avgPrice;
                        if (p.date != null && p.date.equals(yesterday)) yesterdayPrice = p.avgPrice;
                    }
                    if (todayPrice != null && yesterdayPrice != null && yesterdayPrice.compareTo(BigDecimal.ZERO) > 0) {
                        BigDecimal change = todayPrice.subtract(yesterdayPrice).setScale(1, RoundingMode.HALF_UP);
                        BigDecimal changeRate = change.multiply(new BigDecimal("100"))
                                .divide(yesterdayPrice, 1, RoundingMode.HALF_UP);
                        card.setPriceChange(change);
                        card.setPriceChangeRate(changeRate);
                    } else {
                        card.setPriceChange(null);
                        card.setPriceChangeRate(null);
                    }
                } else {
                    card.setPriceChange(fp.getPriceChange());
                    card.setPriceChangeRate(fp.getPriceChangeRate());
                }
            } catch (Exception e) {
                card.setPriceChange(fp.getPriceChange());
                card.setPriceChangeRate(fp.getPriceChangeRate());
            }

            // 价格趋势（近7天）
            try {
                List<StatPriceTrendMapper.PriceTrendPoint> trendPoints = statPriceTrendMapper.selectTrendPointsByCountryFactoryProduct(
                        StatPriceTrendMapper.DIMENSION_COUNTRY_FACTORY_PRODUCT,
                        fp.getCountry(), fp.getProductId(), fp.getFactoryNo(), "报盘");
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
            // 热门商家（带价格）- 使用新查询按厂号产品筛选
            List<MerchantStatWithPriceDTO> merchantStats = bizOfferMapper.aggregateByMerchantForFactoryProduct(today, fp.getFactoryId(), fp.getProductId(), category);
            List<FactoryProductCardDTO.HotMerchantDTO> hotMerchantsList = new ArrayList<>();
            for (MerchantStatWithPriceDTO ms : merchantStats) {
                FactoryProductCardDTO.HotMerchantDTO dto = new FactoryProductCardDTO.HotMerchantDTO();
                dto.setMerchantId(ms.getMerchantId());
                // 直接使用 SQL JOIN 返回的 merchantName（COALESCE short_name, full_name）
                String merchantName = ms.getMerchantName();
                dto.setMerchantName(merchantName != null && !merchantName.isEmpty() ? merchantName : "商家-" + ms.getMerchantId());
                dto.setOfferCount(ms.getTodayOfferCount());
                dto.setPriceMin(ms.getPriceMin());
                dto.setPriceMax(ms.getPriceMax());
                hotMerchantsList.add(dto);
            }
            card.setHotMerchants(hotMerchantsList);
            cards.add(card);
        }

        // 8. 国家产品卡片 - 取前3个
        List<StatCountryProduct> hotCountryProducts = statCountryProductMapper.findHotCountryProducts(today, category, 3);
        for (StatCountryProduct cp : hotCountryProducts) {
            CountryProductCardDTO card = new CountryProductCardDTO();
            card.setCardType("countryProduct");
            card.setRank(rank++);
            card.setCountry(cp.getCountry());
            card.setCountryAlias(cp.getCountry());
            card.setProductId(cp.getProductId());
            card.setProductName(cp.getProductName());
            card.setFactoryCount(cp.getTodayFactoryCount());
            card.setPriceMin(cp.getPriceMin());
            card.setPriceMax(cp.getPriceMax());
            card.setTodayOfferCount(cp.getTodayOfferCount());
            // 前3工厂报价 - 使用新查询按国家产品筛选
            List<FactoryStatWithPriceDTO> factoryStats = bizOfferMapper.aggregateByFactoryForCountryProduct(today, cp.getCountry(), cp.getProductId(), category);
            List<CountryProductCardDTO.FactoryPriceDTO> topFactories = new ArrayList<>();
            for (FactoryStatWithPriceDTO fs : factoryStats) {
                CountryProductCardDTO.FactoryPriceDTO dto = new CountryProductCardDTO.FactoryPriceDTO();
                dto.setFactoryNo(fs.getFactoryNo());
                dto.setPriceMin(fs.getPriceMin());
                dto.setPriceMax(fs.getPriceMax());
                topFactories.add(dto);
            }
            card.setTopFactories(topFactories);
            cards.add(card);
        }

        HomeCardsResponseDTO response = new HomeCardsResponseDTO();
        response.setCards(cards);
        response.setUpdateTime(LocalDateTime.now().format(TIME_FORMATTER));
        return response;
    }

    private String formatCount(int count) {
        if (count >= 10000) {
            return String.format("%.1fw", count / 10000.0);
        } else if (count >= 1000) {
            return String.format("%.1fk", count / 1000.0);
        } else {
            return String.valueOf(count);
        }
    }
}
