import { UPDATE_OPERATORS_FIELD, type FieldReference, type UpdateNodeIR, type Value } from "@chikkadb/interfaces/command/types";

export function parseUpdateDoc(updateDoc: Record<string, any>): [Error, null] | [null, UpdateNodeIR[]] {
  try {
    const elements = Object.entries(updateDoc);

    const parsedNodes: UpdateNodeIR[] = [];

    for (const [key, value] of elements) {
      const [error, node] = parseUpdateElement(key, value);
      if (error) throw error;
      parsedNodes.push(node);
    }

    return [null, parsedNodes];

  } catch (error) {
    return [error as Error, null];
  }
}

function parseUpdateElement(key: string, value: any): [Error, null] | [null, UpdateNodeIR] {
  try {
    const isKeyOperator = /^\$/.test(key);
    if (!isKeyOperator) {
      throw new Error('Update doc key should be an update operator');
    }
    
    if (!UPDATE_OPERATORS_FIELD.includes(key as any)) {
      throw new Error(`Unknown update operator: ${key}`);
    }

    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new Error(`Update operator ${key} needs an object value`);
    }

    if ((key === '$inc' || key === '$mul') && !Object.values(value).every(v => typeof v === 'number')) {
      throw new Error(`Update operator ${key} requires number values in object argument`);
    }

    const operandPairs = Object.entries(value);
    const operandPairsIR: [FieldReference, Value][] = [];

    for (const pair of operandPairs) {
      operandPairsIR.push([{ $ref: pair[0] }, pair[1] as any]);
    }

    return [null, { 
      operator: key as typeof UPDATE_OPERATORS_FIELD[number], 
      operandsArr: operandPairsIR as any, 
    }];

  } catch (error) {
    return [error as Error, null];
  } 
}
