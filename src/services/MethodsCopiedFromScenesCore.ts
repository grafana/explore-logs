// copied from 5.14.7
// import {AdHocVariableFilter} from "@grafana/data";

//@todo export AdHocFilterWithLabels from scenes core and delete the following
import { AdHocVariableFilter } from '@grafana/data';

export interface AdHocFilterWithLabels extends AdHocVariableFilter {
  keyLabel?: string;
  valueLabels?: string[];
}
