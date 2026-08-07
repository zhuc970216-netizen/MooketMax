from __future__ import annotations

import re
from pathlib import Path

import pandas as pd


SOURCE_DIR = Path(r"D:\数据_趋势图\30天报盘数据")
OUTPUT_DIR = SOURCE_DIR
DETAIL_OUTPUT = OUTPUT_DIR / "30天报盘_有报价明细汇总.csv"
TREND_OUTPUT = OUTPUT_DIR / "30天趋势图聚合表.xlsx"
PG_IMPORT_OUTPUT = OUTPUT_DIR / "stat_price_trend_import_ready.csv"
PG_IMPORT_SQL = OUTPUT_DIR / "stat_price_trend_import.sql"
PG_IMPORT_README = OUTPUT_DIR / "stat_price_trend_import_README.txt"

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

    numbers = [float(item) for item in PRICE_RE.findall(text.replace("～", "-").replace("~", "-"))]
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

    keep_cols = [col for col in required if col in df.columns]
    optional_cols = [col for col in ["状态", "标准品名", "规格1", "规格2", "标签", "备注", "姓名", "发布人手机号", "行业商家名称", "报盘时间", "创建时间", "询报盘ID"] if col in df.columns]
    work = df[keep_cols + optional_cols].copy()
    work["日期"] = trade_date

    for col in ["类型", "大类", "国家", "厂号", "产品", "报价"]:
        work[col] = work[col].map(normalize_text)

    work["平均报价"] = work["报价"].map(parse_avg_price)
    work = work[work["平均报价"].notna()].copy()
    return work


