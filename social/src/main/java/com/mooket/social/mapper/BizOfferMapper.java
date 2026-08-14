package com.mooket.social.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mooket.social.dto.BrandProductStatDTO;
import com.mooket.social.dto.BrandStatDTO;
import com.mooket.social.dto.CountryProductStatDTO;
import com.mooket.social.dto.CountryStatDTO;
import com.mooket.social.dto.FactoryProductStatDTO;
import com.mooket.social.dto.FactoryStatDTO;
import com.mooket.social.dto.FactoryStatWithPriceDTO;
import com.mooket.social.dto.MerchantStatDTO;
import com.mooket.social.dto.MerchantStatWithPriceDTO;
import com.mooket.social.dto.ProductStatDTO;
import com.mooket.social.entity.BizOffer;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
/* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper.class */
public interface BizOfferMapper extends BaseMapper<BizOffer> {

    @Select("SELECT offer_original_text FROM biz_offer WHERE offer_id = #{offerId} LIMIT 1")
    String selectOfferOriginalText(@Param("offerId") Long offerId);

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$CountryDashboardStats.class */
    public static class CountryDashboardStats {
        public String country;
        public Long totalOfferCount;
        public Integer merchantCount;
        public Integer factoryCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$CountryFactoryProductCombo.class */
    public static class CountryFactoryProductCombo {
        public String country;
        public Integer productId;
        public String productName;
        public String factoryNo;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$CountryFactoryProductStats.class */
    public static class CountryFactoryProductStats {
        public Long totalOfferCount;
        public Long totalInquiryCount;
        public Integer merchantCount;
    }

    public static class MerchantGroupAgg {
        public Long merchantId;
        public String contactPhone;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public Integer offerCount;
        public LocalDateTime latestPublishTime;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$CountryProductAgg.class */
    public static class CountryProductAgg {
        public Integer productId;
        public String productName;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public String factoryNos;
        public Integer factoryCount;
        public Integer offerCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$CountryProductCombo.class */
    public static class CountryProductCombo {
        public String country;
        public Integer productId;
        public String productName;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$CountryProductFactoryAgg.class */
    public static class CountryProductFactoryAgg {
        public String country;
        public String factoryNo;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public String merchantNames;
        public Integer merchantCount;
        public Integer offerCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$CountryProductStats.class */
    public static class CountryProductStats {
        public Long totalOfferCount;
        public Long totalInquiryCount;
        public Integer merchantCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$DailyPriceStats.class */
    public static class DailyPriceStats {
        public LocalDate dataDate;
        public Integer offerCount;
        public BigDecimal avgPrice;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$FactoryDashboardAgg.class */
    public static class FactoryDashboardAgg {
        public Integer productCount;
        public Integer inquiryCount;
        public Integer recentOfferCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$FactoryProductAgg.class */
    public static class FactoryProductAgg {
        public Integer productId;
        public String productName;
        public String country;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public Integer merchantCount;
        public Integer offerCount;
        public String merchantNames;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$HotFactoryAgg.class */
    public static class HotFactoryAgg {
        public String factoryNo;
        public Integer offerCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$HotProductAgg.class */
    public static class HotProductAgg {
        public String productName;
        public Integer offerCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$MerchantDashboardStats.class */
    public static class MerchantDashboardStats {
        public Long recentOfferCount;
        public Long recentInquiryCount;
        public Long recentProductCount;
        public Long recentFactoryCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$MerchantOfferAgg.class */
    public static class MerchantOfferAgg {
        public String productName;
        public String country;
        public String factoryNo;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public String tags;
        public String goodsLocations;
        public String goodsTypes;
        public String feedingTypes;
        public LocalDateTime latestPublishTime;
        public Integer offerCount;
        public String userNickname;
        public BigDecimal empPrice;
        public BigDecimal empPriceMax;
        public String empWeight;
        public String empGoodsLocation;
        public String offerOriginalText;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$MerchantStatAgg.class */
    public static class MerchantStatAgg {
        public Long merchantId;
        public Integer offerCount;
        public Integer inquiryCount;
        public Integer productCount;
        public Integer factoryCount;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$OfferStat.class */
    public static class OfferStat {
        public Long merchantId;
        public String country;
        public String factoryNo;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$PriceRange.class */
    public static class PriceRange {
        public BigDecimal priceMin;
        public BigDecimal priceMax;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$ProductDashboardStats.class */
    public static class ProductDashboardStats {
        public Long totalOfferCount;
        public Integer merchantCount;
        public Integer factoryCount;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$ProductDashboardStatsWithName.class */
    public static class ProductDashboardStatsWithName {
        public Integer productId;
        public String productName;
        public Long totalOfferCount;
        public Integer merchantCount;
        public Integer factoryCount;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$ProductStatAgg.class */
    public static class ProductStatAgg {
        public String country;
        public String factoryNo;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public Integer offerCount;
        public Integer merchantCount;
        public String merchantNames;
    }

    /* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/BizOfferMapper$HomeStatResult.class */
    public static class HomeStatResult {
        public Long totalOfferCount;
        public Long totalInquiryCount;
        public Integer totalMerchantCount;
    }

    public static class OfferFeedRow {
        public Long offerId;
        public Long merchantId;
        public String merchantName;
        public String merchantShortName;
        public String brandName;
        public String merchantTags;
        public String contactPhone;
        public String userNickname;
        public String category;
        public Integer productId;
        public String productName;
        public String country;
        public String factoryNo;
        public BigDecimal price;
        public BigDecimal priceMax;
        public String weight;
        public String offerType;
        public String goodsType;
        public String goodsLocation;
        public String tags;
        public String fatRatio;
        public String feedingType;
        public String cattleBreed;
        public String remark;
        public String offerOriginalText;
        public LocalDateTime publishTime;
    }

    public static class OfferFeedFilterRow {
        public String country;
        public String factoryNo;
        public String goodsType;
        public String goodsLocation;
        public String feedingType;
        public String tags;
    }

    public static class HomeHotSkuAgg {
        public String country;
        public String factoryNo;
        public Integer productId;
        public String productName;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public Integer offerCount;
        public Integer merchantCount;
        public LocalDateTime latestPublishTime;
    }

    public static class HomeHotSkuTrendPoint {
        public LocalDate dataDate;
        public BigDecimal avgPrice;
        public Integer offerCount;
    }

    @Select({"<script>",
            "SELECT",
            "  o.country AS \"country\",",
            "  o.factory_no AS \"factoryNo\",",
            "  MIN(o.product_id) AS \"productId\",",
            "  o.product_name AS \"productName\",",
            "  MIN(CASE WHEN o.price &gt; 0 THEN o.price END) AS \"priceMin\",",
            "  MAX(CASE WHEN o.price_max &gt; 0 THEN o.price_max WHEN o.price &gt; 0 THEN o.price END) AS \"priceMax\",",
            "  COUNT(*) AS \"offerCount\",",
            "  COUNT(DISTINCT COALESCE(o.merchant_id::text, NULLIF(o.contact_phone, ''), NULLIF(o.user_nickname, ''))) AS \"merchantCount\",",
            "  MAX(o.publish_time) AS \"latestPublishTime\"",
            "FROM biz_offer o",
            "WHERE o.status = 'ACTIVE'",
            "  AND o.offer_type = #{offerType}",
            "  AND (CAST(#{category} AS varchar) IS NULL OR CAST(#{category} AS varchar) = '' OR o.category = #{category})",
            "  AND o.country IS NOT NULL AND o.country != ''",
            "  AND o.factory_no IS NOT NULL AND o.factory_no != ''",
            "  AND o.product_name IS NOT NULL AND o.product_name != ''",
            "GROUP BY o.country, o.factory_no, o.product_name",
            "HAVING COUNT(*) &gt; 0 AND MIN(CASE WHEN o.price &gt; 0 THEN o.price END) IS NOT NULL",
            "ORDER BY COUNT(*) DESC, COUNT(DISTINCT COALESCE(o.merchant_id::text, NULLIF(o.contact_phone, ''), NULLIF(o.user_nickname, ''))) DESC, MAX(o.publish_time) DESC",
            "LIMIT #{limit}",
            "</script>"})
    List<HomeHotSkuAgg> selectHomeHotSkus(
            @Param("category") String category,
            @Param("offerType") String offerType,
            @Param("limit") int limit);

    @Select({"<script>",
            "SELECT",
            "  o.data_date AS \"dataDate\",",
            "  AVG(o.price) AS \"avgPrice\",",
            "  COUNT(*) AS \"offerCount\"",
            "FROM biz_offer o",
            "WHERE o.status = 'ACTIVE'",
            "  AND o.offer_type = #{offerType}",
            "  AND o.country = #{country}",
            "  AND REPLACE(o.factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '')",
            "  AND o.product_name = #{productName}",
            "  AND o.price IS NOT NULL AND o.price &gt; 0",
            "  AND o.data_date &gt;= CURRENT_DATE - INTERVAL '6 day'",
            "  AND (CAST(#{category} AS varchar) IS NULL OR CAST(#{category} AS varchar) = '' OR o.category = #{category})",
            "GROUP BY o.data_date",
            "ORDER BY o.data_date ASC",
            "</script>"})
    List<HomeHotSkuTrendPoint> selectHomeHotSkuTrend(
            @Param("country") String country,
            @Param("factoryNo") String factoryNo,
            @Param("productName") String productName,
            @Param("category") String category,
            @Param("offerType") String offerType);

