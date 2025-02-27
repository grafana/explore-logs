import React, { useEffect, useState } from 'react';
import { RegexIconButton } from './RegexIconButton';
import { Button, Field, Select, useStyles2 } from '@grafana/ui';
import { testIds } from '../../../services/testIds';
import { css, cx } from '@emotion/css';
import { LineFilterCaseSensitivityButton } from './LineFilterCaseSensitivityButton';
import { GrafanaTheme2 } from '@grafana/data';
import { LineFilterInput } from '../Breakdowns/LineFilterInput';
import { LineFilterProps } from '../../IndexScene/LineFilterVariable';

export interface LineFilterEditorProps extends LineFilterProps {
  focus: boolean;
  setFocus: (focus: boolean) => void;
}

const INITIAL_INPUT_WIDTH = 40;

export function LineFilterEditor({
  exclusive,
  lineFilter,
  caseSensitive,
  setExclusive,
  regex,
  onInputChange,
  onCaseSensitiveToggle,
  onRegexToggle,
  handleEnter,
  onSubmitLineFilter,
  onClearLineFilter,
  focus,
  setFocus,
}: LineFilterEditorProps) {
  const styles = useStyles2(getStyles);
  const [width, setWidth] = useState(INITIAL_INPUT_WIDTH);

  function resize(content?: string) {
    // The input width roughly corresponds to char count
    const width = Math.max(content?.length ?? 0, INITIAL_INPUT_WIDTH);
    // We add a few extra because the buttons are absolutely positioned within the input width
    setWidth(width + 8);
  }

  useEffect(() => {
    resize(lineFilter);
  }, [lineFilter, focus]);

  return (
    <div className={styles.wrapper}>
      {!onSubmitLineFilter && (
        <Select
          prefix={null}
          className={styles.select}
          value={exclusive ? 'exclusive' : 'inclusive'}
          options={[
            {
              value: 'exclusive',
              label: 'Exclude',
            },
            {
              value: 'inclusive',
              label: 'Include',
            },
          ]}
          onChange={() => setExclusive(!exclusive)}
        />
      )}
      <Field className={styles.field}>
        <LineFilterInput
          // Only set width if focused
          width={focus ? width : undefined}
          onFocus={() => setFocus(true)}
          // onBlur={() => setFocus(false)}
          data-testid={testIds.exploreServiceDetails.searchLogs}
          value={lineFilter}
          className={cx(onSubmitLineFilter ? styles.inputNoBorderRight : undefined, styles.input)}
          onChange={onInputChange}
          suffix={
            <span className={`${styles.suffix} input-suffix`}>
              <LineFilterCaseSensitivityButton
                caseSensitive={caseSensitive}
                onCaseSensitiveToggle={onCaseSensitiveToggle}
              />
              <RegexIconButton regex={regex} onRegexToggle={onRegexToggle} />
            </span>
          }
          prefix={null}
          placeholder="Search in log lines"
          onClear={onClearLineFilter}
          onKeyUp={(e) => {
            handleEnter(e, lineFilter);
            resize(lineFilter);
          }}
        />
      </Field>
      {onSubmitLineFilter && (
        <span className={styles.buttonWrap}>
          <Button
            onClick={() => {
              setExclusive(false);
              onSubmitLineFilter();
            }}
            className={styles.includeButton}
            variant={'secondary'}
            fill={'outline'}
            disabled={!lineFilter}
          >
            Include
          </Button>
          <Button
            onClick={() => {
              setExclusive(true);
              onSubmitLineFilter();
            }}
            className={styles.excludeButton}
            variant={'secondary'}
            fill={'outline'}
            disabled={!lineFilter}
          >
            Exclude
          </Button>
        </span>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inputNoBorderRight: css({
    input: {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
  }),
  suffix: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
  }),
  removeBtn: css({
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  }),
  buttonWrap: css({
    display: 'flex',
    justifyContent: 'center',
  }),
  includeButton: css({
    borderLeft: 'none',
    borderRadius: 0,
    borderRight: 'none',
    '&[disabled]': {
      borderRight: 'none',
    },
  }),
  excludeButton: css({
    borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
    borderLeft: 'none',
    '&[disabled]': {
      borderLeft: 'none',
    },
  }),
  submit: css({
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  }),
  select: css({
    label: 'line-filter-exclusion',
    marginLeft: 0,
    paddingLeft: 0,
    height: 'auto',
    borderBottomRightRadius: '0',
    borderTopRightRadius: '0',
    borderRight: 'none',
    minHeight: '30px',
    minWidth: '95px',
    maxWidth: '95px',
    outline: 'none',
  }),
  wrapper: css({
    display: 'flex',
    width: '100%',
  }),
  input: css({
    label: 'line-filter-input-wrapper',
    minWidth: '200px',
    // Keeps the input from overflowing container on resize
    maxWidth: 'calc(100vw - 198px)',

    input: {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      fontFamily: 'monospace',
      fontSize: theme.typography.bodySmall.fontSize,
      width: '100%',
    },
  }),
  exclusiveBtn: css({
    marginRight: '1rem',
  }),
  field: css({
    label: 'field',
    flex: '0 1 auto',
    marginBottom: 0,
  }),
});
