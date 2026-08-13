import type {HomeCardItem} from '../src/types/api';
import {
  buildSelfSelectFilterOptions,
  filterSelfSelectCards,
  pruneInvalidSelfSelectFilters,
} from '../src/utils/selfSelectFilters';

const cards: HomeCardItem[] = [
  {
    cardType: 'factoryProduct',
    country: '巴西',
    factoryNo: ' sif 411 ',
    productName: '牛前八件套',
  },
  {
    cardType: 'factoryProduct',
    country: '巴西',
    factoryNo: 'SIF3941',
    productName: '牛腩',
  },
  {
    cardType: 'factoryProduct',
    country: '澳大利亚',
    factoryNo: '486',
    productName: '牛腩',
  },
  {
    cardType: 'merchant',
    merchantName: '没有 SKU 维度的商家',
  },
];

describe('self select filters', () => {
  it('builds stable, deduplicated product, country, and normalized factory options', () => {
    const options = buildSelfSelectFilterOptions([
      ...cards,
      {country: ' 巴西 ', factoryNo: 'sif411', productName: ' 牛腩 '},
    ]);

    expect(options).toEqual({
      products: ['牛前八件套', '牛腩'],
      countries: ['巴西', '澳大利亚'],
      factoryNos: ['SIF411', 'SIF3941', '486'],
    });
  });

  it('uses OR within a dimension and AND between dimensions', () => {
    const result = filterSelfSelectCards(cards, {
      products: ['牛前八件套', '牛腩'],
      countries: ['巴西'],
      factoryNos: ['sif 411', 'SIF3941'],
    });

    expect(result).toEqual(cards.slice(0, 2));
  });

  it('treats an empty dimension as unrestricted', () => {
    const result = filterSelfSelectCards(cards, {
      products: ['牛腩'],
      countries: [],
      factoryNos: [],
    });

    expect(result).toEqual([cards[1], cards[2]]);
  });

  it('removes invalid selections and normalizes surviving factory numbers', () => {
    const result = pruneInvalidSelfSelectFilters(
      {
        products: ['牛腩', '已删除产品', ' 牛腩 '],
        countries: ['巴西', '美国'],
        factoryNos: ['sif 411', 'SIF0000'],
      },
      buildSelfSelectFilterOptions(cards.slice(0, 3)),
    );

    expect(result).toEqual({
      products: ['牛腩'],
      countries: ['巴西'],
      factoryNos: ['SIF411'],
    });
  });

  it('does not mutate cards, filters, or options', () => {
    const inputCards = cards.map(card => ({...card}));
    const filters = {
      products: ['牛腩'],
      countries: ['巴西'],
      factoryNos: ['SIF3941'],
    };
    const options = buildSelfSelectFilterOptions(inputCards);
    const cardsBefore = JSON.stringify(inputCards);
    const filtersBefore = JSON.stringify(filters);
    const optionsBefore = JSON.stringify(options);

    filterSelfSelectCards(inputCards, filters);
    pruneInvalidSelfSelectFilters(filters, options);

    expect(JSON.stringify(inputCards)).toBe(cardsBefore);
    expect(JSON.stringify(filters)).toBe(filtersBefore);
    expect(JSON.stringify(options)).toBe(optionsBefore);
  });
});
