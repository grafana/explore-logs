import { getCountOptionsFromTotal } from './ServiceSelectionPaginationScene';

describe('getCountOptionsFromTotal()', () => {
  test('Generates pagination options', () => {
    const options = getCountOptionsFromTotal(61);
    expect(options).toEqual([
      { value: '20', label: '20' },
      { value: '40', label: '40' },
      { value: '60', label: '60' },
    ]);
  });

  test('Generates pagination options up to the total count', () => {
    expect(getCountOptionsFromTotal(60)).toEqual([
      { value: '20', label: '20' },
      { value: '40', label: '40' },
      { value: '60', label: '60' },
    ]);
    expect(getCountOptionsFromTotal(59)).toEqual([
      { value: '20', label: '20' },
      { value: '40', label: '40' },
      { value: '60', label: '59' },
    ]);
    expect(getCountOptionsFromTotal(40)).toEqual([
      { value: '20', label: '20' },
      { value: '40', label: '40' },
    ]);
    expect(getCountOptionsFromTotal(39)).toEqual([
      { value: '20', label: '20' },
      { value: '40', label: '39' },
    ]);
    expect(getCountOptionsFromTotal(20)).toEqual([{ value: '20', label: '20' }]);
    expect(getCountOptionsFromTotal(19)).toEqual([{ value: '20', label: '19' }]);
    expect(getCountOptionsFromTotal(1)).toEqual([{ value: '20', label: '1' }]);
  });
});
