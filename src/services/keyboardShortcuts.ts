import { IndexScene } from '../Components/IndexScene/IndexScene';
import { KeybindingSet } from './KeybindingSet';
import { getAppEvents, locationService } from '@grafana/runtime';
import { BusEventBase, BusEventWithPayload, SetPanelAttentionEvent } from '@grafana/data';
import { sceneGraph, SceneObject, sceneUtils, VizPanel } from '@grafana/scenes';
import { getExploreLink } from '../Components/Panels/PanelMenu';
import { getTimePicker } from './scenes';
import { OptionsWithLegend } from '@grafana/ui';

const appEvents = getAppEvents();

export function setupKeyboardShortcuts(scene: IndexScene) {
  const keybindings = new KeybindingSet();
  let vizPanelKey: string | null = null;

  const panelAttentionSubscription = appEvents.subscribe(SetPanelAttentionEvent, (event) => {
    if (typeof event.payload.panelId === 'string') {
      vizPanelKey = event.payload.panelId;
    }
  });

  function withFocusedPanel(scene: IndexScene, fn: (vizPanel: VizPanel) => void) {
    return () => {
      const vizPanel = sceneGraph.findObject(scene, (o) => o.state.key === vizPanelKey && o.isActive);
      if (vizPanel && vizPanel instanceof VizPanel) {
        fn(vizPanel);
        return;
      }
    };
  }

  function withAllPanels(scene: IndexScene, fn: (vizPanel: VizPanel) => void) {
    return () => {
      const vizPanels = sceneGraph.findAllObjects(scene, (o) => o instanceof VizPanel && o.isActive);
      vizPanels.forEach((vizPanel) => {
        if (vizPanel && vizPanel instanceof VizPanel) {
          fn(vizPanel);
        }
      });
    };
  }

  // Toggle legend
  keybindings.addBinding({
    key: 'p l',
    onTrigger: withFocusedPanel(scene, toggleVizPanelLegend),
  });

  // Toggle all legend
  keybindings.addBinding({
    key: 'a l',
    onTrigger: withAllPanels(scene, toggleVizPanelLegend),
  });

  // Go to Explore for panel
  keybindings.addBinding({
    key: 'p x',
    onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
      const url = getExploreLink(vizPanel);
      if (url) {
        locationService.push(url);
      }
    }),
  });

  // Copy time range
  keybindings.addBinding({
    key: 't c',
    onTrigger: () => {
      const timeRange = sceneGraph.getTimeRange(scene);
      setWindowGrafanaSceneContext(timeRange);
      appEvents.publish(new CopyTimeEvent());
    },
  });

  // Paste time range
  keybindings.addBinding({
    key: 't v',
    onTrigger: () => {
      appEvents.publish(new PasteTimeEvent({ updateUrl: true }));
    },
  });

  // Refresh
  keybindings.addBinding({
    key: 'd r',
    onTrigger: () => sceneGraph.getTimeRange(scene).onRefresh(),
  });

  // Zoom out
  keybindings.addBinding({
    key: 't z',
    onTrigger: () => {
      handleZoomOut(scene);
    },
  });

  // Zoom out alias
  keybindings.addBinding({
    key: 'ctrl+z',
    onTrigger: () => {
      handleZoomOut(scene);
    },
  });

  // Relative -> Absolute time range
  keybindings.addBinding({
    key: 't a',
    onTrigger: () => {
      const timePicker = getTimePicker(scene);
      timePicker?.toAbsolute();
    },
  });

  keybindings.addBinding({
    key: 't left',
    onTrigger: () => {
      handleTimeRangeShift(scene, 'left');
    },
  });
  keybindings.addBinding({
    key: 't right',
    onTrigger: () => {
      handleTimeRangeShift(scene, 'right');
    },
  });
  return () => {
    keybindings.removeAll();
    panelAttentionSubscription.unsubscribe();
  };
}

function handleZoomOut(scene: IndexScene) {
  const timePicker = getTimePicker(scene);
  timePicker?.onZoom();
}

function handleTimeRangeShift(scene: IndexScene, direction: 'left' | 'right') {
  const timePicker = getTimePicker(scene);

  if (!timePicker) {
    return;
  }

  if (direction === 'left') {
    timePicker.onMoveBackward();
  }
  if (direction === 'right') {
    timePicker.onMoveForward();
  }
}

export function toggleVizPanelLegend(vizPanel: VizPanel): void {
  const options = vizPanel.state.options;
  if (hasLegendOptions(options) && typeof options.legend.showLegend === 'boolean') {
    vizPanel.onOptionsChange({
      legend: {
        showLegend: options.legend.showLegend ? false : true,
      },
    });
  }
}

function hasLegendOptions(optionsWithLegend: unknown): optionsWithLegend is OptionsWithLegend {
  return optionsWithLegend != null && typeof optionsWithLegend === 'object' && 'legend' in optionsWithLegend;
}

// Copied from https://github.com/grafana/grafana/blob/main/public/app/types/events.ts
// @todo export from core grafana
export class CopyTimeEvent extends BusEventBase {
  static type = 'copy-time';
}

// Copied from https://github.com/grafana/grafana/blob/main/public/app/types/events.ts
// @todo export from core grafana
interface PasteTimeEventPayload {
  updateUrl?: boolean;
}

// Copied from https://github.com/grafana/grafana/blob/main/public/app/types/events.ts
// @todo export from core grafana
export class PasteTimeEvent extends BusEventWithPayload<PasteTimeEventPayload> {
  static type = 'paste-time';
}

/**
 * @todo delete after https://github.com/grafana/scenes/pull/999 is available
 * @param activeScene
 */
export function setWindowGrafanaSceneContext(activeScene: SceneObject) {
  const prevScene = (window as any).__grafanaSceneContext;

  (window as any).__grafanaSceneContext = activeScene;

  return () => {
    if ((window as any).__grafanaSceneContext === activeScene) {
      (window as any).__grafanaSceneContext = prevScene;
    }
  };
}
