export interface AppliedPattern {
  pattern: string;
  type: 'include' | 'exclude';
}

export type DetectedLabel = {
  label: string;
  cardinality: number;
};

export type DetectedLabelsResponse = {
  detectedLabels: DetectedLabel[];
};
