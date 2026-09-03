package com.mooket.social.controller;

import com.mooket.social.common.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/offers")
public class OfferController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/feed")
    public ApiResponse<Map<String, Object>> getOfferFeed(
            @RequestParam("category") String category,
            @RequestParam(name = "type", defaultValue = "offer") String type,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "merchantId", required = false) Long merchantId,
            @RequestParam(name = "brandName", required = false) String brandName,
            @RequestParam(name = "productName", required = false) String productName,
            @RequestParam(name = "country", required = false) String country,
            @RequestParam(name = "factoryNo", required = false) String factoryNo,
            @RequestParam(name = "goodsType", required = false) String goodsType,
            @RequestParam(name = "region", required = false) String region,
            @RequestParam(name = "feedingType", required = false) String feedingType,
            @RequestParam(name = "tag", required = false) String tag,
            @RequestParam(name = "quotedOnly", required = false) Boolean quotedOnly,
            @RequestParam(name = "realNameOnly", required = false) Boolean realNameOnly,
            @RequestParam(name = "verifiedOnly", required = false) Boolean verifiedOnly,
            @RequestParam(name = "recentOnly", required = false) Boolean recentOnly,
            @RequestParam(name = "sortBy", required = false) String sortBy,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "pageSize", defaultValue = "20") int pageSize) {

        try {
            StringBuilder sql = new StringBuilder(
                "FROM biz_offer o " +
                "LEFT JOIN dict_merchant m ON o.merchant_id = m.merchant_id " +
                "LEFT JOIN dict_brand b ON o.brand_id = b.brand_id " +
                "WHERE o.status = 'ACTIVE' AND o.category = ?");
            List<Object> params = new ArrayList<>();
            params.add(category);
            sql.append(" AND o.offer_type = ?");
            // 兼容中英文 type 值
            String offerTypeVal = type;
            if ("offer".equals(type)) offerTypeVal = "报盘";
            if ("inquiry".equals(type)) offerTypeVal = "求购";
            params.add(offerTypeVal);

            if (keyword != null && !keyword.isEmpty()) {
                sql.append(" AND (o.product_name LIKE ? OR o.factory_no LIKE ? OR o.country LIKE ?)");
                String kw = "%" + keyword + "%";
                params.add(kw); params.add(kw); params.add(kw);
            }
            if (merchantId != null) { sql.append(" AND o.merchant_id = ?"); params.add(merchantId); }
            if (productName != null && !productName.isEmpty()) {
                sql.append(" AND o.product_name LIKE ?"); params.add("%" + productName + "%");
            }
            if (country != null && !country.isEmpty()) { sql.append(" AND o.country = ?"); params.add(country); }
            if (factoryNo != null && !factoryNo.isEmpty()) {
                sql.append(" AND o.factory_no LIKE ?"); params.add("%" + factoryNo + "%");
            }
            if (goodsType != null && !goodsType.isEmpty()) { sql.append(" AND o.goods_type = ?"); params.add(goodsType); }
            if (feedingType != null && !feedingType.isEmpty()) { sql.append(" AND o.feeding_type = ?"); params.add(feedingType); }
            if (tag != null && !tag.isEmpty()) { sql.append(" AND o.tags LIKE ?"); params.add("%" + tag + "%"); }
            if (region != null && !region.isEmpty()) { sql.append(" AND o.goods_location = ?"); params.add(region); }

            String countSql = "SELECT COUNT(*) " + sql.toString();
            Long totalCount = jdbcTemplate.queryForObject(countSql, Long.class, params.toArray());
            if (totalCount == null) totalCount = 0L;

            // 排序：fieldCompleteness = 信息完整度倒序
            if ("fieldCompleteness".equals(sortBy) || "comprehensive".equals(sortBy) || sortBy == null) {
                sql.append(" ORDER BY ");
                sql.append("(CASE WHEN o.price IS NOT NULL THEN 1 ELSE 0 END + ");
                sql.append("CASE WHEN o.factory_no IS NOT NULL AND o.factory_no != '' THEN 1 ELSE 0 END + ");
                sql.append("CASE WHEN o.country IS NOT NULL AND o.country != '' THEN 1 ELSE 0 END + ");
                sql.append("CASE WHEN o.goods_type IS NOT NULL AND o.goods_type != '' THEN 1 ELSE 0 END + ");
                sql.append("CASE WHEN o.goods_location IS NOT NULL AND o.goods_location != '' THEN 1 ELSE 0 END + ");
                sql.append("CASE WHEN o.tags IS NOT NULL AND o.tags != '' THEN 1 ELSE 0 END + ");
                sql.append("CASE WHEN o.weight IS NOT NULL AND o.weight != '' THEN 1 ELSE 0 END) DESC, ");
                sql.append("o.publish_time DESC");
            } else if ("price".equals(sortBy)) {
                sql.append(" ORDER BY o.price DESC, o.publish_time DESC");
            } else if ("price_asc".equals(sortBy)) {
                sql.append(" ORDER BY o.price ASC, o.publish_time DESC");
            } else {
                sql.append(" ORDER BY o.publish_time DESC");
            }
            
            int offset = (page - 1) * pageSize;
            sql.append(" LIMIT ? OFFSET ?");
            params.add(pageSize);
            params.add(offset);

            String querySql = "SELECT o.offer_id, o.merchant_id, o.contact_phone, o.category, o.product_id, " +
                "o.product_name, o.country, o.factory_no, o.price, o.price_max, " +
                "o.goods_type, o.goods_location, o.tags, o.feeding_type, " +
                "o.publish_time, o.data_date, o.brand_id, o.factory_id, o.offer_type, " +
                "o.user_nickname, o.weight, o.fat_ratio, o.cattle_breed, o.remark, o.offer_original_text, " +
                "m.merchant_name, m.merchant_short_name, m.merchant_tags, " +
                "b.brand_name " + sql.toString();

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(querySql, params.toArray());
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                Map<String, Object> item = new HashMap<>();
                item.put("offerId", row.get("offer_id"));
                item.put("merchantId", row.get("merchant_id"));
                item.put("merchantName", row.get("merchant_name"));
                item.put("merchantShortName", row.get("merchant_short_name"));
                item.put("brandName", row.get("brand_name"));
                item.put("merchantTags", row.get("merchant_tags"));
                item.put("contactPhone", row.get("contact_phone"));
                item.put("userNickname", row.get("user_nickname"));
                item.put("category", row.get("category"));
                item.put("productId", row.get("product_id"));
                item.put("productName", row.get("product_name"));
                item.put("country", row.get("country"));
                item.put("factoryNo", row.get("factory_no"));
                item.put("price", row.get("price"));
                item.put("priceMax", row.get("price_max"));
                item.put("weight", row.get("weight"));
                item.put("offerType", row.get("offer_type"));
                item.put("goodsType", row.get("goods_type"));
                item.put("goodsLocation", row.get("goods_location"));
                item.put("region", row.get("goods_location"));
                item.put("tags", row.get("tags"));
                item.put("feedingType", row.get("feeding_type"));
                item.put("fatRatio", row.get("fat_ratio"));
                item.put("cattleBreed", row.get("cattle_breed"));
                item.put("remark", row.get("remark"));
                item.put("offerOriginalText", row.get("offer_original_text"));
                item.put("publishTime", row.get("publish_time"));
                item.put("dataDate", row.get("data_date"));
                items.add(item);
            }

            // filterOptions
            Map<String, Object> filterOptions = new HashMap<>();
            try {
                String baseSql = "FROM biz_offer WHERE status = 'ACTIVE' AND category = ? AND offer_type = ?";
                List<Object> baseParams = new ArrayList<>();
                baseParams.add(category);
                baseParams.add(type);

                List<Map<String, Object>> countries = jdbcTemplate.queryForList(
                    "SELECT DISTINCT country " + baseSql + " AND country IS NOT NULL ORDER BY country",
                    baseParams.toArray());
                filterOptions.put("countries", countries.stream().map(r -> r.get("country")).toArray());

                List<Map<String, Object>> factoryNos = jdbcTemplate.queryForList(
                    "SELECT DISTINCT factory_no " + baseSql + " AND factory_no IS NOT NULL ORDER BY factory_no",
                    baseParams.toArray());
                filterOptions.put("factoryNos", factoryNos.stream().map(r -> r.get("factory_no")).toArray());

                List<Map<String, Object>> regions = jdbcTemplate.queryForList(
                    "SELECT DISTINCT goods_location " + baseSql + " AND goods_location IS NOT NULL ORDER BY goods_location",
                    baseParams.toArray());
                filterOptions.put("regions", regions.stream().map(r -> r.get("goods_location")).toArray());

                List<Map<String, Object>> goodsTypes = jdbcTemplate.queryForList(
                    "SELECT DISTINCT goods_type " + baseSql + " AND goods_type IS NOT NULL ORDER BY goods_type",
                    baseParams.toArray());
                filterOptions.put("goodsTypes", goodsTypes.stream().map(r -> r.get("goods_type")).toArray());

                List<Map<String, Object>> feedingTypes = jdbcTemplate.queryForList(
                    "SELECT DISTINCT feeding_type " + baseSql + " AND feeding_type IS NOT NULL ORDER BY feeding_type",
                    baseParams.toArray());
                filterOptions.put("feedingTypes", feedingTypes.stream().map(r -> r.get("feeding_type")).toArray());
            } catch (Exception e) {
                System.err.println("[OfferController] filterOptions error: " + e.getMessage());
            }

            int totalPages = (int) Math.ceil((double) totalCount / pageSize);
            Map<String, Object> result = new HashMap<>();
            result.put("items", items);
            result.put("totalCount", totalCount);
            result.put("page", page);
            result.put("pageSize", pageSize);
            result.put("totalPages", totalPages);
            result.put("offerType", type);
            result.put("filterOptions", filterOptions);
            return ApiResponse.success(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ApiResponse.error(500, "Offer feed error: " + e.getMessage());
        }
    }

    @GetMapping("/debug/test-sql")
    public ApiResponse<Map<String, Object>> debugTestSql(
            @RequestParam(name = "country", required = false) String country,
            @RequestParam(name = "factoryNo", required = false) String factoryNo,
            @RequestParam(name = "productName", required = false) String productName,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "type", required = false) String type) {
        Map<String, Object> result = new HashMap<>();
        result.put("paramCountry", country);
        result.put("paramFactoryNo", factoryNo);
        result.put("paramProductName", productName);
        result.put("paramCategory", category);
        result.put("paramKeyword", keyword);
        result.put("paramType", type);
        
        try {
            String sql1 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND data_date >= CURRENT_DATE - INTERVAL '1 day'";
            Long total = jdbcTemplate.queryForObject(sql1, Long.class);
            result.put("totalActive", total);
            
            if (country != null && !country.isEmpty()) {
                String sql2 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND data_date >= CURRENT_DATE - INTERVAL '1 day' AND country = ?";
                Long countryCount = jdbcTemplate.queryForObject(sql2, Long.class, country);
                result.put("countryCount", countryCount);
            }
            
            if (country != null && factoryNo != null && !factoryNo.isEmpty()) {
                String sql3 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND data_date >= CURRENT_DATE - INTERVAL '1 day' AND country = ? AND factory_no = ?";
                Long cfCount = jdbcTemplate.queryForObject(sql3, Long.class, country, factoryNo);
                result.put("countryFactoryCount", cfCount);
            }
            
            if (country != null && factoryNo != null && productName != null && !productName.isEmpty()) {
                String sql4 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND data_date >= CURRENT_DATE - INTERVAL '1 day' AND country = ? AND factory_no = ? AND product_name = ?";
                Long cfpCount = jdbcTemplate.queryForObject(sql4, Long.class, country, factoryNo, productName);
                result.put("countryFactoryProductCount", cfpCount);
            }
            
            String sql5 = "SELECT product_name, country FROM biz_offer WHERE status = 'ACTIVE' LIMIT 1";
            Map<String, Object> sample = jdbcTemplate.queryForMap(sql5);
            result.put("sampleProductName", sample.get("product_name"));
            result.put("sampleCountry", sample.get("country"));
            
            // 测试硬编码中文的 offer_type
            String sql6 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND data_date >= CURRENT_DATE - INTERVAL '1 day' AND country = ? AND factory_no = ? AND product_name = ? AND offer_type = '报盘'";
            Long hardcodedCount = jdbcTemplate.queryForObject(sql6, Long.class, country, factoryNo, productName);
            result.put("hardcodedOfferTypeCount", hardcodedCount);
            
            // 测试参数化的 offer_type
            String sql7 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND data_date >= CURRENT_DATE - INTERVAL '1 day' AND country = ? AND factory_no = ? AND product_name = ? AND offer_type = ?";
            Long paramOfferTypeCount = jdbcTemplate.queryForObject(sql7, Long.class, country, factoryNo, productName, "报盘");
            result.put("paramOfferTypeCount", paramOfferTypeCount);
            
            // 查看所有不同的 offer_type
            String sql8 = "SELECT DISTINCT offer_type FROM biz_offer WHERE country = ? AND factory_no = ? AND product_name = ? LIMIT 5";
            java.util.List<Map<String, Object>> types = jdbcTemplate.queryForList(sql8, country, factoryNo, productName);
            result.put("offerTypes", types);
            
            // 测试 keyword LIKE 查询
            if (keyword != null && !keyword.isEmpty()) {
                String sql9 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND category = ? AND offer_type = '报盘' AND product_name LIKE ?";
                Long likeCount = jdbcTemplate.queryForObject(sql9, Long.class, category, "%" + keyword + "%");
                result.put("keywordLikeCount", likeCount);
                
                String sql10 = "SELECT COUNT(*) FROM biz_offer WHERE status = 'ACTIVE' AND category = ? AND offer_type = ? AND product_name LIKE ?";
                String typeVal = type;
                if ("offer".equals(type)) typeVal = "报盘";
                if ("inquiry".equals(type)) typeVal = "求购";
                if (typeVal == null) typeVal = "报盘";
                Long paramTypeLikeCount = jdbcTemplate.queryForObject(sql10, Long.class, category, typeVal, "%" + keyword + "%");
                result.put("paramTypeLikeCount", paramTypeLikeCount);
                result.put("resolvedType", typeVal);
            }
            
            result.put("success", true);
        } catch (Exception e) {
            result.put("error", e.getMessage());
            result.put("success", false);
        }
        
        return ApiResponse.success(result);
    }
}