    @Select({"<script>",
            "SELECT",
            "  o.offer_id AS \"offerId\",",
            "  o.merchant_id AS \"merchantId\",",
            "  m.merchant_name AS \"merchantName\",",
            "  m.merchant_short_name AS \"merchantShortName\",",
            "  b.brand_name AS \"brandName\",",
            "  m.merchant_tags AS \"merchantTags\",",
            "  COALESCE(o.contact_phone, m.contact_phone) AS \"contactPhone\",",
            "  o.user_nickname AS \"userNickname\",",
            "  o.category AS \"category\",",
            "  o.product_id AS \"productId\",",
            "  o.product_name AS \"productName\",",
            "  o.country AS \"country\",",
            "  o.factory_no AS \"factoryNo\",",
            "  o.price AS \"price\",",
            "  o.price_max AS \"priceMax\",",
            "  o.weight AS \"weight\",",
            "  o.offer_type AS \"offerType\",",
            "  o.goods_type AS \"goodsType\",",
            "  o.goods_location AS \"goodsLocation\",",
            "  o.tags AS \"tags\",",
            "  o.fat_ratio AS \"fatRatio\",",
            "  o.feeding_type AS \"feedingType\",",
            "  o.cattle_breed AS \"cattleBreed\",",
            "  o.remark AS \"remark\",",
            "  o.offer_original_text AS \"offerOriginalText\",",
            "  o.publish_time AS \"publishTime\"",
            "FROM biz_offer o",
            "LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id",
            "LEFT JOIN dict_brand b ON o.brand_id = b.brand_id",
            "WHERE o.status = 'ACTIVE'",
            "  <if test='recentOnly != null and recentOnly'>AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'</if>",
            "  AND (CAST(#{category} AS varchar) IS NULL OR CAST(#{category} AS varchar) = '' OR o.category = #{category})",
            "  AND (CAST(#{offerType} AS varchar) IS NULL OR CAST(#{offerType} AS varchar) = '' OR o.offer_type = #{offerType})",
            "  <if test='merchantId != null'>AND o.merchant_id = #{merchantId}</if>",
            "  <if test='brandName != null and brandName != \"\"'>AND b.brand_name = #{brandName}</if>",
            "  <if test='productName != null and productName != \"\"'>AND o.product_name = #{productName}</if>",
            "  <if test='keyword != null and keyword != \"\"'>AND (o.product_name ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.country ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.factory_no ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.user_nickname ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.offer_original_text ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR m.merchant_name ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR m.merchant_short_name ILIKE CONCAT('%', #{keyword}, '%'))</if>",
            "  <if test='country != null and country != \"\"'>AND o.country = #{country}</if>",
            "  <if test='factoryNo != null and factoryNo != \"\"'>AND o.factory_no = #{factoryNo}</if>",
            "  <if test='goodsType != null and goodsType != \"\"'>AND o.goods_type = #{goodsType}</if>",
            "  <if test='region != null and region != \"\"'>AND o.goods_location ILIKE CONCAT('%', #{region}, '%')</if>",
            "  <if test='feedingType != null and feedingType != \"\"'>AND o.feeding_type = #{feedingType}</if>",
            "  <if test='tag != null and tag != \"\"'>AND o.tags ILIKE CONCAT('%', #{tag}, '%')</if>",
            "  <if test='quotedOnly != null and quotedOnly'>AND o.price IS NOT NULL AND o.price &gt; 0</if>",
            "  <if test='realNameOnly != null and realNameOnly'>AND m.merchant_tags ILIKE '%实名%'</if>",
            "  <if test='verifiedOnly != null and verifiedOnly'>AND (m.merchant_tags ILIKE '%认证%' OR m.merchant_tags ILIKE '%实名%')</if>",
            "<choose>",
            "  <when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN o.price IS NULL OR o.price &lt;= 0 THEN 1 ELSE 0 END, o.price ASC, o.publish_time DESC, o.offer_id DESC</when>",
            "  <when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN o.price IS NULL OR o.price &lt;= 0 THEN 1 ELSE 0 END, o.price DESC, o.publish_time DESC, o.offer_id DESC</when>",
            "  <when test='sortBy == \"publish_time\"'>ORDER BY o.publish_time DESC, o.offer_id DESC</when>",
            "  <when test='sortBy == \"field_completeness\"'>ORDER BY",
            "    (CASE WHEN NULLIF(BTRIM(o.product_name), '') IS NULL THEN 0 ELSE 1 END",
            "     + CASE WHEN NULLIF(BTRIM(o.country), '') IS NULL THEN 0 ELSE 1 END",
            "     + CASE WHEN NULLIF(BTRIM(o.factory_no), '') IS NULL THEN 0 ELSE 1 END",
            "     + CASE WHEN (o.price IS NULL OR o.price &lt;= 0) AND (o.price_max IS NULL OR o.price_max &lt;= 0) THEN 0 ELSE 1 END",
            "     + CASE WHEN COALESCE(o.merchant_id::text, NULLIF(BTRIM(m.merchant_short_name), ''), NULLIF(BTRIM(m.merchant_name), ''), NULLIF(BTRIM(o.user_nickname), '')) IS NULL THEN 0 ELSE 1 END",
            "     + CASE WHEN NULLIF(BTRIM(o.goods_location), '') IS NULL THEN 0 ELSE 1 END",
            "     + CASE WHEN NULLIF(BTRIM(o.tags), '') IS NULL THEN 0 ELSE 1 END",
            "     + CASE WHEN NULLIF(BTRIM(o.feeding_type), '') IS NULL THEN 0 ELSE 1 END",
            "     + CASE WHEN NULLIF(BTRIM(o.weight), '') IS NULL THEN 0 ELSE 1 END) DESC,",
            "    o.publish_time DESC,",
            "    o.offer_id DESC</when>",
            "  <otherwise>ORDER BY o.publish_time DESC, o.offer_id DESC</otherwise>",
            "</choose>",
            "LIMIT #{limit} OFFSET #{offset}",
            "</script>"})
    List<OfferFeedRow> selectOfferFeed(
            @Param("category") String category,
            @Param("offerType") String offerType,
            @Param("keyword") String keyword,
            @Param("merchantId") Long merchantId,
            @Param("brandName") String brandName,
            @Param("productName") String productName,
            @Param("country") String country,
            @Param("factoryNo") String factoryNo,
            @Param("goodsType") String goodsType,
            @Param("region") String region,
            @Param("feedingType") String feedingType,
            @Param("tag") String tag,
            @Param("quotedOnly") Boolean quotedOnly,
            @Param("realNameOnly") Boolean realNameOnly,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("recentOnly") Boolean recentOnly,
            @Param("sortBy") String sortBy,
            @Param("limit") int limit,
            @Param("offset") int offset);

    @Select({"<script>",
            "SELECT COUNT(*)",
            "FROM biz_offer o",
            "LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id",
            "LEFT JOIN dict_brand b ON o.brand_id = b.brand_id",
            "WHERE o.status = 'ACTIVE'",
            "  <if test='recentOnly != null and recentOnly'>AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'</if>",
            "  AND (CAST(#{category} AS varchar) IS NULL OR CAST(#{category} AS varchar) = '' OR o.category = #{category})",
            "  AND (CAST(#{offerType} AS varchar) IS NULL OR CAST(#{offerType} AS varchar) = '' OR o.offer_type = #{offerType})",
            "  <if test='merchantId != null'>AND o.merchant_id = #{merchantId}</if>",
            "  <if test='brandName != null and brandName != \"\"'>AND b.brand_name = #{brandName}</if>",
            "  <if test='productName != null and productName != \"\"'>AND o.product_name = #{productName}</if>",
            "  <if test='keyword != null and keyword != \"\"'>AND (o.product_name ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.country ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.factory_no ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.user_nickname ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.offer_original_text ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR m.merchant_name ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR m.merchant_short_name ILIKE CONCAT('%', #{keyword}, '%'))</if>",
            "  <if test='country != null and country != \"\"'>AND o.country = #{country}</if>",
            "  <if test='factoryNo != null and factoryNo != \"\"'>AND o.factory_no = #{factoryNo}</if>",
            "  <if test='goodsType != null and goodsType != \"\"'>AND o.goods_type = #{goodsType}</if>",
            "  <if test='region != null and region != \"\"'>AND o.goods_location ILIKE CONCAT('%', #{region}, '%')</if>",
            "  <if test='feedingType != null and feedingType != \"\"'>AND o.feeding_type = #{feedingType}</if>",
            "  <if test='tag != null and tag != \"\"'>AND o.tags ILIKE CONCAT('%', #{tag}, '%')</if>",
            "  <if test='quotedOnly != null and quotedOnly'>AND o.price IS NOT NULL AND o.price &gt; 0</if>",
            "  <if test='realNameOnly != null and realNameOnly'>AND m.merchant_tags ILIKE '%实名%'</if>",
            "  <if test='verifiedOnly != null and verifiedOnly'>AND (m.merchant_tags ILIKE '%认证%' OR m.merchant_tags ILIKE '%实名%')</if>",
            "</script>"})
    int countOfferFeed(
            @Param("category") String category,
            @Param("offerType") String offerType,
            @Param("keyword") String keyword,
            @Param("merchantId") Long merchantId,
            @Param("brandName") String brandName,
            @Param("productName") String productName,
            @Param("country") String country,
            @Param("factoryNo") String factoryNo,
            @Param("goodsType") String goodsType,
            @Param("region") String region,
            @Param("feedingType") String feedingType,
            @Param("tag") String tag,
            @Param("quotedOnly") Boolean quotedOnly,
            @Param("realNameOnly") Boolean realNameOnly,
            @Param("verifiedOnly") Boolean verifiedOnly,
            @Param("recentOnly") Boolean recentOnly);

    @Select({"<script>",
            "SELECT o.country AS \"country\",",
            "       o.factory_no AS \"factoryNo\",",
            "       o.goods_type AS \"goodsType\",",
            "       o.goods_location AS \"goodsLocation\",",
            "       o.feeding_type AS \"feedingType\",",
            "       o.tags AS \"tags\"",
            "FROM biz_offer o",
            "LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id",
            "LEFT JOIN dict_brand b ON o.brand_id = b.brand_id",
            "WHERE o.status = 'ACTIVE'",
            "  <if test='recentOnly != null and recentOnly'>AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'</if>",
            "  AND (CAST(#{category} AS varchar) IS NULL OR CAST(#{category} AS varchar) = '' OR o.category = #{category})",
            "  AND (CAST(#{offerType} AS varchar) IS NULL OR CAST(#{offerType} AS varchar) = '' OR o.offer_type = #{offerType})",
            "  <if test='merchantId != null'>AND o.merchant_id = #{merchantId}</if>",
            "  <if test='brandName != null and brandName != \"\"'>AND b.brand_name = #{brandName}</if>",
            "  <if test='productName != null and productName != \"\"'>AND o.product_name = #{productName}</if>",
            "  <if test='keyword != null and keyword != \"\"'>AND (o.product_name ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.country ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.factory_no ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.user_nickname ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR o.offer_original_text ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR m.merchant_name ILIKE CONCAT('%', #{keyword}, '%')",
            "    OR m.merchant_short_name ILIKE CONCAT('%', #{keyword}, '%'))</if>",
            "ORDER BY o.publish_time DESC",
            "LIMIT 3000",
            "</script>"})
    List<OfferFeedFilterRow> selectOfferFeedFilterRows(
            @Param("category") String category,
            @Param("offerType") String offerType,
            @Param("keyword") String keyword,
            @Param("merchantId") Long merchantId,
            @Param("brandName") String brandName,
            @Param("productName") String productName,
            @Param("recentOnly") Boolean recentOnly);

