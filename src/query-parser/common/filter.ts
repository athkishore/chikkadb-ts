import { 
  FIELD_LEVEL_FILTER_OPERATORS,
  type FilterDoc, 
  type FilterNodeIR,
  type FilterNodeIR_$eq,
  type FilterNodeIR_$exists,
  type FilterNodeIR_$gt,
  type FilterNodeIR_$gte,
  type FilterNodeIR_$in,
  type FilterNodeIR_$lt,
  type FilterNodeIR_$lte,
  type FilterNodeIR_$ne,
  type FilterNodeIR_$nin,
  type FilterNodeIR_$nor, 
} from "../../types.js";


export function parseFilterDoc(
  filterDoc: FilterDoc, 
  { parentKey }: { parentKey: string | null }
): [Error, null] | [null, FilterNodeIR] {
  try {
    const elements = Object.entries(filterDoc);
    const parsedNodes: FilterNodeIR[] = [];
    
    for (const [key, value] of elements) {
      const [error, node] = parseFilterElement(key, value, { parentKey });
      if (error) throw error;
      parsedNodes.push(node);
    }

    if (parsedNodes.length === 1 && parsedNodes[0]) {
      return [null, parsedNodes[0]]
    } else {
      return [
        null,
        {
          operator: '$and',
          operands: parsedNodes,
        }
      ]
    }
  } catch (error) {
    return [error as Error, null];
  }
}

function parseFilterElement(
  key: string, 
  value: any, 
  { parentKey }: { parentKey: string | null }): [Error, null] | [null, FilterNodeIR] {
  try {
    const isKeyOperator = /^\$/.test(key);
    const parser = parsers[key as keyof typeof parsers];

    if (isKeyOperator && !parser) {
      throw new Error(`Unknown operator: ${key}`);
    }

    if (isKeyOperator && parser) {
      const [error, node] = parser.parse(value, { parentKey });
      if (error) throw error;

      return [null, node];
    }

    if (!isKeyOperator && value !== null && !Array.isArray(value) && typeof value === 'object') {
      const isFirstKeyOfObjectOperator = /^\$/.test(Object.keys(value)[0] ?? '');

      if (isFirstKeyOfObjectOperator) {
        const [error, node] = parseFilterDoc(value, { parentKey: key });
        if (error) throw error;
        return [null, node];
      } else {
        return [null, {
          operator: '$eq',
          operands: [{ $ref: key }, value],
        }];
      }
      
    }

    return [null, {
      operator: '$eq',
      operands: [{ $ref: key }, value],
    }];

    
  } catch (error) {
    return [error as Error, null];
  }
}

