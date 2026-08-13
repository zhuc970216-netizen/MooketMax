package com.mooket.social.controller;

import com.mooket.social.common.ApiResponse;
import com.mooket.social.dto.OfferFeedPageDTO;
import com.mooket.social.service.OfferFeedService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/offers")
public class OfferFeedController {

    private final OfferFeedService offerFeedService;

    public OfferFeedController(OfferFeedService offerFeedService) {
        this.offerFeedService = offerFeedService;
    }

    @GetMapping("/feed")
    public ApiResponse<OfferFeedPageDTO> getOfferFeed(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "type", defaultValue = "offer") String type,
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "merchantId", required = false) Long merchantId,
            @RequestParam(value = "brandName", required = false) String brandName,
            @RequestParam(value = "productName", required = false) String productName,
            @RequestParam(value = "country", required = false) String country,
            @RequestParam(value = "factoryNo", required = false) String factoryNo,
            @RequestParam(value = "goodsType", required = false) String goodsType,
            @RequestParam(value = "region", required = false) String region,
            @RequestParam(value = "feedingType", required = false) String feedingType,
            @RequestParam(value = "tag", required = false) String tag,
            @RequestParam(value = "quotedOnly", required = false) Boolean quotedOnly,
            @RequestParam(value = "realNameOnly", required = false) Boolean realNameOnly,
            @RequestParam(value = "verifiedOnly", required = false) Boolean verifiedOnly,
            @RequestParam(value = "recentOnly", defaultValue = "true") Boolean recentOnly,
            @RequestParam(value = "sortBy", defaultValue = "comprehensive") String sortBy,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "pageSize", defaultValue = "20") int pageSize) {
        try {
            return ApiResponse.success(offerFeedService.getOfferFeed(
                    category,
                    type,
                    keyword,
                    merchantId,
                    brandName,
                    productName,
                    country,
                    factoryNo,
                    goodsType,
                    region,
                    feedingType,
                    tag,
                    quotedOnly,
                    realNameOnly,
                    verifiedOnly,
                    recentOnly,
                    sortBy,
                    page,
                    pageSize));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
