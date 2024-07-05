import { ALL_VARIABLE_VALUE } from 'services/variables';

export class DetectedField {
  static All = new DetectedField(ALL_VARIABLE_VALUE, 'All', [], 0);

  public type: string;
  public label: string;
  public parsers: string[];
  public cardinality: number;

  constructor(type: string, label: string, parsers: string[], cardinality: number) {
    this.type = type;
    this.label = label;
    this.parsers = parsers;
    this.cardinality = cardinality;
  }
}
