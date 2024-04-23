import React from 'react';
import { render } from '@testing-library/react';
import { GrotError } from './GrotError';

describe('GrotError', () => {
  it('renders the error graphic and message', () => {
    const { getByText, getByTestId } = render(<GrotError>Log volume has not been configured.</GrotError>);

    const graphic = getByTestId('grot_err');
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
