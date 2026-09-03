package com.mooket.social.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DataSyncServiceTest {

    @Test
    void normalizeDisplayPublishTimeRollsDateToShanghaiToday() {
        LocalDateTime sourceOfferDate = LocalDateTime.of(2026, 8, 9, 23, 45, 12);

        LocalDateTime normalized = DataSyncService.normalizeDisplayPublishTime(sourceOfferDate);

        assertEquals(LocalDate.now(DataSyncService.APP_ZONE), normalized.toLocalDate());
        assertEquals(sourceOfferDate.toLocalTime(), normalized.toLocalTime());
    }

    @Test
    void normalizeDisplayPublishTimeFallsBackToStartOfShanghaiToday() {
        LocalDateTime normalized = DataSyncService.normalizeDisplayPublishTime(null);

        assertEquals(LocalDate.now(DataSyncService.APP_ZONE), normalized.toLocalDate());
        assertEquals(0, normalized.getHour());
        assertEquals(0, normalized.getMinute());
        assertEquals(0, normalized.getSecond());
    }
}
