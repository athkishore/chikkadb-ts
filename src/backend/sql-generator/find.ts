import config from "../config.js";
import { 
  DOC_LEVEL_FILTER_OPERATORS, 
  FIELD_LEVEL_FILTER_OPERATORS, 
  type FilterNodeIR, 
  type FilterNodeIR_DocLevel, 
  type FilterNodeIR_FieldLevel, 
  type FieldReference, 
  type Value 
} from "#shared/types.js";

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

type TranslationContext = {
  conditionCTEs: string[];
}

// This is a fickle implementation that can change drastically
// as and when new optimizations are discovered. But the
// interface is unlikely to change.
export function translateQueryToSQL({
  collection,
  canonicalFilter,
}: {
  collection: string;
  canonicalFilter: FilterNodeIR;
  // TODO: canonicalProjection, canonicalSort, etc.
}) {
  const context: TranslationContext = {
    conditionCTEs: [],
  };

  console.dir(canonicalFilter, { depth: null });

  traverseFilterAndTranslateCTE(canonicalFilter, context);

  console.dir(canonicalFilter, { depth: null });
  console.log(context.conditionCTEs);
  const whereFragment = getWhereClauseFromAugmentedFilter(canonicalFilter, context);

  const {
    conditionCTEs
  } = context;

  let sql = `\
SELECT COUNT(DISTINCT(c.id))
FROM ${collection} c
WHERE EXISTS (
  WITH
  ${conditionCTEs.join(',')}
  SELECT 1
  ${conditionCTEs.map((_, index) => {
    return index === 0
      ? `FROM condition_${index} c${index}`
      : `FULL OUTER JOIN condition_${index} c${index} ON 1=1`;
  }).join('\n')}
  WHERE
    ${whereFragment}
)
  `;

  return sql;
  
}


// This function doesn't return any value but adds information
// to canonicalFilter and context.
function traverseFilterAndTranslateCTE(
  canonicalFilter: FilterNodeIR,
  context: TranslationContext,
) {
  const { operator, operands } = canonicalFilter;

  if (
    operator
    && FIELD_LEVEL_FILTER_OPERATORS.includes(operator as FilterNodeIR_FieldLevel['operator'])
  ) {
    const ref = (operands[0] as FieldReference).$ref;
    const value = operands[1] as Value;
    const sqlFragment = getLeafSqlFragment({
      conditionIndex: context.conditionCTEs.length,
      operator: operator as FilterNodeIR_FieldLevel['operator'],
      ref,
      value,
    });
    context.conditionCTEs.push(sqlFragment);
    (canonicalFilter as any).conditionIndex = context.conditionCTEs.length - 1;
  } else if (
    operator
    && DOC_LEVEL_FILTER_OPERATORS.includes(operator as FilterNodeIR_DocLevel['operator'])
  ) {
    for (const operand of operands) {
      traverseFilterAndTranslateCTE(operand as FilterNodeIR, context);
    }
  }
}

function getWhereClauseFromAugmentedFilter(filterNode: FilterNodeIR, context: TranslationContext): string {
  console.log(filterNode);
  if ((filterNode as any).conditionIndex !== undefined) {
    return `(c${(filterNode as any).conditionIndex} IS NOT NULL)`;
  } else if ((filterNode as FilterNodeIR_DocLevel).operator === '$and') {
    const fragments = filterNode.operands.map((op: any) => getWhereClauseFromAugmentedFilter(op, context));
    return `(${fragments.join(' AND ')})`;
  } else if ((filterNode as FilterNodeIR_DocLevel).operator === '$or') {
    const fragments = filterNode.operands.map((op: any) => getWhereClauseFromAugmentedFilter(op, context));
    return `(${fragments.join(' OR ')})`;
  } else if ((filterNode as FilterNodeIR_DocLevel).operator === '$nor') {
    const fragments = filterNode.operands.map((op: any) => getWhereClauseFromAugmentedFilter(op, context));
    return `(NOT (${fragments.join(' OR ')}) )`;
  }

  throw new Error('Could not translate filter node to WHERE clause: ' + filterNode);
}

