package com.mooket.social.controller;

import com.mooket.social.common.ApiResponse;
import com.mooket.social.mapper.BizOfferMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理接口
 */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final JdbcTemplate jdbcTemplate;
    private final BizOfferMapper bizOfferMapper;

    public AdminController(JdbcTemplate jdbcTemplate, BizOfferMapper bizOfferMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.bizOfferMapper = bizOfferMapper;
    }

    /**
     * 创建索引，用于优化查询性能
     */
    @PostMapping("/create-indexes")
    public ApiResponse<String> createIndexes() {
        try {
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_biz_offer_product_query " +
                    "ON biz_offer(product_id, category, offer_type, status, data_date)");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_biz_offer_group_agg " +
                    "ON biz_offer(product_id, category, offer_type, status, data_date, country, factory_no)");
            return ApiResponse.success("索引创建成功");
        } catch (Exception e) {
            return ApiResponse.error("创建索引失败: " + e.getMessage());
        }
    }

    /**
     * 回填 stat_brand_product 的昨日均价字段
     */
    @PostMapping("/fix-stat-brand-product-yesterday")
    public ApiResponse<String> fixStatBrandProductYesterday() {
        try {
            int updated = jdbcTemplate.update("""
                UPDATE stat_brand_product t
                SET avg_price_yesterday = y.avg_price,
                    price_change = CASE
                        WHEN y.avg_price > 0 THEN ROUND(t.avg_price - y.avg_price, 4)
                        ELSE 0
                    END,
                    price_change_rate = CASE
                        WHEN y.avg_price > 0 THEN ROUND((t.avg_price - y.avg_price) / y.avg_price * 100, 2)
                        ELSE 0
                    END,
                    update_time = CURRENT_TIMESTAMP
                FROM stat_brand_product y
                WHERE t.stat_date = CURRENT_DATE
                  AND y.stat_date = CURRENT_DATE - 1
                  AND REPLACE(t.brand_name, ' ', '') = REPLACE(y.brand_name, ' ', '')
                  AND REPLACE(t.product_name, ' ', '') = REPLACE(y.product_name, ' ', '')
                  AND t.avg_price_yesterday = 0
                  AND t.today_offer_count > 0
                  AND y.avg_price > 0
                """);
            return ApiResponse.success("回填成功，影响行数: " + updated);
        } catch (Exception e) {
            return ApiResponse.error("回填失败: " + e.getMessage());
        }
    }

    /**
     * 手动将 biz_offer 里不是今天的日期刷新为今天
     */
    @PostMapping("/refresh-biz-offer-dates")
    public ApiResponse<String> refreshBizOfferDates() {
        try {
            int staleRows = bizOfferMapper.countRowsWithNonTodayDate();
            if (staleRows <= 0) {
                return ApiResponse.success("biz_offer 日期已是今天，无需刷新");
            }
            int updatedRows = bizOfferMapper.refreshAllOfferDatesToToday();
            return ApiResponse.success("biz_offer 日期刷新完成，原待刷新 " + staleRows + " 条，实际更新 " + updatedRows + " 条");
        } catch (Exception e) {
            return ApiResponse.error("刷新 biz_offer 日期失败: " + e.getMessage());
        }
    }
}
