import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import { testIds } from 'services/testIds';

type Props = {
  onInclude: () => void;
  onClear: () => void;
  isIncluded: boolean;
  onExclude: () => void;
  isExcluded: boolean;
  titles?: {
    include: string;
    exclude: string;
  };
};

export const FilterButton = (props: Props) => {
  const { isExcluded, isIncluded, onInclude, onExclude, onClear, titles } = props;
  const styles = useStyles2(getStyles, isIncluded, isExcluded);
  return (
    <div className={styles.container}>
      <Button
        variant={isIncluded ? 'primary' : 'secondary'}
        fill="outline"
        size="sm"
        aria-selected={isIncluded}
        className={styles.includeButton}
        onClick={isIncluded ? onClear : onInclude}
        data-testid={testIds.exploreServiceDetails.buttonFilterInclude}
        title={titles?.include}
      >
        Include
      </Button>
      <Button
        variant={isExcluded ? 'primary' : 'secondary'}
        fill="outline"
        size="sm"
        aria-selected={isExcluded}
        className={styles.excludeButton}
        onClick={isExcluded ? onClear : onExclude}
        title={titles?.exclude}
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
      borderLeft: isExcluded ? undefined : 'none',
    }),
  };
};
