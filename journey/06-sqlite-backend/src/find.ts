import Database from "better-sqlite3";
const DB_PATH = 'data/sqlite/cricket.db';

const FILTER_OPERATORS = [
  '$and',
  '$or',
  '$eq',
  '$lt',
  '$lte',
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

const sql = filterParseTree ? convertFilterTreeToSQL(collection, filterParseTree) : null;
console.log(sql);

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
  operands: (FilterParseNode | FieldReference | string | number | boolean /*| BigInt*/ | null)[]; // Array, Object
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

// This is a specific backend implementation and can change
function convertFilterTreeToSQLWhere(filter: FilterParseNode): string {
  const { operator, operands } = filter;

  const sqlFragments: string [] = [];

  for (const operand of operands) {
    if ((operand as FilterParseNode).operator) {
      const sqlFragment = convertFilterTreeToSQLWhere(operand as FilterParseNode);
      sqlFragments.push(sqlFragment);
    } else if ((operand as FieldReference).$ref) {
      const fieldPathSegments = (operand as FieldReference).$ref.split('.');
      const sqlFragment = `'$.${fieldPathSegments.map(el => `${el}%`).join('.')}'`;
      sqlFragments.push(sqlFragment);
    } else if (typeof operand === 'string') {
      sqlFragments.push(`'${operand}'`);
    } else if (typeof operand === 'number') {
      sqlFragments.push(`${operand}`);
    } else if (typeof operand === 'boolean') {
      sqlFragments.push(operand ? 'TRUE' : 'FALSE');
    } else if (operand === null) {
      sqlFragments.push('NULL');
    }


  }
  switch (operator) {
    case '$and': 
      return sqlFragments.map(o => `(${o})`).join(' AND ');

    case '$or':
      return sqlFragments.map(o => `(${o})`).join(' OR ');

    case '$eq':
      return `st.fullkey LIKE ${sqlFragments[0]} AND st.value = ${sqlFragments[1]}`; // highly specific to this implementation

    case '$gt':
      return `st.fullkey LIKE ${sqlFragments[0]} AND st.value > ${sqlFragments[1]}`;

    case '$gte':
      return `st.fullkey LIKE ${sqlFragments[0]} AND st.value >= ${sqlFragments[1]}`;

    case '$lt':
      return `st.fullkey LIKE ${sqlFragments[0]} AND st.value < ${sqlFragments[1]}`;

    case '$lte':
      return `st.fullkey LIKE ${sqlFragments[0]} AND st.value < ${sqlFragments[1]}`;

    default: throw new Error(`Unexpected operator: ${operator}`)
  }

}

function convertFilterTreeToSQL(collection: string, filter: FilterParseNode): string {
  const where = convertFilterTreeToSQLWhere(filter);

  const sql = `
    .timer on
    SELECT m.doc
    FROM ${collection} as c
    WHERE EXISTS (
      WITH subtree(key, fullkey, value) AS (
        SELECT jt.key, jt.fullkey, jt.value
        FROM json_tree(m.doc) AS jt
      )
      SELECT 1
      FROM subtree AS st
      WHERE ${where}
    )
  `;

  return sql;
}

