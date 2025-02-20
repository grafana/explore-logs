import React from 'react';
import { useStyles2, useTheme2 } from '@grafana/ui';
import SVG from 'react-inlinesvg';
import { GrafanaTheme2, locationUtil } from '@grafana/data';
import { css } from '@emotion/css';

export const NoLokiSplash = () => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  return (
    <div className={styles.wrap}>
      <div className={styles.graphicContainer}>
        <SVG
          src={
            theme.isDark
              ? `/public/plugins/grafana-lokiexplore-app/img/grot_loki.svg`
              : `/public/plugins/grafana-lokiexplore-app/img/grot_loki.svg`
          }
        />
      </div>
      <div className={styles.text}>
        <h3 className={styles.title}>Welcome to Grafana Logs Drilldown</h3>

        <p>
          We noticed there is no Loki datasource configured.
          <br />
          Add a{' '}
          <a className={'external-link'} href={locationUtil.assureBaseUrl(`/connections/datasources/new`)}>
            Loki datasource
          </a>{' '}
          to view logs.
        </p>

        <br />

        <p>
          Click{' '}
          <a
            href={'https://grafana.com/docs/grafana/latest/explore/simplified-exploration/logs/'}
            target={'_blank'}
            className={'external-link'}
            rel="noreferrer"
          >
            here
          </a>{' '}
          to learn more...
        </p>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    graphicContainer: css({
      display: 'flex',
      justifyContent: 'center',
      margin: '0 auto',
      width: '200px',
      height: '250px',
      padding: theme.spacing(1),
      [theme.breakpoints.up('md')]: {
        alignSelf: 'flex-end',
        width: '300px',
        height: 'auto',
        padding: theme.spacing(1),
      },
      [theme.breakpoints.up('lg')]: {
        alignSelf: 'flex-end',
        width: '400px',
        height: 'auto',
        padding: theme.spacing(1),
      },
    }),

    text: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
    }),
    title: css({
      marginBottom: '1.5rem',
    }),
    wrap: css({
      [theme.breakpoints.up('md')]: {
        margin: '4rem auto auto auto',
        flexDirection: 'row',
      },
      padding: '2rem',
      margin: '0 auto auto auto',
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'column',
      textAlign: 'center',
    }),
  };
};
