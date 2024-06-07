import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import { testIds } from 'services/testIds';

type Props = {
  onInclude: () => void;
  onExclude: () => void;
  onReset: () => void;
  isIncluded: boolean;
  isExcluded: boolean;
};

export const FilterButton = (props: Props) => {
  const { isExcluded, isIncluded, onInclude, onExclude, onReset } = props;
  const styles = useStyles2(getStyles, isIncluded, isExcluded);
  return (
    <div className={styles.container}>
      <Button
        variant={isIncluded ? 'primary' : 'secondary'}
        fill="outline"
        size="sm"
        className={styles.includeButton}
        onClick={isIncluded ? onReset : onInclude}
        data-testid={testIds.exploreServiceDetails.buttonFilterInclude}
      >
        Include
      </Button>
      <Button
        variant={isExcluded ? 'primary' : 'secondary'}
        fill="outline"
        size="sm"
        className={styles.excludeButton}
        onClick={isExcluded ? onReset : onExclude}
        data-testid={testIds.exploreServiceDetails.buttonFilterExclude}
      >
        Exclude
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, isIncluded: boolean, isExcluded: boolean) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    includeButton: css({
      borderRadius: 0,
      borderRight: isIncluded ? undefined : 'none',
    }),
    excludeButton: css({
      borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
      borderLeft: isExcluded || !isIncluded ? undefined : 'none',
    }),
  };
};
