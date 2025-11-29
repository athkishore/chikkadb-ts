// This function doesn't return any value but adds information

import config from "#src/config.js";
import { DOC_LEVEL_FILTER_OPERATORS, FIELD_LEVEL_FILTER_OPERATORS, type FieldReference, type FilterNodeIR, type FilterNodeIR_DocLevel, type FilterNodeIR_FieldLevel, type Value } from "../../types.js";

export type TranslationContext = {
  conditionCTEs: string[];
}

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

// to canonicalFilter and context.
export function traverseFilterAndTranslateCTE(
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

export function getWhereClauseFromAugmentedFilter(filterNode: FilterNodeIR, context: TranslationContext): string {
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
          `${acc[acc.length - 1]}.${el}`,
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
//     sqlFragment = `\
// condition_${n} AS (
//   SELECT 1 AS c${n}
//   FROM (
//     SELECT 
//       CASE json_type(c.doc, '$.${segment}')
//         WHEN 'array' THEN je.value
//         ELSE json_extract(c.doc, '$.${segment}')
//       END AS value
//       FROM
//       (SELECT 1) AS dummy
//       LEFT JOIN ${JSON_TYPE}_each(c.doc, '$.${segment}') AS je
//         ON json_type(c.doc, '$.${segment}') = 'array'
//   ) AS node
//   WHERE 
//     node.value ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}
// )`;
    sqlFragment = `\
condition_${n} AS (
  SELECT 1 AS c${n}
  FROM (
    SELECT 
      CASE json_type(c.doc, '$.${segment}')
        WHEN 'array' THEN je.type
        ELSE json_type(c.doc, '$.${segment}')
      END AS type,
      CASE json_type(c.doc, '$.${segment}')
        WHEN 'array' THEN je.value
        ELSE json_extract(c.doc, '$.${segment}')
      END AS value
      FROM
      (SELECT 1) AS dummy
      LEFT JOIN ${JSON_TYPE}_each(c.doc, '$.${segment}') AS je
        ON json_type(c.doc, '$.${segment}') = 'array'
  ) AS node
  WHERE 
    ${getOperatorExpression('node', operator, value)}
)`;

    return sqlFragment;
  }

  while (segment) {
    if (segmentIdx === segmentCount - 1) {
//       sqlFragment = `\
// WHERE CASE typeof(c${n}_p${segmentIdx - 1}.key)
//   WHEN 'integer' THEN ${JSON_TYPE}_extract(c${n}_p${segmentIdx - 1}.value, '$.${segment}') ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}
//   ELSE c${n}_p${segmentIdx - 1}.key = '${segment}' AND c${n}_p${segmentIdx - 1}.value ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}
// END      
// `;
//       sqlFragment = `\
// WHERE ${JSON_TYPE}_extract(c${n}_p${segmentIdx - 1}.value, '$.${segment}') ${getOperatorSqlFragment(operator)} ${getValueSqlFragment(value)}   
// `;

    sqlFragment = `\
WHERE EXISTS (
  SELECT 1
  FROM (
    SELECT
      CASE json_type(c${n}_p${segmentIdx - 1}.value, '$.${segment}')
        WHEN 'array' THEN je.type
        ELSE json_type(c${n}_p${segmentIdx - 1}.value)
      END AS type,
      CASE json_type(c${n}_p${segmentIdx - 1}.value, '$.${segment}')
        WHEN 'array' THEN je.value
        ELSE json_extract(c${n}_p${segmentIdx - 1}.value, '$.${segment}')
      END as value
    FROM
      (SELECT 1) AS dummy
      LEFT JOIN ${JSON_TYPE}_each(c${n}_p${segmentIdx - 1}.value, '$.${segment}') AS je
        ON json_type(c${n}_p${segmentIdx - 1}.value, '$.${segment}') = 'array'
  ) AS node
  WHERE
    ${getOperatorExpression('node', operator, value)}
)
`;
    } else if (segmentIdx > 0) {
//       sqlFragment = `\
// WHERE EXISTS (
//   SELECT 1
//   FROM ${JSON_TYPE}_each(c${n}_p${segmentIdx - 1}.value, '$.${segment}') AS c${n}_p${segmentIdx} ${sqlFragment}
// )      
// `;

    sqlFragment = `\
WHERE EXISTS (
  SELECT 1
  FROM (
    SELECT
      CASE json_type(c${n}_p${segmentIdx - 1}.value, '$.${segment}')
        WHEN 'array' THEN je.type
        ELSE json_type(c${n}_p${segmentIdx - 1}.value)
      END AS type,
      CASE json_type(c${n}_p${segmentIdx - 1}.value, '$.${segment}')
        WHEN 'array' THEN je.value
        ELSE json_extract(c${n}_p${segmentIdx - 1}.value, '$.${segment}')
      END AS value
    FROM
      (SELECT 1) AS dummy
      LEFT JOIN ${JSON_TYPE}_each(c${n}_p${segmentIdx - 1}.value, '$.${segment}') AS je
        ON json_type(c${n}_p${segmentIdx - 1}.value, '$.${segment}') = 'array'
  ) AS c${n}_p${segmentIdx} ${sqlFragment}
)      
`;
    } else {
      sqlFragment = `\
condition_${n} AS (
  SELECT 1 AS c${n}
  FROM (
    SELECT 
      CASE json_type(c.doc, '$.${segment}')
        WHEN 'array' THEN je.type
        ELSE json_type(c.doc, '$.${segment}')
      END AS type,
      CASE json_type(c.doc, '$.${segment}')
        WHEN 'array' THEN je.value
        ELSE ${JSON_TYPE}_extract(c.doc, '$.${segment}')
      END AS value
    FROM
    (SELECT 1) AS dummy
    LEFT JOIN ${JSON_TYPE}_each(c.doc, '$.${segment}') AS je
      ON json_type(c.doc, '$.${segment}') = 'array'
  ) AS c${n}_p${segmentIdx} ${sqlFragment}
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

export function getValueSqlFragment(value: Value) {
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

function getOperatorExpression(tblPrefix: string, operator: FilterNodeIR_FieldLevel['operator'], value: Value) {
  switch(operator) {
    case '$eq': {
      return value !== null ? `${tblPrefix}.value = ${getValueSqlFragment(value)}` : `${tblPrefix}.type = 'null'`;
    }
    case '$gt': {
      return value !== null ? `${tblPrefix}.value > ${getValueSqlFragment(value)}` : `${tblPrefix}.value > -1e308`;
    }
    case '$gte': {
      return value !== null ? `${tblPrefix}.value >= ${getValueSqlFragment(value)}` : `${tblPrefix}.value >= -1e308`;
    }
    case '$lt': {
      return `${tblPrefix}.value < ${getValueSqlFragment(value)}`;
    }
    case '$lte': {
      return `${tblPrefix}.value <= ${getValueSqlFragment(value)}`;
    }
    case '$ne': {
      return value !== null ? `${tblPrefix}.value <> ${getValueSqlFragment(value)}` : `${tblPrefix}.type <> 'null'`;
    }

    case '$exists': {
      return Boolean(value) ? `${tblPrefix}.type IS NOT NULL` : `${tblPrefix}.type IS NULL`;
    }
  }

}