package com.mooket.social.dto;

import lombok.Data;

import java.util.List;

@Data
public class OfferFeedPageDTO {
    private List<OfferFeedItemDTO> items;
    private Integer totalCount;
    private Integer page;
    private Integer pageSize;
    private Integer totalPages;
    private String offerType;
    private OfferFeedFilterOptionsDTO filterOptions;
}
