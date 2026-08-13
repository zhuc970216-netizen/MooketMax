package com.mooket.social.service.impl;

import com.mooket.social.dto.OfferFeedFilterOptionsDTO;
import com.mooket.social.dto.OfferFeedItemDTO;
import com.mooket.social.dto.OfferFeedPageDTO;
import com.mooket.social.mapper.BizOfferMapper;
import com.mooket.social.service.OfferFeedService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;

@Service
public class OfferFeedServiceImpl implements OfferFeedService {

    private static final int MAX_PAGE_SIZE = 50;

    private final BizOfferMapper offerMapper;

    public OfferFeedServiceImpl(BizOfferMapper offerMapper) {
        this.offerMapper = offerMapper;
    }

    @Override
    public OfferFeedPageDTO getOfferFeed(
            String category,
            String type,
            String keyword,
            Long merchantId,
            String brandName,
            String productName,
            String country,
            String factoryNo,
            String goodsType,
            String region,
            String feedingType,
            String tag,
            Boolean quotedOnly,
            Boolean realNameOnly,
            Boolean verifiedOnly,
            Boolean recentOnly,
            String sortBy,
            int page,
            int pageSize) {
        String dbOfferType = normalizeOfferType(type);
        String normalizedSort = normalizeSortBy(sortBy);
        int safePage = Math.max(page, 1);
        int safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
        int offset = (safePage - 1) * safePageSize;
        boolean useRecentOnly = recentOnly == null || Boolean.TRUE.equals(recentOnly);

        int totalCount = offerMapper.countOfferFeed(
                trimToNull(category),
                dbOfferType,
                trimToNull(keyword),
                merchantId,
                trimToNull(brandName),
                trimToNull(productName),
                trimToNull(country),
                trimToNull(factoryNo),
                trimToNull(goodsType),
                trimToNull(region),
                trimToNull(feedingType),
                trimToNull(tag),
                Boolean.TRUE.equals(quotedOnly),
                Boolean.TRUE.equals(realNameOnly),
                Boolean.TRUE.equals(verifiedOnly),
                useRecentOnly);

        List<OfferFeedItemDTO> items = offerMapper.selectOfferFeed(
                        trimToNull(category),
                        dbOfferType,
                        trimToNull(keyword),
                        merchantId,
                        trimToNull(brandName),
                        trimToNull(productName),
                        trimToNull(country),
                        trimToNull(factoryNo),
                        trimToNull(goodsType),
                        trimToNull(region),
                        trimToNull(feedingType),
                        trimToNull(tag),
                        Boolean.TRUE.equals(quotedOnly),
                        Boolean.TRUE.equals(realNameOnly),
                        Boolean.TRUE.equals(verifiedOnly),
                        useRecentOnly,
                        normalizedSort,
                        safePageSize,
                        offset)
                .stream()
                .map(this::toItem)
                .toList();

        OfferFeedPageDTO result = new OfferFeedPageDTO();
        result.setItems(items);
        result.setTotalCount(totalCount);
        result.setPage(safePage);
        result.setPageSize(safePageSize);
        result.setTotalPages((int) Math.ceil((double) totalCount / safePageSize));
        result.setOfferType("求购".equals(dbOfferType) ? "inquiry" : "offer");
        result.setFilterOptions(buildFilterOptions(
                offerMapper.selectOfferFeedFilterRows(
                        trimToNull(category),
                        dbOfferType,
                        trimToNull(keyword),
                        merchantId,
                        trimToNull(brandName),
                        trimToNull(productName),
                        useRecentOnly)));
        return result;
    }

