from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")
PRICE_RE = re.compile(r"(-?\d+(?:\.\d+)?)")

COMMON_STAGE_COLUMNS = [
    "stat_date",
    "offer_type",
    "category",
    "country",
    "factory_no",
    "product_name",
    "has_price",
    "avg_price",
    "price_min",
    "price_max",
    "merchant_phone",
    "merchant_name",
    "source_id",
]

TABLES = [
    "stat_price_trend",
    "stat_brand_product",
    "stat_product",
    "stat_country",
    "stat_factory",
    "stat_brand",
    "stat_country_product",
    "stat_factory_product",
    "stat_merchant",
]


@dataclass(frozen=True)
class OutputFileSet:
    csv_path: Path
    sql_path: Path
    readme_path: Path


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return text


def extract_date_from_name(file_name: str) -> str | None:
    match = DATE_RE.search(file_name)
    return match.group(1) if match else None


def parse_price_parts(value: object) -> tuple[float | None, float | None, float | None]:
    text = normalize_text(value)
    if not text:
        return None, None, None

    normalized = (
        text.replace("—", "-")
        .replace("–", "-")
        .replace("－", "-")
        .replace("~", "-")
        .replace("～", "-")
        .replace("至", "-")
    )
    numbers = [float(item) for item in PRICE_RE.findall(normalized)]
    if not numbers:
        return None, None, None
    if len(numbers) >= 2:
        low = round(min(numbers[0], numbers[1]), 4)
        high = round(max(numbers[0], numbers[1]), 4)
        avg = round((low + high) / 2, 4)
        return avg, low, high
    value_one = round(numbers[0], 4)
    return value_one, value_one, value_one


def choose_product_name(row: pd.Series) -> str:
    standard_name = normalize_text(row.get("标准品名"))
    if standard_name:
        return standard_name
    return normalize_text(row.get("产品"))


def load_one_file(path: Path) -> pd.DataFrame:
    trade_date = extract_date_from_name(path.name)
    if not trade_date:
        raise ValueError(f"无法从文件名提取日期: {path.name}")

    df = pd.read_excel(path, engine="openpyxl")
    df.columns = [normalize_text(col) for col in df.columns]

    required = ["类型", "大类", "国家", "厂号", "产品", "报价"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"{path.name} 缺少字段: {missing}")

    work = pd.DataFrame(index=df.index)
    work["stat_date"] = trade_date
    work["offer_type"] = df["类型"].map(normalize_text)
    work["category"] = df["大类"].map(normalize_text)
    work["country"] = df["国家"].map(normalize_text)
    work["factory_no"] = df["厂号"].map(normalize_text)
    work["raw_product_name"] = df["产品"].map(normalize_text)
    work["product_name"] = df.apply(choose_product_name, axis=1)
    work["price_text"] = df["报价"].map(normalize_text)

    parsed_prices = work["price_text"].map(parse_price_parts)
    work["avg_price"] = parsed_prices.map(lambda item: item[0])
    work["price_min"] = parsed_prices.map(lambda item: item[1])
    work["price_max"] = parsed_prices.map(lambda item: item[2])
    work["has_price"] = work["avg_price"].notna()

    merchant_phone_col = "发布人手机号" if "发布人手机号" in df.columns else None
    merchant_name_col = "行业商家名称" if "行业商家名称" in df.columns else None
    source_id_col = "询报盘ID" if "询报盘ID" in df.columns else None

    work["merchant_phone"] = df[merchant_phone_col].map(normalize_text) if merchant_phone_col else ""
    work["merchant_name"] = df[merchant_name_col].map(normalize_text) if merchant_name_col else ""
    if source_id_col:
        work["source_id"] = df[source_id_col].map(normalize_text)
    else:
        work["source_id"] = [f"{trade_date}-{path.stem}-{idx+1}" for idx in range(len(df))]

    return work


def discover_files(source_dir: Path, start_date: str, end_date: str) -> list[Path]:
    selected: list[Path] = []
    for file in sorted(source_dir.glob("*.xlsx")):
        trade_date = extract_date_from_name(file.name)
        if not trade_date:
            continue
        if start_date <= trade_date <= end_date:
            selected.append(file)
    return selected


def build_stage_df(source_dir: Path, start_date: str, end_date: str) -> tuple[pd.DataFrame, list[str], list[Path]]:
    files = discover_files(source_dir, start_date, end_date)
    if not files:
        raise SystemExit(f"未找到日期范围 {start_date} ~ {end_date} 的 Excel: {source_dir}")

    frames = [load_one_file(file) for file in files]
    stage_df = pd.concat(frames, ignore_index=True)
    processed_dates = sorted(stage_df["stat_date"].drop_duplicates().tolist())

    for column in ["offer_type", "category", "country", "factory_no", "product_name", "merchant_phone", "merchant_name"]:
        stage_df[column] = stage_df[column].map(normalize_text)

    stage_df = stage_df[COMMON_STAGE_COLUMNS].copy()
    return stage_df, processed_dates, files


def sql_literal_path(path: Path) -> str:
    return str(path).replace("\\", "/").replace("'", "''")


def build_common_stage_table_sql(temp_table: str, csv_path: Path) -> str:
    copy_path = sql_literal_path(csv_path)
    return f"""DROP TABLE IF EXISTS {temp_table};
CREATE TEMP TABLE {temp_table} (
    stat_date date NOT NULL,
    offer_type varchar(20) NOT NULL,
    category varchar(20) NOT NULL,
    country varchar(100),
    factory_no varchar(100),
    product_name varchar(200),
    has_price boolean NOT NULL,
    avg_price numeric(10,4),
    price_min numeric(10,4),
    price_max numeric(10,4),
    merchant_phone varchar(100),
    merchant_name varchar(200),
    source_id varchar(200)
);

-- 执行前请把下面 \\copy 路径改成服务器上的真实路径
-- \\copy {temp_table} FROM '{copy_path}' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
"""


