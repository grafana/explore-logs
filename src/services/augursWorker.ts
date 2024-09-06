import init, { type Changepoints, ChangepointDetector, OutlierDetector, OutlierOutput } from '@bsull/augurs';

const wasmSupported = () => {
  const support = typeof WebAssembly === 'object';

  // if (!support) {
  //   reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.wasm_not_supported);
  // }

  return support;
};

if (wasmSupported()) {
  init();
}

export function detectChangepoints(values: Float64Array): Changepoints {
  return ChangepointDetector.defaultArgpcp().detectChangepoints(values);
}

interface DetectOutliersOptions {
  points: Float64Array;
  nTimestamps: number;
  sensitivity: number;
}

export function detectOutliers(opts: DetectOutliersOptions): OutlierOutput {
  return OutlierDetector.dbscan({ sensitivity: opts.sensitivity }).preprocess(opts.points, opts.nTimestamps).detect();
}
