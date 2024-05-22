import React from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, useTheme2 } from '@grafana/ui';

import { useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { FieldNameMetaStore } from 'Components/Table/TableTypes';
import { debouncedFuzzySearch } from 'Components/Table/uFuzzy/uFuzzy';
import { reportInteraction } from '@grafana/runtime';

function getStyles(theme: GrafanaTheme2) {
  return {
    searchWrap: css({
      padding: `${theme.spacing(0.4)} 0 ${theme.spacing(0.4)} ${theme.spacing(0.4)}`,
    }),
  };
}

interface LogsColumnSearchProps {
  searchValue: string;
  setSearchValue: (value: string) => void;
}
export function LogsColumnSearch({ searchValue, setSearchValue }: LogsColumnSearchProps) {
  const { columns, setFilteredColumns } = useTableColumnContext();

  // uFuzzy search dispatcher, adds any matches to the local state
  const dispatcher = (data: string[][]) => {
    const matches = data[0];
    let newColumnsWithMeta: FieldNameMetaStore = {};
    let numberOfResults = 0;
    matches.forEach((match) => {
      if (match in columns) {
        newColumnsWithMeta[match] = columns[match];
        numberOfResults++;
      }
    });
    setFilteredColumns(newColumnsWithMeta);
    searchFilterEvent(numberOfResults);
  };

  // uFuzzy search
  const search = (needle: string) => {
    debouncedFuzzySearch(Object.keys(columns), needle, dispatcher);
  };

  // onChange handler for search input
  const onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget?.value;
    setSearchValue(value);
    if (value) {
      search(value);
    } else {
      // If the search input is empty, reset the local search state.
      setFilteredColumns(undefined);
    }
  };

  const theme = useTheme2();
  const styles = getStyles(theme);
  return (
    <Field className={styles.searchWrap}>
      <Input value={searchValue} type={'text'} placeholder={'Search fields by name'} onChange={onSearchInputChange} />
    </Field>
  );
}

function searchFilterEvent(searchResultCount: number) {
  reportInteraction('grafana_logs_app_table_text_search_result_count', {
    resultCount: searchResultCount,
  });
}
