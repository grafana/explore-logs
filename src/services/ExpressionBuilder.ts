import { AdHocFilterWithLabels, sceneUtils } from '@grafana/scenes';
import { AdHocVariableFilter } from '@grafana/data';
import { FilterOp, FilterOpType, LabelFilterOp, NumericFilterOp } from './filterTypes';
import { Dictionary, groupBy, trim } from 'lodash';
import { EMPTY_VARIABLE_VALUE, isAdHocFilterValueUserInput, stripAdHocFilterUserInputPrefix } from './variables';
import { getValueFromFieldsFilter } from './variableGetters';
import { isOperatorExclusive, isOperatorInclusive, isOperatorNumeric, isOperatorRegex } from './operatorHelpers';
import { narrowFilterOperator } from './narrowing';
import { getExpressionBuilderDebug } from './store';

type Key = string;
type Value = string;
type CombinedFiltersValues = { operator: LabelFilterOp | NumericFilterOp; values: Value[] };
type CombinedFiltersValuesByKey = Record<Key, CombinedFiltersValues>;
type CombinedOperatorFilters = Record<Key, Value>;
type OperatorFilters = Record<Key, Value[]>;

interface Options {
  /**
   * Sets debug output
   */
  debug?: boolean;

  /**
   * Separator between filters with different keys or operators
   */
  filterSeparator?: string;

  /**
   * Prefix of the logQL expression
   */
  prefix?: string;

  /**
   * Sets if match filters join values together in a regex filter
   * i.e. multiple filters with operators: '=' | '!=' => '=~' | '!~'
   */
  joinMatchFilters: boolean;

  /**
   * Sets if the values are JSON encoded
   */
  decodeFilters: boolean;

  /**
   * Keys to ignore
   */
  ignoreKeys?: string[];

  /**
   * Filter type
   */
  type: 'indexed' | 'field';
}

export class ExpressionBuilder {
  private filters: AdHocFilterWithLabels[];
  private options: Options;
  private valueSeparator = 'or';

  constructor(
    filters: AdHocFilterWithLabels[],
    options: Options = { joinMatchFilters: true, decodeFilters: false, type: 'field' }
  ) {
    this.filters = filters;
    this.options = options;
    if (!this.options.debug) {
      this.options.debug = getExpressionBuilderDebug();
    }
  }

  /**
   * Joins filters with same keys similar operators
   * e.g. {level="info"}, {level="warn"} => {level=~"warn|info"}
   */
  public getJoinedLabelsFilters(): AdHocFilterWithLabels[] {
    let { equalsFilters, notEqualsFilters, regexEqualFilters, regexNotEqualFilters } = this.getCombinedLabelFilters();
    const adHocFilters: AdHocFilterWithLabels[] = [];
    const filters = [equalsFilters, notEqualsFilters, regexEqualFilters, regexNotEqualFilters].filter(
      (filter) => filter
    );
    filters.forEach((operatorFilters) => {
      const joinedValues = this.joinCombinedFiltersValues(operatorFilters, '|');

      for (const key in operatorFilters) {
        const filter = operatorFilters[key];
        const operator = filter.operator;
        adHocFilters.push({ key, operator, value: joinedValues[key] });
      }
    });

    return adHocFilters;
  }

  /**
   * Returns logQL expression for AdHocFilterWithLabels[]
   * Merges multiple include matches into regex
   */
  protected getExpr(): string {
    let {
      equalsFilters,
      notEqualsFilters,
      regexEqualFilters,
      regexNotEqualFilters,
      ltFilters,
      lteFilters,
      gtFilters,
      gteFilters,
    } = this.getCombinedLabelFilters();

    if (this.options.debug) {
      console.info('combined filters after merge', {
        equalsFilters,
        notEqualsFilters,
        regexEqualFilters,
        regexNotEqualFilters,
        ltFilters,
        lteFilters,
        gtFilters,
        gteFilters,
      });
    }

    const filtersString = this.buildLabelsLogQLFromFilters({
      equalsFilters,
      notEqualsFilters,
      regexEqualFilters,
      regexNotEqualFilters,
      ltFilters,
      lteFilters,
      gtFilters,
      gteFilters,
    });

    if (filtersString) {
      // Append prefix if defined
      return (this.options.prefix ?? '') + filtersString;
    }

    return '';
  }

