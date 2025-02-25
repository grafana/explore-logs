// Warning, this file is included in the main module.tsx bundle, and doesn't contain any imports to keep that bundle size small. Don't add imports to this file!

/**
 * Methods copied from scenes that we want in the module (to generate links which cannot be lazy loaded), without including all of scenes.
 * See https://github.com/grafana/scenes/issues/1046
 */
// based on the openmetrics-documentation, the 3 symbols we have to handle are:
// - \n ... the newline character
// - \  ... the backslash character
// - "  ... the double-quote character
export function escapeLabelValueInExactSelector(labelValue: string): string {
  return labelValue.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}
