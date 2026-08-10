package com.mooket.social.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.mooket.social.entity.FactoryTier;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
/* loaded from: temp_jar_download.jar:BOOT-INF/classes/com/mooket/social/mapper/FactoryTierMapper.class */
public interface FactoryTierMapper extends BaseMapper<FactoryTier> {
    @Select({"SELECT factory_no FROM factory_tier WHERE category = #{category} AND product_name = #{productName} AND tier = #{tier}"})
    List<String> selectFactoryNosByTier(@Param("category") String category, @Param("productName") String productName, @Param("tier") String tier);

    @Select({"SELECT tier FROM factory_tier WHERE category = #{category} AND product_name = #{productName} AND factory_no = #{factoryNo} LIMIT 1"})
    String selectTierByFactoryNo(@Param("category") String category, @Param("productName") String productName, @Param("factoryNo") String factoryNo);

    @Select({
            "<script>",
            "SELECT tier",
            "FROM factory_tier",
            "WHERE category = #{category}",
            "  AND factory_no = #{factoryNo}",
            "  AND (",
            "    <foreach collection='productNames' item='productName' separator=' OR '>",
            "      REPLACE(product_name, ' ', '') = REPLACE(#{productName}, ' ', '')",
            "    </foreach>",
            "  )",
            "LIMIT 1",
            "</script>"
    })
    String selectTierByFactoryNoAndProductNames(@Param("category") String category,
                                                @Param("productNames") List<String> productNames,
                                                @Param("factoryNo") String factoryNo);

    @Select({
            "<script>",
            "SELECT DISTINCT factory_no",
            "FROM factory_tier",
            "WHERE category = #{category}",
            "  AND tier = #{tier}",
            "  AND (",
            "    <foreach collection='productNames' item='productName' separator=' OR '>",
            "      REPLACE(product_name, ' ', '') = REPLACE(#{productName}, ' ', '')",
            "    </foreach>",
            "  )",
            "</script>"
    })
    List<String> selectFactoryNosByTierAndProductNames(@Param("category") String category,
                                                       @Param("productNames") List<String> productNames,
                                                       @Param("tier") String tier);
}
