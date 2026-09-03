package com.mooket.social.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class OfferFeedItemDTO {
    private Long offerId;
    private Long merchantId;
    private String merchantName;
    private String merchantShortName;
    private String brandName;
    private String merchantTags;
    private String contactPhone;
    private String userNickname;
    private String category;
    private Integer productId;
    private String productName;
    private String country;
    private String factoryNo;
    private BigDecimal price;
    private BigDecimal priceMax;
    private String weight;
    private String offerType;
    private String goodsType;
    private String goodsLocation;
    private String region;
    private String tags;
    private String fatRatio;
    private String feedingType;
    private String cattleBreed;
    private String remark;
    private String offerOriginalText;
    private LocalDateTime publishTime;
}