const parsers = {
  '$eq': {
    parse(
      value: any, 
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$eq] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error(`$eq should have a field reference as the parent key`);
        }

        return [null, {
          operator: '$eq',
          operands: [{ $ref: parentKey }, value]
        }];
      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$gt': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$gt] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error(`$gt should have a field reference as the parent key`);
        }

        return [null, {
          operator: '$gt',
          operands: [{ $ref: parentKey }, value]
        }];
      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$gte': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$gte] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error('$gte should have a field reference as the parent key');
        }

        return [null, {
          operator: '$gte',
          operands: [{ $ref: parentKey }, value],
        }];
      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$lt': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$lt] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error('$lt should have a field reference as the parent key');
        }

        return [null, {
          operator: '$lt',
          operands: [{ $ref: parentKey }, value],
        }];
      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$lte': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$lte] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error('$lte should have a field reference as the parent key');
        }

        return [null, {
          operator: '$lte',
          operands: [{ $ref: parentKey }, value],
        }];
      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$ne': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$ne] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error('$ne should have a field reference as the parent key');
        }

        return [null, {
          operator: '$ne',
          operands: [{ $ref: parentKey }, value],
        }];
      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$in': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$in] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error('$in should have a field reference or $not as the parent key')
        }

        if (!Array.isArray(value)) {
          throw new Error('$in requires an array value');
        }

        return [null, {
          operator: '$in',
          operands: [{ $ref: parentKey }, value],
        }];
      } catch (error) {
        return [error as Error, null];
      }
    },
  },

  '$nin': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$nin] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error('$nin should have a field reference or $not as the parent key');
        }

        if (!Array.isArray(value)) {
          throw new Error('$nin requires an array value');
        }

        return [
          null, {
            operator: '$nin',
            operands: [{ $ref: parentKey }, value],
          }
        ];
      } catch (error) {
        return [error as Error, null];
      }
    },
  },

  '$exists': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$exists] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || (isParentKeyOperator && parentKey !== '$not')) {
          throw new Error('$exists should have a field reference as the parent key');
        }

        if (typeof value !== 'boolean') {
          throw new Error('$exists requires a boolean value');
        }

        return value === true ? [null, {
          operator: '$exists',
          operands: [{ $ref: parentKey }, value]
        }] : [null, {
          operator: '$nor',
          operands: [{ operator: '$exists', operands: [{ $ref: parentKey }, true]}]
        }] as any; // TODO: Find a better solution to this workaround
      } catch (error) {
        return [error as Error, null];
      }
    }
  },

  '$not': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR_$nor] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || isParentKeyOperator) {
          throw new Error('$not should have a field referene as the parent key');
        }

        if (!value || typeof value !== 'object') {
          throw new Error('$not should have an object value');
        }

        if (Object.keys(value).some(key => !FIELD_LEVEL_FILTER_OPERATORS.includes(key as any))) {
          throw new Error('$not operand should have keys that are field-level operators');
        }

        const [error, parsedValue] = parseFilterDoc(value, { parentKey });

        if (error) throw error;

        return [null, {
          operator: '$nor',
          operands: [parsedValue],
        }];
      } catch (error) {
        return [error as Error, null];
      }
    }
  },

  '$and': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR] {
      try {
        if (!Array.isArray(value)) {
          throw new Error('Array value required for $and');
        }
        
        if (value.some(el => !el || Array.isArray(el) || typeof el !== 'object')) {
          throw new Error('Array elements must be full objects');
        }

        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!isParentKeyOperator && parentKey !== null) {
          throw new Error('$and cannot have a field reference as the parent key');
        }

        const parsedNodes: FilterNodeIR[] = [];
        for (const el of value) {
          const [error, node] = parseFilterDoc(el, { parentKey: '$and' });
          if (error) throw error;
          parsedNodes.push(node);
        }

        return parsedNodes.length === 1
          ? [null, parsedNodes[0]!] 
          : [
              null, 
              {
                operator: '$and',
                operands: parsedNodes,
              }
            ];

      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$or': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR] {
      try {
        if (!Array.isArray(value)) {
          throw new Error('Array value required for $or');
        }
        
        if (value.some(el => !el || Array.isArray(el) || typeof el !== 'object')) {
          throw new Error('Array elements must be full objects');
        }

        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!isParentKeyOperator && parentKey !== null) {
          throw new Error('$or cannot have a field reference as the parent key');
        }

        const parsedNodes: FilterNodeIR[] = [];
        for (const el of value) {
          const [error, node] = parseFilterDoc(el, { parentKey: '$or' });
          if (error) throw error;
          parsedNodes.push(node);
        }

        return parsedNodes.length === 1
          ? [null, parsedNodes[0]!] 
          : [
              null, 
              {
                operator: '$or',
                operands: parsedNodes,
              }
            ];

      } catch (error) {
        return [error as Error, null];
      }
    }
  },
  '$nor': {
    parse(
      value: any,
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, FilterNodeIR] {
      try {
        if (!Array.isArray(value)) {
          throw new Error('Array value required for $nor');
        }
        
        if (value.some(el => !el || Array.isArray(el) || typeof el !== 'object')) {
          throw new Error('Array elements must be full objects');
        }

        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!isParentKeyOperator && parentKey !== null) {
          throw new Error('$nor cannot have a field reference as the parent key');
        }

        const parsedNodes: FilterNodeIR[] = [];
        for (const el of value) {
          const [error, node] = parseFilterDoc(el, { parentKey: '$nor' });
          if (error) throw error;
          parsedNodes.push(node);
        }

        return parsedNodes.length === 1
          ? [null, parsedNodes[0]!] 
          : [
              null, 
              {
                operator: '$nor',
                operands: parsedNodes,
              }
            ];

      } catch (error) {
        return [error as Error, null];
      }
    }
  }
} as const;