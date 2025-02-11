import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReturnToPrevious } from '@grafana/runtime';
import { OpenInExploreLogsButtonProps } from './types';
import OpenInExploreLogsButton from './OpenInExploreLogsButton';

jest.mock('@grafana/runtime', () => ({
  useReturnToPrevious: jest.fn(),
  config: {
    appSubUrl: 'http://localhost',
    appUrl: 'http://localhost',
  },
}));

describe('OpenInExploreLogsButton', () => {
  const setReturnToPreviousMock = jest.fn();

  beforeEach(() => {
    (useReturnToPrevious as jest.Mock).mockReturnValue(setReturnToPreviousMock);
  });

  it('should render the button with correct href', () => {
    const props: OpenInExploreLogsButtonProps = {
      datasourceUid: 'test-datasource',
      labelMatchers: [{ name: 'job', value: 'test-job' }],
      from: 'now-1h',
      to: 'now',
    };

    render(<OpenInExploreLogsButton {...props} />);

    const linkButton = screen.getByRole('link', { name: /open in explore logs/i });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toHaveAttribute(
      'href',
      'http://localhosta/grafana-lokiexplore-app/explore/job/test-job/logs?var-datasource=test-datasource&from=now-1h&to=now&var-filters=job%7C%3D%7Ctest-job'
    );
  });

  it('should not render button if labelMatchers is empty', () => {
    render(<OpenInExploreLogsButton labelMatchers={[]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should call setReturnToPrevious on click', () => {
    const props: OpenInExploreLogsButtonProps = {
      labelMatchers: [{ name: 'job', value: 'test-job' }],
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
      labelMatchers: [{ name: 'job', value: 'test-job' }],
      renderButton: renderButtonMock,
    };

    render(<OpenInExploreLogsButton {...props} />);
    expect(screen.getByText('Custom Button')).toBeInTheDocument();
    expect(renderButtonMock).toHaveBeenCalledWith(expect.objectContaining({ href: expect.any(String) }));
  });
});