def main() -> None:
    files = sorted(
        file
        for file in SOURCE_DIR.glob("*.xlsx")
        if file.name not in {DETAIL_OUTPUT.name, TREND_OUTPUT.name}
        and DATE_RE.search(file.name)
    )
    if not files:
        raise SystemExit(f"未找到 Excel 文件: {SOURCE_DIR}")

    detail_frames: list[pd.DataFrame] = []
    for file in files:
        detail_frames.append(load_one_file(file))

    detail_df = pd.concat(detail_frames, ignore_index=True)

    grouped = (
        detail_df.groupby(["日期", "类型", "大类", "国家", "厂号", "产品"], dropna=False)
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

    detail_df = detail_df.sort_values(["日期", "类型", "大类", "国家", "厂号", "产品"]).reset_index(drop=True)
    grouped = grouped.sort_values(["类型", "大类", "国家", "厂号", "产品", "日期"]).reset_index(drop=True)

    pg_ready = grouped.copy()
    pg_ready["stat_date"] = pd.to_datetime(pg_ready["日期"]).dt.strftime("%Y-%m-%d")
    pg_ready["category"] = pg_ready["大类"].map(normalize_text)
    pg_ready["offer_type"] = pg_ready["类型"].map(normalize_text)
    pg_ready["country"] = pg_ready["国家"].map(normalize_text)
    pg_ready["factory_no"] = pg_ready["厂号"].map(normalize_text)
    pg_ready["product_name"] = pg_ready["产品"].map(normalize_text)
    pg_ready["dimension_type"] = pg_ready["factory_no"].apply(
        lambda value: "country_factory_product" if value else "country_product"
    )
    pg_ready["avg_price"] = pg_ready["平均报价"].round(2)
    pg_ready["source_offer_count"] = pg_ready["报盘条数"]
    pg_ready["source_min_price"] = pg_ready["最低报价"].round(2)
    pg_ready["source_max_price"] = pg_ready["最高报价"].round(2)
    pg_ready = pg_ready[
        [
            "stat_date",
            "dimension_type",
            "category",
            "offer_type",
            "country",
            "factory_no",
            "product_name",
            "avg_price",
            "source_offer_count",
            "source_min_price",
            "source_max_price",
        ]
    ].copy()
    pg_ready.to_csv(PG_IMPORT_OUTPUT, index=False, encoding="utf-8-sig")

    detail_df.to_csv(DETAIL_OUTPUT, index=False, encoding="utf-8-sig")

    with pd.ExcelWriter(TREND_OUTPUT, engine="openpyxl") as writer:
        grouped.to_excel(writer, index=False, sheet_name="趋势图聚合表")

    PG_IMPORT_SQL.write_text(
        """-- 1) 创建临时导入表
DROP TABLE IF EXISTS tmp_stat_price_trend_import;
CREATE TEMP TABLE tmp_stat_price_trend_import (
    stat_date date NOT NULL,
    dimension_type varchar(50) NOT NULL,
    category varchar(10) NOT NULL,
    offer_type varchar(20) NOT NULL,
    country varchar(100),
    factory_no varchar(100),
    product_name varchar(200) NOT NULL,
    avg_price numeric(10,2),
    source_offer_count integer,
    source_min_price numeric(10,2),
    source_max_price numeric(10,2)
);

-- 2) 在 psql 中执行时，把下面路径替换成服务器本机实际路径
-- \\copy tmp_stat_price_trend_import FROM 'D:/数据_趋势图/30天报盘数据/stat_price_trend_import_ready.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- 3) 先检查哪些产品在 dict_product 里找不到 product_id
SELECT
    t.category,
    t.product_name,
    COUNT(*) AS row_count
FROM tmp_stat_price_trend_import t
LEFT JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
WHERE p.product_id IS NULL
GROUP BY t.category, t.product_name
ORDER BY row_count DESC, t.category, t.product_name;

-- 4) 正式写入趋势表（仅导入能匹配到 product_id 的记录）
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
    t.stat_date,
    t.dimension_type,
    NULLIF(t.country, ''),
    p.product_id,
    t.product_name,
    COALESCE(t.factory_no, ''),
    t.offer_type,
    t.avg_price,
    CURRENT_DATE
FROM tmp_stat_price_trend_import t
JOIN dict_product p
  ON p.category = t.category
 AND p.product_name = t.product_name
ON CONFLICT (stat_date, dimension_type, country, product_id, factory_no, offer_type)
DO UPDATE SET
    avg_price = EXCLUDED.avg_price,
    updated_at = CURRENT_TIMESTAMP;

-- 5) 导入后抽查数量
SELECT COUNT(*) AS imported_rows
FROM public.stat_price_trend
WHERE stat_date BETWEEN DATE '2026-07-07' AND DATE '2026-08-06';
""",
        encoding="utf-8",
    )

    PG_IMPORT_README.write_text(
        f"""一、你现在要带去服务器/部署机的文件
1. {PG_IMPORT_OUTPUT}
2. {PG_IMPORT_SQL}

二、这份 CSV 已经按 public.stat_price_trend 的写入规则准备好了
- dimension_type:
  - 有厂号 -> country_factory_product
  - 无厂号 -> country_product
- offer_type:
  - 直接使用 Excel 里的“类型”字段（应为 报盘 / 求购）
- category:
  - 直接使用 Excel 里的“大类”字段（用于匹配 dict_product.product_id）
- avg_price:
  - 由每天同维度下的报价均值计算得到

三、服务器上推荐导入步骤
1. 把 CSV 和 SQL 放到服务器本机一个固定目录
2. 用 psql 连到 mooket_db
3. 先执行 SQL 文件里的建临时表语句
4. 修改 SQL 里的 \\copy 路径为服务器上 CSV 的真实路径
5. 先执行“未匹配 product_id 检查”
6. 确认没有大批量未匹配后，再执行 INSERT ... ON CONFLICT

四、本次生成结果
- 有报价明细: {len(detail_df)}
- 趋势聚合记录: {len(grouped)}
- 导入准备记录: {len(pg_ready)}
""",
        encoding="utf-8",
    )

    print(f"明细输出: {DETAIL_OUTPUT}")
    print(f"趋势输出: {TREND_OUTPUT}")
    print(f"PG导入CSV: {PG_IMPORT_OUTPUT}")
    print(f"PG导入SQL: {PG_IMPORT_SQL}")
    print(f"PG导入说明: {PG_IMPORT_README}")
    print(f"有报价明细条数: {len(detail_df)}")
    print(f"趋势聚合条数: {len(grouped)}")


if __name__ == "__main__":
    main()
