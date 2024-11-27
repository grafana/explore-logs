const isString = (s: unknown) => (typeof s === 'string' && s) || '';

const isPropString = <P extends string, T extends Record<P, T[P]>>(
  prop: P,
  object: T
): object is T & Record<P, string> => {
  return typeof object[prop] === 'string';
};

export function unknownToStrings(a: unknown): string[] {
  let strings: string[] = [];
  if (Array.isArray(a)) {
    for (let i = 0; i < a.length; i++) {
      strings.push(isString(a[i]));
    }
  }
  return strings;
}

export interface PropType {
  name: string;
  type: 'string' | 'number';
}

export function isPropType<T extends SelectedTableRow>(o: unknown, prop: PropType): o is T {
  return isObj(o) && hasProp(o, prop.name) && typeof o[prop.name] === prop.type;
}

// Example
type SelectedTableRow = {
  row: number;
  id: string;
};

const isObj = (o: unknown): o is object => typeof o === 'object' && o !== null;

function hasProp<K extends PropertyKey>(data: object, prop: K): data is Record<K, unknown> {
  return prop in data;
}

export function isSelectedTableRow(o: unknown) {
  return isObj(o) && hasProp(o, 'row') && 'row' in o && typeof o.row === 'string';
}

export function isSelectedTableRowAssert<T>(o: unknown): o is T {
  return isObj(o) && hasProp(o, 'row') && 'row' in o && typeof o.row === 'string';
}

const unknown: unknown = {
  id: 'string-value',
};

// This is the closest to a solution, but requires inlining, also the row is not typed as string
if (isObj(unknown) && hasProp(unknown, 'row') && 'row' in unknown && typeof unknown.row === 'string') {
  const result = unknown; // type inferred  as Record<"row", unknown>
  const row = result.row; // type inferred as unknown
  const unknownRow = unknown.row; // type inferred as string
  console.log(result.row); // No type error
  console.log(result.id); // Type error, id does not exist

  if (typeof result.row === 'string') {
    const row = result.row;
  }
}

// This fails to type the object at all
if (isSelectedTableRow(unknown)) {
  const result = unknown; // type inferred as unknown
  console.log(result.row); // result is type unknown, type error
  console.log(result.id); // result is type unknown, type error
}

// This asserts that the object is the Templated type (SelectedTableRow), it doesnt matter if the interface or implementation changes, you won't get type errors
if (isSelectedTableRowAssert<SelectedTableRow>(unknown)) {
  const result = unknown; // type inferred as SelectedTableRow
  console.log(result.row); // no type error
  console.log(result.id); // runtime error
}
