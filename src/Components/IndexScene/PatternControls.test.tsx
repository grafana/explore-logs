import React from 'react';
import { PatternControls } from './PatternControls';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppliedPattern } from './IndexScene';

const originalWidth = global.window.innerWidth;
beforeAll(() => {
  global.window.innerWidth = 1200;
});

afterAll(() => {
  global.window.innerWidth = originalWidth;
});

const patterns = [
  'level=warn <_> caller=instance.go:43 msg="TRACE_TOO_LARGE: max size of trace (52428800) exceeded tenant <_>',
  'level=info <_> caller=compactor.go:242 msg="flushed to block" <_>',
];

describe('PatternControls', () => {
  test('Does not render when there are no patterns', () => {
    const { container } = render(<PatternControls patterns={undefined} onRemove={jest.fn()} />);

    expect(container).toMatchInlineSnapshot('<div />');
  });

  test('Displays the applied pattern', () => {
    render(<PatternControls patterns={[{ pattern: patterns[0], type: 'include' }]} onRemove={jest.fn()} />);

    expect(screen.getByText('Included pattern')).toBeInTheDocument();
    expect(screen.getByText(patterns[0])).toBeInTheDocument();
  });

  test('Allows to remove patterns', async () => {
    const onRemove = jest.fn();
    render(<PatternControls patterns={[{ pattern: patterns[0], type: 'include' }]} onRemove={onRemove} />);

    await act(() => userEvent.click(screen.getByLabelText('Remove pattern')));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('Displays an excluded pattern', () => {
    render(<PatternControls patterns={[{ pattern: patterns[0], type: 'exclude' }]} onRemove={jest.fn()} />);

    expect(screen.getByText(/Excluded pattern/)).toBeInTheDocument();
    expect(screen.getByText(patterns[0])).toBeInTheDocument();
  });

  test('Displays excluded patterns', () => {
    const excludedPatterns: AppliedPattern[] = patterns.map((pattern) => ({
      pattern,
      type: 'exclude',
    }));
    render(<PatternControls patterns={excludedPatterns} onRemove={jest.fn()} />);

    expect(screen.getByText(/Excluded patterns/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Remove pattern')).toHaveLength(2);
  });
});