function getLeafSqlFragment({
  conditionIndex,
  operator,
  ref,
  value,
}: {
  conditionIndex: number;
  operator: FilterNodeIR_FieldLevel['operator'];
  ref: string;
  value: Value;
}): string {
  let fieldPathSegments = ref.split('.');
  const n = conditionIndex;

  // If any internal segments have array indices specified,
  // it can be combined with the two adjacent segments to
  // form a single segment and narrow the document scan.
  fieldPathSegments = fieldPathSegments
    .reduce((acc, el, index, arr) => {
      if (!isNaN(Number(el))) {
        return [
          ...acc.slice(0, acc.length - 1),
          `${acc[acc.length - 1]}[${el}]`,
        ];
      } else if (!isNaN(Number(arr[index - 1]))) {
        return [
          ...acc.slice(0, acc.length - 1),
          `${acc[acc.length - 1]}${el}`,
        ];
      } else {
        return [...acc, el];
      }
    }, [] as string[]);

  const segmentCount = fieldPathSegments.length;
  let sqlFragment = '';
  let segment = fieldPathSegments.pop();
  let segmentIdx = fieldPathSegments.length;

  if (segment && segmentCount === 1) {
    sqlFragment = `\
condition_${n} AS (
  SELECT 1 AS c${n}
  FROM (
    SELECT json_type(c.doc, '$.${segment}') AS type,
      ${JSON_TYPE}_extract(c.doc, '$.${segment}') AS value
  ) AS node
  WHERE CASE node.type
    WHEN 'array' THEN EXISTS (
      SELECT 1
      FROM ${JSON_TYPE}_each(node.value) AS c${n}_p${segmentIdx}
      WHERE c${n}_p${segmentIdx} ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}
    )
    ELSE node.value ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}
  END
)`;

    return sqlFragment;
  }

  while (segment) {
    if (segmentIdx === segmentCount - 1) {
      sqlFragment = `\
WHERE CASE c${n}_p${segmentIdx - 1}.key
  WHEN '${segment}' THEN
    CASE c${n}_p${segmentIdx - 1}.type
      WHEN 'array' THEN EXISTS (
        SELECT 1
        FROM ${JSON_TYPE}_each(c${n}_p${segmentIdx - 1}.value) AS c${n}_p${segmentIdx}
        WHERE c${n}_p${segmentIdx}.value ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}
      )
      ELSE c${n}_p${segmentIdx - 1}.value ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}
    END
  ELSE 0
END      
`;
    } else if (segmentIdx > 0) {
      sqlFragment = `\
WHERE EXISTS (
  SELECT 1
  FROM ${JSON_TYPE}_each(c${n}_p${segmentIdx - 1}.value, '$.${segment}') AS c${n}_p${segmentIdx} ${sqlFragment}
)      
`;
    } else {
      sqlFragment = `\
condition_${n} AS (
  SELECT 1 AS c${n}
  FROM ${JSON_TYPE}_each(c.doc, '$.${segment}') AS c${n}_p${segmentIdx} ${sqlFragment}
)      
`;
    }

    segment = fieldPathSegments.pop();
    segmentIdx--;
  }

  return sqlFragment;
}

function getOperatorSqlFragment(operator: FilterNodeIR_FieldLevel['operator']) {
  switch(operator) {
    case '$eq': return '=';
    case '$gt': return '>';
    case '$gte': return '>=';
    case '$lt': return '<';
    case '$lte': return '<=';
    case '$ne': return '<>';
    default:
      throw new Error('Unknown operator: ' + operator);
  }
}

function getValueSqlFragment(value: Value) {
  if (typeof value === 'string') {
    return `'${value}'`;
  } else if (typeof value === 'number') {
    return `${value}`;
  } else if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  } else if (value === null) {
    return 'NULL';
  } else if (Array.isArray(value)) {
    return `${JSON_TYPE}('${JSON.stringify(value)}')`;
  } else if (typeof value === 'object') {
    return `${JSON_TYPE}('${JSON.stringify(value)}')`;
  }

  throw new Error('Unknown type for value: ' + value);
}