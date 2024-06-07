import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';

type Props = {
  onInclude: () => void;
  onReset: () => void;
  isIncluded: boolean;
  // temporary fix for the case when we want to show only include button (without exclude button)
  onlyIncluded?: boolean;
  // these are optional in case we want to show only included button
  onExclude?: () => void;
  isExcluded?: boolean;
};

export const FilterButton = (props: Props) => {
  const { isExcluded, isIncluded, onInclude, onExclude, onReset, onlyIncluded } = props;
  const styles = useStyles2(getStyles, isIncluded, isExcluded, onlyIncluded);
  return (
    <div className={styles.container}>
      <Button
        variant={isIncluded ? 'primary' : 'secondary'}
        fill="outline"
        size="sm"
        className={styles.includeButton}
        onClick={isIncluded ? onReset : onInclude}
      >
        {isIncluded && onlyIncluded ? 'Undo include' : 'Include'}
      </Button>

      {!onlyIncluded && (
        <Button
          variant={isExcluded ? 'primary' : 'secondary'}
          fill="outline"
          size="sm"
          className={styles.excludeButton}
          onClick={isExcluded ? onReset : onExclude}
        >
          Exclude
        </Button>
      )}
    </div>
  );
};

const getStyles = (
  theme: GrafanaTheme2,
  isIncluded: boolean,
  isExcluded: boolean | undefined,
  onlyIncluded: boolean | undefined
) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    includeButton: css({
      borderRadius: 0,
      borderRight: isIncluded || onlyIncluded ? undefined : 'none',
    }),
    excludeButton: css({
      borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
      borderLeft: isExcluded ? undefined : 'none',
    }),
  };
};
