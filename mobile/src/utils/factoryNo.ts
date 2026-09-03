export function normalizeFactoryNo(value?: string | null) {
  const compact = value?.replace(/[\s\u200B-\u200D\uFEFF]/g, '').trim() ?? '';
  if (!compact) return '';
  return compact.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
}

export function normalizeFactoryNoOrNull(value?: string | null) {
  const normalized = normalizeFactoryNo(value);
  return normalized || null;
}
