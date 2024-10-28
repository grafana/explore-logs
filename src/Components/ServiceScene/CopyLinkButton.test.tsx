import { render, screen } from '@testing-library/react';
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
  render(<CopyLinkButton onClick={onClick} />);

  await userEvent.hover(screen.getByRole('button'));
  await userEvent.click(screen.getByRole('button'));

  expect(onClick).toHaveBeenCalled();
  expect(await screen.findByText('Copied')).toBeInTheDocument();

  jest.advanceTimersByTime(2000);

  expect(await screen.findByText('Copy link to log line')).toBeInTheDocument();
});
