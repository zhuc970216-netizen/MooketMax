package com.mooket.social.controller;

import com.mooket.social.common.ApiResponse;
import com.mooket.social.dto.HomeCardsResponseDTO;
import com.mooket.social.service.HomeStatService;
import com.mooket.social.service.SearchHistoryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 首页 Controller
 */
@RestController
@RequestMapping("/api/v1/home")
public class HomeController {

    private final HomeStatService homeStatService;
    private final SearchHistoryService searchHistoryService;

    public HomeController(HomeStatService homeStatService, SearchHistoryService searchHistoryService) {
        this.homeStatService = homeStatService;
        this.searchHistoryService = searchHistoryService;
    }

    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) return null;
        try {
            String token = authHeader.substring(7);
            return com.mooket.social.common.JwtUtil.getUserId(token);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * 获取热门搜索推荐
     */
    @GetMapping("/hot-search")
    public ApiResponse<List<HomeStatService.HotSearchItem>> getHotSearchRecommendations(
            @RequestParam(required = false, defaultValue = "牛") String category) {
        List<HomeStatService.HotSearchItem> recommendations = homeStatService.getHotSearchRecommendations(category);
        return ApiResponse.success(recommendations);
    }

    /**
     * 获取首页统计数据（报盘总量、求购总量）
     */
    @GetMapping("/stat")
    public ApiResponse<HomeStatService.HomeStatData> getHomeStatData(
            @RequestParam(required = false, defaultValue = "牛") String category) {
        HomeStatService.HomeStatData statData = homeStatService.getHomeStatData(category);
        return ApiResponse.success(statData);
    }

    /**
     * 获取首页找货热门 SKU（按后端全量有效报盘统计）
     */
    @GetMapping("/hot-offer-skus")
    public ApiResponse<List<com.mooket.social.dto.HomeHotSkuDTO>> getHomeHotOfferSkus(
            @RequestParam(required = false, defaultValue = "牛") String category,
            @RequestParam(required = false, defaultValue = "3") Integer limit) {
        List<com.mooket.social.dto.HomeHotSkuDTO> skus = homeStatService.getHomeHotOfferSkus(category, limit);
        return ApiResponse.success(skus);
    }

    /**
     * 获取首页卡片数据（瀑布流8种卡片）
     * @param tab 0=热门统计卡片 1=历史搜索卡片
     */
    @GetMapping("/cards")
    public ApiResponse<HomeCardsResponseDTO> getHomeCards(
            @RequestParam(required = false, defaultValue = "牛") String category,
            @RequestParam(required = false, defaultValue = "0") Integer tab,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (tab == 1) {
            // 历史搜索数据：需要用户身份，从 searchHistoryService 获取
            Long userId = extractUserId(authHeader);
            if (userId == null) {
                HomeCardsResponseDTO empty = new HomeCardsResponseDTO();
                empty.setCards(List.of());
                empty.setUpdateTime(null);
                return ApiResponse.success(empty);
            }
            HomeCardsResponseDTO cards = searchHistoryService.getRecentSearchCards(userId, category);
            return ApiResponse.success(cards);
        }
        // tab=0 或默认：热门统计卡片
        HomeCardsResponseDTO cards = homeStatService.getHomeCards(category);
        return ApiResponse.success(cards);
    }

    /**
     * 手动触发首页统计计算（用于测试或数据修复）
     */
    @PostMapping("/test-cards")
    public ApiResponse<HomeCardsResponseDTO> testCards(
            @RequestParam(required = false, defaultValue = "牛") String category,
            @RequestParam(required = false, defaultValue = "0") Integer tab,
            @RequestParam(required = false) Long userId) {
        if (userId == null || tab == 0) {
            HomeCardsResponseDTO cards = homeStatService.getHomeCards(category);
            return ApiResponse.success(cards);
        }
        HomeCardsResponseDTO cards = searchHistoryService.getRecentSearchCards(userId, category);
        return ApiResponse.success(cards);
    }

    /**
     * 手动触发首页统计计算（用于测试或数据修复）
     */
    @PostMapping("/compute-stats")
    public ApiResponse<Map<String, String>> computeStats() {
        try {
            homeStatService.computeAllStats();
            return ApiResponse.success(Map.of("message", "统计计算完成"));
        } catch (Exception e) {
            return ApiResponse.error("统计计算失败: " + e.getMessage());
        }
    }
}
