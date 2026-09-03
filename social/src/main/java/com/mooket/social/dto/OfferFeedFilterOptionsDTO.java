package com.mooket.social.dto;

import lombok.Data;

import java.util.List;

@Data
public class OfferFeedFilterOptionsDTO {
    private List<String> countries;
    private List<String> factoryNos;
    private List<String> regions;
    private List<String> goodsTypes;
    private List<String> feedingTypes;
    private List<String> tags;
}
