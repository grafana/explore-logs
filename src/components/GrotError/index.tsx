import React from 'react';

import { css } from '@emotion/css';
import SVG from 'react-inlinesvg';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2, Text, TextLink } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    graphicContainer: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    graphic: css({ height: '120px', padding: theme.spacing(1) }),
    text: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }),
  };
};

export const GrotError = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  return (
    <>
      <div className={styles.graphicContainer}>
        <SVG
          className={styles.graphic}
          src={
            theme.isDark
              ? `/public/plugins/grafana-explorelogs-app/img/grot_err.svg`
              : `/public/plugins/grafana-explorelogs-app/img/grot_err_light.svg`
          }
        />
      </div>
      <div className={styles.text}>
        <Text textAlignment="center" color="primary" element="p">
          Sorry, we could not detect any patterns.
          <p>
            Check back later or reachout to the{' '}
            <TextLink href="https://slack.grafana.com/" external>
              Grafana Labs community Slack channel
            </TextLink>
          </p>
          Patterns let you detect similar log lines and add or exclude them from your search.
        </Text>
      </div>
    </>
  );
};
