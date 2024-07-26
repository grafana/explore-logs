import React from 'react';
import { Badge, Icon, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export const GiveFeedbackButton = () => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <a
        href="https://forms.gle/1sYWCTPvD72T1dPH9"
        className={styles.feedback}
        title="Share your thoughts about Logs in Grafana."
        target="_blank"
        rel="noreferrer noopener"
      >
        <Icon name="comment-alt-message" /> Give feedback
      </a>
      <a
        href="https://forms.gle/1sYWCTPvD72T1dPH9"
        className={styles.feedback}
        title="Share your thoughts about Logs in Grafana."
        target="_blank"
        rel="noreferrer noopener"
      >
        <Badge text={'Preview'} color={'blue'} icon={'rocket'} />
      </a>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      whiteSpace: 'nowrap',
    }),
    feedback: css({
      alignSelf: 'center',
      margin: '6px 6px 6px 0',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.link,
      },
    }),
  };
};
