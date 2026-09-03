package com.mooket.social.scheduler;

import com.mooket.social.mapper.BizOfferMapper;
import com.mooket.social.mapper.StatBrandMapper;
import com.mooket.social.mapper.StatBrandProductMapper;
import com.mooket.social.mapper.StatCountryMapper;
import com.mooket.social.mapper.StatCountryProductMapper;
import com.mooket.social.mapper.StatFactoryMapper;
import com.mooket.social.mapper.StatFactoryProductMapper;
import com.mooket.social.mapper.StatMerchantMapper;
import com.mooket.social.mapper.StatPriceTrendMapper;
import com.mooket.social.mapper.StatProductMapper;
import com.mooket.social.service.BrandSyncService;
import com.mooket.social.service.DataSyncService;
import com.mooket.social.service.FactorySyncService;
import com.mooket.social.service.MerchantSyncService;
import com.mooket.social.service.ProductSyncService;
import com.mooket.social.service.UserMerchantSyncService;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * MySQL 数据同步调度器
 * - dict_product: 手动触发，一次性同步
 * - dict_factory: 手动触发，一次性同步
 * - dict_merchant: 每天 8:00 / 14:00 / 20:00 同步
 * - biz_offer: 每5分钟增量同步
 */
@Component
public class DataSyncScheduler {

    private final DataSyncService dataSyncService;
    private final ProductSyncService productSyncService;
    private final FactorySyncService factorySyncService;
    private final BrandSyncService brandSyncService;
    private final MerchantSyncService merchantSyncService;
    private final UserMerchantSyncService userMerchantSyncService;
    private final BizOfferMapper bizOfferMapper;
    private final StatProductMapper statProductMapper;
    private final StatMerchantMapper statMerchantMapper;
    private final StatCountryMapper statCountryMapper;
    private final StatFactoryMapper statFactoryMapper;
    private final StatCountryProductMapper statCountryProductMapper;
    private final StatFactoryProductMapper statFactoryProductMapper;
    private final StatBrandMapper statBrandMapper;
    private final StatBrandProductMapper statBrandProductMapper;
    private final StatPriceTrendMapper statPriceTrendMapper;

    // 标记是否已执行过首次同步（避免重复执行）
    private volatile boolean initialSyncExecuted = false;

    // dict_factory 上次同步时间（用于增量同步）
    private volatile LocalDateTime lastFactorySyncTime = null;

    public DataSyncScheduler(DataSyncService dataSyncService,
                            ProductSyncService productSyncService,
                            FactorySyncService factorySyncService,
                            BrandSyncService brandSyncService,
                            MerchantSyncService merchantSyncService,
                            UserMerchantSyncService userMerchantSyncService,
                            BizOfferMapper bizOfferMapper,
                            StatProductMapper statProductMapper,
                            StatMerchantMapper statMerchantMapper,
                            StatCountryMapper statCountryMapper,
                            StatFactoryMapper statFactoryMapper,
                            StatCountryProductMapper statCountryProductMapper,
                            StatFactoryProductMapper statFactoryProductMapper,
                            StatBrandMapper statBrandMapper,
                            StatBrandProductMapper statBrandProductMapper,
                            StatPriceTrendMapper statPriceTrendMapper) {
        this.dataSyncService = dataSyncService;
        this.productSyncService = productSyncService;
        this.factorySyncService = factorySyncService;
        this.brandSyncService = brandSyncService;
        this.merchantSyncService = merchantSyncService;
        this.userMerchantSyncService = userMerchantSyncService;
        this.bizOfferMapper = bizOfferMapper;
        this.statProductMapper = statProductMapper;
        this.statMerchantMapper = statMerchantMapper;
        this.statCountryMapper = statCountryMapper;
        this.statFactoryMapper = statFactoryMapper;
        this.statCountryProductMapper = statCountryProductMapper;
        this.statFactoryProductMapper = statFactoryProductMapper;
        this.statBrandMapper = statBrandMapper;
        this.statBrandProductMapper = statBrandProductMapper;
        this.statPriceTrendMapper = statPriceTrendMapper;
    }

    /**
     * 应用启动后执行 biz_offer 首次同步（最近2天数据）
     * 异步执行，避免阻塞 HTTP 请求
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!initialSyncExecuted) {
            initialSyncExecuted = true;
            System.out.println("[DataSyncScheduler] 应用启动，异步执行 biz_offer 首次同步...");
            // 异步执行，不阻塞主线程
            new Thread(() -> {
                try {
                    dataSyncService.sync();
                } catch (Exception e) {
                    System.err.println("[DataSyncScheduler] biz_offer 首次同步失败: " + e.getMessage());
                }
            }).start();
        }
    }

    /**
     * 每5分钟执行一次增量同步（仅 biz_offer）
     * 异步执行，避免阻塞 HTTP 请求
     */
    @Scheduled(fixedRate = 300000)
    public void incrementalSync() {
        System.out.println("[DataSyncScheduler] 开始执行增量同步（异步）...");
        // 异步执行，不阻塞
        new Thread(() -> {
            try {
                int count = dataSyncService.sync();
                System.out.println("[DataSyncScheduler] 增量同步完成，同步了 " + count + " 条数据");
            } catch (Exception e) {
                System.err.println("[DataSyncScheduler] 增量同步失败: " + e.getMessage());
            }
        }).start();
    }