    @Select({"SELECT * FROM biz_offer WHERE merchant_id = #{merchantId} AND status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' ORDER BY publish_time DESC"})
    List<BizOffer> selectByMerchantId(@Param("merchantId") Long merchantId);

    @Select({"<script>SELECT * FROM biz_offer WHERE merchant_id = #{merchantId} AND offer_type = #{offerType} AND status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' <if test='category != null'> AND category = #{category} </if> ORDER BY publish_time DESC</script>"})
    List<BizOffer> selectByMerchantIdAndType(@Param("merchantId") Long merchantId, @Param("offerType") String offerType, @Param("category") String category);

    @Select({"SELECT merchant_id, COUNT(*) FILTER (WHERE offer_type = '报盘' AND data_date = CURRENT_DATE) as offer_count, COUNT(*) FILTER (WHERE offer_type = '求购' AND data_date = CURRENT_DATE) as inquiry_count, COUNT(DISTINCT product_name) FILTER (WHERE product_name IS NOT NULL AND product_name != '' AND data_date = CURRENT_DATE) as product_count, COUNT(DISTINCT CONCAT(product_name, '|', country, '|', factory_no)) FILTER (WHERE factory_no IS NOT NULL AND factory_no != '' AND data_date = CURRENT_DATE) as factory_count FROM biz_offer WHERE status = 'ACTIVE' AND data_date = CURRENT_DATE AND merchant_id IS NOT NULL GROUP BY merchant_id"})
    List<MerchantStatAgg> selectMerchantStatsAgg();

    @Select({"SELECT COUNT(*) FILTER (WHERE offer_type = '报盘') as totalOfferCount, COUNT(*) FILTER (WHERE offer_type = '求购') as totalInquiryCount, COUNT(DISTINCT merchant_id) as totalMerchantCount FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND (#{category} IS NULL OR category = #{category})"})
    HomeStatResult selectHomeStatResult(@Param("category") String category);

    @Delete({"DELETE FROM biz_offer WHERE data_date < CURRENT_DATE - INTERVAL '1 day'"})
    int deleteOldData();

    @Select({"SELECT COUNT(*) FROM biz_offer WHERE data_date IS DISTINCT FROM CURRENT_DATE OR publish_time::date IS DISTINCT FROM CURRENT_DATE"})
    int countRowsWithNonTodayDate();

    @Update({"UPDATE biz_offer SET publish_time = CURRENT_DATE + publish_time::time, data_date = CURRENT_DATE WHERE data_date IS DISTINCT FROM CURRENT_DATE OR publish_time::date IS DISTINCT FROM CURRENT_DATE"})
    int refreshAllOfferDatesToToday();

    @Select({"SELECT COUNT(*) FROM biz_offer WHERE publish_time::date IS DISTINCT FROM CURRENT_DATE"})
    int countRowsWithNonTodayPublishDate();

    @Update({"UPDATE biz_offer SET publish_time = CURRENT_DATE + publish_time::time WHERE publish_time::date IS DISTINCT FROM CURRENT_DATE"})
    int refreshAllOfferPublishDatesToToday();

