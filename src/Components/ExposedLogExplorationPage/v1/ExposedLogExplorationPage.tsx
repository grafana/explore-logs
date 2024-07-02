import { AdHocVariableFilter, TimeRange, dateTimeParse } from "@grafana/data";
import { SceneTimeRange } from '@grafana/scenes';
import { IndexScene } from "Components/IndexScene/IndexScene";
import { isEqual } from "lodash";
import React, { useEffect, useMemo } from "react";

const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

interface Props {
  initialFilters?: AdHocVariableFilter[];
  initialDS?: string;
  initialTimeRange?: TimeRange;
  onTimeRangeChange?: (timeRange: TimeRange) => void;
}

export function ExposedLogExplorationPage({ initialFilters, initialDS, initialTimeRange, onTimeRangeChange }: Props) {
  const [isInitialized, setIsInitialized] = React.useState(false);
  // Must memoize the top-level scene or any route change will re-instantiate all the scene classes
  const scene = useMemo(
    () =>
      new IndexScene({
        $timeRange: new SceneTimeRange(
          initialTimeRange
            ? {
                from:
                  typeof initialTimeRange.raw.from === 'string'
                    ? initialTimeRange.raw.from
                    : initialTimeRange.raw.from.toISOString(),
                to:
                  typeof initialTimeRange.raw.to === 'string'
                    ? initialTimeRange.raw.to
                    : initialTimeRange.raw.to.toISOString(),
              }
            : DEFAULT_TIME_RANGE
        ),
        $behaviors: [
          (scene: IndexScene) => {
            const unsubscribable = scene.state.$timeRange?.subscribeToState((newState, oldState) => {
              if (!isEqual(newState, oldState)) {
                const timeRange: TimeRange = {
                  from: dateTimeParse(newState.from),
                  to: dateTimeParse(newState.to),
                  raw: {
                    from: newState.from,
                    to: newState.to,
                  },
                };
                onTimeRangeChange?.(timeRange);
              }
            });

            return () => {
              unsubscribable?.unsubscribe();
            };
          },
        ],
        initialFilters,
        initialDS,
        mode: 'service_details',
      }),
    //eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [scene, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
}
