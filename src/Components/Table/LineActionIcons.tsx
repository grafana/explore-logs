import { ClipboardButton, IconButton, Modal, useTheme2 } from '@grafana/ui';
import React, { useState } from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { SelectedTableRow } from 'Components/Table/LogLineCellComponent';
import { useQueryContext } from 'Components/Table/Context/QueryContext';
import { testIds } from '../../services/testIds';
import { locationService } from '@grafana/runtime';

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
  const lineValue = logsFrame?.bodyField.values[props.rowIndex];
  const [isInspecting, setIsInspecting] = useState(false);
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
            <pre>{lineValue}</pre>
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
