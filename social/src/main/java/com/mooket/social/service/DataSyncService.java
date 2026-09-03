package com.mooket.social.service;

import com.mooket.social.entity.BizOffer;
import com.mooket.social.entity.DictBrand;
import com.mooket.social.entity.DictFactory;
import com.mooket.social.entity.DictMerchant;
import com.mooket.social.entity.DictProduct;
import com.mooket.social.entity.mysql.SocialOnlineBusiness;
import com.mooket.social.entity.mysql.SocialOnlineBusinessContent;
import com.mooket.social.entity.mysql.SocialOnlineBusinessTag;
import com.mooket.social.entity.mysql.SocialStandardGoodsName;
import com.mooket.social.entity.mysql.SysDict;
import com.mooket.social.mapper.BizOfferMapper;
import com.mooket.social.mapper.DictBrandMapper;
import com.mooket.social.mapper.DictFactoryMapper;
import com.mooket.social.mapper.DictMerchantMapper;
import com.mooket.social.mapper.DictProductMapper;
import com.mooket.social.mysql.mapper.SocialOnlineBusinessContentMapper;
import com.mooket.social.mysql.mapper.SocialOnlineBusinessMapper;
import com.mooket.social.mysql.mapper.SocialOnlineBusinessTagMapper;
import com.mooket.social.mysql.mapper.SocialStandardGoodsNameMapper;
import com.mooket.social.mysql.mapper.SysDictMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * MySQL 数据同步服务
 */
@Service
public class DataSyncService {

    static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");

    private final SocialOnlineBusinessMapper sourceMapper;
    private final BizOfferMapper targetMapper;
    private final SysDictMapper sysDictMapper;
    private final SocialOnlineBusinessContentMapper contentMapper;
    private final SocialOnlineBusinessTagMapper tagMapper;
    private final SocialStandardGoodsNameMapper goodsNameMapper;
    private final DictMerchantMapper merchantMapper;
    private final DictFactoryMapper factoryMapper;
    private final DictProductMapper productMapper;
    private final DictBrandMapper brandMapper;
    private final JdbcTemplate pgJdbcTemplate;

    // 国家编码→名称映射（与 FactorySyncService 保持一致）
    private static final Map<Integer, String> COUNTRY_MAP = new HashMap<>();
    static {
        COUNTRY_MAP.put(1, "阿根廷"); COUNTRY_MAP.put(2, "澳大利亚"); COUNTRY_MAP.put(3, "白罗斯");
        COUNTRY_MAP.put(4, "巴西"); COUNTRY_MAP.put(5, "加拿大"); COUNTRY_MAP.put(6, "中国");
        COUNTRY_MAP.put(7, "智利"); COUNTRY_MAP.put(8, "哥斯达黎加"); COUNTRY_MAP.put(9, "法国");
        COUNTRY_MAP.put(10, "匈牙利"); COUNTRY_MAP.put(11, "爱尔兰"); COUNTRY_MAP.put(12, "墨西哥");
        COUNTRY_MAP.put(13, "蒙古"); COUNTRY_MAP.put(14, "纳米比亚"); COUNTRY_MAP.put(15, "新西兰");
        COUNTRY_MAP.put(16, "南非"); COUNTRY_MAP.put(17, "塞尔维亚"); COUNTRY_MAP.put(18, "乌拉圭");
        COUNTRY_MAP.put(19, "美国"); COUNTRY_MAP.put(20, "哈萨克斯坦"); COUNTRY_MAP.put(21, "奥地利");
        COUNTRY_MAP.put(22, "比利时"); COUNTRY_MAP.put(23, "丹麦"); COUNTRY_MAP.put(24, "英国");
        COUNTRY_MAP.put(25, "芬兰"); COUNTRY_MAP.put(26, "德国"); COUNTRY_MAP.put(27, "意大利");
        COUNTRY_MAP.put(28, "荷兰"); COUNTRY_MAP.put(29, "波兰"); COUNTRY_MAP.put(30, "罗马尼亚");
        COUNTRY_MAP.put(31, "西班牙"); COUNTRY_MAP.put(32, "韩国"); COUNTRY_MAP.put(33, "泰国");
        COUNTRY_MAP.put(34, "俄罗斯"); COUNTRY_MAP.put(35, "玻利维亚"); COUNTRY_MAP.put(36, "立陶宛");
        COUNTRY_MAP.put(37, "乌克兰"); COUNTRY_MAP.put(38, "巴拿马"); COUNTRY_MAP.put(39, "葡萄牙");
        COUNTRY_MAP.put(40, "拉脱维亚"); COUNTRY_MAP.put(41, "冰岛"); COUNTRY_MAP.put(42, "瑞士");
        COUNTRY_MAP.put(43, "新加坡"); COUNTRY_MAP.put(44, "日本"); COUNTRY_MAP.put(45, "土耳其");
        COUNTRY_MAP.put(46, "秘鲁"); COUNTRY_MAP.put(47, "挪威"); COUNTRY_MAP.put(48, "格陵兰岛");
        COUNTRY_MAP.put(49, "哥伦比亚"); COUNTRY_MAP.put(50, "巴拉圭");
        COUNTRY_MAP.put(51, "哥伦比亚"); COUNTRY_MAP.put(52, "危地马拉");
    }

