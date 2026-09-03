import type {HomeCardItem} from '../types/api';
import {normalizeFactoryNoOrNull} from './factoryNo';

export type SelfSelectFilterValues = {
  products: string[];
  countries: string[];
  factoryNos: string[];
};

export type SelfSelectFilterOptions = SelfSelectFilterValues;

export const EMPTY_SELF_SELECT_FILTERS: SelfSelectFilterValues = {
  products: [],
  countries: [],
  factoryNos: [],
};

export function buildSelfSelectFilterOptions(
  cards: HomeCardItem[],
): SelfSelectFilterOptions {
  return {
    products: uniqueTextValues(cards.map(card => card.productName)),
    countries: uniqueTextValues(cards.map(card => card.country)),
    factoryNos: uniqueFactoryNos(cards.map(card => card.factoryNo)),
  };
}

export function filterSelfSelectCards(
  cards: HomeCardItem[],
  filters: SelfSelectFilterValues,
) {
  const products = normalizedTextSet(filters.products);
  const countries = normalizedTextSet(filters.countries);
  const factoryNos = new Set(
    filters.factoryNos
      .map(normalizeFactoryNoOrNull)
      .filter((value): value is string => value != null),
  );

  return cards.filter(card => {
    const productMatches =
      products.size === 0 || products.has(normalizeText(card.productName ?? ''));
    const countryMatches =
      countries.size === 0 || countries.has(normalizeText(card.country ?? ''));
    const factoryNo = normalizeFactoryNoOrNull(card.factoryNo);
    const factoryMatches =
      factoryNos.size === 0 || Boolean(factoryNo && factoryNos.has(factoryNo));
    return productMatches && countryMatches && factoryMatches;
  });
}

export function pruneInvalidSelfSelectFilters(
  filters: SelfSelectFilterValues,
  options: SelfSelectFilterOptions,
): SelfSelectFilterValues {
  const validProducts = normalizedTextSet(options.products);
  const validCountries = normalizedTextSet(options.countries);
  const validFactoryNos = new Set(
    options.factoryNos
      .map(normalizeFactoryNoOrNull)
      .filter((value): value is string => value != null),
  );

  return {
    products: uniqueTextValues(filters.products).filter(value =>
      validProducts.has(normalizeText(value)),
    ),
    countries: uniqueTextValues(filters.countries).filter(value =>
      validCountries.has(normalizeText(value)),
    ),
    factoryNos: uniqueFactoryNos(filters.factoryNos).filter(value =>
      validFactoryNos.has(value),
    ),
  };
}

function uniqueTextValues(values: Array<string | null | undefined>) {
  const result: string[] = [];
  const seen = new Set<string>();
  values.forEach(value => {
    const trimmed = value?.trim();
    const key = normalizeText(trimmed ?? '');
    if (!trimmed || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(trimmed);
  });
  return result;
}

function uniqueFactoryNos(values: Array<string | null | undefined>) {
  const result: string[] = [];
  const seen = new Set<string>();
  values.forEach(value => {
    const factoryNo = normalizeFactoryNoOrNull(value);
    if (!factoryNo || seen.has(factoryNo)) {
      return;
    }
    seen.add(factoryNo);
    result.push(factoryNo);
  });
  return result;
}

function normalizedTextSet(values: string[]) {
  return new Set(values.map(normalizeText).filter(Boolean));
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase();
}
