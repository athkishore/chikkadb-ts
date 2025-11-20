type FilterDoc = Record<string, any>;

type CanonicalNode = 
  | CanonicalNode_DocLevel
  | CanonicalNode_FieldLevel;

type CanonicalNode_DocLevel = 
  | CanonicalNode_$and
  | CanonicalNode_$or
  | CanonicalNode_$nor;

type CanonicalNode_FieldLevel = 
  | CanonicalNode_$eq
  | CanonicalNode_$gt
  | CanonicalNode_$gte
  | CanonicalNode_$lt
  | CanonicalNode_$lte
  | CanonicalNode_$ne;

type CanonicalNode_$and = {
  operator: '$and';
  operands: CanonicalNode[];
};

type CanonicalNode_$or = {
  operator: '$or';
  operands: CanonicalNode[];
};

type CanonicalNode_$nor = {
  operator: '$nor';
  operands: CanonicalNode[];
};

type CanonicalNode_$eq = {
  operator: '$eq';
  operands: [FieldReference, Value];
};

type CanonicalNode_$gt = {
  operator: '$gt';
  operands: [FieldReference, Value];
};

type CanonicalNode_$gte = {
  operator: '$gte';
  operands: [FieldReference, Value];
};

type CanonicalNode_$lt = {
  operator: '$lt';
  operands: [FieldReference, Value];
};

type CanonicalNode_$lte = {
  operator: '$lte';
  operands: [FieldReference, Value];
};

type CanonicalNode_$ne = {
  operator: '$ne';
  operands: [FieldReference, Value];
};

type FieldReference = {
  $ref: string;
};

type Value = 
  | string
  | number
  | boolean
  | null
  | Array<any>
  | Object;

const FIELD_LEVEL_OPERATORS = [
  '$eq',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$ne',
] as const;

const DOC_LEVEL_OPERATORS = [
  '$and',
  '$or',
  '$nor',
] as const;

function parseFilterDoc(
  filterDoc: FilterDoc, 
  { parentKey }: { parentKey: string | null }
): [Error, null] | [null, CanonicalNode] {
  try {
    const elements = Object.entries(filterDoc);
    const parsedNodes: CanonicalNode[] = [];
    
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

function parseFilterElement(key: string, value: any, { parentKey }: { parentKey: string | null }): [Error, null] | [null, CanonicalNode] {
  try {
    const isKeyOperator = /^\$/.test(key);
    const parser = parsers[key as keyof typeof parsers];

    if (isKeyOperator && !parser) {
      throw new Error(`Unknown operator: ${key}`);
    }

    const [error, node] = parser.parse(value, { parentKey });

    if (error) throw error;

    return [null, node];
  } catch (error) {
    return [error as Error, null];
  }
}

const parsers = {
  '$eq': {
    parse(
      value: any, 
      { parentKey }: { parentKey: string | null }
    ): [Error, null] | [null, CanonicalNode_$eq] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || isParentKeyOperator) {
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
    ): [Error, null] | [null, CanonicalNode_$gt] {
      try {
        const isParentKeyOperator = parentKey ? /^\$/.test(parentKey) : false;

        if (!parentKey || isParentKeyOperator) {
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
  }
} as const;