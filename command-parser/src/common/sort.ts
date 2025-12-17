import type { FieldReference, SortNodeIR } from "@chikkadb/interfaces/command/types";

export function parseSortDoc(sortDoc: Record<string, 1 | -1>): [Error, null] | [null, SortNodeIR] {
  try {
    const elements = Object.entries(sortDoc);

    const parsedElements: [FieldReference, 1 | -1][] = [];

    for (const [key, value] of elements) {
      const [error, node] = parseSortElement(key, value);
      if (error) throw error;
      parsedElements.push(node);
    }

    return [null, {
      operator: '$sort',
      operands: parsedElements,
    }];
  } catch (error) {
    return [error as Error, null];
  }
}

function parseSortElement(key: string, value: any): [Error, null] | [null, [FieldReference, 1 | -1]] {
  try {
    const isKeyOperator = /^\$/.test(key);
    if (isKeyOperator) {
      throw new Error('sort key should be a field reference');
    }

    if (value !== 1 && value !== -1) {
      throw new Error('sort value should be 1 or -1');
    }

    return [null, [{ $ref: key }, value]];
  } catch (error) {
    return [error as Error, null];
  }
}