    // 上次同步时间（内存存储，生产环境建议持久化到数据库或配置中心）
    private volatile LocalDateTime lastSyncTime;

    public DataSyncService(SocialOnlineBusinessMapper sourceMapper,
                           BizOfferMapper targetMapper,
                           SysDictMapper sysDictMapper,
                           SocialOnlineBusinessContentMapper contentMapper,
                           SocialOnlineBusinessTagMapper tagMapper,
                           SocialStandardGoodsNameMapper goodsNameMapper,
                           DictMerchantMapper merchantMapper,
                           DictFactoryMapper factoryMapper,
                           DictProductMapper productMapper,
                           DictBrandMapper brandMapper,
                           @Qualifier("pgJdbcTemplate") JdbcTemplate pgJdbcTemplate) {
        this.sourceMapper = sourceMapper;
        this.targetMapper = targetMapper;
        this.sysDictMapper = sysDictMapper;
        this.contentMapper = contentMapper;
        this.tagMapper = tagMapper;
        this.goodsNameMapper = goodsNameMapper;
        this.merchantMapper = merchantMapper;
        this.factoryMapper = factoryMapper;
        this.productMapper = productMapper;
        this.brandMapper = brandMapper;
        this.pgJdbcTemplate = pgJdbcTemplate;
    }

    /**
     * 同步类型枚举
     */
    public enum SyncType {
        INITIAL,   // 首次同步（最近2天）
        INCREMENT  // 增量同步
    }

    /**
     * 执行同步（防止并发重复执行）
     */
    public synchronized int sync() {
        System.out.println("[DataSyncService] 开始执行增量同步...");

        // 1. 获取源数据（基于 update_time 增量查询）
        boolean reconcileRecentWindow = true;
        LocalDateTime startTime = lastSyncTime == null ? LocalDateTime.now(APP_ZONE).minusDays(2) : lastSyncTime;
        return doSync(startTime, reconcileRecentWindow);
    }

    /**
     * 强制全量同步（最近2天数据）
     */
    public synchronized int syncFull() {
        System.out.println("[DataSyncService] 开始执行全量同步（最近2天）...");
        lastSyncTime = null; // 重置同步时间，强制全量
        LocalDateTime startTime = LocalDateTime.now(APP_ZONE).minusDays(2);
        return doSync(startTime, true);
    }

