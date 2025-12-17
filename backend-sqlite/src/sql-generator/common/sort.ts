import config from "../../config.js";
import type { SortNodeIR } from "@chikkadb/interfaces/command/types";

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

export function getSortFragment(sort: SortNodeIR) {
  let sqlFragment = '';

  sqlFragment += `ORDER BY `;
  for (const [index, operand] of sort.operands.entries()) {
    sqlFragment += `${JSON_TYPE}_extract(c.doc, '${getSqlFieldRef(operand[0].$ref)}')`;
    sqlFragment += operand[1] === 1 ? ' ASC' : ' DESC';
    if (index < sort.operands.length - 1) {
      sqlFragment += ',';
    }
  }

  return sqlFragment;
}

function getSqlFieldRef(ref: string) {
  const fieldPathSegments = ref.split('.');

  const sqlFieldRef = fieldPathSegments.reduce((acc, seg) => {
    return !isNaN(Number(seg))
      ? `${acc}[${seg}]`
      : `${acc}.${seg}`;
  }, '$');
  
  return sqlFieldRef;
}