def build_merchant_match_sql(stage_alias: str = "t") -> str:
    return f"""COALESCE(
        (
            SELECT dm.merchant_id
            FROM dict_merchant dm
            WHERE NULLIF({stage_alias}.merchant_phone, '') IS NOT NULL
              AND dm.contact_phone = {stage_alias}.merchant_phone
            ORDER BY dm.merchant_id
            LIMIT 1
        ),
        (
            SELECT dm2.merchant_id
            FROM dict_merchant dm2
            WHERE NULLIF({stage_alias}.merchant_name, '') IS NOT NULL
              AND (
                    dm2.merchant_name = {stage_alias}.merchant_name
                 OR dm2.merchant_short_name = {stage_alias}.merchant_name
              )
            ORDER BY dm2.merchant_id
            LIMIT 1
        )
    )"""


def capped_diff_sql(diff_expr: str) -> str:
    return (
        f"CASE WHEN {diff_expr} IS NULL THEN NULL "
        f"WHEN ABS({diff_expr}) > 999.99 THEN ROUND(SIGN({diff_expr}) * 999.99, 2) "
        f"ELSE ROUND(({diff_expr})::numeric, 2) END"
    )


def capped_rate_sql(rate_expr: str) -> str:
    return (
        f"CASE WHEN {rate_expr} IS NULL THEN NULL "
        f"WHEN ABS({rate_expr}) > 999.99 THEN ROUND(SIGN({rate_expr}) * 999.99, 2) "
        f"ELSE ROUND(({rate_expr})::numeric, 2) END"
    )


def build_stat_price_trend_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_price_trend_import"
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE t.has_price = TRUE
  AND NULLIF(t.country, '') IS NOT NULL
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

