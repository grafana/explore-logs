import React, { useRef, useState } from 'react';
import { AdHocFiltersVariable, sceneGraph } from '@grafana/scenes';
import { Spinner, Toggletip } from '@grafana/ui';
import { getLokiDatasource } from 'services/scenes';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { VAR_FILTERS } from 'services/variables';
import { buildLokiQuery } from 'services/query';
import { PatternFieldLabelStats } from './PatternFieldLabelStats';
import { LogLabelStatsModel, TimeRange } from '@grafana/data';

interface PatternNameLabelProps {
  exploration: IndexScene;
  pattern: string;
}

const LINE_LIMIT = 2000;

export const PatternNameLabel = ({ exploration, pattern }: PatternNameLabelProps) => {
  const patternIndices = extractPatternIndices(pattern);
  const [stats, setStats] = useState<LogLabelStatsModel[][] | undefined>(undefined);

  // Refs to store the previous values of query and timeRange
  const previousQueryRef = useRef<string>('');
  const previousTimeRangeRef = useRef<TimeRange>();

  const handleClick = async () => {
    const query = constructQuery(
      pattern,
      patternIndices,
      sceneGraph.lookupVariable(VAR_FILTERS, exploration) as AdHocFiltersVariable
    );
    const datasource = await getLokiDatasource(exploration);
    const currentTimeRange = sceneGraph.getTimeRange(exploration).state.value;

    // If the query and timeRange are the same as the previous ones, do not re-query
    if (stats && query === previousQueryRef.current && currentTimeRange === previousTimeRangeRef.current) {
      return;
    }

    // Update the refs with the new values
    previousQueryRef.current = query;
    previousTimeRangeRef.current = currentTimeRange;

    datasource
      ?.query({
        requestId: '1',
        interval: '',
        intervalMs: 0,
        scopedVars: {},
        range: currentTimeRange,
        targets: [buildLokiQuery(query, { maxLines: LINE_LIMIT })],
        timezone: '',
        app: '',
        startTime: 0,
      })
      .forEach((result) => {
        if (result.state !== 'Done') {
          setStats(undefined);
          return;
        }
        setStats(convertResultToStats(result, patternIndices.length));
      });
  };

  return (
    <div>
      {pattern.split('<_>').map((part, index) => (
        <span key={index}>
          {part}
          {index !== patternIndices.length && (
            <Toggletip
              onOpen={handleClick}
              content={
                stats ? (
                  <PatternFieldLabelStats stats={stats[index]} value="" />
                ) : (
                  <div style={{ padding: '10px' }}>
                    <Spinner size="xl" />
                  </div>
                )
              }
            >
              <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>&lt;_&gt;</span>
            </Toggletip>
          )}
        </span>
      ))}
    </div>
  );
};

// Convert the result to statistics data structure
function convertResultToStats(result: any, fieldCount: number): LogLabelStatsModel[][] {
  const fieldStatsMap = new Map<string, Map<string, number>>();

  // Populate the fieldStatsMap with values from the result
  result.data[0].fields[0].values.toArray().forEach((value: Record<string, any>) => {
    Object.keys(value).forEach((key) => {
      if (!fieldStatsMap.has(key)) {
        fieldStatsMap.set(key, new Map<string, number>());
      }
      fieldStatsMap.get(key)?.set(value[key], (fieldStatsMap.get(key)?.get(value[key]) || 0) + 1);
    });
  });

  const stats: LogLabelStatsModel[][] = [];

  // Construct stats array from fieldStatsMap
  for (let i = 0; i <= fieldCount; i++) {
    const fieldStats: LogLabelStatsModel[] = [];
    fieldStatsMap.get(`field_${i + 1}`)?.forEach((count, key) => {
      fieldStats.push({ value: key, count, proportion: count / LINE_LIMIT });
    });
    fieldStats.sort((a, b) => b.count - a.count);
    stats.push(fieldStats);
  }

  return stats;
}

// Extract indices of the pattern '<_>' in the given string
function extractPatternIndices(pattern: string): number[] {
  const indices: number[] = [];
  let currentIndex = pattern.indexOf('<_>');

  while (currentIndex !== -1) {
    indices.push(currentIndex);
    currentIndex = pattern.indexOf('<_>', currentIndex + 1);
  }
  return indices;
}

// Construct the query string based on pattern and other conditions
function constructQuery(pattern: string, patternIndices: number[], filters: AdHocFiltersVariable): string {
  let fieldIndex = 1;
  const patternExtractor = pattern.replace(/<_>/g, () => `<field_${fieldIndex++}>`);
  const filterExpression = filters.state.filterExpression;
  const fields = patternIndices.map((_value, index) => `field_${index + 1}`).join(' ,');
  return `${filterExpression} |> \`${pattern}\` | pattern \`${patternExtractor}\` | keep ${fields} | line_format ""`;
}