    /**
     * 实际执行同步
     */
    private int doSync(LocalDateTime startTime, boolean reconcileRecentWindow) {
        List<SocialOnlineBusiness> sourceData = sourceMapper.selectIncrementData(startTime);
        System.out.println("[DataSyncService] 查询起始时间: " + startTime + "，待同步数据: " + sourceData.size() + " 条");

        if ((sourceData == null || sourceData.isEmpty()) && !reconcileRecentWindow) {
            System.out.println("[DataSyncService] 没有需要同步的数据");
            return 0;
        }

        // 2. 批量查询关联数据（减少数据库查询次数）
        Map<Long, String> contentMap = batchGetContent(sourceData);
        Map<Long, String> goodsNameMap = batchGetGoodsName(sourceData);
        Map<Long, String> tagMap = batchGetTags(sourceData);
        Map<String, String> dictValueMap = batchGetDictValues(sourceData);
        Map<String, Long> merchantMap = batchGetMerchants(sourceData);
        Map<String, Long> factoryIdMap = batchGetFactoryIds(sourceData);
        Map<String, Integer> productIdMap = batchGetProductIds(sourceData);
        Map<Long, Integer> brandIdMap = batchGetBrandIds(sourceData, factoryIdMap);

        // 3. 转换为目标实体并插入
        int successCount = 0;
        int failCount = 0;

        int total = sourceData.size();
        for (int i = 0; i < sourceData.size(); i++) {
            SocialOnlineBusiness src = sourceData.get(i);
            try {
                BizOffer target = convertToBizOffer(src, contentMap, goodsNameMap, dictValueMap, merchantMap, factoryIdMap, productIdMap, brandIdMap, tagMap);
                targetMapper.upsert(target);
                successCount++;
                if ((i + 1) % 5000 == 0) {
                    System.out.println("[DataSyncService] 进度: " + (i + 1) + "/" + total);
                }
            } catch (Exception e) {
                System.err.println("[DataSyncService] 同步失败, id=" + src.getId() + ", error=" + e.getMessage());
                e.printStackTrace();
                failCount++;
            }
        }

        // 4. 更新上次同步时间
        if (reconcileRecentWindow) {
            reconcileRecentSourceBusinessIds();
        }
        lastSyncTime = LocalDateTime.now(APP_ZONE);

        System.out.println("[DataSyncService] 同步完成: 成功=" + successCount + ", 失败=" + failCount);
        return successCount;
    }