WITH base AS (
    SELECT
        stat_date,
        offer_type,
        category,
        NULLIF(country, '') AS country,
        COALESCE(factory_no, '') AS factory_no,
        product_name,
        avg_price
    FROM {temp_table}
    WHERE has_price = TRUE
      AND NULLIF(country, '') IS NOT NULL
      AND NULLIF(product_name, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        offer_type,
        category,
        country,
        '' AS factory_no,
        product_name,
        'country_product' AS dimension_type,
        ROUND(AVG(avg_price)::numeric, 2) AS avg_price
    FROM base
    GROUP BY stat_date, offer_type, category, country, product_name
    UNION ALL
    SELECT
        stat_date,
        offer_type,
        category,
        country,
        factory_no,
        product_name,
        'country_factory_product' AS dimension_type,
        ROUND(AVG(avg_price)::numeric, 2) AS avg_price
    FROM base
    WHERE factory_no <> ''
    GROUP BY stat_date, offer_type, category, country, factory_no, product_name
)
INSERT INTO public.stat_price_trend (
    stat_date,
    dimension_type,
    country,
    product_id,
    product_name,
    factory_no,
    offer_type,
    avg_price,
    record_date
)
SELECT
    a.stat_date,
    a.dimension_type,
    a.country,
    p.product_id,
    a.product_name,
    a.factory_no,
    a.offer_type,
    a.avg_price,
    CURRENT_DATE
FROM agg a
JOIN dict_product p
  ON p.category = a.category
 AND p.product_name = a.product_name
ON CONFLICT (stat_date, dimension_type, country, product_id, factory_no, offer_type)
DO UPDATE SET
    avg_price = EXCLUDED.avg_price,
    updated_at = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_price_trend
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_brand_product_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_brand_product_import"
    prev_avg = "COALESCE(prev_tmp.avg_price, prev_db.avg_price)"
    diff_expr = f"(s.avg_price - {prev_avg})"
    rate_expr = f"(({diff_expr}) / NULLIF({prev_avg}, 0) * 100)"
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.category,
    t.country,
    t.factory_no,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN LATERAL (
    SELECT b.brand_id
    FROM dict_brand b
    WHERE b.country = t.country
      AND b.factory_no = t.factory_no
      AND (b.category = t.category OR b.category IS NULL OR b.category = '')
    ORDER BY CASE WHEN b.category = t.category THEN 0 ELSE 1 END, b.brand_id
    LIMIT 1
) b ON TRUE
WHERE t.offer_type = '报盘'
  AND t.has_price = TRUE
  AND NULLIF(t.country, '') IS NOT NULL
  AND NULLIF(t.factory_no, '') IS NOT NULL
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND b.brand_id IS NULL
GROUP BY t.category, t.country, t.factory_no
ORDER BY row_count DESC, t.category, t.country, t.factory_no;

SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE t.offer_type = '报盘'
  AND t.has_price = TRUE
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        t.country,
        t.factory_no,
        t.product_name,
        t.avg_price,
        t.price_min,
        t.price_max,
        b.brand_id,
        COALESCE(NULLIF(REPLACE(b.brand_name, ' ', ''), ''), t.country || ' ' || t.factory_no) AS brand_name,
        COALESCE(b.factory_id::text, t.country || '|' || t.factory_no) AS factory_key,
        p.product_id,
        p.product_name AS canonical_product_name
    FROM {temp_table} t
    JOIN LATERAL (
        SELECT b.brand_id, b.brand_name, b.factory_id
        FROM dict_brand b
        WHERE b.country = t.country
          AND b.factory_no = t.factory_no
          AND (b.category = t.category OR b.category IS NULL OR b.category = '')
        ORDER BY CASE WHEN b.category = t.category THEN 0 ELSE 1 END, b.brand_id
        LIMIT 1
    ) b ON TRUE
    JOIN dict_product p
      ON p.category = t.category
     AND p.product_name = t.product_name
    WHERE t.offer_type = '报盘'
      AND t.has_price = TRUE
      AND NULLIF(t.country, '') IS NOT NULL
      AND NULLIF(t.factory_no, '') IS NOT NULL
      AND NULLIF(t.product_name, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        brand_id,
        MAX(brand_name) AS brand_name,
        product_id,
        MAX(canonical_product_name) AS product_name,
        category,
        COUNT(DISTINCT factory_key)::integer AS today_factory_count,
        COUNT(*)::integer AS today_offer_count,
        ROUND(MIN(price_min)::numeric, 2) AS price_min,
        ROUND(MAX(price_max)::numeric, 2) AS price_max,
        ROUND(AVG(avg_price)::numeric, 2) AS avg_price
    FROM matched
    GROUP BY stat_date, brand_id, product_id, category
)
INSERT INTO public.stat_brand_product (
    stat_date,
    brand_id,
    brand_name,
    product_id,
    product_name,
    category,
    today_factory_count,
    today_offer_count,
    price_min,
    price_max,
    avg_price,
    avg_price_yesterday,
    price_change,
    price_change_rate,
    update_time
)
SELECT
    s.stat_date,
    s.brand_id,
    s.brand_name,
    s.product_id,
    s.product_name,
    s.category,
    s.today_factory_count,
    s.today_offer_count,
    s.price_min,
    s.price_max,
    s.avg_price,
    {prev_avg} AS avg_price_yesterday,
    {capped_diff_sql(diff_expr)} AS price_change,
    {capped_rate_sql(rate_expr)} AS price_change_rate,
    CURRENT_TIMESTAMP
FROM agg s
LEFT JOIN agg prev_tmp
  ON prev_tmp.stat_date = s.stat_date - INTERVAL '1 day'
 AND prev_tmp.brand_id = s.brand_id
 AND prev_tmp.product_id = s.product_id
 AND prev_tmp.category = s.category
LEFT JOIN public.stat_brand_product prev_db
  ON prev_db.stat_date = s.stat_date - INTERVAL '1 day'
 AND prev_db.brand_id = s.brand_id
 AND prev_db.product_id = s.product_id
 AND prev_db.category = s.category
ON CONFLICT (stat_date, brand_id, product_id, category)
DO UPDATE SET
    brand_name = EXCLUDED.brand_name,
    product_name = EXCLUDED.product_name,
    today_factory_count = EXCLUDED.today_factory_count,
    today_offer_count = EXCLUDED.today_offer_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    avg_price = EXCLUDED.avg_price,
    avg_price_yesterday = EXCLUDED.avg_price_yesterday,
    price_change = EXCLUDED.price_change,
    price_change_rate = EXCLUDED.price_change_rate,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_brand_product
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_product_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_product_import"
    merchant_expr = build_merchant_match_sql("t")
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE t.offer_type = '报盘'
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        p.product_id,
        p.product_name AS canonical_product_name,
        {merchant_expr} AS merchant_id,
        CASE
            WHEN NULLIF(t.country, '') IS NOT NULL AND NULLIF(t.factory_no, '') IS NOT NULL THEN
                (
                    SELECT f.factory_id
                    FROM dict_factory f
                    WHERE f.country = t.country
                      AND f.factory_no = t.factory_no
                      AND (f.category = t.category OR f.category IS NULL OR f.category = '')
                    ORDER BY CASE WHEN f.category = t.category THEN 0 ELSE 1 END, f.factory_id
                    LIMIT 1
                )
            ELSE NULL
        END AS factory_id,
        t.has_price,
        t.price_min,
        t.price_max
    FROM {temp_table} t
    JOIN dict_product p
      ON p.category = t.category
     AND p.product_name = t.product_name
    WHERE t.offer_type = '报盘'
      AND NULLIF(t.product_name, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        product_id,
        MAX(canonical_product_name) AS product_name,
        CASE
            WHEN BOOL_OR(category = '牛') THEN '牛'
            WHEN BOOL_OR(category = '猪') THEN '猪'
            ELSE MIN(category)
        END AS category,
        COUNT(*)::integer AS today_offer_count,
        0::integer AS today_inquiry_count,
        COUNT(DISTINCT merchant_id)::integer AS today_merchant_count,
        COUNT(DISTINCT factory_id)::integer AS today_factory_count,
        ROUND(MIN(price_min) FILTER (WHERE has_price = TRUE)::numeric, 2) AS price_min,
        ROUND(MAX(price_max) FILTER (WHERE has_price = TRUE)::numeric, 2) AS price_max
    FROM matched
    GROUP BY stat_date, product_id
)
INSERT INTO public.stat_product (
    stat_date,
    category,
    product_id,
    product_name,
    today_offer_count,
    today_inquiry_count,
    today_merchant_count,
    today_factory_count,
    price_min,
    price_max,
    update_time
)
SELECT
    stat_date,
    category,
    product_id,
    product_name,
    today_offer_count,
    today_inquiry_count,
    today_merchant_count,
    today_factory_count,
    price_min,
    price_max,
    CURRENT_TIMESTAMP
FROM agg
ON CONFLICT (stat_date, product_id)
DO UPDATE SET
    category = EXCLUDED.category,
    today_offer_count = EXCLUDED.today_offer_count,
    today_inquiry_count = EXCLUDED.today_inquiry_count,
    today_merchant_count = EXCLUDED.today_merchant_count,
    today_factory_count = EXCLUDED.today_factory_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_product
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_country_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_country_import"
    merchant_expr = build_merchant_match_sql("t")
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        t.country,
        t.factory_no,
        t.product_name,
        {merchant_expr} AS merchant_id
    FROM {temp_table} t
    WHERE t.offer_type = '报盘'
      AND NULLIF(t.country, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        category,
        country,
        COUNT(*)::integer AS today_offer_count,
        0::integer AS today_inquiry_count,
        COUNT(DISTINCT NULLIF(factory_no, ''))::integer AS today_factory_count,
        COUNT(DISTINCT merchant_id)::integer AS today_merchant_count
    FROM matched
    GROUP BY stat_date, category, country
),
hot_factories AS (
    SELECT
        stat_date,
        category,
        country,
        '[' || STRING_AGG(
            json_build_object('factoryNo', factory_no, 'offerCount', offer_count)::text,
            ',' ORDER BY offer_count DESC, factory_no
        ) || ']' AS hot_factories
    FROM (
        SELECT
            stat_date,
            category,
            country,
            factory_no,
            COUNT(*) AS offer_count,
            ROW_NUMBER() OVER (
                PARTITION BY stat_date, category, country
                ORDER BY COUNT(*) DESC, factory_no
            ) AS rn
        FROM matched
        WHERE NULLIF(factory_no, '') IS NOT NULL
        GROUP BY stat_date, category, country, factory_no
    ) s
    WHERE rn <= 3
    GROUP BY stat_date, category, country
),
hot_products AS (
    SELECT
        stat_date,
        category,
        country,
        '[' || STRING_AGG(
            json_build_object('productName', product_name, 'offerCount', offer_count)::text,
            ',' ORDER BY offer_count DESC, product_name
        ) || ']' AS hot_products
    FROM (
        SELECT
            stat_date,
            category,
            country,
            product_name,
            COUNT(*) AS offer_count,
            ROW_NUMBER() OVER (
                PARTITION BY stat_date, category, country
                ORDER BY COUNT(*) DESC, product_name
            ) AS rn
        FROM matched
        WHERE NULLIF(product_name, '') IS NOT NULL
        GROUP BY stat_date, category, country, product_name
    ) s
    WHERE rn <= 3
    GROUP BY stat_date, category, country
)
INSERT INTO public.stat_country (
    stat_date,
    category,
    country,
    today_offer_count,
    today_inquiry_count,
    today_factory_count,
    today_merchant_count,
    hot_factories,
    hot_products,
    update_time
)
SELECT
    a.stat_date,
    a.category,
    a.country,
    a.today_offer_count,
    a.today_inquiry_count,
    a.today_factory_count,
    a.today_merchant_count,
    COALESCE(hf.hot_factories, '[]'),
    COALESCE(hp.hot_products, '[]'),
    CURRENT_TIMESTAMP
FROM agg a
LEFT JOIN hot_factories hf
  ON hf.stat_date = a.stat_date
 AND hf.category = a.category
 AND hf.country = a.country
LEFT JOIN hot_products hp
  ON hp.stat_date = a.stat_date
 AND hp.category = a.category
 AND hp.country = a.country
ON CONFLICT (stat_date, country, category)
DO UPDATE SET
    today_offer_count = EXCLUDED.today_offer_count,
    today_inquiry_count = EXCLUDED.today_inquiry_count,
    today_factory_count = EXCLUDED.today_factory_count,
    today_merchant_count = EXCLUDED.today_merchant_count,
    hot_factories = EXCLUDED.hot_factories,
    hot_products = EXCLUDED.hot_products,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_country
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_factory_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_factory_import"
    merchant_expr = build_merchant_match_sql("t")
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.category,
    t.country,
    t.factory_no,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN LATERAL (
    SELECT f.factory_id
    FROM dict_factory f
    WHERE f.country = t.country
      AND f.factory_no = t.factory_no
      AND (f.category = t.category OR f.category IS NULL OR f.category = '')
    ORDER BY CASE WHEN f.category = t.category THEN 0 ELSE 1 END, f.factory_id
    LIMIT 1
) f ON TRUE
WHERE NULLIF(t.country, '') IS NOT NULL
  AND NULLIF(t.factory_no, '') IS NOT NULL
  AND f.factory_id IS NULL
GROUP BY t.category, t.country, t.factory_no
ORDER BY row_count DESC, t.category, t.country, t.factory_no;

WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        t.country,
        t.factory_no,
        f.factory_id,
        {merchant_expr} AS merchant_id,
        t.offer_type,
        t.has_price,
        t.price_min,
        t.price_max
    FROM {temp_table} t
    JOIN LATERAL (
        SELECT f.factory_id
        FROM dict_factory f
        WHERE f.country = t.country
          AND f.factory_no = t.factory_no
          AND (f.category = t.category OR f.category IS NULL OR f.category = '')
        ORDER BY CASE WHEN f.category = t.category THEN 0 ELSE 1 END, f.factory_id
        LIMIT 1
    ) f ON TRUE
    WHERE NULLIF(t.country, '') IS NOT NULL
      AND NULLIF(t.factory_no, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        category,
        country,
        factory_no,
        factory_id,
        COUNT(*) FILTER (WHERE offer_type = '报盘')::integer AS today_offer_count,
        COUNT(*) FILTER (WHERE offer_type = '求购')::integer AS today_inquiry_count,
        COUNT(DISTINCT merchant_id) FILTER (WHERE offer_type = '报盘')::integer AS today_merchant_count,
        ROUND(MIN(price_min) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS price_min,
        ROUND(MAX(price_max) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS price_max
    FROM matched
    GROUP BY stat_date, category, country, factory_no, factory_id
)
INSERT INTO public.stat_factory (
    stat_date,
    category,
    country,
    factory_no,
    factory_id,
    today_offer_count,
    today_inquiry_count,
    today_merchant_count,
    price_min,
    price_max,
    update_time
)
SELECT
    stat_date,
    category,
    country,
    factory_no,
    factory_id,
    today_offer_count,
    today_inquiry_count,
    today_merchant_count,
    price_min,
    price_max,
    CURRENT_TIMESTAMP
FROM agg
WHERE today_offer_count > 0 OR today_inquiry_count > 0
ON CONFLICT (stat_date, factory_id, category)
DO UPDATE SET
    today_offer_count = EXCLUDED.today_offer_count,
    today_inquiry_count = EXCLUDED.today_inquiry_count,
    today_merchant_count = EXCLUDED.today_merchant_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_factory
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_brand_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_brand_import"
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.category,
    t.country,
    t.factory_no,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN LATERAL (
    SELECT b.brand_id
    FROM dict_brand b
    WHERE b.country = t.country
      AND b.factory_no = t.factory_no
      AND (b.category = t.category OR b.category IS NULL OR b.category = '')
    ORDER BY CASE WHEN b.category = t.category THEN 0 ELSE 1 END, b.brand_id
    LIMIT 1
) b ON TRUE
WHERE t.offer_type = '报盘'
  AND NULLIF(t.country, '') IS NOT NULL
  AND NULLIF(t.factory_no, '') IS NOT NULL
  AND b.brand_id IS NULL
GROUP BY t.category, t.country, t.factory_no
ORDER BY row_count DESC, t.category, t.country, t.factory_no;

SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE t.offer_type = '报盘'
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        t.factory_no,
        t.product_name,
        t.has_price,
        t.price_min,
        t.price_max,
        b.brand_id,
        COALESCE(NULLIF(REPLACE(b.brand_name, ' ', ''), ''), t.country || ' ' || t.factory_no) AS brand_name,
        p.product_id
    FROM {temp_table} t
    JOIN LATERAL (
        SELECT b.brand_id, b.brand_name
        FROM dict_brand b
        WHERE b.country = t.country
          AND b.factory_no = t.factory_no
          AND (b.category = t.category OR b.category IS NULL OR b.category = '')
        ORDER BY CASE WHEN b.category = t.category THEN 0 ELSE 1 END, b.brand_id
        LIMIT 1
    ) b ON TRUE
    LEFT JOIN dict_product p
      ON p.category = t.category
     AND p.product_name = t.product_name
    WHERE t.offer_type = '报盘'
      AND NULLIF(t.country, '') IS NOT NULL
      AND NULLIF(t.factory_no, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        brand_id,
        MAX(brand_name) AS brand_name,
        category,
        COUNT(*)::integer AS today_offer_count,
        COUNT(DISTINCT NULLIF(factory_no, ''))::integer AS today_factory_count,
        COUNT(DISTINCT product_id)::integer AS today_product_count,
        ROUND(MIN(price_min) FILTER (WHERE has_price = TRUE)::numeric, 2) AS price_min,
        ROUND(MAX(price_max) FILTER (WHERE has_price = TRUE)::numeric, 2) AS price_max
    FROM matched
    GROUP BY stat_date, brand_id, category
)
INSERT INTO public.stat_brand (
    stat_date,
    brand_id,
    brand_name,
    category,
    today_offer_count,
    today_factory_count,
    today_product_count,
    price_min,
    price_max,
    update_time
)
SELECT
    stat_date,
    brand_id,
    brand_name,
    category,
    today_offer_count,
    today_factory_count,
    today_product_count,
    price_min,
    price_max,
    CURRENT_TIMESTAMP
FROM agg
ON CONFLICT (stat_date, brand_id, category)
DO UPDATE SET
    brand_name = EXCLUDED.brand_name,
    today_offer_count = EXCLUDED.today_offer_count,
    today_factory_count = EXCLUDED.today_factory_count,
    today_product_count = EXCLUDED.today_product_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_brand
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_country_product_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_country_product_import"
    prev_avg = "COALESCE(prev_tmp.avg_price, prev_db.avg_price)"
    diff_expr = f"(s.avg_price - {prev_avg})"
    rate_expr = f"(({diff_expr}) / NULLIF({prev_avg}, 0) * 100)"
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE NULLIF(t.country, '') IS NOT NULL
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        t.country,
        p.product_id,
        p.product_name AS canonical_product_name,
        t.offer_type,
        t.has_price,
        t.avg_price,
        t.price_min,
        t.price_max,
        CASE
            WHEN NULLIF(t.country, '') IS NOT NULL AND NULLIF(t.factory_no, '') IS NOT NULL THEN
                (
                    SELECT f.factory_id
                    FROM dict_factory f
                    WHERE f.country = t.country
                      AND f.factory_no = t.factory_no
                      AND (f.category = t.category OR f.category IS NULL OR f.category = '')
                    ORDER BY CASE WHEN f.category = t.category THEN 0 ELSE 1 END, f.factory_id
                    LIMIT 1
                )
            ELSE NULL
        END AS factory_id
    FROM {temp_table} t
    JOIN dict_product p
      ON p.category = t.category
     AND p.product_name = t.product_name
    WHERE NULLIF(t.country, '') IS NOT NULL
      AND NULLIF(t.product_name, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        category,
        country,
        product_id,
        MAX(canonical_product_name) AS product_name,
        COUNT(*) FILTER (WHERE offer_type = '报盘')::integer AS today_offer_count,
        COUNT(*) FILTER (WHERE offer_type = '求购')::integer AS today_inquiry_count,
        COUNT(DISTINCT factory_id) FILTER (WHERE offer_type = '报盘')::integer AS today_factory_count,
        ROUND(MIN(price_min) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS price_min,
        ROUND(MAX(price_max) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS price_max,
        ROUND(AVG(avg_price) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS avg_price
    FROM matched
    GROUP BY stat_date, category, country, product_id
)
INSERT INTO public.stat_country_product (
    stat_date,
    category,
    country,
    product_id,
    product_name,
    today_offer_count,
    today_inquiry_count,
    today_factory_count,
    price_min,
    price_max,
    avg_price,
    avg_price_yesterday,
    price_change,
    price_change_rate,
    update_time
)
SELECT
    s.stat_date,
    s.category,
    s.country,
    s.product_id,
    s.product_name,
    s.today_offer_count,
    s.today_inquiry_count,
    s.today_factory_count,
    s.price_min,
    s.price_max,
    s.avg_price,
    {prev_avg} AS avg_price_yesterday,
    {capped_diff_sql(diff_expr)} AS price_change,
    {capped_rate_sql(rate_expr)} AS price_change_rate,
    CURRENT_TIMESTAMP
FROM agg s
LEFT JOIN agg prev_tmp
  ON prev_tmp.stat_date = s.stat_date - INTERVAL '1 day'
 AND prev_tmp.country = s.country
 AND prev_tmp.product_id = s.product_id
 AND prev_tmp.category = s.category
LEFT JOIN public.stat_country_product prev_db
  ON prev_db.stat_date = s.stat_date - INTERVAL '1 day'
 AND prev_db.country = s.country
 AND prev_db.product_id = s.product_id
 AND prev_db.category = s.category
WHERE s.today_offer_count > 0
ON CONFLICT (stat_date, country, product_id, category)
DO UPDATE SET
    product_name = EXCLUDED.product_name,
    today_offer_count = EXCLUDED.today_offer_count,
    today_inquiry_count = EXCLUDED.today_inquiry_count,
    today_factory_count = EXCLUDED.today_factory_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    avg_price = EXCLUDED.avg_price,
    avg_price_yesterday = EXCLUDED.avg_price_yesterday,
    price_change = EXCLUDED.price_change,
    price_change_rate = EXCLUDED.price_change_rate,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_country_product
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_factory_product_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_factory_product_import"
    prev_avg = "COALESCE(prev_tmp.avg_price, prev_db.avg_price)"
    diff_expr = f"(s.avg_price - {prev_avg})"
    rate_expr = f"(({diff_expr}) / NULLIF({prev_avg}, 0) * 100)"
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.category,
    t.country,
    t.factory_no,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN LATERAL (
    SELECT f.factory_id
    FROM dict_factory f
    WHERE f.country = t.country
      AND f.factory_no = t.factory_no
      AND (f.category = t.category OR f.category IS NULL OR f.category = '')
    ORDER BY CASE WHEN f.category = t.category THEN 0 ELSE 1 END, f.factory_id
    LIMIT 1
) f ON TRUE
WHERE NULLIF(t.country, '') IS NOT NULL
  AND NULLIF(t.factory_no, '') IS NOT NULL
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND f.factory_id IS NULL
GROUP BY t.category, t.country, t.factory_no
ORDER BY row_count DESC, t.category, t.country, t.factory_no;

SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE NULLIF(t.country, '') IS NOT NULL
  AND NULLIF(t.factory_no, '') IS NOT NULL
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        t.country,
        t.factory_no,
        f.factory_id,
        p.product_id,
        p.product_name AS canonical_product_name,
        t.offer_type,
        t.has_price,
        t.avg_price,
        t.price_min,
        t.price_max
    FROM {temp_table} t
    JOIN LATERAL (
        SELECT f.factory_id
        FROM dict_factory f
        WHERE f.country = t.country
          AND f.factory_no = t.factory_no
          AND (f.category = t.category OR f.category IS NULL OR f.category = '')
        ORDER BY CASE WHEN f.category = t.category THEN 0 ELSE 1 END, f.factory_id
        LIMIT 1
    ) f ON TRUE
    JOIN dict_product p
      ON p.category = t.category
     AND p.product_name = t.product_name
    WHERE NULLIF(t.country, '') IS NOT NULL
      AND NULLIF(t.factory_no, '') IS NOT NULL
      AND NULLIF(t.product_name, '') IS NOT NULL
),
agg AS (
    SELECT
        stat_date,
        factory_id,
        MAX(factory_no) AS factory_no,
        MAX(country) AS country,
        product_id,
        MAX(canonical_product_name) AS product_name,
        category,
        COUNT(*) FILTER (WHERE offer_type = '报盘')::integer AS today_offer_count,
        COUNT(*) FILTER (WHERE offer_type = '求购')::integer AS today_inquiry_count,
        ROUND(MIN(price_min) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS price_min,
        ROUND(MAX(price_max) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS price_max,
        ROUND(AVG(avg_price) FILTER (WHERE offer_type = '报盘' AND has_price = TRUE)::numeric, 2) AS avg_price
    FROM matched
    GROUP BY stat_date, factory_id, product_id, category
)
INSERT INTO public.stat_factory_product (
    stat_date,
    factory_id,
    factory_no,
    country,
    product_id,
    product_name,
    category,
    today_offer_count,
    today_inquiry_count,
    price_min,
    price_max,
    avg_price,
    avg_price_yesterday,
    price_change,
    price_change_rate,
    update_time
)
SELECT
    s.stat_date,
    s.factory_id,
    s.factory_no,
    s.country,
    s.product_id,
    s.product_name,
    s.category,
    s.today_offer_count,
    s.today_inquiry_count,
    s.price_min,
    s.price_max,
    s.avg_price,
    {prev_avg} AS avg_price_yesterday,
    {capped_diff_sql(diff_expr)} AS price_change,
    {capped_rate_sql(rate_expr)} AS price_change_rate,
    CURRENT_TIMESTAMP
FROM agg s
LEFT JOIN agg prev_tmp
  ON prev_tmp.stat_date = s.stat_date - INTERVAL '1 day'
 AND prev_tmp.factory_id = s.factory_id
 AND prev_tmp.product_id = s.product_id
 AND prev_tmp.category = s.category
LEFT JOIN public.stat_factory_product prev_db
  ON prev_db.stat_date = s.stat_date - INTERVAL '1 day'
 AND prev_db.factory_id = s.factory_id
 AND prev_db.product_id = s.product_id
 AND prev_db.category = s.category
WHERE s.today_offer_count > 0
ON CONFLICT (stat_date, factory_id, product_id, category)
DO UPDATE SET
    factory_no = EXCLUDED.factory_no,
    country = EXCLUDED.country,
    product_name = EXCLUDED.product_name,
    today_offer_count = EXCLUDED.today_offer_count,
    today_inquiry_count = EXCLUDED.today_inquiry_count,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    avg_price = EXCLUDED.avg_price,
    avg_price_yesterday = EXCLUDED.avg_price_yesterday,
    price_change = EXCLUDED.price_change,
    price_change_rate = EXCLUDED.price_change_rate,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_factory_product
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def build_stat_merchant_sql(fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    temp_table = "tmp_stat_merchant_import"
    merchant_expr = build_merchant_match_sql("t")
    return (
        build_common_stage_table_sql(temp_table, fileset.csv_path)
        + f"""
SELECT
    t.merchant_phone,
    t.merchant_name,
    COUNT(*) AS row_count
FROM {temp_table} t
WHERE ({merchant_expr}) IS NULL
  AND (NULLIF(t.merchant_phone, '') IS NOT NULL OR NULLIF(t.merchant_name, '') IS NOT NULL)
GROUP BY t.merchant_phone, t.merchant_name
ORDER BY row_count DESC, t.merchant_phone, t.merchant_name;

SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM {temp_table} t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE t.offer_type = '报盘'
  AND NULLIF(t.product_name, '') IS NOT NULL
  AND p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

WITH matched AS (
    SELECT
        t.stat_date,
        t.category,
        {merchant_expr} AS merchant_id,
        t.offer_type,
        CASE
            WHEN NULLIF(t.product_name, '') IS NOT NULL THEN
                (
                    SELECT p.product_id
                    FROM dict_product p
                    WHERE p.category = t.category
                      AND p.product_name = t.product_name
                    ORDER BY p.product_id
                    LIMIT 1
                )
            ELSE NULL
        END AS product_id,
        CASE
            WHEN NULLIF(t.country, '') IS NOT NULL AND NULLIF(t.factory_no, '') IS NOT NULL THEN
                (
                    SELECT f.factory_id
                    FROM dict_factory f
                    WHERE f.country = t.country
                      AND f.factory_no = t.factory_no
                      AND (f.category = t.category OR f.category IS NULL OR f.category = '')
                    ORDER BY CASE WHEN f.category = t.category THEN 0 ELSE 1 END, f.factory_id
                    LIMIT 1
                )
            ELSE NULL
        END AS factory_id
    FROM {temp_table} t
),
agg AS (
    SELECT
        stat_date,
        merchant_id,
        category,
        COUNT(*) FILTER (WHERE offer_type = '报盘')::integer AS today_offer_count,
        COUNT(*) FILTER (WHERE offer_type = '求购')::integer AS today_inquiry_count,
        COUNT(DISTINCT product_id) FILTER (WHERE offer_type = '报盘')::integer AS today_product_count,
        COUNT(DISTINCT factory_id) FILTER (WHERE offer_type = '报盘')::integer AS today_factory_count
    FROM matched
    WHERE merchant_id IS NOT NULL
    GROUP BY stat_date, merchant_id, category
)
INSERT INTO public.stat_merchant (
    stat_date,
    merchant_id,
    category,
    today_offer_count,
    today_inquiry_count,
    today_product_count,
    today_factory_count,
    update_time
)
SELECT
    stat_date,
    merchant_id,
    category,
    today_offer_count,
    today_inquiry_count,
    today_product_count,
    today_factory_count,
    CURRENT_TIMESTAMP
FROM agg
ON CONFLICT (stat_date, merchant_id, category)
DO UPDATE SET
    today_offer_count = EXCLUDED.today_offer_count,
    today_inquiry_count = EXCLUDED.today_inquiry_count,
    today_product_count = EXCLUDED.today_product_count,
    today_factory_count = EXCLUDED.today_factory_count,
    update_time = CURRENT_TIMESTAMP;

SELECT COUNT(*) AS imported_rows
FROM public.stat_merchant
WHERE stat_date BETWEEN DATE '{start_date}' AND DATE '{end_date}';
"""
    )


def table_output_files(output_dir: Path, table_name: str) -> OutputFileSet:
    return OutputFileSet(
        csv_path=output_dir / f"{table_name}_import_ready.csv",
        sql_path=output_dir / f"{table_name}_import.sql",
        readme_path=output_dir / f"{table_name}_import_README.txt",
    )


def build_sql_for_table(table_name: str, fileset: OutputFileSet, start_date: str, end_date: str) -> str:
    builders = {
        "stat_price_trend": build_stat_price_trend_sql,
        "stat_brand_product": build_stat_brand_product_sql,
        "stat_product": build_stat_product_sql,
        "stat_country": build_stat_country_sql,
        "stat_factory": build_stat_factory_sql,
        "stat_brand": build_stat_brand_sql,
        "stat_country_product": build_stat_country_product_sql,
        "stat_factory_product": build_stat_factory_product_sql,
        "stat_merchant": build_stat_merchant_sql,
    }
    return builders[table_name](fileset, start_date, end_date)


def compute_preview_counts(stage_df: pd.DataFrame) -> dict[str, int]:
    offer_df = stage_df[stage_df["offer_type"] == "报盘"].copy()
    priced_offer_df = offer_df[offer_df["has_price"]].copy()
    priced_df = stage_df[stage_df["has_price"]].copy()

    counts: dict[str, int] = {}
    counts["stat_price_trend"] = int(
        priced_df[priced_df["country"].ne("") & priced_df["product_name"].ne("")][
            ["stat_date", "offer_type", "category", "country", "product_name"]
        ]
        .drop_duplicates()
        .shape[0]
        + priced_df[
            priced_df["country"].ne("") & priced_df["factory_no"].ne("") & priced_df["product_name"].ne("")
        ][["stat_date", "offer_type", "category", "country", "factory_no", "product_name"]]
        .drop_duplicates()
        .shape[0]
    )
    counts["stat_brand_product"] = int(
        priced_offer_df[
            priced_offer_df["country"].ne("") & priced_offer_df["factory_no"].ne("") & priced_offer_df["product_name"].ne("")
        ][["stat_date", "category", "country", "factory_no", "product_name"]]
        .drop_duplicates()
        .shape[0]
    )
    counts["stat_product"] = int(offer_df[offer_df["product_name"].ne("")][["stat_date", "product_name"]].drop_duplicates().shape[0])
    counts["stat_country"] = int(offer_df[offer_df["country"].ne("")][["stat_date", "category", "country"]].drop_duplicates().shape[0])
    counts["stat_factory"] = int(stage_df[stage_df["country"].ne("") & stage_df["factory_no"].ne("")][["stat_date", "category", "country", "factory_no"]].drop_duplicates().shape[0])
    counts["stat_brand"] = int(offer_df[offer_df["country"].ne("") & offer_df["factory_no"].ne("")][["stat_date", "category", "country", "factory_no"]].drop_duplicates().shape[0])
    counts["stat_country_product"] = int(stage_df[stage_df["country"].ne("") & stage_df["product_name"].ne("")][["stat_date", "category", "country", "product_name"]].drop_duplicates().shape[0])
    counts["stat_factory_product"] = int(stage_df[stage_df["country"].ne("") & stage_df["factory_no"].ne("") & stage_df["product_name"].ne("")][["stat_date", "category", "country", "factory_no", "product_name"]].drop_duplicates().shape[0])
    counts["stat_merchant"] = int(stage_df[(stage_df["merchant_phone"].ne("")) | (stage_df["merchant_name"].ne(""))][["stat_date", "category", "merchant_phone", "merchant_name"]].drop_duplicates().shape[0])
    return counts


def build_raw_issue_frames(stage_df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    offer_df = stage_df[stage_df["offer_type"] == "报盘"].copy()
    priced_offer_df = offer_df[offer_df["has_price"]].copy()

    raw_issues: dict[str, pd.DataFrame] = {}
    raw_issues["raw_missing_product_keys"] = stage_df[stage_df["product_name"].eq("")][
        ["stat_date", "offer_type", "category", "country", "factory_no", "merchant_phone", "merchant_name", "source_id"]
    ].drop_duplicates()
    raw_issues["raw_missing_brand_keys"] = priced_offer_df[
        priced_offer_df["country"].eq("") | priced_offer_df["factory_no"].eq("")
    ][["stat_date", "category", "country", "factory_no", "product_name", "source_id"]].drop_duplicates()
    raw_issues["raw_missing_merchant_keys"] = stage_df[
        stage_df["merchant_phone"].eq("") & stage_df["merchant_name"].eq("")
    ][["stat_date", "offer_type", "category", "country", "factory_no", "product_name", "source_id"]].drop_duplicates()
    raw_issues["raw_missing_price_for_offer"] = offer_df[offer_df["has_price"] == False][
        ["stat_date", "category", "country", "factory_no", "product_name", "merchant_phone", "merchant_name", "source_id"]
    ].drop_duplicates()
    return raw_issues


def write_readme(
    fileset: OutputFileSet,
    table_name: str,
    processed_dates: list[str],
    stage_row_count: int,
    estimated_final_count: int,
    raw_issue_counts: dict[str, int],
) -> None:
    text = f"""一、文件说明
1. {fileset.csv_path.name}
   - 这是 {table_name} 的导入准备文件
   - 文件内容为按项目现有统计逻辑整理过的源数据中间层
   - 部署机导入时由 SQL 再做字典匹配、聚合和 upsert
2. {fileset.sql_path.name}
   - 先创建临时表
   - 再通过 \\copy 导入 CSV
   - 再执行未匹配检查
   - 最后 upsert 到 public.{table_name}

二、本次处理日期
- 起始日期: {processed_dates[0]}
- 截止日期: {processed_dates[-1]}
- 实际处理天数: {len(processed_dates)}

三、数据规模
- 中间层记录数: {stage_row_count}
- 预计最终 upsert 行数(按自然键预估): {estimated_final_count}

四、导入说明
1. 先把 SQL 中的 \\copy 路径改成服务器所在电脑上的真实路径
2. 先执行 SQL 里的未匹配检查
3. 确认未匹配项可接受后，再执行正式 INSERT ... ON CONFLICT
4. 这套 SQL 只针对本次日期范围做增量更新，不会默认重算全部历史

五、源数据侧已发现的问题
- 缺产品名: {raw_issue_counts.get('raw_missing_product_keys', 0)}
- 缺品牌关键键(国家或厂号为空，影响品牌类统计): {raw_issue_counts.get('raw_missing_brand_keys', 0)}
- 缺商家关键键(手机号和商家名都为空): {raw_issue_counts.get('raw_missing_merchant_keys', 0)}
- 报盘缺报价: {raw_issue_counts.get('raw_missing_price_for_offer', 0)}

六、补充说明
- 真正的品牌/产品/商家/厂号字典未匹配结果，需要以部署机数据库中的 dict_* 表校验结果为准
- 本机这次没有直接连接项目数据库，因此 SQL 中已经内置未匹配检查语句
"""
    fileset.readme_path.write_text(text, encoding="utf-8")


def write_preview_workbook(
    output_dir: Path,
    stage_df: pd.DataFrame,
    processed_dates: list[str],
    preview_counts: dict[str, int],
    raw_issues: dict[str, pd.DataFrame],
) -> Path:
    preview_path = output_dir / "stat_history_preview.xlsx"
    summary_df = pd.DataFrame(
        {
            "item": ["processed_start", "processed_end", "processed_days", "stage_rows"]
            + [f"{name}_estimated_rows" for name in TABLES],
            "value": [processed_dates[0], processed_dates[-1], len(processed_dates), len(stage_df)]
            + [preview_counts[name] for name in TABLES],
        }
    )
    with pd.ExcelWriter(preview_path, engine="openpyxl") as writer:
        summary_df.to_excel(writer, index=False, sheet_name="summary")
        stage_df.head(1000).to_excel(writer, index=False, sheet_name="stage_sample")
        for sheet_name, frame in raw_issues.items():
            frame.head(1000).to_excel(writer, index=False, sheet_name=sheet_name[:31])
    return preview_path


def write_raw_issue_files(output_dir: Path, raw_issues: dict[str, pd.DataFrame]) -> list[Path]:
    paths: list[Path] = []
    for name, frame in raw_issues.items():
        path = output_dir / f"{name}.csv"
        frame.to_csv(path, index=False, encoding="utf-8-sig")
        paths.append(path)
    return paths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build MOOKET stat history import materials from Excel files.")
    parser.add_argument("--source-dir", required=True, help="Directory containing Excel files.")
    parser.add_argument("--start-date", required=True, help="Start date in YYYY-MM-DD.")
    parser.add_argument("--end-date", required=True, help="End date in YYYY-MM-DD.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_dir = Path(args.source_dir)
    start_date = args.start_date
    end_date = args.end_date

    if not source_dir.exists():
        raise SystemExit(f"目录不存在: {source_dir}")
    if start_date > end_date:
        raise SystemExit("start-date 不能晚于 end-date")

    stage_df, processed_dates, files = build_stage_df(source_dir, start_date, end_date)
    preview_counts = compute_preview_counts(stage_df)
    raw_issues = build_raw_issue_frames(stage_df)
    raw_issue_counts = {name: int(len(frame)) for name, frame in raw_issues.items()}

    for table_name in TABLES:
        fileset = table_output_files(source_dir, table_name)
        stage_df.to_csv(fileset.csv_path, index=False, encoding="utf-8-sig")
        fileset.sql_path.write_text(
            build_sql_for_table(table_name, fileset, processed_dates[0], processed_dates[-1]),
            encoding="utf-8",
        )
        write_readme(
            fileset=fileset,
            table_name=table_name,
            processed_dates=processed_dates,
            stage_row_count=len(stage_df),
            estimated_final_count=preview_counts[table_name],
            raw_issue_counts=raw_issue_counts,
        )

    preview_path = write_preview_workbook(source_dir, stage_df, processed_dates, preview_counts, raw_issues)
    raw_issue_paths = write_raw_issue_files(source_dir, raw_issues)

    result = {
        "processed_dates": processed_dates,
        "processed_file_count": len(files),
        "stage_rows": int(len(stage_df)),
        "estimated_rows": preview_counts,
        "raw_issue_counts": raw_issue_counts,
        "preview_path": str(preview_path),
        "raw_issue_files": [str(path) for path in raw_issue_paths],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