  public getLabelsExpr(options?: Partial<Options>): string {
    const defaultOptions: Options = { joinMatchFilters: true, decodeFilters: false, type: 'indexed' };
    this.options = { ...defaultOptions, ...options };
    return this.getExpr();
  }

  /**
   * Returns merged filters separated by pipe
   */
  public getMetadataExpr(options?: Partial<Options>): string {
    const defaultOptions: Options = {
      filterSeparator: ' |',
      prefix: '| ',
      joinMatchFilters: false,
      decodeFilters: false,
      type: 'field',
    };
    this.options = { ...defaultOptions, ...options };
    return this.getExpr();
  }

  /**
   * Same as metadata, but only include operators supported
   */
  public getLevelsExpr(options?: Partial<Options>): string {
    const defaultOptions: Options = {
      filterSeparator: ' |',
      prefix: '| ',
      joinMatchFilters: false,
      decodeFilters: false,
      type: 'field',
    };

    this.options = { ...defaultOptions, ...options };
    return this.getExpr();
  }

  /**
   * Returns merged filters separated by pipe
   * JSON encodes value
   */
  public getFieldsExpr(options?: Partial<Options>): string {
    const defaultOptions: Options = {
      filterSeparator: ' |',
      prefix: '| ',
      joinMatchFilters: false,
      decodeFilters: true,
      type: 'field',
    };
    this.options = { ...defaultOptions, ...options };
    return this.getExpr();
  }

  /**
   * Transforms joined field value objects into logQL strings
   */
  private buildLabelsLogQLFromFilters({
    equalsFilters,
    notEqualsFilters,
    regexEqualFilters,
    regexNotEqualFilters,
    ltFilters,
    lteFilters,
    gtFilters,
    gteFilters,
  }: {
    equalsFilters: CombinedFiltersValuesByKey | undefined;
    notEqualsFilters: CombinedFiltersValuesByKey | undefined;
    regexEqualFilters: CombinedFiltersValuesByKey | undefined;
    regexNotEqualFilters: CombinedFiltersValuesByKey | undefined;
    ltFilters: CombinedFiltersValuesByKey | undefined;
    lteFilters: CombinedFiltersValuesByKey | undefined;
    gtFilters: CombinedFiltersValuesByKey | undefined;
    gteFilters: CombinedFiltersValuesByKey | undefined;
  }) {
    let equalFiltersStrings: CombinedOperatorFilters | OperatorFilters;
    let notEqualsFiltersStrings: CombinedOperatorFilters | OperatorFilters;
    let regexEqualFiltersStrings: CombinedOperatorFilters | OperatorFilters;
    let regexNotEqualFiltersStrings: CombinedOperatorFilters | OperatorFilters;
    let ltFiltersStrings: OperatorFilters;
    let lteFiltersStrings: OperatorFilters;
    let gtFiltersStrings: OperatorFilters;
    let gteFiltersStrings: OperatorFilters;

    // Build the LogQL filters
    const allFilters: string[] = [];

    if (this.options.joinMatchFilters) {
      // Join values arrays for all keys with "|" char
      equalFiltersStrings = this.joinCombinedFiltersValues(equalsFilters, '|');
      notEqualsFiltersStrings = this.joinCombinedFiltersValues(notEqualsFilters, '|');
      regexEqualFiltersStrings = this.joinCombinedFiltersValues(regexEqualFilters, '|');
      regexNotEqualFiltersStrings = this.joinCombinedFiltersValues(regexNotEqualFilters, '|');

      allFilters.push(...this.buildJoinedFilters(equalFiltersStrings, LabelFilterOp.Equal));
      allFilters.push(...this.buildJoinedFilters(notEqualsFiltersStrings, LabelFilterOp.NotEqual));
      allFilters.push(...this.buildJoinedFilters(regexEqualFiltersStrings, LabelFilterOp.RegexEqual));
      allFilters.push(...this.buildJoinedFilters(regexNotEqualFiltersStrings, LabelFilterOp.RegexNotEqual));
    } else {
      // Do not join filters
      equalFiltersStrings = this.getFilterValues(equalsFilters);
      notEqualsFiltersStrings = this.getFilterValues(notEqualsFilters);
      regexEqualFiltersStrings = this.getFilterValues(regexEqualFilters);
      regexNotEqualFiltersStrings = this.getFilterValues(regexNotEqualFilters);

      allFilters.push(...this.buildFilter(equalFiltersStrings, LabelFilterOp.Equal));
      allFilters.push(...this.buildFilter(notEqualsFiltersStrings, LabelFilterOp.NotEqual));
      allFilters.push(...this.buildFilter(regexEqualFiltersStrings, LabelFilterOp.RegexEqual));
      allFilters.push(...this.buildFilter(regexNotEqualFiltersStrings, LabelFilterOp.RegexNotEqual));
    }

    // //Numeric fields are never joined
    ltFiltersStrings = this.getFilterValues(ltFilters);
    lteFiltersStrings = this.getFilterValues(lteFilters);
    gtFiltersStrings = this.getFilterValues(gtFilters);
    gteFiltersStrings = this.getFilterValues(gteFilters);

    allFilters.push(...this.buildFilter(ltFiltersStrings, NumericFilterOp.lt));
    allFilters.push(...this.buildFilter(lteFiltersStrings, NumericFilterOp.lte));
    allFilters.push(...this.buildFilter(gtFiltersStrings, NumericFilterOp.gt));
    allFilters.push(...this.buildFilter(gteFiltersStrings, NumericFilterOp.gte));

    if (this.options.debug) {
      console.info('combined filters after stringify', {
        equalFiltersStrings,
        notEqualsFiltersStrings,
        regexEqualFiltersStrings,
        regexNotEqualFiltersStrings,
        ltFiltersStrings,
        lteFiltersStrings,
        gtFiltersStrings,
        gteFiltersStrings,
        allFilters,
      });
    }

    // Create the final output string by joining filters with filterSeparator char
    const allFiltersString = trim(this.combineValues(allFilters, `${this.options.filterSeparator ?? ','} `));

    if (this.options.debug) {
      console.info('DEBUG labels expr', { allFiltersString });
    }

    return allFiltersString;
  }

