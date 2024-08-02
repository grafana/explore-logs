import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ServiceFieldSelector } from './FieldSelector';
import { userEvent } from '@testing-library/user-event';
import { testIds } from '../../../services/testIds';

describe('FieldSelector', () => {
  async function initialRender() {
    const onChange = jest.fn();
    const onSelect = jest.fn();

    const props = {
      isLoading: false,
      label: 'value',
      onChange: onChange,
      options: [
        {
          value: 'serviceName',
          label: 'serviceName',
        },
        {
          value: 'serviceName2',
          label: 'serviceName2',
        },
        {
          value: 'serviceName3',
          label: 'serviceName3',
        },
        {
          value: 'tempo-ingester',
          label: 'tempo-ingester',
        },
      ],
      selectOption: onSelect,
      value: '',
    };

    const { rerender } = render(
      <div>
        <span>Outside</span>
        <ServiceFieldSelector {...props} />
      </div>
    );

    // Its odd that the svgs have aria labels and different roles then what I see in the test executions, but these are the right elements?
    await waitFor(() => expect(queryFilterIcon()).toBeNull());
    await waitFor(() => expect(queryCloseIcon()).toBeNull());

    const stringToType = 'service';

    await act(async () =>
      userEvent.type(screen.getByTestId(testIds.exploreServiceSearch.search), stringToType, {
        skipAutoClose: true,
      })
    );
    return { props, rerender, stringToType };
  }
  it('displays custom filter when adding custom option by clicking off the input after entering some text', async () => {
    const { props, rerender, stringToType } = await initialRender();

    // Click outside the element
    await act(async () => userEvent.click(screen.getByText('Outside')));

    rerender(
      <div>
        <span>Outside</span>
        <ServiceFieldSelector {...props} value={stringToType} />
      </div>
    );

    // Should be a filter icon
    await waitFor(() => expect(getFilterIcon()).toBeInTheDocument());
    // Should also be a close icon
    await waitFor(() => expect(getCloseIcon()).toBeInTheDocument());
  });
  it('displays custom filter when adding custom option by hitting escape after entering some text', async () => {
    const { props, rerender, stringToType } = await initialRender();

    // Press escape to save a custom filter option
    await act(async () => userEvent.keyboard('{Escape}'));

    rerender(
      <div>
        <span>Outside</span>
        <ServiceFieldSelector {...props} value={stringToType} />
      </div>
    );

    // Should be a filter icon
    await waitFor(() => expect(getFilterIcon()).toBeInTheDocument());
    // Should also be a close icon
    await waitFor(() => expect(getCloseIcon()).toBeInTheDocument());
  });
  it('clearing custom filter works', async () => {
    const { props, rerender, stringToType } = await initialRender();
    // Press escape to save a custom filter option
    await act(async () => userEvent.keyboard('{Escape}'));

    rerender(
      <div>
        <span>Outside</span>
        <ServiceFieldSelector {...props} value={stringToType} />
      </div>
    );

    await waitFor(() => expect(getFilterIcon()).toBeInTheDocument());
    await waitFor(() => expect(getCloseIcon()).toBeInTheDocument());

    // Hit clear icon
    await act(async () => userEvent.click(getCloseIcon()));

    // Icons should go away
    await waitFor(() => expect(queryFilterIcon()).toBeNull());
    await waitFor(() => expect(queryCloseIcon()).toBeNull());
  });
});

const closeTestId = 'times';
const filterTestId = 'filter';

function getFilterIcon() {
  return screen.getByTestId(filterTestId);
}
function queryFilterIcon() {
  return screen.queryByRole(filterTestId);
}
function getCloseIcon() {
  return screen.getByTestId(closeTestId);
}
function queryCloseIcon() {
  return screen.queryByRole(closeTestId);
}
