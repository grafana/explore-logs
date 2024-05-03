import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { AppliedPattern } from './IndexScene';
import { PatternTag } from './PatternTag';
import { css } from '@emotion/css';
import { useStyles2, Text } from '@grafana/ui';

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

  return (
    <div>
      {includePatterns.length > 0 && (
        <div className={styles.patternsContainer}>
          <Text variant="bodySmall" weight="bold">
            {excludePatterns.length > 0 ? 'Include patterns' : 'Patterns'}
          </Text>
          <div className={styles.patterns}>
            {includePatterns.map((p) => (
              <PatternTag
                key={p.pattern}
                pattern={p.pattern}
                onRemove={() => onRemove(patterns.filter((pat) => pat !== p))}
              />
            ))}
          </div>
        </div>
      )}
      {excludePatterns.length > 0 && (
        <div className={styles.patternsContainer}>
          <Text variant="bodySmall" weight="bold">
            Exclude patterns:
          </Text>
          <div className={styles.patterns}>
            {excludePatterns.map((p) => (
              <PatternTag
                key={p.pattern}
                pattern={p.pattern}
                onRemove={() => onRemove(patterns.filter((pat) => pat !== p))}
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
