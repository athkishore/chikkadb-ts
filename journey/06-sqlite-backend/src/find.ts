import Database from "better-sqlite3";
const DB_PATH = 'data/sqlite/cricket.db';

const FILTER_OPERATORS = [
  '$and',
  '$or',
  '$eq',
  '$lt',
  'lte',
  '$gt',
  '$gte',
] as const;

const LEAF_OPERATORS = [
  '$eq',
  '$lt',
  '$lte',
  '$gt',
  '$gte'
] as const;

const INTERIOR_OPERATORS = [
  '$and',
  '$or',
];


const db = new Database(DB_PATH);

const collection = process.argv[2];
if (!collection) {
  console.error('Collection name is required');
  process.exit(1);
}

const filterJSON = process.argv[3];
if (!filterJSON) {
  console.error('Filter is required');
  process.exit(1);
}

const filter = JSON.parse(filterJSON);
const { error, filterParseTree } = parseFilter(filter);
if (error) console.error(error);
if (filterParseTree) console.dir(filterParseTree, { depth: null });

type FilterOperator = typeof FILTER_OPERATORS[number];
type LeafOperator = typeof LEAF_OPERATORS[number];
type InteriorOperator = typeof INTERIOR_OPERATORS[number];

// interface FilterParseTree {
//   operator: FilterOperator,
//   operands: FilterParseNode[];
// }

interface FieldReference {
  $ref: string;
}

interface FilterParseNode {
  operator: FilterOperator;
  operands: (FilterParseNode | FieldReference | string | number | boolean | BigInt | null)[];
}

function parseFilter(
  filter: Record<string, any>, 
  context: { 
    parentKey: string;
  } = {
    parentKey: '$and',
  }
): { 
  error: null, 
  filterParseTree: FilterParseNode 
} | { 
  error: Error, 
  filterParseTree: null 
} {
  try {
    const topLevelOperands: FilterParseNode[] = [];

    const elements = Object.entries(filter);

    for (const [key, value] of elements) {
      const node: FilterParseNode = parseElement(key, value, { parentKey: context.parentKey });
      topLevelOperands.push(node);
    }

    if (topLevelOperands.length === 1) {
      return {
        error: null,
        filterParseTree: topLevelOperands[0]!
      };
    } else {
      return {
        error: null,
        filterParseTree: {
          operator: '$and',
          operands: topLevelOperands,
        }
      }
    }
  } catch (error) {
    return {
      error: error as Error,
      filterParseTree: null,
    }
  }
}

function parseElement(
  key: string,
  value: any,
  context: { parentKey: string }
) : FilterParseNode {
  const isKeyOperator = key.match(/^\$/);

  if (isKeyOperator && !FILTER_OPERATORS.includes(key as any)) {
    throw new Error(`Unknown filter operator: ${key}`);
  }

  if (LEAF_OPERATORS.includes(key as any)) {
    if (FILTER_OPERATORS.includes(context.parentKey as FilterOperator)) {
      throw new Error(`Leaf operator ${key} needs to have a field ref as the parent key`);
    }

    return {
      operator: key as FilterOperator,
      operands: [
        { $ref: context.parentKey },
        value,
      ]
    };

  }

  if (
    typeof value === 'string'
    || typeof value === 'number' // what about BigInt
    || typeof value === 'boolean'
    || value === null
    || Array.isArray(value)
  ) {
    return {
      operator: '$eq',
      operands: [
        { $ref: key },
        value,
      ]
    }
  } else if (typeof value === 'object') {
    const { error, filterParseTree } = parseFilter(value, { parentKey: key });
    if (error) {
      throw error;
    }

    return filterParseTree;
  }

  throw new Error(`Unexpected key-value pair: ${key} ${value}`);
}

// function parseFilter(filterJSON: string): { error: Error | null, filterParseTree: FilterParseTree | null } {
//   try {
//     const filter = JSON.parse(filterJSON);
//     const elements = Object.entries(filter);

//     const operands: FilterParseNode[] = [];

//     for (const [key, value] of elements) {
//       if (
//         !key.match(/^\$/) 
//         && (
//           typeof value === 'string'
//           || typeof value === 'number'
//           || typeof value === 'bigint'
//           || typeof value === 'boolean'
//           || value === null
//         )
//       ) {
//         operands.push({
//           operator: '$eq',
//           operands: [{ $ref: key }, value]
//         });
//       } else {
//         throw new Error('Operand type not supported yet');
//       }
//     }

//     return {
//       error: null,
//       filterParseTree: {
//         operator: '$and',
//         operands,
//       }
//     }
//   } catch(error) {
//     return {
//       error: error as Error,
//       filterParseTree: null,
//     };
//   }
// }

// const FilterNodetoSQLWhereFragmentMap = {
//   $eq: function (filterNode: FilterParseNode) {
//     const { operator, operands } = filterNode;
//     if (operator !== '$eq') throw new Error('An unexpected error occured'); // print node id
//     if (operands.length !== 2) throw new Error('$eq needs exactly two operands');


//     let sqlFragment = ``;
//     for (const operand of operands) {
//       if (operand && (operand as FieldReference).$ref) {
//         const fieldPath = (operand as FieldReference).$ref.split('.');

        

//       }
//     }
//   }
// };

// function getSQLWhereFromFilter(filter: FilterParseTree) {

// }
