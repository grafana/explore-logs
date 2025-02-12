import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReturnToPrevious } from '@grafana/runtime';
import { OpenInExploreLogsButtonProps } from './types';
import OpenInExploreLogsButton from './OpenInExploreLogsButton';
import { AbstractLabelOperator } from '@grafana/data';

jest.mock('@grafana/runtime', () => ({
  useReturnToPrevious: jest.fn(),
  config: {
    appSubUrl: 'http://localhost:3000/',
    appUrl: 'http://localhost:3000/',
  },
}));

describe('OpenInExploreLogsButton', () => {
  const setReturnToPreviousMock = jest.fn();

  beforeEach(() => {
    (useReturnToPrevious as jest.Mock).mockReturnValue(setReturnToPreviousMock);
  });

  it('should render the button with correct href (Equal operator)', () => {
    const props: OpenInExploreLogsButtonProps = {
      datasourceUid: 'test-datasource',
      labelMatchers: [{ name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal }],
      from: 'now-1h',
      to: 'now',
    };

    render(<OpenInExploreLogsButton {...props} />);

    const linkButton = screen.getByRole('link', { name: /open in explore logs/i });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toHaveAttribute(
      'href',
      'http://localhost:3000/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-datasource=test-datasource&from=now-1h&to=now&var-filters=job%7C%3D%7Ctest-job'
    );
  });

  it('should handle NotEqual operator correctly', () => {
    const props: OpenInExploreLogsButtonProps = {
      labelMatchers: [
        { name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal },
        { name: 'test_label_key', value: 'test-label-value', operator: AbstractLabelOperator.NotEqual },
      ],
    };

    render(<OpenInExploreLogsButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      'http://localhost:3000/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=job%7C%3D%7Ctest-job&var-filters=test_label_key%7C%21%3D%7Ctest-label-value'
    );
  });

  it('should handle EqualRegEx operator with properly encoded PromQL values', () => {
    const props: OpenInExploreLogsButtonProps = {
      labelMatchers: [
        { name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal },
        { name: 'test_label_key', value: 'special.(char)+value$', operator: AbstractLabelOperator.EqualRegEx },
      ],
    };

    render(<OpenInExploreLogsButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      'http://localhost:3000/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=job%7C%3D%7Ctest-job&var-filters=test_label_key%7C%3D%7E%7Cspecial.%28char%29%2Bvalue%24'
    );
  });

  it('should handle NotEqualRegEx operator with properly encoded PromQL values', () => {
    const props: OpenInExploreLogsButtonProps = {
      labelMatchers: [
        { name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal },
        { name: 'test_label_key', value: 'special.(char)+value$', operator: AbstractLabelOperator.NotEqualRegEx },
      ],
    };

    render(<OpenInExploreLogsButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      'http://localhost:3000/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=job%7C%3D%7Ctest-job&var-filters=test_label_key%7C%21%7E%7Cspecial.%28char%29%2Bvalue%24'
    );
  });

  it('should not render button if labelMatchers is empty', () => {
    render(<OpenInExploreLogsButton labelMatchers={[]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should call setReturnToPrevious on click', () => {
    const props: OpenInExploreLogsButtonProps = {
      labelMatchers: [{ name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal }],
      returnToPreviousSource: 'test-source',
    };

    render(<OpenInExploreLogsButton {...props} />);

    const linkButton = screen.getByRole('link');
    fireEvent.click(linkButton);

    expect(setReturnToPreviousMock).toHaveBeenCalledWith('test-source');
  });

  it('should render using custom renderButton prop', () => {
    const renderButtonMock = jest.fn(({ href }) => <a href={href}>Custom Button</a>);

    const props: OpenInExploreLogsButtonProps = {
      labelMatchers: [{ name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal }],
      renderButton: renderButtonMock,
    };

    render(<OpenInExploreLogsButton {...props} />);
    expect(screen.getByText('Custom Button')).toBeInTheDocument();
    expect(renderButtonMock).toHaveBeenCalledWith(expect.objectContaining({ href: expect.any(String) }));
  });
});
