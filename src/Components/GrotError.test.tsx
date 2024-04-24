import React from 'react';
import { render } from '@testing-library/react';
import { GrotError } from './GrotError';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  useTheme2: jest.fn(() => ({
    isDark: false,
  })),
}));

describe('GrotError', () => {
  it('renders the grot light error graphic when isDark false', () => {
    const { getByTestId } = render(<GrotError>Log volume has not been configured.</GrotError>);

    const graphic = getByTestId('grot_err_light');

    expect(graphic).toBeInTheDocument();
  });

  it('renders the error graphic and message', () => {
    const { getByText, getByTestId } = render(<GrotError>Log volume has not been configured.</GrotError>);

    const graphic = getByTestId('grot_err_light');
    const message = getByText('Log volume has not been configured.');

    expect(graphic).toBeInTheDocument();
    expect(message).toBeInTheDocument();
  });

  it('renders the default error message if no children are provided', () => {
    const { getByText } = render(<GrotError />);

    const message = getByText('An error occurred');

    expect(message).toBeInTheDocument();
  });
});
