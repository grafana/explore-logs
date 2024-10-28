import { act, render, screen } from '@testing-library/react';
import { CopyLinkButton } from './CopyLinkButton';
import React from 'react';
import userEvent from '@testing-library/user-event';

beforeAll(() => {
  jest.useFakeTimers();
});
afterAll(() => {
  jest.useRealTimers();
});

test('Renders correctly', () => {
  render(<CopyLinkButton onClick={jest.fn()} />);
  expect(screen.getByLabelText('Copy link to log line')).toBeInTheDocument();
});

test('Calls event listener and displays a success message', async () => {
  const onClick = jest.fn();
  const { getByLabelText, queryByLabelText } = render(<CopyLinkButton onClick={onClick} />);

  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  await act(() => user.click(screen.getByRole('button')));

  expect(onClick).toHaveBeenCalled();
  expect(getByLabelText('Copied')).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(2000));

  expect(queryByLabelText('Copied')).not.toBeInTheDocument();
  expect(getByLabelText('Copy link to log line')).toBeInTheDocument();
});
