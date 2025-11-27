import { translateCommandToSQL } from "#backend/sql-generator/update.js";
import type { UpdateCommand } from "#frontend/types.js";
import { UPDATE_OPERATORS_FIELD, type FieldReference, type UpdateCommandIR, type UpdateNodeIR, type Value } from "#shared/types.js";
import { parseFilterDoc } from "./common/filter.js";

export function parseUpdateCommand(command: UpdateCommand): UpdateCommandIR {
  const { updates } = command;

  console.log(command);

  const { q, u } = updates?.[0] ?? {};

  // TODO: Support multiple updates

  if (!q) throw new Error('Missing filter');
  if (!u) throw new Error('Missing update');

  const [filterParseError, filterIR] = parseFilterDoc(q, { parentKey: null });
  if (filterParseError) throw filterParseError;

  const [updateParseError, updateIR] = parseUpdateDoc(u);
  if (updateParseError) throw updateParseError;

  return {
    ...command,
    updates: [{
      filter: filterIR,
      update: updateIR,
    }]
  }
}

function parseUpdateDoc(updateDoc: Record<string, any>): [Error, null] | [null, UpdateNodeIR[]] {
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

    const operandPairs = Object.entries(value);
    const operandPairsIR: [FieldReference, Value][] = [];

    for (const pair of operandPairs) {
      operandPairsIR.push([{ $ref: pair[0] }, pair[1] as any]);
    }

    return [null, { 
      operator: key as typeof UPDATE_OPERATORS_FIELD[number], 
      operandsArr: operandPairsIR, 
    }];

  } catch (error) {
    return [error as Error, null];
  } 
}

// const cmd: UpdateCommand = {
//   command: 'update',
//   database: 'test',
//   collection: 'users',
//   updates: [
//     {
//       q: { username: 'user1' },
//       u: { $set: { email: 'user1@example.org', name: 'User 1' } },
//     },
//   ],
// }

// const cmdIR = parseUpdateCommand(cmd);

// console.dir(cmdIR, { depth: null });

// const {
//   collection,
//   updates
// } = cmdIR;

// const {
//   filter,
//   update
// } = updates[0] ?? {};

// if (!filter || !update) throw 'missing filter or update';

// const sql = translateCommandToSQL({ collection, filter, update });
// console.log(sql);