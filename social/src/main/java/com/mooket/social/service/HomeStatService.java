package com.mooket.social.service;

import com.mooket.social.dto.*;
import com.mooket.social.entity.*;

import java.time.LocalDate;
import java.util.List;

/**
 * 首页统计服务接口
 */
public interface HomeStatService {

    /**
     * 计算所有统计数据（每小时调用）
     */
    void computeAllStats();

    /**
     * 计算产品维度统计
     */
    void computeProductStats(LocalDate statDate);

    /**
     * 计算国家维度统计
     */
    void computeCountryStats(LocalDate statDate);

    /**
     * 计算国家厂号维度统计
     */
    void computeFactoryStats(LocalDate statDate);

    /**
     * 计算品牌维度统计
     */
    void computeBrandStats(LocalDate statDate);

    /**
     * 计算国家产品维度统计
     */
    void computeCountryProductStats(LocalDate statDate);

    /**
     * 计算品牌产品维度统计
     */
    void computeBrandProductStats(LocalDate statDate);

    /**
     * 计算国家厂号产品维度统计
     */
    void computeFactoryProductStats(LocalDate statDate);

    /**
     * 计算商家维度统计
     */
    void computeMerchantStats(LocalDate statDate);

    /**
     * 获取热门搜索推荐（首页用）
     */
    List<HotSearchItem> getHotSearchRecommendations(String category);

    /**
     * 获取首页统计数据（报盘总量、求购总量）
     */
    HomeStatData getHomeStatData(String category);

    /**
     * 获取首页找货热门 SKU（按后端全量 ACTIVE 报盘聚合）
     */
    List<HomeHotSkuDTO> getHomeHotOfferSkus(String category, int limit);

    /**
     * 获取首页卡片数据
     */
    HomeCardsResponseDTO getHomeCards(String category);

    /**
     * 热门搜索项
     */
    class HotSearchItem {
        public String keyword;          // 搜索关键词
        public String dimension;        // 维度：国家厂号产品/国家产品/国家/产品/品牌/商家
        public Integer todayOfferCount; // 今日报盘数

        // 各维度核心元素（用于去重）
        public String country;          // 国家
        public String factoryNo;        // 厂号
        public Integer productId;       // 产品ID
        public Integer brandId;         // 品牌ID
        public Long merchantId;         // 商家ID

        public HotSearchItem() {}
    }

    /**
     * 首页统计数据
     */
    class HomeStatData {
        public String totalOfferCount;   // 报盘总量
        public String totalInquiryCount;  // 求购总量
        public String merchantCount;     // 商家总数
        public String statTime;          // 统计时间说明

        public HomeStatData(String totalOfferCount, String totalInquiryCount, String merchantCount, String statTime) {
            this.totalOfferCount = totalOfferCount;
            this.totalInquiryCount = totalInquiryCount;
            this.merchantCount = merchantCount;
            this.statTime = statTime;
        }
    }
}
