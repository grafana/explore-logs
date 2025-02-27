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
      <span>
        <div className={styles.titleWrap}>
          <span>Line filter</span>
          <IconButton onClick={onClick} name={'times'} size={'xs'} aria-label={'Remove line filter'} />
        </div>
        <span className={styles.collapseWrap}>
          <LineFilterEditor {...props} focus={focus} setFocus={setFocus} type={'variable'} />
          {focus && (
            <IconButton
              className={styles.collapseBtn}
              tooltip={'Collapse'}
              size={'lg'}
              aria-label={'Collapse filter'}
              onClick={() => setFocus(false)}
              name={'table-collapse-all'}
            />
          )}
        </span>
      </span>
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
  collapseWrap: css({
    display: 'flex',
  }),
  collapseBtn: css({
    marginLeft: theme.spacing(1),
  }),
});
