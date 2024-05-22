import { sceneGraph, SceneObjectState } from '@grafana/scenes';
import { IndexScene } from '../../IndexScene/IndexScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';

export interface FilterByPatternsButtonState extends SceneObjectState {
  pattern: string;
  type: 'exclude' | 'include';
}

export interface FilterByPatternsState extends FilterByPatternsButtonState {
  indexScene: IndexScene;
}

export function onPatternClick(props: FilterByPatternsState) {
  const { indexScene: staleIndex, pattern, type } = { ...props };

  const indexScene = sceneGraph.getAncestor(staleIndex, IndexScene);

  if (!indexScene) {
    console.warn('logs exploration scene not found');
    return;
  }

  const { patterns = [] } = indexScene.state;

  // Remove the pattern if it's already there
  const filteredPatterns = patterns.filter(
    (pat) => pat.pattern !== pattern && type !== 'include' && pat.type !== 'include'
  );

  // Analytics
  const includePatternsLength = filteredPatterns.filter((p) => p.type === 'include')?.length ?? 0;
  const excludePatternsLength = filteredPatterns.filter((p) => p.type === 'exclude')?.length ?? 0;
  reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.pattern_selected, {
    type: type,
    includePatternsLength: includePatternsLength + (type === 'include' ? 1 : 0),
    excludePatternsLength: excludePatternsLength + (type === 'exclude' ? 1 : 0),
  });

  indexScene.setState({
    patterns: [...filteredPatterns, { pattern: pattern, type: type }],
  });
}
