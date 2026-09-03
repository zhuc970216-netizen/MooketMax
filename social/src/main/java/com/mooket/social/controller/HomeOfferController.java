package com.mooket.social.controller;

import com.mooket.social.common.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Additional home endpoints for ui-v2 frontend
 */
@RestController
@RequestMapping("/api/v1/home")
public class HomeOfferController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/hot-offer-skus")
    public ApiResponse<List<Map<String, Object>>> getHotOfferSkus(
            @RequestParam("category") String category,
            @RequestParam(name = "limit", defaultValue = "3") int limit) {

        try {
            String sql = "SELECT product_id, product_name, price_min, price_max, today_offer_count " +
                "FROM stat_product WHERE stat_date = CURRENT_DATE AND category = ? " +
                "ORDER BY today_offer_count DESC LIMIT ?";

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, category, limit);
            List<Map<String, Object>> result = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                Map<String, Object> item = new HashMap<>();
                item.put("productId", row.get("product_id"));
                item.put("productName", row.get("product_name"));
                item.put("priceMin", row.get("price_min"));
                item.put("priceMax", row.get("price_max"));
                item.put("offerCount", row.get("today_offer_count"));
                result.add(item);
            }
            return ApiResponse.success(result);
        } catch (Exception e) {
            return ApiResponse.error(500, "Hot offer skus error: " + e.getMessage());
        }
    }
}