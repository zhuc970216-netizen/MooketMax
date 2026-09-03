from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


SOURCE_DIR = Path(r"D:\数据_趋势图\30天报盘数据")
OUTPUT_DIR = SOURCE_DIR
PG_IMPORT_OUTPUT = OUTPUT_DIR / "stat_brand_product_import_ready.csv"
PG_IMPORT_SQL = OUTPUT_DIR / "stat_brand_product_import.sql"
PG_IMPORT_README = OUTPUT_DIR / "stat_brand_product_import_README.txt"
SUMMARY_OUTPUT = OUTPUT_DIR / "30天品牌产品趋势聚合表.xlsx"

DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")
PRICE_RE = re.compile(r"(-?\d+(?:\.\d+)?)")


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and pd.isna(value):
        return ""
    text = str(value).strip()
    if text.lower() == "nan":
        return ""
    return text


def parse_avg_price(value: object) -> float | None:
    text = normalize_text(value)
    if not text:
        return None
    normalized = text.replace("～", "-").replace("~", "-").replace("—", "-").replace("–", "-")
    numbers = [float(item) for item in PRICE_RE.findall(normalized)]
    if not numbers:
        return None
    if len(numbers) >= 2:
        return round(sum(numbers[:2]) / 2, 4)
    return round(numbers[0], 4)


def extract_date_from_name(file_name: str) -> str | None:
    match = DATE_RE.search(file_name)
    return match.group(1) if match else None


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

    work = df[required].copy()
    work["日期"] = trade_date

    for col in required:
        work[col] = work[col].map(normalize_text)

    work["平均报价"] = work["报价"].map(parse_avg_price)
    work = work[work["平均报价"].notna()].copy()
    work = work[work["类型"] == "报盘"].copy()
    work = work[(work["国家"] != "") & (work["厂号"] != "") & (work["产品"] != "")].copy()
    work["品牌名"] = work["国家"] + " " + work["厂号"]
    return work


def build_sql(min_date: str, max_date: str) -> str:
    return f"""-- 1) 创建临时导入表
DROP TABLE IF EXISTS tmp_stat_brand_product_import;
CREATE TEMP TABLE tmp_stat_brand_product_import (
    stat_date date NOT NULL,
    category varchar(10) NOT NULL,
    country varchar(50) NOT NULL,
    factory_no varchar(100) NOT NULL,
    brand_name varchar(150) NOT NULL,
    product_name varchar(100) NOT NULL,
    avg_price numeric(10,4),
    source_offer_count integer,
    source_min_price numeric(10,4),
    source_max_price numeric(10,4)
);

-- 2) 在 psql 中执行时，把下面路径替换成部署机本地实际路径
-- \\copy tmp_stat_brand_product_import FROM 'D:/数据_趋势图/30天报盘数据/stat_brand_product_import_ready.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- 3) 先检查品牌和产品的字典匹配情况
SELECT
    t.category,
    t.country,
    t.factory_no,
    t.brand_name,
    COUNT(*) AS row_count
FROM tmp_stat_brand_product_import t
LEFT JOIN dict_brand b
  ON b.country = t.country
 AND b.factory_no = t.factory_no
 AND (b.category = t.category OR b.category IS NULL OR b.category = '')
WHERE b.brand_id IS NULL
GROUP BY t.category, t.country, t.factory_no, t.brand_name
ORDER BY row_count DESC, t.category, t.country, t.factory_no;

SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM tmp_stat_brand_product_import t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

-- 4) 先把源数据聚合成品牌产品日统计
DROP TABLE IF EXISTS tmp_stat_brand_product_daily;
CREATE TEMP TABLE tmp_stat_brand_product_daily AS
SELECT
    t.stat_date,
    b.brand_id,
    COALESCE(NULLIF(b.brand_name, ''), t.brand_name) AS brand_name,
    p.product_id,
    p.product_name,
    t.category,
    COUNT(DISTINCT COALESCE(NULLIF(b.factory_id::text, ''), t.country || '|' || t.factory_no))::integer AS today_factory_count,
    SUM(t.source_offer_count)::integer AS today_offer_count,
    ROUND(MIN(t.source_min_price)::numeric, 2) AS price_min,
    ROUND(MAX(t.source_max_price)::numeric, 2) AS price_max,
    ROUND((SUM(t.avg_price * t.source_offer_count) / NULLIF(SUM(t.source_offer_count), 0))::numeric, 2) AS avg_price
FROM tmp_stat_brand_product_import t
JOIN dict_brand b
  ON b.country = t.country
 AND b.factory_no = t.factory_no
 AND (b.category = t.category OR b.category IS NULL OR b.category = '')
JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
GROUP BY t.stat_date, b.brand_id, COALESCE(NULLIF(b.brand_name, ''), t.brand_name), p.product_id, p.product_name, t.category;

-- 5) 带上昨日均价、涨跌额、涨跌幅，再正式写入
INSERT INTO public.stat_brand_product (
    stat_date,
    brand_id,
    brand_name,
    product_id,
    product_name,
    today_factory_count,
    today_offer_count,
    price_min,
    price_max,
    avg_price,
    avg_price_yesterday,
    price_change,
    price_change_rate,
    update_time,
    category
)
SELECT
    s.stat_date,
    s.brand_id,
    s.brand_name,
    s.product_id,
    s.product_name,
    s.today_factory_count,
    s.today_offer_count,
    s.price_min,
    s.price_max,
    s.avg_price,
    prev_avg_price AS avg_price_yesterday,
    CASE
        WHEN prev_avg_price IS NOT NULL THEN ROUND((s.avg_price - prev_avg_price)::numeric, 2)
        ELSE NULL
    END AS price_change,
    CASE
        WHEN prev_avg_price IS NOT NULL AND prev_avg_price <> 0
            THEN ROUND(((s.avg_price - prev_avg_price) / prev_avg_price * 100)::numeric, 2)
        ELSE NULL
    END AS price_change_rate,
    CURRENT_TIMESTAMP AS update_time,
    s.category
FROM (
    SELECT
        d.*,
        LAG(d.avg_price) OVER (
            PARTITION BY d.brand_id, d.product_id, d.category
            ORDER BY d.stat_date
        ) AS prev_avg_price
    FROM tmp_stat_brand_product_daily d
) s
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

-- 6) 导入后抽查
SELECT COUNT(*) AS imported_rows
FROM public.stat_brand_product
WHERE stat_date BETWEEN DATE '{min_date}' AND DATE '{max_date}';
"""