    /**
     * 批量获取原文内容
     */
    private Map<Long, String> batchGetContent(List<SocialOnlineBusiness> sourceData) {
        List<Long> contentIds = sourceData.stream()
                .map(SocialOnlineBusiness::getOnlineBusinessContentId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        if (contentIds.isEmpty()) {
            return Collections.emptyMap();
        }

        return contentMapper.selectByIds(contentIds).stream()
                .collect(Collectors.toMap(SocialOnlineBusinessContent::getId, SocialOnlineBusinessContent::getContent));
    }

    /**
     * 批量获取标准产品名称
     */
    private Map<Long, String> batchGetGoodsName(List<SocialOnlineBusiness> sourceData) {
        List<Long> goodsIds = sourceData.stream()
                .map(SocialOnlineBusiness::getStandardGoodsNameId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        if (goodsIds.isEmpty()) {
            return Collections.emptyMap();
        }

        return goodsNameMapper.selectByIds(goodsIds).stream()
                .collect(Collectors.toMap(SocialStandardGoodsName::getId, SocialStandardGoodsName::getStandardGoodsName));
    }

    /**
     * 批量获取标签（仅当前同步窗口的报盘 id，不触碰历史数据）。
     * 按 online_business_id 聚合去重，逗号拼接；超 200 字符截断以适配 tags 列长度。
     */
    private Map<Long, String> batchGetTags(List<SocialOnlineBusiness> sourceData) {
        List<Long> ids = sourceData.stream()
                .map(SocialOnlineBusiness::getId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }

        Map<Long, LinkedHashSet<String>> grouped = new HashMap<>();
        int batchSize = 1000;
        for (int i = 0; i < ids.size(); i += batchSize) {
            List<Long> batch = ids.subList(i, Math.min(i + batchSize, ids.size()));
            try {
                for (SocialOnlineBusinessTag t : tagMapper.selectByBusinessIds(batch)) {
                    if (t.getOnlineBusinessId() == null || t.getBusinessTag() == null) continue;
                    String tag = t.getBusinessTag().trim();
                    if (tag.isEmpty()) continue;
                    grouped.computeIfAbsent(t.getOnlineBusinessId(), k -> new LinkedHashSet<>()).add(tag);
                }
            } catch (Exception e) {
                // 标签为辅助字段，单批失败不应阻断主同步流程
                System.err.println("[DataSyncService] 标签查询失败(跳过该批): " + e.getMessage());
            }
        }

        Map<Long, String> result = new HashMap<>();
        for (Map.Entry<Long, LinkedHashSet<String>> e : grouped.entrySet()) {
            String joined = String.join(",", e.getValue());
            if (joined.length() > 200) {
                joined = joined.substring(0, 200);
            }
            result.put(e.getKey(), joined);
        }
        System.out.println("[DataSyncService] 标签获取完成: " + result.size() + " 个报盘含标签");
        return result;
    }

    /**
     * 批量获取字典值
     */
    private Map<String, String> batchGetDictValues(List<SocialOnlineBusiness> sourceData) {
        Map<String, String> result = new HashMap<>();

        // 预加载所有需要的字典
        String[] dictNames = {"ggoods_country", "weight_unit", "business_category", "lean_ratio"};
        for (String dictName : dictNames) {
            List<SysDict> dicts = sysDictMapper.selectByDictNameEn(dictName);
            for (SysDict dict : dicts) {
                result.put(dictName + "_" + dict.getDictKey(), dict.getDictValue());
            }
        }

        return result;
    }

    private void reconcileRecentSourceBusinessIds() {
        LocalDateTime recentWindowStart = LocalDate.now(APP_ZONE).minusDays(1).atStartOfDay();
        List<Long> activeSourceIds = sourceMapper.selectActiveIdsByOfferDate(recentWindowStart);
        System.out.println("[DataSyncService] recent active source ids: " + activeSourceIds.size());

        Integer deleted = pgJdbcTemplate.execute((org.springframework.jdbc.core.ConnectionCallback<Integer>) connection -> {
            try (PreparedStatement insertStmt = connection.prepareStatement(
                    "INSERT INTO temp_active_source_business_ids (source_business_id) VALUES (?) ON CONFLICT DO NOTHING")) {
                connection.createStatement().execute("DROP TABLE IF EXISTS temp_active_source_business_ids");
                connection.createStatement().execute(
                        "CREATE TEMP TABLE temp_active_source_business_ids (source_business_id BIGINT PRIMARY KEY)");

                for (int i = 0; i < activeSourceIds.size(); i++) {
                    insertStmt.setLong(1, activeSourceIds.get(i));
                    insertStmt.addBatch();
                    if ((i + 1) % 1000 == 0) {
                        insertStmt.executeBatch();
                    }
                }
                if (!activeSourceIds.isEmpty()) {
                    insertStmt.executeBatch();
                }

                int rows = connection.createStatement().executeUpdate("""
                        DELETE FROM biz_offer bo
                        WHERE bo.data_date >= CURRENT_DATE - INTERVAL '1 day'
                          AND bo.source_business_id IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1
                              FROM temp_active_source_business_ids tmp
                              WHERE tmp.source_business_id = bo.source_business_id
                          )
                        """);
                connection.createStatement().execute("DROP TABLE IF EXISTS temp_active_source_business_ids");
                return rows;
            }
        });
        System.out.println("[DataSyncService] reconciled stale recent biz_offer rows: " + deleted);
    }

    /**
     * 批量获取商家信息（通过 rel_user_merchant 的 mobile→merchant_id 映射）
     * 这样能覆盖所有员工号码，不仅限于 dict_merchant.contact_phone 中的单一号码
     */
    private Map<String, Long> batchGetMerchants(List<SocialOnlineBusiness> sourceData) {
        Map<String, Long> result = new HashMap<>();

        // 获取所有需要关联的电话号码
        List<String> phoneNos = sourceData.stream()
                .map(SocialOnlineBusiness::getPhoneNo)
                .filter(Objects::nonNull)
                .filter(p -> !p.isEmpty())
                .distinct()
                .collect(Collectors.toList());

        if (phoneNos.isEmpty()) {
            return result;
        }

        // 优先从 rel_user_merchant 查（覆盖所有员工号码）
        try {
            List<Map<String, Object>> rows = pgJdbcTemplate.queryForList(
                "SELECT mobile, merchant_id FROM rel_user_merchant WHERE merchant_id IS NOT NULL"
            );
            for (Map<String, Object> row : rows) {
                String mobile = (String) row.get("mobile");
                Long merchantId = (Long) row.get("merchant_id");
                if (mobile != null && merchantId != null) {
                    result.put(mobile, merchantId);
                }
            }
        } catch (Exception e) {
            System.err.println("[DataSyncService] rel_user_merchant 查询失败，回退到 dict_merchant: " + e.getMessage());
        }

        // 补充：dict_merchant.contact_phone（兜底，万一 rel_user_merchant 中没有）
        if (result.isEmpty()) {
            List<DictMerchant> merchants = merchantMapper.selectByPhones(phoneNos);
            for (DictMerchant merchant : merchants) {
                if (merchant.getContactPhone() != null) {
                    result.put(merchant.getContactPhone(), merchant.getMerchantId());
                }
            }
        }

        return result;
    }

    /**
     * 批量获取厂号ID（通过factory_no直接查询）
     */
    private Map<String, Long> batchGetFactoryIds(List<SocialOnlineBusiness> sourceData) {
        Map<String, Long> result = new HashMap<>();

        // 收集所有不重复的 factoryNo + category 组合
        List<SocialOnlineBusiness> validData = sourceData.stream()
                .filter(s -> s.getPlantNo() != null && !s.getPlantNo().isEmpty())
                .collect(Collectors.toList());

        if (validData.isEmpty()) {
            return result;
        }

        // 按 category 分组处理，每组独立查询
        Map<String, List<SocialOnlineBusiness>> byCategory = validData.stream()
                .collect(Collectors.groupingBy(s -> convertCategory(s.getGoodsCategory())));

        for (Map.Entry<String, List<SocialOnlineBusiness>> entry : byCategory.entrySet()) {
            String category = entry.getKey();
            List<String> factoryNos = entry.getValue().stream()
                    .map(SocialOnlineBusiness::getPlantNo)
                    .distinct()
                    .collect(Collectors.toList());

            for (String factoryNo : factoryNos) {
                try {
                    List<DictFactory> factories = factoryMapper.selectByFactoryNoWithCategory(factoryNo, category);
                    if (factories != null && !factories.isEmpty()) {
                        // 使用 factoryNo + category 组合作为 key，避免跨 category 数据覆盖
                        result.put(factoryNo + "|" + category, factories.get(0).getFactoryId().longValue());
                    }
                } catch (Exception e) {
                    // ignore
                }
            }
        }

        return result;
    }

    /**
     * 批量获取产品ID（通过product_name查询）
     */
    private Map<String, Integer> batchGetProductIds(List<SocialOnlineBusiness> sourceData) {
        Map<String, Integer> result = new HashMap<>();
        List<Long> standardGoodsIds = sourceData.stream()
                .map(SocialOnlineBusiness::getStandardGoodsNameId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        if (!standardGoodsIds.isEmpty()) {
            String inClause = standardGoodsIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(","));
            try {
                List<Map<String, Object>> rows = pgJdbcTemplate.queryForList(
                        "SELECT source_goods_id, product_id FROM dict_product_source_map WHERE source_goods_id IN (" + inClause + ")"
                );
                for (Map<String, Object> row : rows) {
                    Object sourceGoodsId = row.get("source_goods_id");
                    Object productId = row.get("product_id");
                    if (sourceGoodsId instanceof Number && productId instanceof Number) {
                        result.put("id:" + ((Number) sourceGoodsId).longValue(), ((Number) productId).intValue());
                    }
                }
            } catch (Exception e) {
                System.err.println("[DataSyncService] dict_product_source_map query failed: " + e.getMessage());
            }
        }

        // 收集所有不重复的产品名称
        List<String> productNames = sourceData.stream()
                .map(SocialOnlineBusiness::getGoodsName)
                .filter(Objects::nonNull)
                .filter(p -> !p.isEmpty())
                .distinct()
                .collect(Collectors.toList());

        if (productNames.isEmpty()) {
            return result;
        }

        // 直接用product_name查询dict_product表
        for (String productName : productNames) {
            try {
                DictProduct product = productMapper.selectByProductName(productName);
                if (product != null) {
                    result.putIfAbsent("name:" + productName, product.getProductId());
                }
            } catch (Exception e) {
                // ignore
            }
        }

        return result;
    }

    /**
     * 批量获取品牌ID（通过factory_id查询）
     */
    private Map<Long, Integer> batchGetBrandIds(List<SocialOnlineBusiness> sourceData, Map<String, Long> factoryIdMap) {
        Map<Long, Integer> result = new HashMap<>();

        // 收集所有不重复的factory_id（用于兼容原有调用方）
        // ⚠️ 必须按 category 过滤，否则同一 factory_no 在牛/猪类下对应不同 factory_id，会导致 brand_id 串类
        List<Long> factoryIds = sourceData.stream()
                .map(src -> {
                    String factoryNo = src.getPlantNo();
                    String category = convertCategory(src.getGoodsCategory());
                    if (factoryNo == null || factoryNo.isEmpty() || category == null) return null;
                    return factoryIdMap.get(factoryNo + "|" + category);
                })
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        if (factoryIds.isEmpty()) {
            return result;
        }

        // 通过factory_id查询dict_brand表（此路可能因 factory_id 不一致而查不到，改用 factory_no 直查兜底）
        for (Long factoryId : factoryIds) {
            try {
                List<DictBrand> brands = brandMapper.selectByFactoryId(factoryId.intValue());
                if (brands != null && !brands.isEmpty()) {
                    result.put(factoryId, brands.get(0).getBrandId());
                }
            } catch (Exception e) {
                // ignore
            }
        }

        System.out.println("[DataSyncService] 品牌ID获取完成（按factoryId）: " + result.size() + " 个");

        // 兜底：用 factory_no 直查 dict_brand，补充 result 中缺失的 brandId
        // 场景：factory_no 对应的 factory_id 在 dict_brand 中关联了不同的 brand
        Map<String, Integer> factoryNoBrandMap = new HashMap<>();
        for (SocialOnlineBusiness src : sourceData) {
            String factoryNo = src.getPlantNo();
            String category = convertCategory(src.getGoodsCategory());
            if (factoryNo == null || factoryNo.isEmpty() || category == null) continue;
            if (factoryNoBrandMap.containsKey(factoryNo + "_" + category)) continue;

            // 用 factory_no + category 直接查 dict_brand
            try {
                List<DictBrand> brands = brandMapper.selectByFactoryNoAndCategory(factoryNo, category);
                if (brands != null && !brands.isEmpty()) {
                    factoryNoBrandMap.put(factoryNo + "_" + category, brands.get(0).getBrandId());
                }
            } catch (Exception e) {
                // ignore
            }
        }

        // 将 factoryNoBrandMap 合并到 result（factoryNo → factoryId → brandId 链补充）
        for (SocialOnlineBusiness src : sourceData) {
            String factoryNo = src.getPlantNo();
            String category = convertCategory(src.getGoodsCategory());
            if (factoryNo == null || factoryNo.isEmpty() || category == null) continue;
            Integer brandId = factoryNoBrandMap.get(factoryNo + "_" + category);
            if (brandId != null) {
                Long factoryId = factoryIdMap.get(factoryNo + "|" + category);
                if (factoryId != null) {
                    result.putIfAbsent(factoryId, brandId);
                }
            }
        }

        System.out.println("[DataSyncService] 品牌ID获取完成（总计）: " + result.size() + " 个");
        return result;
    }

    /**
     * 修复 biz_offer 中 brand_id 为 NULL 的记录
     * 通过 factory_no + category 直连 dict_brand 补全 brand_id
     */
    public int repairNullBrandId() {
        System.out.println("[DataSyncService] 开始修复 biz_offer 中 brand_id 为 NULL 的记录...");

        // 直接用 UPDATE + JOIN，一次性修复所有记录
        String sql = """
            UPDATE biz_offer AS bo
            SET brand_id = db.brand_id
            FROM dict_brand AS db
            WHERE bo.status = 'ACTIVE'
              AND bo.brand_id IS NULL
              AND bo.factory_no IS NOT NULL
              AND bo.factory_no != ''
              AND REPLACE(bo.factory_no, ' ', '') = REPLACE(db.factory_no, ' ', '')
              AND bo.category = db.category
            """;

        int updated = pgJdbcTemplate.update(sql);
        System.out.println("[DataSyncService] 修复完成: 共修复 " + updated + " 条");
        return updated;
    }

    /**
     * 转换为目标实体
     */
    private BizOffer convertToBizOffer(SocialOnlineBusiness src,
                                        Map<Long, String> contentMap,
                                        Map<Long, String> goodsNameMap,
                                        Map<String, String> dictValueMap,
                                        Map<String, Long> merchantMap,
                                        Map<String, Long> factoryIdMap,
                                        Map<String, Integer> productIdMap,
                                        Map<Long, Integer> brandIdMap,
                                        Map<Long, String> tagMap) {
        BizOffer target = new BizOffer();

        // source_business_id: 保留源表主键，保证 social_online_business 一条记录对应 biz_offer 一条记录
        target.setSourceBusinessId(src.getId());

        // offer_original_text: 通过 online_business_content_id 关联
        if (src.getOnlineBusinessContentId() != null) {
            target.setOfferOriginalText(contentMap.get(src.getOnlineBusinessContentId()));
        }

        // category: 1=牛, 2=羊, 3=猪, 4=禽, 5=水产
        target.setCategory(convertCategory(src.getGoodsCategory()));

        // product_name（使用源数据的goodsName）
        target.setProductName(src.getGoodsName());

        // product_id: 通过 goodsName 查询 dict_product 表获取
        if (src.getStandardGoodsNameId() != null) {
            target.setProductId(productIdMap.get("id:" + src.getStandardGoodsNameId()));
        }
        if (target.getProductId() == null && src.getGoodsName() != null && !src.getGoodsName().isEmpty()) {
            target.setProductId(productIdMap.get("name:" + src.getGoodsName()));
        }

        // country: 通过国家编码映射（包括哥伦比亚49等）
        target.setCountry(COUNTRY_MAP.get(src.getCountry()));

        // factory_no
        target.setFactoryNo(src.getPlantNo());

        // factory_id: 通过 factory_no + category 组合查询 dict_factory 表获取
        String category = target.getCategory();
        if (src.getPlantNo() != null && !src.getPlantNo().isEmpty() && category != null) {
            target.setFactoryId(factoryIdMap.get(src.getPlantNo() + "|" + category));
        }

        // brand_id: 通过 factory_id 查询 dict_brand 表获取
        Long factoryId = target.getFactoryId();
        if (factoryId != null) {
            target.setBrandId(brandIdMap.get(factoryId));
        }

        // merchant_id: 通过 phone_no 关联 dict_merchant
        if (src.getPhoneNo() != null && !src.getPhoneNo().isEmpty()) {
            target.setMerchantId(merchantMap.get(src.getPhoneNo()));
        }

        // contact_phone
        target.setContactPhone(src.getPhoneNo());

        // user_id
        target.setUserId(src.getUserId());

        // user_nickname
        target.setUserNickname(src.getUserName());

        // price
        target.setPrice(src.getAmount());

        // weight: weight + weight_unit
        String weight = "";
        if (src.getWeight() != null) {
            weight = src.getWeight().toString();
            if (src.getWeightUnit() != null) {
                String unit = dictValueMap.get("weight_unit_" + src.getWeightUnit());
                if (unit != null) {
                    weight += " " + unit;
                }
            }
        }
        target.setWeight(weight);

        // offer_type: 0=求购, 1=报盘
        target.setOfferType(src.getIsOffer() != null ?
                (src.getIsOffer() == 0 ? "求购" : "报盘") : null);

        // goods_type
        target.setGoodsType(dictValueMap.get("business_category_" + src.getBusinessCategory()));

        // goods_location
        target.setGoodsLocation((src.getAddressProvince() != null ? src.getAddressProvince() : "") +
                (src.getAddressCity() != null ? src.getAddressCity() : ""));

        // fat_ratio
        target.setFatRatio(dictValueMap.get("lean_ratio_" + src.getLeanRatio()));

        // feeding_type
        target.setFeedingType(src.getStandard());

        // cattle_breed
        target.setCattleBreed(src.getStandardTwo());

        // remark
        target.setRemark(src.getMemo());

        // tags: 通过 social_online_business_tag 按 online_business_id 聚合（仅当前窗口）
        target.setTags(tagMap.get(src.getId()));

        // Keep the live offer board on today's display date so midnight refresh is not
        // overwritten by the next incremental sync writing the source offer date back.
        LocalDateTime displayPublishTime = normalizeDisplayPublishTime(src.getOfferDate());
        target.setPublishTime(displayPublishTime);

        // Preserve the source report date for historical statistics and trend calculations.
        target.setDataDate(src.getOfferDate() != null ? src.getOfferDate().toLocalDate() : LocalDate.now(APP_ZONE));

        // status: 1=已过期, 3=ACTIVE
        target.setStatus(src.getStatus() != null ?
                (src.getStatus() == 1 ? "已过期" : "ACTIVE") : "ACTIVE");

        // create_time: 与源表保持一致，源表为null则写null
        target.setCreateTime(src.getCreatedTime());

        return target;
    }

    /**
     * 转换品类
     */
    private String convertCategory(Integer goodsCategory) {
        if (goodsCategory == null) return null;
        switch (goodsCategory) {
            case 1: return "牛";
            case 2: return "羊";
            case 3: return "猪";
            case 4: return "禽";
            case 5: return "水产";
            default: return null;
        }
    }

    /**
     * 获取上次同步时间
     */
    public LocalDateTime getLastSyncTime() {
        return lastSyncTime;
    }

    static LocalDateTime normalizeDisplayPublishTime(LocalDateTime sourceOfferDate) {
        LocalDate displayDate = LocalDate.now(APP_ZONE);
        if (sourceOfferDate == null) {
            return displayDate.atStartOfDay();
        }
        return displayDate.atTime(sourceOfferDate.toLocalTime());
    }

    /**
     * 修复 biz_offer 表中 country 为 null 的数据
     * 通过 factory_no + category 关联 dict_factory 回填国家名称
     * 哥伦比亚等国家编码原来在 COUNTRY_MAP 中缺失，导致 country 为 null
     * 由于唯一约束包含 country，先删冲突行再更新
     */
    public int fixColombiaCountry() {
        // 先删掉 country 为 null 且会产生冲突的重复行（保留 country 非 null 的那条）
        String deleteSql = """
            DELETE FROM biz_offer o
            WHERE o.country IS NULL
            AND EXISTS (
                SELECT 1 FROM biz_offer o2
                WHERE o2.factory_no = o.factory_no
                AND o2.product_name = o.product_name
                AND o2.user_nickname = o.user_nickname
                AND o2.offer_type = o.offer_type
                AND o2.feeding_type IS NOT DISTINCT FROM o.feeding_type
                AND o2.fat_ratio IS NOT DISTINCT FROM o.fat_ratio
                AND o2.country IS NOT NULL
            )
            """;
        int deleted = pgJdbcTemplate.update(deleteSql);

        // 再更新剩余 country 为 null 的行
        String updateSql = """
            UPDATE biz_offer o
            SET country = d.country
            FROM dict_factory d
            WHERE o.factory_no = d.factory_no
            AND o.category = d.category
            AND o.country IS NULL
            AND d.country IS NOT NULL
            """;
        int updated = pgJdbcTemplate.update(updateSql);
        return deleted + updated;
    }

    /**
     * 清空 dict_factory 表（删除错误同步的数字国家数据）
     */
    public void truncateDictFactory() {
        pgJdbcTemplate.execute("TRUNCATE TABLE dict_factory RESTART IDENTITY CASCADE");
    }
}
