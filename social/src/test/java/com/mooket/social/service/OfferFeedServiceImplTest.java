package com.mooket.social.service;

import com.mooket.social.service.impl.OfferFeedServiceImpl;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OfferFeedServiceImplTest {

    private final OfferFeedServiceImpl service = new OfferFeedServiceImpl(null);

    @Test
    void normalizeSortBySupportsClientAndServerSortNames() throws Exception {
        assertEquals("comprehensive", normalizeSortBy(null));
        assertEquals("comprehensive", normalizeSortBy(""));
        assertEquals("comprehensive", normalizeSortBy("comprehensive"));
        assertEquals("price_asc", normalizeSortBy("priceAsc"));
        assertEquals("price_asc", normalizeSortBy("price_asc"));
        assertEquals("price_desc", normalizeSortBy("priceDesc"));
        assertEquals("price_desc", normalizeSortBy("price_desc"));
        assertEquals("publish_time", normalizeSortBy("publishTime"));
        assertEquals("publish_time", normalizeSortBy("publish_time"));
        assertEquals("field_completeness", normalizeSortBy("fieldCompleteness"));
        assertEquals("field_completeness", normalizeSortBy("field_completeness"));
    }

    private String normalizeSortBy(String sortBy) throws Exception {
        Method method = OfferFeedServiceImpl.class.getDeclaredMethod("normalizeSortBy", String.class);
        method.setAccessible(true);
        return (String) method.invoke(service, sortBy);
    }
}
