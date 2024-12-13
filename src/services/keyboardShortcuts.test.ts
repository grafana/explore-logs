import { getCopiedTimeRange } from './keyboardShortcuts';

function mockReadText(value: any) {
  Object.defineProperty(navigator, 'clipboard', {
    // Allow overwriting
    configurable: true,
    value: {
      // Provide mock implementation
      readText: jest.fn().mockReturnValueOnce(Promise.resolve(value)),
    },
  });
}
describe('getCopiedTimeRange', () => {
  it('should return valid absolute time range', async () => {
    const inputString = `{"from":"2024-12-13T15:13:39.680Z","to":"2024-12-13T15:14:04.904Z"}`;
    mockReadText(inputString);

    const expected = {
      isError: false,
      range: JSON.parse(inputString),
    };

    expect(await getCopiedTimeRange()).toEqual(expected);
  });

  it('should return valid relative time range', async () => {
    const inputString = `{"from":"now-30m","to":"now"}`;
    mockReadText(inputString);

    const expected = {
      isError: false,
      range: JSON.parse(inputString),
    };

    expect(await getCopiedTimeRange()).toEqual(expected);
  });

  it('should return error for non-timerange', async () => {
    const inputString = `{"never":"gonna","give":"you", "up": true}`;
    mockReadText(inputString);

    const expected = {
      isError: true,
      range: inputString,
    };

    expect(await getCopiedTimeRange()).toEqual(expected);
  });
});