  /**
   * Group filter values by key
   */
  private getCombinedLabelFilters() {
    // Group filters by operator and key
    const {
      [LabelFilterOp.Equal]: equal,
      [LabelFilterOp.NotEqual]: notEqual,
      [LabelFilterOp.RegexEqual]: regexEqual,
      [LabelFilterOp.RegexNotEqual]: regexNotEqual,
      [NumericFilterOp.lt]: lt,
      [NumericFilterOp.lte]: lte,
      [NumericFilterOp.gt]: gt,
      [NumericFilterOp.gte]: gte,
    } = this.groupFiltersByKey(this.filters);

    let equalsFilters: CombinedFiltersValuesByKey | undefined;
    let notEqualsFilters: CombinedFiltersValuesByKey | undefined;
    let regexEqualFilters: CombinedFiltersValuesByKey | undefined;
    let regexNotEqualFilters: CombinedFiltersValuesByKey | undefined;

    let ltFilters: CombinedFiltersValuesByKey | undefined;
    let lteFilters: CombinedFiltersValuesByKey | undefined;
    let gtFilters: CombinedFiltersValuesByKey | undefined;
    let gteFilters: CombinedFiltersValuesByKey | undefined;

    // Escape values and combine filters by key and operator, multiple non-regex operations are returned under a different operator
    if (this.options.joinMatchFilters) {
      equalsFilters = this.combineFiltersValues(equal, LabelFilterOp.RegexEqual);
      notEqualsFilters = this.combineFiltersValues(notEqual, LabelFilterOp.RegexNotEqual);
      regexEqualFilters = this.combineFiltersValues(regexEqual);
      regexNotEqualFilters = this.combineFiltersValues(regexNotEqual);
    } else {
      equalsFilters = this.combineFiltersValues(equal);
      notEqualsFilters = this.combineFiltersValues(notEqual);
      regexEqualFilters = this.combineFiltersValues(regexEqual);
      regexNotEqualFilters = this.combineFiltersValues(regexNotEqual);
    }

    // Numeric filters are never combined
    ltFilters = this.combineFiltersValues(lt);
    lteFilters = this.combineFiltersValues(lte);
    gtFilters = this.combineFiltersValues(gt);
    gteFilters = this.combineFiltersValues(gte);

    if (this.options.debug) {
      console.info('combined filters', {
        equalsFilters,
        notEqualsFilters,
        regexEqualFilters,
        regexNotEqualFilters,
      });
    }

    if (this.options.joinMatchFilters) {
      // If we changed the operation, merge the values and remove the stale operator from the object
      if (equalsFilters) {
        regexEqualFilters = this.mergeFilters(LabelFilterOp.RegexEqual, equalsFilters, regexEqualFilters);
        equalsFilters = this.removeStaleOperators(equalsFilters, LabelFilterOp.Equal);
      }
      if (notEqualsFilters) {
        regexNotEqualFilters = this.mergeFilters(LabelFilterOp.RegexNotEqual, notEqualsFilters, regexNotEqualFilters);
        notEqualsFilters = this.removeStaleOperators(notEqualsFilters, LabelFilterOp.NotEqual);
      }
    }

    return {
      equalsFilters,
      notEqualsFilters,
      regexEqualFilters,
      regexNotEqualFilters,
      ltFilters,
      lteFilters,
      gtFilters,
      gteFilters,
    };
  }

