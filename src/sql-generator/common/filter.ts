import config from "#src/config.js";
import { DOC_LEVEL_FILTER_OPERATORS, FIELD_LEVEL_FILTER_OPERATORS, type FieldReference, type FilterNodeIR, type FilterNodeIR_DocLevel, type FilterNodeIR_FieldLevel, type Value } from "../../types.js";

export type TranslationContext = {
  conditionCTEs: string[];
}

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

// This function doesn't return any value but adds information
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
      sqlFragment = `\
condition_${n} AS (
  SELECT 1 AS c${n}
  FROM (
    SELECT 
      je.key AS key,
      je.type AS type,
      je.value AS value,
      max(je.key = '${segment}') OVER () AS _exists
      FROM ${JSON_TYPE}_each(c.doc) AS je
  ) AS node
  WHERE
    (${getOperatorExpression('node', segment, operator, value)})
)`;

    return sqlFragment;
  }

  while (segment) {
    if (segmentIdx === segmentCount - 1) {
    sqlFragment = `\
WHERE EXISTS (
  SELECT 1
  FROM (
    SELECT
      CASE typeof(prev.key)
        WHEN 'integer' THEN '${segment}'
        ELSE prev.key
      END as key,
      CASE typeof(prev.key)
        WHEN 'integer' THEN json_type(prev.value, '$.${segment}')
        ELSE prev.type
      END AS type,
      CASE typeof(prev.key)
        WHEN 'integer' THEN json_extract(prev.value, '$.${segment}')
        ELSE prev.value
      END as value,
      CASE typeof(prev.key)
        WHEN 'integer' THEN json_type(prev.value, '$.${segment}')
        ELSE prev.key = '${segment}'
      END AS _exists
    FROM
      (SELECT c${n}_p${segmentIdx - 1}.key as key, c${n}_p${segmentIdx - 1}.type as type, c${n}_p${segmentIdx - 1}.value) AS prev
  ) AS node
  WHERE
    (${getOperatorExpression('node', segment, operator, value)})
  LIMIT 1
)
`;
    } else if (segmentIdx > 0) {
    sqlFragment = `\
WHERE (c${n}_p${segmentIdx - 1}.key = '${segment}' OR typeof(c${n}_p${segmentIdx - 1}.key) = 'integer') AND EXISTS (
  SELECT 1
  FROM (
    ${JSON_TYPE}_each(
      c${n}_p${segmentIdx - 1}.value,
      CASE typeof(c${n}_p${segmentIdx - 1}.key) 
        WHEN 'integer' THEN '$.${segment}'
        ELSE '$'
      END
    )
  ) AS c${n}_p${segmentIdx} ${sqlFragment}
  LIMIT 1
)      
`;
    } else {
      sqlFragment = `\
condition_${n} AS (
  SELECT 1 AS c${n}
  FROM (
    ${JSON_TYPE}_each(c.doc, '$.${segment}')
  ) AS c${n}_p${segmentIdx} ${sqlFragment}
  LIMIT 1
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

function getOperatorExpression(tblPrefix: string, segment: string, operator: FilterNodeIR_FieldLevel['operator'], value: Value) {
  switch(operator) {
    case '$eq': {
      let s = '';

      s += `${tblPrefix}.key = '${segment}' AND \n`;
      s += `CASE ${tblPrefix}.type\n`;
      s += `  WHEN 'array' THEN EXISTS(\n`;
      s += `    SELECT 1\n`;
      s += `    FROM ${JSON_TYPE}_each(${tblPrefix}.value) AS _je\n`;
      s += `    WHERE _je.value = ${getValueSqlFragment(value)}\n`;
      s += `  ) OR ${tblPrefix}.value = ${getValueSqlFragment(value)}\n`;
      s += `  ELSE ${value !== null ? `${tblPrefix}.value = ${getValueSqlFragment(value)}` : `${tblPrefix}.type = 'null'`}\n`;
      s += `END\n`;
      return s;
    }
    case '$gt': {
      return value !== null 
        ? `${tblPrefix}.key = '${segment}' AND ${tblPrefix}.value > ${getValueSqlFragment(value)}` 
        : `${tblPrefix}.key = '${segment}' AND ${tblPrefix}.value > -1e308`;
    }
    case '$gte': {
      return value !== null 
        ? `${tblPrefix}.key = '${segment}' AND ${tblPrefix}.value >= ${getValueSqlFragment(value)}` 
        : `${tblPrefix}.key = '${segment} AND '${tblPrefix}.value >= -1e308`;
    }
    case '$lt': {
      return `${tblPrefix}.key = '${segment}' AND ${tblPrefix}.value < ${getValueSqlFragment(value)}`;
    }
    case '$lte': {
      return `${tblPrefix}.key = '${segment}' AND ${tblPrefix}.value <= ${getValueSqlFragment(value)}`;
    }
    case '$ne': {
      return value !== null 
        ? `${tblPrefix}.key = '${segment}' AND ${tblPrefix}.value <> ${getValueSqlFragment(value)}` : `${tblPrefix}.key = '${segment}' AND ${tblPrefix}.type <> 'null'`;
    }

    case '$exists': {
      return Boolean(value) ? `${tblPrefix}._exists > 0` : `${tblPrefix}._exists = 0`;
    }
  }

}