import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { LineFilterEditor } from '../ServiceScene/LineFilter/LineFilterEditor';
import React, { ChangeEvent, KeyboardEvent, useState } from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
import { LineFilterCaseSensitive } from '../../services/filterTypes';
import { RegexInputValue } from '../ServiceScene/LineFilter/RegexIconButton';

export interface LineFilterProps {
  exclusive: boolean;
  lineFilter: string;
  caseSensitive: boolean;
  regex: boolean;
  setExclusive: (exclusive: boolean) => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onCaseSensitiveToggle: (caseSensitive: LineFilterCaseSensitive) => void;
  onRegexToggle: (regex: RegexInputValue) => void;
  updateFilter: (lineFilter: string, debounced: boolean) => void;
  handleEnter: (e: KeyboardEvent<HTMLInputElement>, lineFilter: string) => void;
  onSubmitLineFilter?: () => void;
  onClearLineFilter?: () => void;
}

export function LineFilterVariable({ onClick, props }: { onClick: () => void; props: LineFilterProps }) {
  const [focus, setFocus] = useState(false);
  const styles = useStyles2(getLineFilterStyles);
  return (
    <>
      <span className={styles.wrapper}>
        <div className={styles.titleWrap}>
          <span>Line filter</span>
          <IconButton onClick={onClick} name={'times'} size={'xs'} aria-label={'Line filter variable'} />
        </div>
        <LineFilterEditor {...props} focus={focus} setFocus={setFocus} />
      </span>
      {focus && <div className={styles.lineSpacer}></div>}
    </>
  );
}

const getLineFilterStyles = (theme: GrafanaTheme2) => ({
  titleWrap: css({
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    marginBottom: theme.spacing(0.5),
    gap: theme.spacing(1),
  }),
  wrapper: css({
    // maxWidth: '300px',
  }),
  lineSpacer: css({
    width: '100%',
  }),
});