    /**
     * 每天 8:00 / 14:00 / 20:00 执行 dict_factory → dict_brand → dict_merchant 串行同步
     * 依赖顺序：dict_factory（无依赖）→ dict_brand（依赖factory）→ dict_merchant（无依赖）
     */
    @Scheduled(cron = "0 0 8,14,20 * * ?", zone = "Asia/Shanghai")
    public void syncDictFactoryAndBrandAndMerchant() {
        // 1. dict_factory 全量同步
        System.out.println("[DataSyncScheduler] 开始执行 dict_factory 定时同步...");
        try {
            int factoryCount = factorySyncService.sync(null);
            System.out.println("[DataSyncScheduler] dict_factory 定时同步完成，共 " + factoryCount + " 条");
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] dict_factory 定时同步失败: " + e.getMessage());
            return; // factory 失败则不继续
        }

        // 2. dict_brand 同步（依赖 dict_factory 完成）
        System.out.println("[DataSyncScheduler] 开始执行 dict_brand 定时同步...");
        try {
            int brandCount = brandSyncService.sync();
            System.out.println("[DataSyncScheduler] dict_brand 定时同步完成，共 " + brandCount + " 条");
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] dict_brand 定时同步失败: " + e.getMessage());
        }

        // 3. rel_user_merchant 同步（必须在 dict_merchant 之前，因为 merchant 同步时要从中取 contact_phone）
        System.out.println("[DataSyncScheduler] 开始执行 rel_user_merchant 定时同步...");
        try {
            int userMerchantCount = userMerchantSyncService.sync(null);
            System.out.println("[DataSyncScheduler] rel_user_merchant 定时同步完成，共 " + userMerchantCount + " 条");
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] rel_user_merchant 定时同步失败: " + e.getMessage());
        }

        // 4. dict_merchant 同步（依赖 rel_user_merchant 的 contact_phone）
        System.out.println("[DataSyncScheduler] 开始执行 dict_merchant 定时同步...");
        try {
            int merchantCount = merchantSyncService.sync();
            System.out.println("[DataSyncScheduler] dict_merchant 定时同步完成，共 " + merchantCount + " 条");
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] dict_merchant 定时同步失败: " + e.getMessage());
        }
    }

    /**
     * 每天 0:00 执行一次 biz_offer 旧数据清理
     * 删除 data_date < CURRENT_DATE - INTERVAL '1 day' 的数据（即前天0点之前的数据）
     */
    @Scheduled(cron = "0 0 0 * * ?", zone = "Asia/Shanghai")
    public void cleanupOldBizOfferData() {
        System.out.println("[DataSyncScheduler] 开始执行 biz_offer 旧数据清理...");
        try {
            int deleted = bizOfferMapper.deleteOldData();
            System.out.println("[DataSyncScheduler] biz_offer 旧数据清理完成，删除了 " + deleted + " 条");
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] biz_offer 旧数据清理失败: " + e.getMessage());
        }
    }

    /**
     * 每天 1:00 执行一次 stat_* 表旧数据清理
     * 删除 stat_date < CURRENT_DATE - INTERVAL '30 day' 的数据（保留30天）
     */
    @Scheduled(cron = "0 0 1 * * ?", zone = "Asia/Shanghai")
    public void cleanupOldStatData() {
        System.out.println("[DataSyncScheduler] 开始执行 stat_* 表旧数据清理（保留30天）...");
        try {
            int deleted1 = statProductMapper.deleteOldRecords();
            int deleted2 = statMerchantMapper.deleteOldRecords();
            int deleted3 = statCountryMapper.deleteOldRecords();
            int deleted4 = statFactoryMapper.deleteOldRecords();
            int deleted5 = statCountryProductMapper.deleteOldRecords();
            int deleted6 = statFactoryProductMapper.deleteOldRecords();
            int deleted7 = statBrandMapper.deleteOldRecords();
            int deleted8 = statBrandProductMapper.deleteOldRecords();
            int deleted9 = statPriceTrendMapper.deleteOldRecords();
            System.out.println("[DataSyncScheduler] stat_* 表旧数据清理完成: stat_product=" + deleted1 + ", stat_merchant=" + deleted2 + ", stat_country=" + deleted3 + ", stat_factory=" + deleted4 + ", stat_country_product=" + deleted5 + ", stat_factory_product=" + deleted6 + ", stat_brand=" + deleted7 + ", stat_brand_product=" + deleted8 + ", stat_price_trend=" + deleted9);
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] stat_* 表旧数据清理失败: " + e.getMessage());
        }
    }

    // ==================== 手动触发方法（用于测试） ====================

    /**
     * 手动触发 dict_product 同步（一次性）
     * 成功后取消下面的注释，下次启动会自动执行
     */
    public void syncDictProductManually() {
        System.out.println("[DataSyncScheduler] 手动触发 dict_product 同步...");
        try {
            int count = productSyncService.sync();
            System.out.println("[DataSyncScheduler] dict_product 同步完成，共 " + count + " 条");
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] dict_product 同步失败: " + e.getMessage());
            throw e;
        }
    }

    /**
     * 手动触发 dict_factory 同步（一次性）
     * null表示全量同步
     */
    public void syncDictFactoryManually() {
        System.out.println("[DataSyncScheduler] 手动触发 dict_factory 同步...");
        try {
            int count = factorySyncService.sync(null); // 全量同步
            lastFactorySyncTime = LocalDateTime.now();
            System.out.println("[DataSyncScheduler] dict_factory 同步完成，共 " + count + " 条");
        } catch (Exception e) {
            System.err.println("[DataSyncScheduler] dict_factory 同步失败: " + e.getMessage());
            throw e;
        }
    }
}