  /**
   * Transforms values grouped by key to logQL filter strings
   */
  private buildFilter(filters: OperatorFilters, operator: LabelFilterOp | NumericFilterOp): string[] {
    const filterStrings: string[] = [];

    for (const key in filters) {
      const filtersWithSameOperatorsAndKeys: string[] = [];
      const values = filters[key];
      if (isOperatorNumeric(operator)) {
        values.forEach((value) =>
          filtersWithSameOperatorsAndKeys.push(this.buildFilterString(key, operator, value, ''))
        );
      } else {
        values.forEach((value) => filtersWithSameOperatorsAndKeys.push(this.buildFilterString(key, operator, value)));
      }

      filterStrings.push(filtersWithSameOperatorsAndKeys.join(` ${this.valueSeparator} `));
    }

    return filterStrings;
  }

  /**
   * Transforms escaped & concatenated values into strings grouped by key to logQL filter strings
   */
  private buildJoinedFilters(equalFiltersStrings: CombinedOperatorFilters, operator: LabelFilterOp) {
    const filterStrings = [];
    for (const key in equalFiltersStrings) {
      filterStrings.push(this.buildFilterString(key, operator, equalFiltersStrings[key]));
    }
    return filterStrings;
  }

  /**
   * Cleans up CombinedFiltersValuesByKey if the operator was transformed
   */
  private removeStaleOperators(filters: CombinedFiltersValuesByKey, expectedOperator: LabelFilterOp) {
    const result: CombinedFiltersValuesByKey = {};
    Object.keys(filters).forEach((key) => {
      if (filters[key].operator === expectedOperator) {
        result[key] = filters[key];
      }
    });
    return result;
  }

  /**
   * Merges filters grouped by key from one operator group to another
   */
  private mergeFilters(
    operatorTo: LabelFilterOp,
    filtersFrom: CombinedFiltersValuesByKey,
    filtersTo: CombinedFiltersValuesByKey | undefined
  ) {
    const convertedEqualsFilters = Object.keys(filtersFrom)
      .filter((key) => filtersFrom[key].operator === operatorTo)
      .map((key) => ({ values: filtersFrom[key].values, key }));

    convertedEqualsFilters.forEach((valuesToMove) => {
      if (filtersTo === undefined) {
        filtersTo = { [valuesToMove.key]: { values: [], operator: operatorTo } };
      }
      if (filtersTo[valuesToMove.key] === undefined) {
        filtersTo[valuesToMove.key] = { values: [], operator: operatorTo };
      }
      filtersTo[valuesToMove.key].values.push(
        ...this.mergeCombinedFiltersValues(filtersFrom[valuesToMove.key], operatorTo)
      );
    });
    return filtersTo;
  }

