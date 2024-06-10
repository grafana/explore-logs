import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { AppliedPattern } from './IndexScene';
import { PatternTag } from './PatternTag';
import { css } from '@emotion/css';
import { useStyles2, Text } from '@grafana/ui';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { testIds } from 'services/testIds';

type Props = {
  patterns: AppliedPattern[] | undefined;
  onRemove: (patterns: AppliedPattern[]) => void;
};
export const PatternControls = ({ patterns, onRemove }: Props) => {
  const styles = useStyles2(getStyles);

  if (!patterns || patterns.length === 0) {
    return null;
  }

  const includePatterns = patterns.filter((pattern) => pattern.type === 'include');
  const excludePatterns = patterns.filter((pattern) => pattern.type !== 'include');

  const onRemovePattern = (pattern: AppliedPattern) => {
    onRemove(patterns.filter((pat) => pat !== pattern));
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.pattern_removed, {
      includePatternsLength: includePatterns.length - (pattern?.type === 'include' ? 1 : 0),
      excludePatternsLength: excludePatterns.length - (pattern?.type !== 'include' ? 1 : 0),
      type: pattern.type,
    });
  };

  return (
    <div>
      {includePatterns.length > 0 && (
        <div className={styles.patternsContainer}>
          <Text variant="bodySmall" weight="bold" data-testid={testIds.patterns.buttonIncludedPattern}>
            Included pattern{patterns.length > 1 ? 's' : ''}
          </Text>
          <div className={styles.patterns}>
            {includePatterns.map((p) => (
              <PatternTag key={p.pattern} pattern={p.pattern} size="lg" onRemove={() => onRemovePattern(p)} />
            ))}
          </div>
        </div>
      )}
      {excludePatterns.length > 0 && (
        <div className={styles.patternsContainer}>
          <Text variant="bodySmall" weight="bold" data-testid={testIds.patterns.buttonExcludedPattern}>
            Excluded pattern{excludePatterns.length > 1 ? 's' : ''}:
          </Text>
          <div className={styles.patterns}>
            {excludePatterns.map((p) => (
              <PatternTag
                key={p.pattern}
                pattern={p.pattern}
                size={excludePatterns.length > 1 ? 'sm' : 'lg'}
                onRemove={() => onRemovePattern(p)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    patternsContainer: css({
      paddingBottom: theme.spacing(1),
      overflow: 'hidden',
    }),
    patterns: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
      flexWrap: 'wrap',
    }),
  };
}