    private OfferFeedItemDTO toItem(BizOfferMapper.OfferFeedRow row) {
        OfferFeedItemDTO dto = new OfferFeedItemDTO();
        dto.setOfferId(row.offerId);
        dto.setMerchantId(row.merchantId);
        dto.setMerchantName(row.merchantName);
        dto.setMerchantShortName(row.merchantShortName);
        dto.setBrandName(row.brandName);
        dto.setMerchantTags(row.merchantTags);
        dto.setContactPhone(row.contactPhone);
        dto.setUserNickname(row.userNickname);
        dto.setCategory(row.category);
        dto.setProductId(row.productId);
        dto.setProductName(row.productName);
        dto.setCountry(row.country);
        dto.setFactoryNo(row.factoryNo);
        dto.setPrice(row.price);
        dto.setPriceMax(row.priceMax);
        dto.setWeight(row.weight);
        dto.setOfferType(row.offerType);
        dto.setGoodsType(row.goodsType);
        dto.setGoodsLocation(row.goodsLocation);
        dto.setRegion(extractRegion(row.goodsLocation));
        dto.setTags(row.tags);
        dto.setFatRatio(row.fatRatio);
        dto.setFeedingType(row.feedingType);
        dto.setCattleBreed(row.cattleBreed);
        dto.setRemark(row.remark);
        dto.setOfferOriginalText(row.offerOriginalText);
        dto.setPublishTime(row.publishTime);
        return dto;
    }

    private OfferFeedFilterOptionsDTO buildFilterOptions(List<BizOfferMapper.OfferFeedFilterRow> rows) {
        OfferFeedFilterOptionsDTO options = new OfferFeedFilterOptionsDTO();
        LinkedHashSet<String> countries = new LinkedHashSet<>();
        LinkedHashSet<String> factoryNos = new LinkedHashSet<>();
        LinkedHashSet<String> regions = new LinkedHashSet<>();
        LinkedHashSet<String> goodsTypes = new LinkedHashSet<>();
        LinkedHashSet<String> feedingTypes = new LinkedHashSet<>();
        LinkedHashSet<String> tags = new LinkedHashSet<>();

        for (BizOfferMapper.OfferFeedFilterRow row : rows) {
            add(countries, row.country);
            add(factoryNos, row.factoryNo);
            add(regions, extractRegion(row.goodsLocation));
            add(goodsTypes, row.goodsType);
            add(feedingTypes, row.feedingType);
            splitTags(row.tags).forEach(value -> add(tags, value));
        }

        options.setCountries(limit(countries, 60));
        options.setFactoryNos(limit(factoryNos, 80));
        options.setRegions(limit(regions, 60));
        options.setGoodsTypes(limit(goodsTypes, 40));
        options.setFeedingTypes(limit(feedingTypes, 40));
        options.setTags(limit(tags, 80));
        return options;
    }

    private String normalizeOfferType(String type) {
        return "inquiry".equalsIgnoreCase(type) || "求购".equals(type) ? "求购" : "报盘";
    }

    private String normalizeSortBy(String sortBy) {
        String normalized = trimToNull(sortBy);
        if (normalized == null) {
            return "comprehensive";
        }
        return switch (normalized) {
            case "price_asc", "priceAsc" -> "price_asc";
            case "price_desc", "priceDesc" -> "price_desc";
            case "publish_time", "publishTime" -> "publish_time";
            case "field_completeness", "fieldCompleteness" -> "field_completeness";
            default -> "comprehensive";
        };
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void add(LinkedHashSet<String> values, String value) {
        String normalized = trimToNull(value);
        if (normalized != null) {
            values.add(normalized);
        }
    }

    private List<String> limit(LinkedHashSet<String> values, int max) {
        List<String> result = new ArrayList<>();
        for (String value : values) {
            if (result.size() >= max) {
                break;
            }
            result.add(value);
        }
        return result;
    }

    private List<String> splitTags(String tags) {
        String normalized = trimToNull(tags);
        if (normalized == null) {
            return List.of();
        }
        return Arrays.stream(normalized.split("[,，、\\s]+"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }

    private String extractRegion(String location) {
        String normalized = trimToNull(location);
        if (normalized == null) {
            return null;
        }
        String[] parts = normalized.split("[/\\\\,，、\\s-]+");
        return parts.length == 0 ? normalized : parts[parts.length - 1].trim();
    }
}
