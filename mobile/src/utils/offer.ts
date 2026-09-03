export function parseWeight(weight?: string | null): [string, string] {
  if (!weight || weight.trim() === '') {
    return ['', ''];
  }
  const match = weight.trim().match(/^([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) {
    return [weight.trim(), ''];
  }
  const numeric = Number(match[1]);
  const unit = match[2].trim();
  if (!Number.isFinite(numeric)) {
    return [match[1], unit];
  }
  const rounded = Math.round(numeric * 10) / 10;
  const text = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  return [text, unit];
}

export function extractCity(location?: string | null): string {
  if (!location) {
    return '';
  }
  const parts = location
    .split(/[\/\\,，、\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

const municipalities = ['北京', '上海', '天津', '重庆'];
const provinceNames = [
  '黑龙江',
  '内蒙古',
  '新疆',
  '广西',
  '宁夏',
  '西藏',
  '香港',
  '澳门',
  '河北',
  '山西',
  '辽宁',
  '吉林',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '海南',
  '四川',
  '贵州',
  '云南',
  '陕西',
  '甘肃',
  '青海',
  '台湾',
];

export function formatGoodsLocation(location?: string | null): string {
  const raw = location?.trim();
  if (!raw) {
    return '';
  }

  const compact = raw
    .replace(/[\/\\,，、·\s]+/g, '')
    .replace(/^中国/, '');
  if (!compact) {
    return '';
  }

  const municipality = municipalities.find(name => compact.startsWith(name));
  if (municipality) {
    return municipality;
  }

  const province = provinceNames.find(name => compact.startsWith(name));
  if (province) {
    const rest = stripAdminPrefix(compact.slice(province.length));
    const city = stripAdminSuffix(extractCityPart(rest));
    return city && city !== province ? `${province}·${city}` : province;
  }

  return stripAdminSuffix(compact);
}

function stripAdminPrefix(value: string) {
  return value
    .replace(/^(省|市|特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区)/, '')
    .replace(/^省/, '');
}

function extractCityPart(value: string) {
  if (!value) {
    return '';
  }
  const match = value.match(/^(.+?(?:自治州|地区|盟|市|县|区))/);
  return match?.[1] ?? value;
}

function stripAdminSuffix(value: string) {
  return value
    .replace(/^(北京|上海|天津|重庆)(市|城区|市辖区|辖区)?$/, '$1')
    .replace(/(维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|自治州|地区|盟|省|市|县|区|城区|市辖区|辖区)$/g, '');
}

export function formatPublishTime(time?: string | null): string {
  if (!time) {
    return '';
  }
  const match = time.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) {
    return time;
  }
  return `${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
}

export function computePriceRange(
  employeePrices: Array<number | null | undefined> | null | undefined,
  fallbackMin?: number | null,
  fallbackMax?: number | null,
): [string | null, string | null] {
  const valid = (employeePrices ?? []).filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
  if (valid.length > 0) {
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    if (min !== max) {
      return [`¥ ${min} - ${max}`, '/kg'];
    }
    return [`¥ ${min}`, '/kg'];
  }
  if (
    fallbackMin != null &&
    fallbackMin > 0 &&
    fallbackMax != null &&
    fallbackMax > 0 &&
    fallbackMin !== fallbackMax
  ) {
    return [`¥ ${fallbackMin} - ${fallbackMax}`, '/kg'];
  }
  if (fallbackMin != null && fallbackMin > 0) {
    return [`¥ ${fallbackMin}`, '/kg'];
  }
  return ['协商报价', null];
}

export function colorForTag(_tag: string): {bg: string; fg: string} {
  // 标签统一使用一种与其他字段（货物类型/饲养方式/肥瘦比/品种/备注）区分度高的青色，
  // 便于在卡片中一眼区分「标签」和「属性字段」。
  return {bg: '#E3F6F8', fg: '#0E8F9C'};
}

export type OfferFieldKind =
  | 'goodsType'
  | 'feedingType'
  | 'fatRatio'
  | 'cattleBreed'
  | 'remark'
  | 'tag';

export function colorForOfferField(kind: OfferFieldKind): {bg: string; fg: string} {
  switch (kind) {
    case 'goodsType':
      return {bg: '#EEF4FF', fg: '#3767D6'};
    case 'feedingType':
      return {bg: '#EEF8F2', fg: '#1F8A55'};
    case 'fatRatio':
      return {bg: '#FFF2E8', fg: '#C96A1A'};
    case 'cattleBreed':
      return {bg: '#F7EEFF', fg: '#7A47B8'};
    case 'remark':
      return {bg: '#FFF1F0', fg: '#D54941'};
    case 'tag':
    default:
      return {bg: '#F3F6F5', fg: '#3C4947'};
  }
}

export function splitTags(tags?: string | null, maxCount = 4): string[] {
  if (!tags) {
    return [];
  }
  return tags
    .split(/[,，、]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, maxCount);
}
