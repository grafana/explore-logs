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
  buttonFill: 'solid' | 'outline' | 'text';
  titles?: {
    include: string;
    exclude: string;
  };
  hideExclude?: boolean
};

export const FilterButton = (props: Props) => {
  const { isExcluded, isIncluded, onInclude, onExclude, onClear, titles, buttonFill, hideExclude } = props;
  const styles = useStyles2(getStyles, isIncluded, isExcluded, hideExclude);
  return (
    <div className={styles.container}>
      <Button
        variant={isIncluded ? 'primary' : 'secondary'}
        fill={buttonFill}
        size="sm"
        aria-selected={isIncluded}
        className={styles.includeButton}
        onClick={isIncluded ? onClear : onInclude}
        data-testid={testIds.exploreServiceDetails.buttonFilterInclude}
        title={titles?.include}
      >
        Include
      </Button>
      {!hideExclude && <Button
          variant={isExcluded ? 'primary' : 'secondary'}
          fill={buttonFill}
          size="sm"
          aria-selected={isExcluded}
          className={styles.excludeButton}
          onClick={isExcluded ? onClear : onExclude}
          title={titles?.exclude}
          data-testid={testIds.exploreServiceDetails.buttonFilterExclude}
      >
        Exclude
      </Button>}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, isIncluded: boolean, isExcluded: boolean, hideExclude?: boolean) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    includeButton: css({
      borderRadius: 0,
      borderRight: isIncluded || hideExclude ? undefined : 'none',
    }),
    excludeButton: css({
      borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
      borderLeft: isExcluded ? undefined : 'none',
    }),
  };
};
