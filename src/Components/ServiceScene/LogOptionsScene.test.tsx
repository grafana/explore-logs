import React from 'react';
import { getLogOption, setLogOption } from 'services/store';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogsListScene } from './LogsListScene';
import { sceneGraph } from '@grafana/scenes';

jest.mock('services/store');
jest.mock('./LogsListScene');

describe('LogOptionsScene', () => {
  beforeEach(() => {
    jest.mocked(setLogOption).mockClear();
  });

  test('Reads active state and stores changes', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('true');
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    await act(async () => userEvent.click(screen.getByLabelText('Wrap lines')));
    expect(setLogOption).toHaveBeenCalledTimes(1);
    expect(setLogOption).toHaveBeenCalledWith('wrapLines', false);
    expect(scene.setLogsVizOption).toHaveBeenCalledWith({ wrapLogMessage: false });
  });

  test('Reads active state and stores changes', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('');
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    await act(async () => userEvent.click(screen.getByLabelText('Wrap lines')));
    expect(setLogOption).toHaveBeenCalledTimes(1);
    expect(setLogOption).toHaveBeenCalledWith('wrapLines', true);
    expect(scene.setLogsVizOption).toHaveBeenCalledWith({ wrapLogMessage: true });
  });

  test('Does not show the clear fields button with no fields in display', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('true');
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    expect(screen.queryByText('Show original log line')).not.toBeInTheDocument();
  });

  test('Shows the clear fields button with fields in display', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('true');
    const scene = new LogsListScene({ displayedFields: ['yass'] });
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue(scene);

    render(<scene.Component model={scene} />);

    expect(screen.getByText('Show original log line')).toBeInTheDocument();

    await act(async () => userEvent.click(screen.getByText('Show original log line')));

    expect(scene.clearDisplayedFields).toHaveBeenCalledTimes(1);
  });
});