    @Insert({"INSERT INTO biz_offer (source_business_id, offer_original_text, category, product_id, product_name, country, factory_no, factory_id, brand_id, merchant_id, contact_phone, user_id, user_nickname, price, price_max, weight, offer_type, goods_type, goods_location, tags, fat_ratio, feeding_type, cattle_breed, remark, publish_time, data_date, status, create_time) VALUES (#{sourceBusinessId}, #{offerOriginalText}, #{category}, #{productId}, #{productName}, #{country}, #{factoryNo}, #{factoryId}, #{brandId}, #{merchantId}, #{contactPhone}, #{userId}, #{userNickname}, #{price}, #{priceMax}, #{weight}, #{offerType}, #{goodsType}, #{goodsLocation}, #{tags}, #{fatRatio}, #{feedingType}, #{cattleBreed}, #{remark}, #{publishTime}, #{dataDate}, #{status}, #{createTime}) ON CONFLICT (source_business_id) DO UPDATE SET offer_original_text = EXCLUDED.offer_original_text, category = EXCLUDED.category, product_id = EXCLUDED.product_id, product_name = EXCLUDED.product_name, country = EXCLUDED.country, factory_no = EXCLUDED.factory_no, factory_id = EXCLUDED.factory_id, brand_id = EXCLUDED.brand_id, merchant_id = EXCLUDED.merchant_id, contact_phone = EXCLUDED.contact_phone, user_id = EXCLUDED.user_id, user_nickname = EXCLUDED.user_nickname, price = EXCLUDED.price, price_max = EXCLUDED.price_max, weight = EXCLUDED.weight, offer_type = EXCLUDED.offer_type, goods_type = EXCLUDED.goods_type, goods_location = EXCLUDED.goods_location, tags = EXCLUDED.tags, fat_ratio = EXCLUDED.fat_ratio, feeding_type = EXCLUDED.feeding_type, cattle_breed = EXCLUDED.cattle_breed, remark = EXCLUDED.remark, publish_time = EXCLUDED.publish_time, data_date = EXCLUDED.data_date, status = EXCLUDED.status"})
    void upsert(BizOffer offer);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if><if test='keyword != null and keyword != \"\"'> AND (product_name LIKE CONCAT('%', #{keyword}, '%') OR country LIKE CONCAT('%', #{keyword}, '%') OR factory_no LIKE CONCAT('%', #{keyword}, '%')) </if>ORDER BY publish_time DESC</script>"})
    List<BizOffer> searchOffers(@Param("category") String category, @Param("offerType") String offerType, @Param("keyword") String keyword);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>ORDER BY publish_time DESC</script>"})
    List<BizOffer> selectByProductId(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT o.country, o.factory_no, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) as price_min, MAX(CASE WHEN o.price &gt; 0 THEN o.price END) as price_max, COUNT(*) as offer_count, COUNT(DISTINCT o.merchant_id) as merchant_count, STRING_AGG(DISTINCT CASE WHEN m.merchant_short_name IS NOT NULL AND m.merchant_short_name != '' THEN CONCAT(m.merchant_short_name, '|', m.merchant_name) ELSE COALESCE(m.merchant_name, '') END, ',') as merchant_names FROM biz_offer o LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id WHERE o.status = 'ACTIVE' AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND o.product_id = #{productId} AND (o.price IS NULL OR (o.price &gt; 0 AND o.price &lt;= 200)) AND (#{category} IS NULL OR o.category = #{category}) AND (#{offerType} IS NULL OR o.offer_type = #{offerType}) GROUP BY o.country, o.factory_no <choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN o.price &gt; 0 THEN o.price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY COUNT(*) DESC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC</otherwise></choose> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<ProductStatAgg> selectProductStatsAgg(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset, @Param("sortBy") String sortBy);

    @Select({"SELECT COUNT(DISTINCT country || '_' || factory_no) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND (price IS NULL OR (price > 0 AND price <= 200)) AND (#{category} IS NULL OR category = #{category}) AND (#{offerType} IS NULL OR offer_type = #{offerType})"})
    int countProductStatsAgg(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COUNT(DISTINCT o.country || '_' || o.factory_no) FROM biz_offer o WHERE o.status = 'ACTIVE' AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND o.product_id = #{productId} AND ( o.price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL AND price &gt; 0 <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND o.price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL AND price &gt; 0 <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) <if test='category != null'> AND o.category = #{category} </if><if test='offerType != null'> AND o.offer_type = #{offerType} </if>)</script>"})
    int countProductStatsAggFiltered(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT   o.country, o.factory_no,   MIN(CASE WHEN o.price > 0 THEN o.price END) as price_min,   MAX(CASE WHEN o.price > 0 THEN o.price END) as price_max,   COUNT(*) as offer_count,   COUNT(DISTINCT o.merchant_id) as merchant_count,   STRING_AGG(DISTINCT CASE WHEN m.merchant_short_name IS NOT NULL AND m.merchant_short_name != '' THEN CONCAT(m.merchant_short_name, '|', m.merchant_name) ELSE COALESCE(m.merchant_name, '') END, ',') as merchant_names FROM biz_offer o LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id WHERE o.status = 'ACTIVE' AND o.publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND o.product_id = #{productId} AND (  o.price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL AND price > 0 <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND o.price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL AND price > 0 <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>)) <if test='category != null'> AND o.category = #{category} </if><if test='offerType != null'> AND o.offer_type = #{offerType} </if>GROUP BY o.country, o.factory_no <if test='sortBy == \"price_asc\"'>ORDER BY price_min ASC, offer_count DESC</if><if test='sortBy == \"price_desc\"'>ORDER BY price_max DESC, offer_count DESC</if><if test='sortBy == \"comprehensive\" or sortBy == null or sortBy == \"\"'>ORDER BY offer_count DESC, price_min ASC</if> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<ProductStatAgg> selectProductStatsAggFiltered(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset, @Param("sortBy") String sortBy);

    @Select({"<script>SELECT   COUNT(*) as total_offer_count,   COUNT(DISTINCT merchant_id) as merchant_count,   COUNT(DISTINCT country || '_' || factory_no) as factory_count,   MIN(price) as price_min,   MAX(price) as price_max FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND (price IS NULL OR (  price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    ProductDashboardStats selectProductDashboardStatsFiltered(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT merchant_id, country, factory_no, MIN(price) as price_min, MAX(price) as price_max FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>GROUP BY merchant_id, country, factory_no</script>"})
    List<OfferStat> selectProductOfferStats(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COUNT(*) as total_offer_count, COUNT(DISTINCT merchant_id) as merchant_count, COUNT(DISTINCT country || '_' || factory_no) as factory_count, MIN(price) as price_min, MAX(price) as price_max FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND (price IS NULL OR (price > 0 AND price &lt;= 200)) <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    ProductDashboardStats selectProductDashboardStats(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT o.product_id AS productId, MAX(p.product_name) AS productName, COUNT(*) as totalOfferCount, COUNT(DISTINCT o.merchant_id) as merchantCount, COUNT(DISTINCT o.country || '_' || o.factory_no) as factoryCount, MIN(o.price) as priceMin, MAX(o.price) as priceMax FROM biz_offer o LEFT JOIN dict_product p ON o.product_id = p.product_id WHERE o.status = 'ACTIVE' AND o.publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND o.offer_type = '报盘' AND o.product_id IS NOT NULL AND (o.price IS NULL OR (o.price > 0 AND o.price &lt;= 200)) <if test='category != null'> AND o.category = #{category} </if>GROUP BY o.product_id</script>"})
    List<ProductDashboardStatsWithName> selectProductDashboardStatsBatch(@Param("category") String category);

    @Select({"<script>SELECT   MIN(price) as price_min,   MAX(price) as price_max FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price > 0 AND (price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL AND price > 0 <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_id = #{productId} AND price IS NOT NULL AND price > 0 <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>)) <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    PriceRange selectFilteredPriceRange(@Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COUNT(*) FILTER (WHERE offer_type = '报盘' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day') as recent_offer_count, COUNT(*) FILTER (WHERE offer_type = '求购' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day') as recent_inquiry_count, COUNT(DISTINCT product_name) FILTER (WHERE offer_type = '报盘' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day') as recent_product_count, COUNT(DISTINCT product_name || '_' || country || '_' || factory_no) FILTER (WHERE offer_type = '报盘' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day') as recent_factory_count FROM biz_offer WHERE merchant_id = #{merchantId} AND status = 'ACTIVE' <if test='category != null'> AND category = #{category} </if></script>"})
    MerchantDashboardStats selectMerchantDashboardStats(@Param("merchantId") Long merchantId, @Param("category") String category);

    @Select({"<script>WITH ranked_offers AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY product_name, country, factory_no ORDER BY publish_time DESC) as rn FROM biz_offer WHERE merchant_id = #{merchantId} AND status = 'ACTIVE' AND (#{offerType} IS NULL OR offer_type = #{offerType}) <if test='category != null'> AND category = #{category} </if>), grouped AS (SELECT product_name, country, factory_no, MIN(CASE WHEN price &gt; 0 THEN price END) as price_min, MAX(CASE WHEN price &gt; 0 THEN price END) as price_max, STRING_AGG(DISTINCT tags, ',') as tags, STRING_AGG(DISTINCT goods_location, '/') as goods_locations, STRING_AGG(DISTINCT goods_type, ',') as goods_types, STRING_AGG(DISTINCT feeding_type, ',') as feeding_types, MAX(publish_time) as latest_publish_time, COUNT(*) as offer_count, MIN(user_nickname) as user_nickname, MIN(price) as emp_price, MIN(price_max) as emp_price_max, MIN(weight) as emp_weight, MIN(goods_location) as emp_goods_location, MIN(offer_original_text) as offer_original_text FROM ranked_offers WHERE rn = 1 GROUP BY product_name, country, factory_no) SELECT * FROM grouped <choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN price_min IS NULL OR price_min &lt;= 0 THEN 1 ELSE 0 END ASC, price_min ASC, offer_count DESC, latest_publish_time DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN price_max IS NULL OR price_max &lt;= 0 THEN 1 ELSE 0 END ASC, price_max DESC, offer_count DESC, latest_publish_time DESC</when><when test='sortBy == \"publish_time\"'>ORDER BY latest_publish_time DESC, offer_count DESC</when><otherwise>ORDER BY latest_publish_time DESC, offer_count DESC</otherwise></choose> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<MerchantOfferAgg> selectMerchantOfferAgg(@Param("merchantId") Long merchantId, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset, @Param("sortBy") String sortBy);

    @Select({"<script>SELECT COUNT(DISTINCT product_name || '_' || country || '_' || factory_no) FROM biz_offer WHERE merchant_id = #{merchantId} AND status = 'ACTIVE' AND (#{offerType} IS NULL OR offer_type = #{offerType}) <if test='category != null'> AND category = #{category} </if></script>"})
    int countMerchantOfferAgg(@Param("merchantId") Long merchantId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT   COUNT(*) as total_offer_count,   COUNT(DISTINCT merchant_id) as merchant_count,   COUNT(DISTINCT factory_no) as factory_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    CountryDashboardStats selectCountryDashboardStats(@Param("country") String country, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT   country,   COUNT(*) as total_offer_count,   COUNT(DISTINCT merchant_id) as merchant_count,   COUNT(DISTINCT factory_no) as factory_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND offer_type = '报盘' AND country IS NOT NULL AND country != '' <if test='category != null'> AND category = #{category} </if>GROUP BY country</script>"})
    List<CountryDashboardStats> selectCountryDashboardStatsBatch(@Param("category") String category);

    @Select({"<script>SELECT   MIN(price) as price_min,   MAX(price) as price_max FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND (price IS NULL OR (  price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    PriceRange selectFilteredPriceRangeByCountry(@Param("country") String country, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT   product_id,   product_name,   MIN(price) as price_min,   MAX(price) as price_max,   STRING_AGG(DISTINCT factory_no, ',') as factory_nos,   COUNT(DISTINCT factory_no) as factory_count,   COUNT(*) as offer_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>AND (price IS NULL OR (  price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) GROUP BY product_id, product_name ORDER BY offer_count DESC, MIN(price) ASC LIMIT #{limit} OFFSET #{offset}</script>"})
    List<CountryProductAgg> selectCountryProductAgg(@Param("country") String country, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset);

    @Select({"<script>SELECT   product_id,   product_name,   MIN(price) as price_min,   MAX(price) as price_max,   STRING_AGG(DISTINCT factory_no, ',') as factory_nos,   COUNT(DISTINCT factory_no) as factory_count,   COUNT(*) as offer_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>AND (price IS NULL OR (  price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) GROUP BY product_id, product_name <choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(price) IS NULL OR MIN(price) &lt;= 0 THEN 1 ELSE 0 END ASC, MIN(price) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(price) IS NULL OR MAX(price) &lt;= 0 THEN 1 ELSE 0 END ASC, MAX(price) DESC, COUNT(*) DESC</when><otherwise>ORDER BY COUNT(*) DESC, MIN(price) ASC</otherwise></choose> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<CountryProductAgg> selectCountryProductAggPaged(@Param("country") String country, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset, @Param("sortBy") String sortBy);

    @Select({"<script>SELECT COUNT(DISTINCT product_name) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>AND (price IS NULL OR (  price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) </script>"})
    int countCountryProductAgg(@Param("country") String country, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT factory_no, COUNT(*) as offer_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no IS NOT NULL AND factory_no != '' <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>GROUP BY factory_no ORDER BY COUNT(*) DESC LIMIT 3</script>"})
    List<HotFactoryAgg> selectHotFactories(@Param("country") String country, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT product_name, COUNT(*) as offer_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND product_name IS NOT NULL AND product_name != '' <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>GROUP BY product_name ORDER BY COUNT(*) DESC LIMIT 3</script>"})
    List<HotProductAgg> selectHotProducts(@Param("country") String country, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT o.product_id, o.product_name, COALESCE(MIN(CASE WHEN o.price &gt; 0 THEN o.price END), 0) as price_min, COALESCE(MAX(CASE WHEN o.price &gt; 0 THEN o.price END), 0) as price_max, COUNT(DISTINCT o.merchant_id) as merchant_count, COUNT(*) as offer_count, STRING_AGG(DISTINCT CASE WHEN m.merchant_short_name IS NOT NULL AND m.merchant_short_name != '' THEN CONCAT(m.merchant_short_name, '|', m.merchant_name) ELSE COALESCE(m.merchant_name, '') END, ',') as merchant_names FROM biz_offer o LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id WHERE o.status = 'ACTIVE' AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND o.country = #{country} AND o.factory_no = #{factoryNo} <if test='category != null'> AND o.category = #{category} </if><if test='offerType != null'> AND o.offer_type = #{offerType} </if>AND (o.price IS NULL OR (o.price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no = #{factoryNo} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND o.price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no = #{factoryNo} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) GROUP BY o.product_id, o.product_name <choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN o.price &gt; 0 THEN o.price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC</otherwise></choose> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<FactoryProductAgg> selectFactoryProductAgg(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset, @Param("sortBy") String sortBy);

    @Select({"<script>SELECT o.product_id, o.product_name, COALESCE(MIN(CASE WHEN o.price &gt; 0 THEN o.price END), 0) as price_min, COALESCE(MAX(CASE WHEN o.price &gt; 0 THEN o.price END), 0) as price_max, COUNT(DISTINCT o.merchant_id) as merchant_count, COUNT(*) as offer_count, STRING_AGG(DISTINCT CASE WHEN m.merchant_short_name IS NOT NULL AND m.merchant_short_name != '' THEN CONCAT(m.merchant_short_name, '|', m.merchant_name) ELSE COALESCE(m.merchant_name, '') END, ',') as merchant_names FROM biz_offer o LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id WHERE o.status = 'ACTIVE' AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND o.country = #{country} AND o.factory_no = #{factoryNo} <if test='category != null'> AND o.category = #{category} </if><if test='offerType != null'> AND o.offer_type = #{offerType} </if>AND (o.price IS NULL OR (o.price &gt; 0 AND o.price &lt;= 200)) GROUP BY o.product_id, o.product_name <choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN o.price &gt; 0 THEN o.price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC</otherwise></choose> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<FactoryProductAgg> selectFactoryProductAggFast(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset, @Param("sortBy") String sortBy);

    @Select({"<script>SELECT COUNT(DISTINCT product_id) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no = #{factoryNo} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>AND (price IS NULL OR (  price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no = #{factoryNo} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no = #{factoryNo} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) </script>"})
    int countFactoryProductAgg(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COUNT(DISTINCT product_id) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no = #{factoryNo} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>AND (price IS NULL OR (price > 0 AND price &lt;= 200)) </script>"})
    int countFactoryProductAggFast(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT   COUNT(DISTINCT product_id) as product_count,   COUNT(CASE WHEN offer_type = '求购' THEN 1 END) as inquiry_count,   COUNT(*) FILTER (WHERE offer_type = #{offerType}) as recent_offer_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND factory_no = #{factoryNo} <if test='category != null'> AND category = #{category} </if></script>"})
    FactoryDashboardAgg selectFactoryDashboardStats(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT   COUNT(*) FILTER (WHERE offer_type = '报盘') as total_offer_count,   COUNT(*) FILTER (WHERE offer_type = '求购') as total_inquiry_count,   COUNT(DISTINCT merchant_id) as merchant_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND product_name LIKE '%' || #{productName} || '%' <if test='category != null'> AND category = #{category} </if></script>"})
    CountryProductStats selectCountryProductStats(@Param("country") String country, @Param("productName") String productName, @Param("category") String category);

    @Select({"<script>SELECT   data_date,   COUNT(*) as offer_count,   AVG(price) as avg_price FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_name = #{productName} <if test='offerType != null'> AND offer_type = #{offerType} </if>AND price IS NOT NULL AND price &gt;= 5 AND price &lt;= 200 <if test='category != null'> AND category = #{category} </if>AND data_date &gt;= CURRENT_DATE - INTERVAL '7 day' GROUP BY data_date ORDER BY data_date ASC</script>"})
    List<DailyPriceStats> selectDailyPriceStats(@Param("country") String country, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT o.country, o.factory_no, COALESCE(MIN(CASE WHEN o.price &gt; 0 THEN o.price END), 0) as price_min, COALESCE(MAX(CASE WHEN o.price &gt; 0 THEN o.price END), 0) as price_max, STRING_AGG(DISTINCT CASE WHEN m.merchant_short_name IS NOT NULL AND m.merchant_short_name != '' THEN CONCAT(m.merchant_short_name, '|', m.merchant_name) ELSE COALESCE(m.merchant_name, '') END, ',') as merchant_names, COUNT(DISTINCT o.merchant_id) as merchant_count, COUNT(*) as offer_count FROM biz_offer o LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id WHERE o.status = 'ACTIVE' AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND o.country = #{country} AND o.product_name = #{productName} <if test='category != null'> AND o.category = #{category} </if><if test='offerType != null'> AND o.offer_type = #{offerType} </if> GROUP BY o.country, o.factory_no <choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN o.price &gt; 0 THEN o.price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC</otherwise></choose> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<CountryProductFactoryAgg> selectCountryProductFactoryAgg(@Param("country") String country, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("limit") int limit, @Param("offset") int offset, @Param("sortBy") String sortBy);

    @Select({"<script>SELECT COUNT(DISTINCT factory_no) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND product_name = #{productName} <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>AND (price IS NULL OR (price > 0 AND price &lt;= 200)) </script>"})
    int countCountryProductFactoryAgg(@Param("country") String country, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT   MIN(price) as price_min,   MAX(price) as price_max FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND product_name = #{productName} AND (price IS NULL OR (  price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND product_name = #{productName} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND country = #{country} AND product_name = #{productName} AND price IS NOT NULL <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if>))) <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    PriceRange selectFilteredPriceRangeByCountryProduct(@Param("country") String country, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT CURRENT_DATE as data_date, COUNT(*) as offer_count, AVG(price) as avg_price FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND offer_type = #{offerType} AND price IS NOT NULL AND price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = CURRENT_DATE) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = CURRENT_DATE) AND data_date = CURRENT_DATE</script>"})
    List<DailyPriceStats> selectTodayAvgPrice(@Param("country") String country, @Param("productId") Integer productId, @Param("offerType") String offerType);

    @Select({"<script>SELECT CURRENT_DATE as data_date, COUNT(*) as offer_count, AVG(price) as avg_price FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND factory_no = #{factoryNo} AND offer_type = #{offerType} AND price IS NOT NULL AND price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND factory_no = #{factoryNo} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = CURRENT_DATE) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND factory_no = #{factoryNo} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = CURRENT_DATE) AND data_date = CURRENT_DATE</script>"})
    List<DailyPriceStats> selectTodayAvgPriceByFactory(@Param("country") String country, @Param("productId") Integer productId, @Param("factoryNo") String factoryNo, @Param("offerType") String offerType);

    @Select({"<script>SELECT #{targetDate} as data_date, COUNT(*) as offer_count, AVG(price) as avg_price FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND offer_type = #{offerType} AND price IS NOT NULL AND price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = #{targetDate}) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = #{targetDate}) AND data_date = #{targetDate}</script>"})
    List<DailyPriceStats> selectHistoricalAvgPrice(@Param("targetDate") LocalDate targetDate, @Param("country") String country, @Param("productId") Integer productId, @Param("offerType") String offerType);

    @Select({"<script>SELECT #{targetDate} as data_date, COUNT(*) as offer_count, AVG(price) as avg_price FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND factory_no = #{factoryNo} AND offer_type = #{offerType} AND price IS NOT NULL AND price &gt;= (SELECT 2.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND factory_no = #{factoryNo} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = #{targetDate}) AND price &lt;= (SELECT 2.5 * PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price) - 1.5 * PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price) FROM biz_offer WHERE status = 'ACTIVE' AND country = #{country} AND product_id = #{productId} AND factory_no = #{factoryNo} AND offer_type = #{offerType} AND price IS NOT NULL AND data_date = #{targetDate}) AND data_date = #{targetDate}</script>"})
    List<DailyPriceStats> selectHistoricalAvgPriceByFactory(@Param("targetDate") LocalDate targetDate, @Param("country") String country, @Param("productId") Integer productId, @Param("factoryNo") String factoryNo, @Param("offerType") String offerType);

    @Select({"<script>SELECT DISTINCT country, product_id, product_name FROM biz_offer WHERE status = 'ACTIVE' AND data_date &gt;= CURRENT_DATE - INTERVAL '7 day' AND country IS NOT NULL AND product_id IS NOT NULL</script>"})
    List<CountryProductCombo> selectActiveCountryProductCombos();

    @Select({"<script>SELECT DISTINCT country, product_id, product_name, factory_no FROM biz_offer WHERE status = 'ACTIVE' AND data_date &gt;= CURRENT_DATE - INTERVAL '7 day' AND country IS NOT NULL AND product_id IS NOT NULL AND factory_no IS NOT NULL</script>"})
    List<CountryFactoryProductCombo> selectActiveCountryFactoryProductCombos();

    @Select({"<script>SELECT   COUNT(*) FILTER (WHERE offer_type = '报盘') as total_offer_count,   COUNT(*) FILTER (WHERE offer_type = '求购') as total_inquiry_count,   COUNT(DISTINCT merchant_id) as merchant_count FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if></script>"})
    CountryFactoryProductStats selectCountryFactoryProductStats(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category);

    @Select({"<script>SELECT   MIN(price) as price_min,   MAX(price) as price_max FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    PriceRange selectFilteredPriceRangeByCountryFactoryProduct(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if><choose>  <when test='sortBy == \"price_asc\"'> ORDER BY price ASC NULLS LAST </when>  <when test='sortBy == \"price_desc\"'> ORDER BY price DESC NULLS LAST </when>  <when test='sortBy == \"publish_time\"'> ORDER BY publish_time DESC </when>  <otherwise> ORDER BY     CASE WHEN offer_type = '报盘' THEN 0 ELSE 1 END,     CASE WHEN merchant_id IS NOT NULL THEN 0 ELSE 1 END,     publish_time DESC   </otherwise></choose>LIMIT #{limit} OFFSET #{offset}</script>"})
    List<BizOffer> selectOfferListByCountryFactoryProduct(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("sortBy") String sortBy, @Param("limit") int limit, @Param("offset") int offset);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if> ORDER BY publish_time DESC</script>"})
    List<BizOffer> selectOfferListByCountryFactoryProductAll(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COALESCE(merchant_id, -1) AS merchant_id, MIN(contact_phone) AS contact_phone, MIN(CASE WHEN price &gt; 0 THEN price END) AS price_min, MAX(CASE WHEN price &gt; 0 THEN price END) AS price_max, COUNT(*) AS offer_count, MAX(publish_time) AS latest_publish_time FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if> GROUP BY COALESCE(merchant_id, -1) <choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN price &gt; 0 THEN price END) ASC, COUNT(*) DESC, MAX(publish_time) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN price &gt; 0 THEN price END) DESC, COUNT(*) DESC, MAX(publish_time) DESC</when><when test='sortBy == \"publish_time\"'>ORDER BY MAX(publish_time) DESC, COUNT(*) DESC</when><otherwise>ORDER BY COUNT(*) DESC, MAX(publish_time) DESC</otherwise></choose> LIMIT #{limit} OFFSET #{offset}</script>"})
    List<MerchantGroupAgg> selectCountryFactoryProductMerchantAgg(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("sortBy") String sortBy, @Param("limit") int limit, @Param("offset") int offset);

    @Select({"<script>SELECT COUNT(DISTINCT COALESCE(merchant_id, -1)) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    int countCountryFactoryProductMerchantAgg(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if> <if test='merchantIds != null and merchantIds.size() > 0'>AND merchant_id IN <foreach collection='merchantIds' item='merchantId' open='(' separator=',' close=')'>#{merchantId}</foreach></if> ORDER BY publish_time DESC</script>"})
    List<BizOffer> selectOfferListByCountryFactoryProductMerchantIds(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("merchantIds") List<Long> merchantIds);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if> AND merchant_id IS NULL ORDER BY publish_time DESC</script>"})
    List<BizOffer> selectOfferListByCountryFactoryProductNoMerchant(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day' <choose><when test='country != null and country.length() > 0'> AND country = #{country} </when><otherwise> AND (country IS NULL OR country = '') </otherwise></choose><choose><when test='factoryNo != null and factoryNo.length() > 0'> AND REPLACE(factory_no, ' ', '') = REPLACE(#{factoryNo}, ' ', '') </when><otherwise> AND (factory_no IS NULL OR REPLACE(factory_no, ' ', '') = '') </otherwise></choose> <if test='productName != null and productName.length() > 0'> AND product_name = #{productName} </if> <if test='category != null'> AND category = #{category} </if><if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    int countOfferListByCountryFactoryProduct(@Param("country") String country, @Param("factoryNo") String factoryNo, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND data_date &gt;= #{startDate} - INTERVAL '2 days' AND data_date &lt;= #{endDate} <if test='category != null'> AND category = #{category} </if>ORDER BY data_date DESC, publish_time DESC</script>"})
    List<BizOffer> findByCategoryAndDateRange(@Param("category") String category, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Select({"<script>SELECT * FROM biz_offer WHERE status = 'ACTIVE' AND data_date &gt;= #{startDate} - INTERVAL '2 days' AND data_date &lt;= #{endDate} ORDER BY data_date DESC, publish_time DESC</script>"})
    List<BizOffer> findByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    @Select({"SELECT\n    o.product_id AS productId,\n    MAX(COALESCE(p.product_name, o.product_name)) AS productName,\n    o.category,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayOfferCount,\n    COUNT(*) FILTER (WHERE o.offer_type = '求购' AND o.data_date = #{statDate}) AS todayInquiryCount,\n    COUNT(DISTINCT o.merchant_id) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayMerchantCount,\n    COUNT(DISTINCT o.factory_id) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayFactoryCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMax\nFROM biz_offer o\nLEFT JOIN dict_product p ON o.product_id = p.product_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date >= #{statDate} - INTERVAL '2 days'\n  AND o.data_date <= #{statDate}\n  AND o.category = #{category}\n  AND o.product_id IS NOT NULL\nGROUP BY o.product_id, o.category\n"})
    List<ProductStatDTO> aggregateByProduct(@Param("statDate") LocalDate statDate, @Param("category") String category);

    @Select({"SELECT\n    country,\n    category,\n    COUNT(*) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayOfferCount,\n    COUNT(*) FILTER (WHERE offer_type = '求购' AND data_date = #{statDate}) AS todayInquiryCount,\n    COUNT(DISTINCT factory_id) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayFactoryCount,\n    COUNT(DISTINCT merchant_id) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayMerchantCount\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND data_date = #{statDate}\n  AND category = #{category}\n  AND country IS NOT NULL AND country <> ''\nGROUP BY country, category\n"})
    List<CountryStatDTO> aggregateByCountry(@Param("statDate") LocalDate statDate, @Param("category") String category);

    @Select({"SELECT\n    country,\n    factory_no AS factoryNo,\n    factory_id AS factoryId,\n    category,\n    COUNT(*) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayOfferCount,\n    COUNT(*) FILTER (WHERE offer_type = '求购' AND data_date = #{statDate}) AS todayInquiryCount,\n    COUNT(DISTINCT merchant_id) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayMerchantCount,\n    MIN(price) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate} AND price IS NOT NULL) AS priceMin,\n    MAX(price) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate} AND price IS NOT NULL) AS priceMax\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND data_date = #{statDate}\n  AND category = #{category}\n  AND factory_id IS NOT NULL\n  AND country IS NOT NULL AND country <> ''\nGROUP BY country, factory_no, factory_id, category\n"})
    List<FactoryStatDTO> aggregateByFactory(@Param("statDate") LocalDate statDate, @Param("category") String category);

    @Select({"SELECT\n    o.country,\n    o.product_id AS productId,\n    MAX(COALESCE(p.product_name, o.product_name)) AS productName,\n    o.category,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayOfferCount,\n    COUNT(*) FILTER (WHERE o.offer_type = '求购' AND o.data_date = #{statDate}) AS todayInquiryCount,\n    COUNT(DISTINCT o.factory_id) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayFactoryCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMax,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS avgPrice,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} - INTERVAL '1 day' AND o.price IS NOT NULL) AS avgPriceYesterday\nFROM biz_offer o\nLEFT JOIN dict_product p ON o.product_id = p.product_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date BETWEEN #{statDate} - INTERVAL '1 day' AND #{statDate}\n  AND o.category = #{category}\n  AND o.country IS NOT NULL AND o.country <> ''\n  AND o.product_id IS NOT NULL\nGROUP BY o.country, o.product_id, o.category\n"})
    List<CountryProductStatDTO> aggregateByCountryProduct(@Param("statDate") LocalDate statDate, @Param("category") String category);

    @Select({"SELECT\n    REPLACE(MAX(d.brand_name), ' ', '') AS brandName,\n    MIN(o.brand_id) AS brandId,\n    o.category,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayOfferCount,\n    COUNT(DISTINCT o.factory_no) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayFactoryCount,\n    COUNT(DISTINCT o.product_id) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayProductCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMax\nFROM biz_offer o\nLEFT JOIN dict_brand d ON o.brand_id = d.brand_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date = #{statDate}\n  AND o.category = #{category}\n  AND o.brand_id IS NOT NULL\nGROUP BY REPLACE(d.brand_name, ' ', ''), o.category\n"})
    List<BrandStatDTO> aggregateByBrand(@Param("statDate") LocalDate statDate, @Param("category") String category);

    @Select({"SELECT\n    o.brand_id AS brandId,\n    country || ' ' || factory_no AS brandName,\n    o.product_id AS productId,\n    MAX(COALESCE(p.product_name, o.product_name)) AS productName,\n    o.category,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayOfferCount,\n    COUNT(DISTINCT o.factory_id) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayFactoryCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMax,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS avgPrice,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} - INTERVAL '1 day' AND o.price IS NOT NULL) AS avgPriceYesterday\nFROM biz_offer o\nLEFT JOIN dict_product p ON o.product_id = p.product_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date BETWEEN #{statDate} - INTERVAL '1 day' AND #{statDate}\n  AND o.category = #{category}\n  AND o.brand_id IS NOT NULL\n  AND o.product_id IS NOT NULL\nGROUP BY o.brand_id, country, factory_no, o.product_id, o.category\n"})
    List<BrandProductStatDTO> aggregateByBrandProduct(@Param("statDate") LocalDate statDate, @Param("category") String category);

    // ========== BrandProduct by BrandId+ProductId (2天窗口，和首页口径一致) ==========
    @Select({"SELECT\\n    o.brand_id AS brandId,\\n    MAX(country || ' ' || factory_no) AS brandName,\\n    o.product_id AS productId,\\n    MAX(COALESCE(p.product_name, o.product_name)) AS productName,\\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayOfferCount,\\n    COUNT(DISTINCT o.factory_id) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayFactoryCount,\\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMin,\\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMax,\\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS avgPrice,\\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} - 1 AND o.price IS NOT NULL) AS avgPriceYesterday\\nFROM biz_offer o\\nLEFT JOIN dict_product p ON o.product_id = p.product_id\\nWHERE o.status = 'ACTIVE'\\n  AND o.data_date >= #{statDate} - INTERVAL '2 days'\\n  AND o.data_date <= #{statDate}\\n  AND o.brand_id = #{brandId}\\n  AND o.product_id = #{productId}\\nGROUP BY o.brand_id, o.product_id"})
    BrandProductStatDTO aggregateByBrandProductById(@Param("statDate") LocalDate statDate, @Param("brandId") Integer brandId, @Param("productId") Integer productId);

    @Select({"SELECT\n    o.country,\n    o.factory_no AS factoryNo,\n    o.factory_id AS factoryId,\n    o.product_id AS productId,\n    MAX(COALESCE(p.product_name, o.product_name)) AS productName,\n    o.category,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayOfferCount,\n    COUNT(*) FILTER (WHERE o.offer_type = '求购' AND o.data_date = #{statDate}) AS todayInquiryCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMax,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS avgPrice,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} - INTERVAL '1 day' AND o.price IS NOT NULL) AS avgPriceYesterday\nFROM biz_offer o\nLEFT JOIN dict_product p ON o.product_id = p.product_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date BETWEEN #{statDate} - INTERVAL '1 day' AND #{statDate}\n  AND o.category = #{category}\n  AND o.factory_id IS NOT NULL\n  AND o.product_id IS NOT NULL\n  AND o.country IS NOT NULL AND o.country <> ''\nGROUP BY country, factory_no, factory_id, o.product_id, o.category\nHAVING COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) > 0\n"})
    List<FactoryProductStatDTO> aggregateByFactoryProduct(@Param("statDate") LocalDate statDate, @Param("category") String category);

    // 按 country + factoryNo + category 精确过滤的热门产品查询
    @Select({"SELECT\n    o.country,\n    o.factory_no AS factoryNo,\n    o.factory_id AS factoryId,\n    o.product_id AS productId,\n    MAX(COALESCE(p.product_name, o.product_name)) AS productName,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) AS todayOfferCount,\n    COUNT(*) FILTER (WHERE o.offer_type = '求购' AND o.data_date = #{statDate}) AS todayInquiryCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS priceMax,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} AND o.price IS NOT NULL) AS avgPrice,\n    AVG(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate} - INTERVAL '1 day' AND o.price IS NOT NULL) AS avgPriceYesterday\nFROM biz_offer o\nLEFT JOIN dict_product p ON o.product_id = p.product_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date BETWEEN #{statDate} - INTERVAL '1 day' AND #{statDate}\n  AND o.factory_id IS NOT NULL\n  AND o.product_id IS NOT NULL\n  AND o.country = #{country}\n  AND o.factory_no = #{factoryNo}\n  AND o.category = #{category}\nGROUP BY country, factory_no, factory_id, o.product_id\nHAVING COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date = #{statDate}) > 0\n"})
    List<FactoryProductStatDTO> aggregateByFactoryProductFiltered(@Param("statDate") LocalDate statDate, @Param("country") String country, @Param("factoryNo") String factoryNo, @Param("category") String category);

    @Select({"SELECT\n    merchant_id AS merchantId,\n    COUNT(*) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayOfferCount,\n    COUNT(*) FILTER (WHERE offer_type = '求购' AND data_date = #{statDate}) AS todayInquiryCount,\n    COUNT(DISTINCT product_id) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayProductCount,\n    COUNT(DISTINCT factory_id) FILTER (WHERE offer_type = '报盘' AND data_date = #{statDate}) AS todayFactoryCount\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND data_date = #{statDate}\n  AND category = #{category}\n  AND merchant_id IS NOT NULL\nGROUP BY merchant_id\n"})
    List<MerchantStatDTO> aggregateByMerchant(@Param("statDate") LocalDate statDate, @Param("category") String category);

    @Select({"SELECT\n    o.factory_no AS factoryNo,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate}) AS todayOfferCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate} AND o.price IS NOT NULL) AS priceMax\nFROM biz_offer o\nWHERE o.status = 'ACTIVE'\n  AND o.data_date >= #{statDate} - INTERVAL '1 day'\n  AND o.data_date <= #{statDate}\n  AND o.country = #{country}\n  AND o.product_id = #{productId}\n  AND o.category = #{category}\n  AND o.factory_no IS NOT NULL\nGROUP BY o.factory_no\nORDER BY todayOfferCount DESC\nLIMIT 3\n"})
    List<FactoryStatWithPriceDTO> aggregateByFactoryForCountryProduct(@Param("statDate") LocalDate statDate, @Param("country") String country, @Param("productId") Integer productId, @Param("category") String category);

    @Select({"SELECT * FROM biz_offer\nWHERE merchant_id = #{merchantId}\n  AND status = 'ACTIVE'\n  AND offer_type = '报盘'\n  AND category = #{category}\n  AND publish_time::date >= CURRENT_DATE - INTERVAL '1 day'\nORDER BY\n    (CASE WHEN price IS NOT NULL AND price > 0 THEN 4 ELSE 0 END +\n     CASE WHEN weight IS NOT NULL AND weight != '' THEN 2 ELSE 0 END +\n     CASE WHEN country IS NOT NULL AND country != '' AND factory_no IS NOT NULL AND factory_no != '' THEN 1 ELSE 0 END) DESC,\n    publish_time DESC\nLIMIT #{limit}\n"})
    List<BizOffer> findLatestByMerchant(@Param("merchantId") Long merchantId, @Param("limit") int limit, @Param("category") String category);

    @Select({"SELECT\n    o.merchant_id AS merchantId,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate}) AS todayOfferCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate} AND o.price IS NOT NULL) AS priceMax,\n    COALESCE(m.merchant_short_name, m.merchant_name) AS merchantName\nFROM biz_offer o\nLEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date >= #{statDate} - INTERVAL '1 day'\n  AND o.data_date <= #{statDate}\n  AND o.factory_id = #{factoryId}\n  AND o.product_id = #{productId}\n  AND o.category = #{category}\n  AND o.merchant_id IS NOT NULL\nGROUP BY o.merchant_id, m.merchant_short_name, m.merchant_name\nORDER BY todayOfferCount DESC\nLIMIT 3\n"})
    List<MerchantStatWithPriceDTO> aggregateByMerchantForFactoryProduct(@Param("statDate") LocalDate statDate, @Param("factoryId") Integer factoryId, @Param("productId") Integer productId, @Param("category") String category);

    @Select({"SELECT\n    o.factory_no AS factoryNo,\n    COUNT(*) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate}) AS todayOfferCount,\n    MIN(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate} AND o.price IS NOT NULL) AS priceMin,\n    MAX(o.price) FILTER (WHERE o.offer_type = '报盘' AND o.data_date >= #{statDate} - INTERVAL '1 day' AND o.data_date <= #{statDate} AND o.price IS NOT NULL) AS priceMax\nFROM biz_offer o\nINNER JOIN dict_brand db ON o.brand_id = db.brand_id\nWHERE o.status = 'ACTIVE'\n  AND o.data_date >= #{statDate} - INTERVAL '1 day'\n  AND o.data_date <= #{statDate}\n  AND db.brand_name = #{brandName}\n  AND o.product_id = #{productId}\n  AND o.category = #{category}\nGROUP BY o.factory_no\nORDER BY todayOfferCount DESC\nLIMIT 3\n"})
    List<FactoryStatWithPriceDTO> aggregateByFactoryForBrandProduct(@Param("statDate") LocalDate statDate, @Param("brandName") String brandName, @Param("productId") Integer productId, @Param("category") String category);

    // ========== Brand Detail 查询 ==========
    /* 品牌产品聚合统计 - 按 brandId 查询 */
    @Select({"<script>SELECT\n    product_id,\n    product_name,\n    MIN(price) as price_min,\n    MAX(price) as price_max,\n    STRING_AGG(DISTINCT factory_no, ',') as factory_nos,\n    COUNT(DISTINCT factory_no) as factory_count,\n    COUNT(*) as offer_count\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  AND brand_id = #{brandId}\n  <if test='category != null'> AND category = #{category} </if>\n  <if test='offerType != null'> AND offer_type = #{offerType} </if>\nGROUP BY product_id, product_name\nORDER BY offer_count DESC, MIN(price) ASC</script>"})
    List<BrandProductAgg> selectBrandProductAggByBrandId(@Param("brandId") Integer brandId, @Param("category") String category, @Param("offerType") String offerType);

    /* 品牌产品聚合统计 - 按 brandId 查询 */
    @Select({"<script>SELECT\n    product_id,\n    product_name,\n    MIN(price) as price_min,\n    MAX(price) as price_max,\n    STRING_AGG(DISTINCT factory_no, ',') as factory_nos,\n    COUNT(DISTINCT factory_no) as factory_count,\n    COUNT(*) as offer_count\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  AND brand_id = #{brandId}\n  <if test='category != null'> AND category = #{category} </if>\n  <if test='offerType != null'> AND offer_type = #{offerType} </if>\nGROUP BY product_id, product_name\nORDER BY offer_count DESC, MIN(price) ASC</script>"})
    List<BrandProductAgg> selectBrandProductAgg(@Param("brandId") Integer brandId, @Param("category") String category, @Param("offerType") String offerType);

    /* 品牌产品聚合统计 - 按 productName 查询（brandName 就是产品名） */
    @Select({"<script>SELECT\n    product_id,\n    product_name,\n    MIN(price) as price_min,\n    MAX(price) as price_max,\n    STRING_AGG(DISTINCT factory_no, ',') as factory_nos,\n    COUNT(DISTINCT factory_no) as factory_count,\n    COUNT(*) as offer_count\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  AND product_name = #{productName}\n  <if test='category != null'> AND category = #{category} </if>\n  <if test='offerType != null'> AND offer_type = #{offerType} </if>\nGROUP BY product_id, product_name\nORDER BY offer_count DESC, MIN(price) ASC</script>"})
    List<BrandProductAgg> selectBrandProductAggByProductName(@Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    /* 品牌统计 - 按 brandId + type 查近2日计数（今日+昨日） */
    @Select({"<script>SELECT " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE) AS \"todayCount\", " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE - INTERVAL '1 day') AS \"yesterdayCount\" " +
            "FROM biz_offer " +
            "WHERE status = 'ACTIVE' " +
            "AND brand_id = #{brandId} " +
            "<if test='category != null'> AND category = #{category} </if> " +
            "<if test='offerType != null'> AND offer_type = #{offerType} </if>" +
            "</script>"})
    BrandStatByType countByBrandIdAndType(@Param("brandId") Integer brandId, @Param("category") String category, @Param("offerType") String offerType);

    /* 品牌统计 - 按多个 brandId + type 查近2日计数（今日+昨日，支持一个品牌多个厂号） */
    @Select({"<script>SELECT " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE) AS \"todayCount\", " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE - INTERVAL '1 day') AS \"yesterdayCount\" " +
            "FROM biz_offer " +
            "WHERE status = 'ACTIVE' " +
            "<if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if> " +
            "<if test='category != null'> AND category = #{category} </if> " +
            "<if test='offerType != null'> AND offer_type = #{offerType} </if>" +
            "</script>"})
    BrandStatByType countByBrandIdsAndType(@Param("brandIds") List<Integer> brandIds, @Param("category") String category, @Param("offerType") String offerType);

    /* 品牌产品聚合统计 - 按多个 brandId 查询（支持一个品牌多个厂号） */
    @Select({"<script>SELECT\n    product_id,\n    product_name,\n    MIN(CASE WHEN price &gt; 0 THEN price END) as price_min,\n    MAX(CASE WHEN price &gt; 0 THEN price END) as price_max,\n    STRING_AGG(DISTINCT factory_no, ',') as factory_nos,\n    COUNT(DISTINCT factory_no) as factory_count,\n    COUNT(*) as offer_count\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  <if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if>\n  <if test='category != null'> AND category = #{category} </if>\n  <if test='offerType != null'> AND offer_type = #{offerType} </if>\nGROUP BY product_id, product_name\n<choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN price &gt; 0 THEN price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN price &gt; 0 THEN price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN price &gt; 0 THEN price END) ASC</otherwise></choose>\nLIMIT #{limit} OFFSET #{offset}</script>"})
    List<BrandProductAgg> selectBrandProductAggByBrandIds(@Param("brandIds") List<Integer> brandIds, @Param("category") String category, @Param("offerType") String offerType, @Param("sortBy") String sortBy, @Param("limit") int limit, @Param("offset") int offset);

    @Select({"<script>SELECT COUNT(DISTINCT product_id) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' <if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if> <if test='category != null'> AND category = #{category} </if> <if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    int countBrandProductAggByBrandIds(@Param("brandIds") List<Integer> brandIds, @Param("category") String category, @Param("offerType") String offerType);

    /* 品牌统计 - 按 productName + type 查近2日计数（今日+昨日） */
    @Select({"<script>SELECT " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE) AS \"todayCount\", " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE - INTERVAL '1 day') AS \"yesterdayCount\" " +
            "FROM biz_offer " +
            "WHERE status = 'ACTIVE' " +
            "AND product_name = #{productName} " +
            "<if test='category != null'> AND category = #{category} </if> " +
            "<if test='offerType != null'> AND offer_type = #{offerType} </if>" +
            "</script>"})
    BrandStatByType countByProductNameAndType(@Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT\n    product_id,\n    product_name,\n    MIN(CASE WHEN price &gt; 0 THEN price END) as price_min,\n    MAX(CASE WHEN price &gt; 0 THEN price END) as price_max,\n    STRING_AGG(DISTINCT factory_no, ',') as factory_nos,\n    COUNT(DISTINCT factory_no) as factory_count,\n    COUNT(*) as offer_count\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  AND product_name = #{productName}\n  <if test='category != null'> AND category = #{category} </if>\n  <if test='offerType != null'> AND offer_type = #{offerType} </if>\nGROUP BY product_id, product_name\n<choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN price &gt; 0 THEN price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN price &gt; 0 THEN price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN price &gt; 0 THEN price END) ASC</otherwise></choose>\nLIMIT #{limit} OFFSET #{offset}</script>"})
    List<BrandProductAgg> selectBrandProductAggByProductName(@Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("sortBy") String sortBy, @Param("limit") int limit, @Param("offset") int offset);

    @Select({"<script>SELECT COUNT(DISTINCT product_id) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' AND product_name = #{productName} <if test='category != null'> AND category = #{category} </if> <if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    int countBrandProductAggByProductName(@Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    /* 品牌统计 */
    public static class BrandProductAgg {
        public Integer productId;
        public String productName;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public String factoryNos;
        public Integer factoryCount;
        public Integer offerCount;
    }

    /* 品牌按 type 统计（近2日计数） */
    public static class BrandStatByType {
        public Long todayCount;
        public Long yesterdayCount;
    }

    /* 品牌产品详情聚合统计 - 按 brandId + productName + country + factory_no 分组 */
    public static class BrandProductDetailAgg {
        public String country;
        public String factoryNo;
        public Integer productId;
        public String productName;
        public BigDecimal priceMin;
        public BigDecimal priceMax;
        public Integer offerCount;
        public Integer merchantCount;
        public String merchantNames;
    }

    /* 品牌产品聚合统计 - 按多个 brandId + productName 查询（品牌+产品搜索） */
    @Select({"<script>SELECT\n    product_id,\n    product_name,\n    MIN(CASE WHEN price &gt; 0 THEN price END) as price_min,\n    MAX(CASE WHEN price &gt; 0 THEN price END) as price_max,\n    STRING_AGG(DISTINCT factory_no, ',') as factory_nos,\n    COUNT(DISTINCT factory_no) as factory_count,\n    COUNT(*) as offer_count\nFROM biz_offer\nWHERE status = 'ACTIVE'\n  AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  <if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if>\n  <if test='productName != null and productName != \"\"'> AND product_name LIKE '%' || #{productName} || '%' </if>\n  <if test='category != null'> AND category = #{category} </if>\n  <if test='offerType != null'> AND offer_type = #{offerType} </if>\nGROUP BY product_id, product_name\n<choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN price &gt; 0 THEN price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN price &gt; 0 THEN price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN price &gt; 0 THEN price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN price &gt; 0 THEN price END) ASC</otherwise></choose>\nLIMIT #{limit} OFFSET #{offset}</script>"})
    List<BrandProductAgg> selectBrandProductAggByBrandIdsAndProductName(@Param("brandIds") List<Integer> brandIds, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("sortBy") String sortBy, @Param("limit") int limit, @Param("offset") int offset);

    /* 品牌产品详情聚合统计 - 按多个 brandId + productName 查询，按 country + factory_no 分组（品牌+产品详情页用） */
    @Select({"<script>SELECT\n    o.country,\n    o.factory_no,\n    o.product_id,\n    #{productName} as product_name,\n    MIN(CASE WHEN o.price &gt; 0 THEN o.price END) as price_min,\n    MAX(CASE WHEN o.price &gt; 0 THEN o.price END) as price_max,\n    COUNT(*) as offer_count,\n    COUNT(DISTINCT o.merchant_id) as merchant_count,\n    STRING_AGG(DISTINCT CASE WHEN m.merchant_short_name IS NOT NULL AND m.merchant_short_name != '' THEN CONCAT(m.merchant_short_name, '|', m.merchant_name) ELSE COALESCE(m.merchant_name, '') END, ',') as merchant_names\nFROM biz_offer o\nLEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id\nWHERE o.status = 'ACTIVE'\n  AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  <if test='brandIds != null and brandIds.size() > 0'> AND o.brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if>\n  <if test='productName != null and productName != \"\"'> AND o.product_name LIKE '%' || #{productName} || '%' </if>\n  <if test='category != null'> AND o.category = #{category} </if>\n  <if test='offerType != null'> AND o.offer_type = #{offerType} </if>\nGROUP BY o.country, o.factory_no, o.product_id\n<choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN o.price &gt; 0 THEN o.price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC</otherwise></choose>\nLIMIT #{limit} OFFSET #{offset}</script>"})
    List<BrandProductDetailAgg> selectBrandProductDetailByBrandIdsAndProductName(@Param("brandIds") List<Integer> brandIds, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("sortBy") String sortBy, @Param("limit") int limit, @Param("offset") int offset);

    @Select({"<script>SELECT\n    o.country,\n    o.factory_no,\n    o.product_id,\n    #{productName} as product_name,\n    MIN(CASE WHEN o.price &gt; 0 THEN o.price END) as price_min,\n    MAX(CASE WHEN o.price &gt; 0 THEN o.price END) as price_max,\n    COUNT(*) as offer_count,\n    COUNT(DISTINCT o.merchant_id) as merchant_count,\n    STRING_AGG(DISTINCT CASE WHEN m.merchant_short_name IS NOT NULL AND m.merchant_short_name != '' THEN CONCAT(m.merchant_short_name, '|', m.merchant_name) ELSE COALESCE(m.merchant_name, '') END, ',') as merchant_names\nFROM biz_offer o\nLEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id\nWHERE o.status = 'ACTIVE'\n  AND o.publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day'\n  <if test='brandIds != null and brandIds.size() > 0'> AND o.brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if>\n  AND o.product_id = #{productId}\n  <if test='category != null'> AND o.category = #{category} </if>\n  <if test='offerType != null'> AND o.offer_type = #{offerType} </if>\nGROUP BY o.country, o.factory_no, o.product_id\n<choose><when test='sortBy == \"price_asc\"'>ORDER BY CASE WHEN MIN(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC, COUNT(*) DESC</when><when test='sortBy == \"price_desc\"'>ORDER BY CASE WHEN MAX(CASE WHEN o.price &gt; 0 THEN o.price END) IS NULL THEN 1 ELSE 0 END ASC, MAX(CASE WHEN o.price &gt; 0 THEN o.price END) DESC, COUNT(*) DESC</when><otherwise>ORDER BY offer_count DESC, MIN(CASE WHEN o.price &gt; 0 THEN o.price END) ASC</otherwise></choose>\nLIMIT #{limit} OFFSET #{offset}</script>"})
    List<BrandProductDetailAgg> selectBrandProductDetailByBrandIdsAndProductId(@Param("brandIds") List<Integer> brandIds, @Param("productId") Integer productId, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType, @Param("sortBy") String sortBy, @Param("limit") int limit, @Param("offset") int offset);

    /* 品牌统计 - 按多个 brandId + productName + type 查近2日计数 */
    @Select({"<script>SELECT " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE) AS \"todayCount\", " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE - INTERVAL '1 day') AS \"yesterdayCount\" " +
            "FROM biz_offer " +
            "WHERE status = 'ACTIVE' " +
            "<if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if> " +
            "<if test='productName != null and productName != \"\"'> AND product_name LIKE '%' || #{productName} || '%' </if> " +
            "<if test='category != null'> AND category = #{category} </if> " +
            "<if test='offerType != null'> AND offer_type = #{offerType} </if>" +
            "</script>"})
    BrandStatByType countByBrandIdsAndProductNameAndType(@Param("brandIds") List<Integer> brandIds, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COUNT(DISTINCT country || '_' || factory_no || '_' || product_id) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' <if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if> <if test='productName != null and productName != \"\"'> AND product_name LIKE '%' || #{productName} || '%' </if> <if test='category != null'> AND category = #{category} </if> <if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    int countBrandProductDetailByBrandIdsAndProductName(@Param("brandIds") List<Integer> brandIds, @Param("productName") String productName, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE) AS \"todayCount\", " +
            "COUNT(*) FILTER (WHERE publish_time::date = CURRENT_DATE - INTERVAL '1 day') AS \"yesterdayCount\" " +
            "FROM biz_offer " +
            "WHERE status = 'ACTIVE' " +
            "<if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if> " +
            "AND product_id = #{productId} " +
            "<if test='category != null'> AND category = #{category} </if> " +
            "<if test='offerType != null'> AND offer_type = #{offerType} </if>" +
            "</script>"})
    BrandStatByType countByBrandIdsAndProductIdAndType(@Param("brandIds") List<Integer> brandIds, @Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    @Select({"<script>SELECT COUNT(DISTINCT country || '_' || factory_no || '_' || product_id) FROM biz_offer WHERE status = 'ACTIVE' AND publish_time::date &gt;= CURRENT_DATE - INTERVAL '1 day' <if test='brandIds != null and brandIds.size() > 0'> AND brand_id IN <foreach collection='brandIds' item='id' open='(' separator=',' close=')'>#{id}</foreach> </if> AND product_id = #{productId} <if test='category != null'> AND category = #{category} </if> <if test='offerType != null'> AND offer_type = #{offerType} </if></script>"})
    int countBrandProductDetailByBrandIdsAndProductId(@Param("brandIds") List<Integer> brandIds, @Param("productId") Integer productId, @Param("category") String category, @Param("offerType") String offerType);

    /* 统计某品牌今日报盘数 */
    @Select({"SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND data_date = CURRENT_DATE AND brand_id = #{brandId}"})
    Integer countTodayOffersByBrand(@Param("brandId") Integer brandId);
}