  /**
   * Merges values for a single filter key
   */
  private mergeCombinedFiltersValues(filtersFrom: CombinedFiltersValues, operatorTo: LabelFilterOp) {
    const values: string[] = [];
    if (filtersFrom.operator === operatorTo && filtersFrom.values?.length) {
      values.push(...filtersFrom.values);
    }
    return values;
  }

  /**
   * Iterates through all keys in an operator group and combines values with separator
   */
  private joinCombinedFiltersValues(
    filters: CombinedFiltersValuesByKey | undefined,
    separator: string
  ): CombinedOperatorFilters {
    const filterCombinedValues: CombinedOperatorFilters = {};
    for (const key in filters) {
      if (!filters[key].values.length) {
        continue;
      }

      filterCombinedValues[key] = this.combineValues(filters[key].values, separator);
    }

    return filterCombinedValues;
  }

  /**
   * Iterates through key groups and transforms filter values to key => values object
   */
  private getFilterValues(filters: CombinedFiltersValuesByKey | undefined): OperatorFilters {
    const filterValues: OperatorFilters = {};
    for (const key in filters) {
      if (!filters[key].values.length) {
        continue;
      }

      filterValues[key] = filters[key].values;
    }

    return filterValues;
  }

  /**
   * Combines an array of values by separator
   * Completely unnecessary wrapper of join
   */
  private combineValues(values: string[], separator: string) {
    return values.join(`${separator}`);
  }

  /**
   * Combines and escapes values with the same operator, note assumes every filter has the same operator
   * If multipleValuesOperator is set, multiple values will be combined into a single filter to use that operator in the output
   * @param filtersByKey
   * @param multipleValuesOperator
   * @private
   */
  private combineFiltersValues(
    filtersByKey: Dictionary<AdHocFilterWithLabels[]>,
    multipleValuesOperator?: LabelFilterOp
  ): CombinedFiltersValuesByKey | undefined {
    let updatedOperatorAndEscapedValues: CombinedFiltersValuesByKey = {};

    for (const key in filtersByKey) {
      if (!filtersByKey[key].length) {
        continue;
      }

      const currentOperator = narrowFilterOperator(filtersByKey[key][0].operator);
      const updatedOperator = multipleValuesOperator ?? currentOperator;
      const firstFilter = filtersByKey[key][0];

      updatedOperatorAndEscapedValues[key] = { values: [], operator: updatedOperator };

      // Only one value for this key
      if (filtersByKey[key].length === 1) {
        const filterString = this.escapeFieldValue(
          firstFilter.operator,
          firstFilter.value,
          firstFilter.valueLabels ?? []
        );
        updatedOperatorAndEscapedValues[key] = { operator: currentOperator, values: [filterString] };

        if (this.options.debug) {
          console.info('single value filter', { filter: firstFilter, filterString });
        }
      } else {
        const values = this.escapeFieldValues(key, filtersByKey, updatedOperator);
        if (updatedOperatorAndEscapedValues[key].operator === undefined) {
          updatedOperatorAndEscapedValues[key] = { operator: updatedOperator, values };
        } else {
          updatedOperatorAndEscapedValues[key].values?.push(...values);
        }
      }
    }

    return updatedOperatorAndEscapedValues;
  }

  /**
   * Iterates through all keys in a merged operator group and escapes the values
   */
  private escapeFieldValues(
    key: string,
    filtersByKey: Dictionary<AdHocFilterWithLabels[]>,
    updatedOperator: LabelFilterOp | NumericFilterOp
  ) {
    // Convert single operator to regex
    return filtersByKey[key].map((filter) =>
      this.escapeFieldValue(updatedOperator, filter.value, filter.valueLabels ?? [])
    );
  }

