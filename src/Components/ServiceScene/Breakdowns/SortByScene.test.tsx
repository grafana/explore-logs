import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { select } from 'react-select-event';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { setSortByPreference } from 'services/store';

describe('SortByScene', () => {
  let scene: SortByScene;
  beforeEach(() => {
    localStorage.clear();
    scene = new SortByScene({ target: 'fields' });
  });

  test('Sorts by standard deviation by default', () => {
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Most relevant')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  test('Retrieves stored sorting preferences', () => {
    setSortByPreference('fields', 'diff', 'asc');

    scene = new SortByScene({ target: 'fields' });
    render(<scene.Component model={scene} />);

    expect(screen.getByText('Difference')).toBeInTheDocument();
    expect(screen.getByText('Asc')).toBeInTheDocument();
  });

  test('Reports criteria changes', async () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    render(<scene.Component model={scene} />);

    await waitFor(() => select(screen.getByLabelText('Sort by'), 'Last', { container: document.body }));

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('last', 'desc'), true);
  });

  test('Reports criteria changes', async () => {
    const eventSpy = jest.spyOn(scene, 'publishEvent');

    render(<scene.Component model={scene} />);

    await waitFor(() => select(screen.getByLabelText('Sort direction'), 'Asc', { container: document.body }));

    expect(eventSpy).toHaveBeenCalledWith(new SortCriteriaChanged('changepoint', 'asc'), true);
  });
});