def main() -> None:
    files = sorted(
        file
        for file in SOURCE_DIR.glob("*.xlsx")
        if DATE_RE.search(file.name)
        and file.name not in {SUMMARY_OUTPUT.name}
    )
    if not files:
        raise SystemExit(f"未找到 Excel 文件: {SOURCE_DIR}")

    detail_frames: list[pd.DataFrame] = [load_one_file(file) for file in files]
    detail_df = pd.concat(detail_frames, ignore_index=True)

    grouped = (
        detail_df.groupby(["日期", "大类", "国家", "厂号", "品牌名", "产品"], dropna=False)
        .agg(
            平均报价=("平均报价", "mean"),
            报盘条数=("平均报价", "size"),
            最低报价=("平均报价", "min"),
            最高报价=("平均报价", "max"),
        )
        .reset_index()
    )

    grouped["平均报价"] = grouped["平均报价"].round(4)
    grouped["最低报价"] = grouped["最低报价"].round(4)
    grouped["最高报价"] = grouped["最高报价"].round(4)
    grouped = grouped.sort_values(["品牌名", "产品", "日期"]).reset_index(drop=True)

    pg_ready = grouped.copy()
    pg_ready["stat_date"] = pd.to_datetime(pg_ready["日期"]).dt.strftime("%Y-%m-%d")
    pg_ready["category"] = pg_ready["大类"].map(normalize_text)
    pg_ready["country"] = pg_ready["国家"].map(normalize_text)
    pg_ready["factory_no"] = pg_ready["厂号"].map(normalize_text)
    pg_ready["brand_name"] = pg_ready["品牌名"].map(normalize_text)
    pg_ready["product_name"] = pg_ready["产品"].map(normalize_text)
    pg_ready["avg_price"] = pg_ready["平均报价"].round(4)
    pg_ready["source_offer_count"] = pg_ready["报盘条数"]
    pg_ready["source_min_price"] = pg_ready["最低报价"].round(4)
    pg_ready["source_max_price"] = pg_ready["最高报价"].round(4)
    pg_ready = pg_ready[
        [
            "stat_date",
            "category",
            "country",
            "factory_no",
            "brand_name",
            "product_name",
            "avg_price",
            "source_offer_count",
            "source_min_price",
            "source_max_price",
        ]
    ].copy()

    pg_ready.to_csv(PG_IMPORT_OUTPUT, index=False, encoding="utf-8-sig")

    with pd.ExcelWriter(SUMMARY_OUTPUT, engine="openpyxl") as writer:
        grouped.to_excel(writer, index=False, sheet_name="品牌产品趋势聚合表")

    min_date = pg_ready["stat_date"].min()
    max_date = pg_ready["stat_date"].max()
    PG_IMPORT_SQL.write_text(build_sql(min_date, max_date), encoding="utf-8")

    PG_IMPORT_README.write_text(
        f"""一、你现在要带去部署机的文件
1. {PG_IMPORT_OUTPUT}
2. {PG_IMPORT_SQL}

二、这份 CSV 是什么
- 它不是最终入库表，而是品牌产品历史趋势的导入中间表
- 一行代表：某一天 + 某国家 + 某厂号 + 某产品 的报盘聚合结果
- SQL 会在部署机上再去关联：
  - dict_brand（拿 brand_id / brand_name）
  - dict_product（拿 product_id / product_name）
- 然后汇总写入 public.stat_brand_product

三、导入前提
- 部署机数据库里已有较完整的 dict_brand、dict_product
- dict_brand 至少能按 country + factory_no 命中品牌
- dict_product 至少能按 category + product_name 命中产品

四、部署机推荐执行顺序
1. 把 CSV 和 SQL 放到部署机本地目录
2. 用 psql 连到 mooket_db
3. 先执行 SQL 里的建临时表语句
4. 修改 SQL 中的 \\copy 路径为部署机上的真实路径
5. 先执行两段“未匹配检查”
6. 确认无大批量未匹配后，再执行正式 INSERT ... ON CONFLICT
7. 导入后抽查几个品牌产品卡片

五、本次生成结果
- 导入准备记录数: {len(pg_ready)}
- 日期范围: {min_date} ~ {max_date}
- 汇总文件: {SUMMARY_OUTPUT}
""",
        encoding="utf-8",
    )

    print(f"导入CSV: {PG_IMPORT_OUTPUT}")
    print(f"导入SQL: {PG_IMPORT_SQL}")
    print(f"导入说明: {PG_IMPORT_README}")
    print(f"汇总Excel: {SUMMARY_OUTPUT}")
    print(f"导入准备记录数: {len(pg_ready)}")
    print(f"日期范围: {min_date} ~ {max_date}")


if __name__ == "__main__":
    main()