  /**
   * Escape field values:
   * If value is encoded, decode it
   * If value is empty, don't escape double quotes
   * If value is custom user input, strip prefix and don't escape special regex chars
   */
  private escapeFieldValue(operator: LabelFilterOp | string, value: string, valueLabels: string[]): string {
    const isUserInput = isAdHocFilterValueUserInput(value);

    // decode value
    if (this.options.decodeFilters) {
      const fieldObject = getValueFromFieldsFilter({ value, valueLabels });
      value = fieldObject.value;
    }

    if (value === EMPTY_VARIABLE_VALUE) {
      if (this.options.debug) {
        console.info('empty variable value, do not escape');
      }
      // Don't encode empty value
      return value;
    }

    if (isUserInput) {
      if (this.options.debug) {
        console.info('ESCAPE: user input - exact selector', {
          operator,
          value,
          result: sceneUtils.escapeLabelValueInExactSelector(stripAdHocFilterUserInputPrefix(value)),
        });
      }
      return sceneUtils.escapeLabelValueInExactSelector(stripAdHocFilterUserInputPrefix(value));
    }
    if (isOperatorRegex(operator)) {
      if (this.options.debug) {
        console.info('ESCAPE: regex selector', { operator, value });
      }
      return sceneUtils.escapeLabelValueInRegexSelector(value);
    }

    if (this.options.debug) {
      console.info('ESCAPE: exact selector', { operator, value });
    }

    return sceneUtils.escapeLabelValueInExactSelector(value);
  }

  /**
   * Builds logQL filter string.
   * Expects pre-escaped content
   * @private
   */
  private buildFilterString(key: string, operator: LabelFilterOp | string, rawValue: string, quoteChar = '"') {
    if (rawValue === EMPTY_VARIABLE_VALUE) {
      return `${key}${operator}${rawValue}`;
    }

    const filterString = `${key}${operator}${quoteChar}${rawValue}${quoteChar}`;
    if (this.options.debug) {
      console.info('buildDoubleQuotedFilter', { filter: { key, operator, value: rawValue }, filterString });
    }

    return filterString;
  }

  /**
   * Groups all filters by operator and key
   */
  private groupFiltersByKey(filters: AdHocVariableFilter[]): Record<FilterOpType, Dictionary<AdHocFilterWithLabels[]>> {
    let filteredFilters: AdHocVariableFilter[] = filters.filter((f) => !this.options.ignoreKeys?.includes(f.key));

    // We need at least one inclusive filter
    if (this.options.type === 'indexed') {
      if (filteredFilters.length < 1) {
        filteredFilters = filters;
      }
    }

    const positiveMatch = filteredFilters.filter(
      (filter) => isOperatorInclusive(filter.operator) && !isOperatorRegex(filter.operator)
    );
    const positiveRegex = filteredFilters.filter(
      (filter) => isOperatorInclusive(filter.operator) && isOperatorRegex(filter.operator)
    );
    const negativeMatch = filteredFilters.filter(
      (filter) => isOperatorExclusive(filter.operator) && !isOperatorRegex(filter.operator)
    );
    const negativeRegex = filteredFilters.filter(
      (filter) => isOperatorExclusive(filter.operator) && isOperatorRegex(filter.operator)
    );
    const gt = filteredFilters.filter((filter) => filter.operator === FilterOp.gt);
    const gte = filteredFilters.filter((filter) => filter.operator === FilterOp.gte);
    const lt = filteredFilters.filter((filter) => filter.operator === FilterOp.lt);
    const lte = filteredFilters.filter((filter) => filter.operator === FilterOp.lte);

    // Field ops
    const positiveMatchGroup = groupBy(positiveMatch, (filter) => filter.key);
    const positiveRegexGroup = groupBy(positiveRegex, (filter) => filter.key);
    const negativeMatchGroup = groupBy(negativeMatch, (filter) => filter.key);
    const negativeRegexGroup = groupBy(negativeRegex, (filter) => filter.key);

    // Duration ops
    const gtGroup = groupBy(gt, (filter) => filter.key);
    const gteGroup = groupBy(gte, (filter) => filter.key);
    const ltGroup = groupBy(lt, (filter) => filter.key);
    const lteGroup = groupBy(lte, (filter) => filter.key);

    return {
      [FilterOp.Equal]: positiveMatchGroup,
      [FilterOp.RegexEqual]: positiveRegexGroup,
      [FilterOp.NotEqual]: negativeMatchGroup,
      [FilterOp.RegexNotEqual]: negativeRegexGroup,
      [FilterOp.gt]: gtGroup,
      [FilterOp.gte]: gteGroup,
      [FilterOp.lt]: ltGroup,
      [FilterOp.lte]: lteGroup,
    };
  }
}
