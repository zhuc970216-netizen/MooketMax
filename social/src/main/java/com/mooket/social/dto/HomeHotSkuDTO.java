package com.mooket.social.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 首页找货下方的热门 SKU 轻量统计。
 */
@Data
public class HomeHotSkuDTO {
    private String country;
    private String factoryNo;
    private Integer productId;
    private String productName;
    private BigDecimal priceMin;
    private BigDecimal priceMax;
    private Integer offerCount;
    private Integer merchantCount;
    private List<TrendPointDTO> trendPoints;

    @Data
    public static class TrendPointDTO {
        private String date;
        private Double avgPrice;
        private Integer offerCount;
    }
}
