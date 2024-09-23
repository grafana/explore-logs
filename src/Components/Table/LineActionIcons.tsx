import { ClipboardButton, CodeEditor, IconButton, Modal, useTheme2 } from '@grafana/ui';
import React, { useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { SelectedTableRow } from 'Components/Table/LogLineCellComponent';
import { useQueryContext } from 'Components/Table/Context/QueryContext';
import { testIds } from '../../services/testIds';
import { locationService } from '@grafana/runtime';
import { isString } from 'lodash';

export enum UrlParameterType {
  SelectedLine = 'selectedLine',
  From = 'from',
  To = 'to',
}

export const getStyles = (theme: GrafanaTheme2, bgColor?: string) => ({
  clipboardButton: css({
    padding: 0,
    height: '100%',
    lineHeight: '1',
    width: '20px',
  }),
  inspectButton: css({
    display: 'inline-flex',
    verticalAlign: 'middle',
    margin: 0,
    overflow: 'hidden',
    borderRadius: '5px',
  }),
  iconWrapper: css({
    height: '35px',
    position: 'sticky',
    left: 0,
    display: 'flex',
    background: theme.colors.background.secondary,
    padding: `0 ${theme.spacing(0.5)}`,
    zIndex: 1,
    boxShadow: theme.shadows.z2,
  }),
  inspect: css({
    padding: '5px 3px',

    '&:hover': {
      color: theme.colors.text.link,
      cursor: 'pointer',
    },
  }),
});
export function LineActionIcons(props: { rowIndex: number; value: unknown }) {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { logsFrame, timeRange } = useQueryContext();
  const logId = logsFrame?.idField?.values[props.rowIndex];
  let value = logsFrame?.bodyField.values[props.rowIndex];
  let displayValue = value;
  const [isInspecting, setIsInspecting] = useState(false);

  if (isString(value)) {
    const trimmedValue = value.trim();
    // Exclude numeric strings like '123' from being displayed in code/JSON mode
    if (trimmedValue[0] === '{' || trimmedValue[0] === '[') {
      try {
        value = JSON.parse(value);
        displayValue = JSON.stringify(value, null, '  ');
      } catch (error: any) {
        // Display helpful error to help folks diagnose json errors
        console.log(
          'Failed to parse JSON in Table cell inspector (this will cause JSON to not print nicely): ',
          error.message
        );
      }
    }
  } else {
    displayValue = JSON.stringify(value);
  }
  let text = displayValue;

  return (
    <>
      <div className={styles.iconWrapper}>
        <div className={styles.inspect}>
          <IconButton
            data-testid={testIds.table.inspectLine}
            className={styles.inspectButton}
            tooltip="View log line"
            variant="secondary"
            aria-label="View log line"
            tooltipPlacement="top"
            size="md"
            name="eye"
            onClick={() => setIsInspecting(true)}
            tabIndex={0}
          />
        </div>
        <div className={styles.inspect}>
          <ClipboardButton
            className={styles.clipboardButton}
            icon="share-alt"
            variant="secondary"
            fill="text"
            size="md"
            tooltip="Copy link to log line"
            tooltipPlacement="top"
            tabIndex={0}
            getText={() => {
              const location = locationService.getLocation();
              const searchParams = new URLSearchParams(location.search);
              if (searchParams && timeRange) {
                const selectedLine: SelectedTableRow = {
                  row: props.rowIndex,
                  id: logId,
                };

                searchParams.set(UrlParameterType.From, timeRange.from.toISOString());
                searchParams.set(UrlParameterType.To, timeRange.to.toISOString());
                searchParams.set(UrlParameterType.SelectedLine, JSON.stringify(selectedLine));

                // @todo can encoding + as %20 break other stuff? Can label names or values have + in them that we don't want encoded? Should we just update values?
                // + encoding for whitespace is for application/x-www-form-urlencoded, which appears to be the default encoding for URLSearchParams, replacing + with %20 to keep urls meant for the browser from breaking
                const searchString = searchParams.toString().replace(/\+/g, '%20');
                return window.location.origin + location.pathname + '?' + searchString;
              }
              return '';
            }}
          />
        </div>
      </div>
      <>
        {isInspecting && (
          <Modal onDismiss={() => setIsInspecting(false)} isOpen={true} title="Inspect value">
            <CodeEditor
              width="100%"
              height={500}
              language="json"
              showLineNumbers={true}
              showMiniMap={(text && text.length) > 100}
              value={text}
              readOnly={true}
              wordWrap={true}
            />
            <Modal.ButtonRow>
              <ClipboardButton icon="copy" getText={() => props.value as string}>
                Copy to Clipboard
              </ClipboardButton>
            </Modal.ButtonRow>
          </Modal>
        )}
      </>
    </>
  );
}
