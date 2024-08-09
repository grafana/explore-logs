import { QueryRunnerState, sceneGraph, SceneQueryRunner } from '@grafana/scenes';

export class LogsSceneQueryRunner extends SceneQueryRunner {
  constructor(initialState: QueryRunnerState) {
    super(initialState);
  }

  public runQueries() {
    const timeRange = sceneGraph.getTimeRange(this);

    // We don't want to subscribe to time range changes, or we'll get duplicate queries
    // this.subscribeToTimeRangeChanges(timeRange);

    // @todo can we make runWithTimeRange protected? (https://github.com/grafana/scenes/pull/866)
    // Hack to call private method
    this['runWithTimeRange'](timeRange);
  }
}
