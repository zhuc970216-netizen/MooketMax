package com.mooket.social.service;

import com.mooket.social.dto.OfferFeedPageDTO;

public interface OfferFeedService {
    OfferFeedPageDTO getOfferFeed(
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
            int pageSize);
}
