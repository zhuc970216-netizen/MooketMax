package com.mooket.social.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * 缓存配置
 */
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager(
                "productDetail", "merchantDetail", "merchantProducts", "countryDetail", "factoryDetail",
                "countryProductDetail", "countryFactoryProductDetail", "brandDetail", "brandProductDetail",
                "homeHotSearch", "homeStatData", "homeHotOfferSkus", "homeCards", "recentSearchCards", "selfSelectCards");
        cacheManager.setCaffeine(Caffeine.newBuilder()
                .maximumSize(1000)
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .recordStats());
        return cacheManager;
    }
}
