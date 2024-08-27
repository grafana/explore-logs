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
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValueOnce(scene);

    render(<scene.Component model={scene} />);

    await act(async () => userEvent.click(screen.getByLabelText('Wrap lines')));
    expect(setLogOption).toHaveBeenCalledTimes(1);
    expect(setLogOption).toHaveBeenCalledWith('wrapLines', false);
    expect(scene.updateLogsPanel).toHaveBeenCalled();
  });

  test('Reads active state and stores changes', async () => {
    jest.mocked(getLogOption).mockReturnValueOnce('');
    const scene = new LogsListScene({});
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValueOnce(scene);

    render(<scene.Component model={scene} />);

    await act(async () => userEvent.click(screen.getByLabelText('Wrap lines')));
    expect(setLogOption).toHaveBeenCalledTimes(1);
    expect(setLogOption).toHaveBeenCalledWith('wrapLines', true);
    expect(scene.updateLogsPanel).toHaveBeenCalled();
  });
});
