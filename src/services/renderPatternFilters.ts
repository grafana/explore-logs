// Warning, this file is included in the main module.tsx bundle, and doesn't contain many imports to keep that bundle size small. Don't add imports to this file!
import { AppliedPattern } from './variables';
import { escapeLabelValueInExactSelector } from './extensions/scenesMethods';

export function renderPatternFilters(patterns: AppliedPattern[]) {
  const excludePatterns = patterns.filter((pattern) => pattern.type === 'exclude');
  const excludePatternsLine = excludePatterns
    .map((p) => `!> "${escapeLabelValueInExactSelector(p.pattern)}"`)
    .join(' ')
    .trim();

  const includePatterns = patterns.filter((pattern) => pattern.type === 'include');
  let includePatternsLine = '';
  if (includePatterns.length > 0) {
    if (includePatterns.length === 1) {
      includePatternsLine = `|> "${escapeLabelValueInExactSelector(includePatterns[0].pattern)}"`;
    } else {
      includePatternsLine = `|> ${includePatterns
        .map((p) => `"${escapeLabelValueInExactSelector(p.pattern)}"`)
        .join(' or ')}`;
    }
  }
  return `${excludePatternsLine} ${includePatternsLine}`.trim();
}
