import { useDataSourceContext } from '@/components/Context/DataSourceContext';

/**
 * Shorthand version of the low level hook useDataSourceContext().
 * @returns DataSourceAPI | undefined
 */
export function useDataSource() {
  const { dataSource } = useDataSourceContext();
  return dataSource;
}
