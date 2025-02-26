import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReturnToPrevious } from '@grafana/runtime';
import { OpenInLogsDrilldownButtonProps } from './types';
import OpenInLogsDrilldownButton from './OpenInLogsDrilldownButton';
import { AbstractLabelOperator } from '@grafana/data';
import { addCustomInputPrefixAndValueLabels, encodeFilter } from 'services/extensions/utils';

jest.mock('@grafana/runtime', () => ({
  useReturnToPrevious: jest.fn(),
}));

describe('OpenInLogsDrilldownButton', () => {
  const setReturnToPreviousMock = jest.fn();

  beforeEach(() => {
    (useReturnToPrevious as jest.Mock).mockReturnValue(setReturnToPreviousMock);
  });

  it('should render the button with correct href (Equal operator)', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      datasourceUid: 'test-datasource',
      streamSelectors: [{ name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal }],
      from: 'now-1h',
      to: 'now',
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link', { name: /open in logs drilldown/i });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-ds=test-datasource&from=now-1h&to=now&var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}`
    );
  });

  it('should handle NotEqual operator correctly', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [
        { name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal },
        { name: 'test_label_key', value: 'test-label-value', operator: AbstractLabelOperator.NotEqual },
      ],
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}&var-filters=${encodeFilter(`test_label_key|!=|${addCustomInputPrefixAndValueLabels('test-label-value')}`)}`
    );
  });

  it('should handle EqualRegEx operator with properly encoded PromQL values', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [
        { name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal },
        { name: 'test_label_key', value: 'special.(char)+|value$', operator: AbstractLabelOperator.EqualRegEx },
      ],
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}&var-filters=${encodeFilter(
        `test_label_key|=~|${addCustomInputPrefixAndValueLabels('special.(char)+|value$')}`
      )}`
    );
  });

  it('should handle NotEqualRegEx operator with properly encoded PromQL values', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [
        { name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal },
        { name: 'test_label_key', value: 'special.(char)+|value$', operator: AbstractLabelOperator.NotEqualRegEx },
      ],
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    expect(linkButton).toHaveAttribute(
      'href',
      `/a/grafana-lokiexplore-app/explore/job/test-job/logs?var-filters=${encodeFilter(
        `job|=|${addCustomInputPrefixAndValueLabels('test-job')}`
      )}&var-filters=${encodeFilter(
        `test_label_key|!~|${addCustomInputPrefixAndValueLabels('special.(char)+|value$')}`
      )}`
    );
  });

  it('should not render button if labelMatchers is empty', () => {
    render(<OpenInLogsDrilldownButton streamSelectors={[]} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should call setReturnToPrevious on click', () => {
    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [{ name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal }],
      returnToPreviousSource: 'test-source',
    };

    render(<OpenInLogsDrilldownButton {...props} />);

    const linkButton = screen.getByRole('link');
    fireEvent.click(linkButton);

    expect(setReturnToPreviousMock).toHaveBeenCalledWith('test-source');
  });

  it('should render using custom renderButton prop', () => {
    const renderButtonMock = jest.fn(({ href }) => <a href={href}>Custom Button</a>);

    const props: OpenInLogsDrilldownButtonProps = {
      streamSelectors: [{ name: 'job', value: 'test-job', operator: AbstractLabelOperator.Equal }],
      renderButton: renderButtonMock,
    };

    render(<OpenInLogsDrilldownButton {...props} />);
    expect(screen.getByText('Custom Button')).toBeInTheDocument();
    expect(renderButtonMock).toHaveBeenCalledWith(expect.objectContaining({ href: expect.any(String) }));
  });
});
