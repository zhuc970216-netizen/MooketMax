package com.mooket.social.scheduler;

import com.mooket.social.mapper.BizOfferMapper;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 在 offer_biz 同步停滞期间，将 biz_offer 里的盘日期统一滚动到当天，
 * 保证首页/列表页仍然能命中“近一天”的查询窗口。
 */
@Component
public class BizOfferDateRefreshScheduler {

    private final BizOfferMapper bizOfferMapper;

    public BizOfferDateRefreshScheduler(BizOfferMapper bizOfferMapper) {
        this.bizOfferMapper = bizOfferMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void refreshOnStartup() {
        refreshOfferDates("startup");
    }

    @Scheduled(cron = "0 0 0 * * ?", zone = "Asia/Shanghai")
    public void refreshAtMidnight() {
        refreshOfferDates("midnight");
    }

    @Scheduled(cron = "0 5 0 * * ?", zone = "Asia/Shanghai")
    public void refreshAfterMidnightBuffer() {
        refreshOfferDates("midnight-buffer");
    }

    @Scheduled(cron = "0 */15 * * * ?", zone = "Asia/Shanghai")
    public void refreshDisplayDatesSelfHealing() {
        refreshOfferDates("self-heal");
    }

    private void refreshOfferDates(String trigger) {
        try {
            int staleRows = bizOfferMapper.countRowsWithNonTodayPublishDate();
            if (staleRows <= 0) {
                System.out.println("[BizOfferDateRefreshScheduler] " + trigger + " skip, all offer publish dates are already today");
                return;
            }
            int updatedRows = bizOfferMapper.refreshAllOfferPublishDatesToToday();
            System.out.println("[BizOfferDateRefreshScheduler] " + trigger + " refreshed biz_offer publish dates to today, staleRows="
                    + staleRows + ", updatedRows=" + updatedRows);
        } catch (Exception e) {
            System.err.println("[BizOfferDateRefreshScheduler] " + trigger + " refresh failed: " + e.getMessage());
        }
    }
}
