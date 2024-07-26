import React from 'react';

import { css } from '@emotion/css';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2, Text } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    graphicContainer: css({
      display: 'flex',
      justifyContent: 'center',
      margin: '0 auto',
    }),
    graphic: css({ width: '200px', height: '120px', padding: theme.spacing(1) }),
    text: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }),
    wrap: css({
      margin: '0 auto',
    }),
  };
};

type Props = {
  children?: React.ReactNode;
};

export const GrotError = ({ children }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  return (
    <div className={styles.wrap}>
      <div className={styles.graphicContainer}>
        <SVG
          className={styles.graphic}
          src={
            theme.isDark
              ? `/public/plugins/grafana-lokiexplore-app/img/grot_err.svg`
              : `/public/plugins/grafana-lokiexplore-app/img/grot_err_light.svg`
          }
        />
      </div>
      <div className={styles.text}>
        <Text textAlignment="center" color="primary" element="span">
          {children ? children : 'An error occurred'}
        </Text>
      </div>
    </div>
  );
};
