import config from "#backend/config.js";
import type { UpdateNodeIR } from "#shared/types.js";
import { getValueSqlFragment } from "./filter.js";

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

export function getUpdateFragment(update: UpdateNodeIR[]) {
  let sqlFragment = '';

  for (const element of update) {
    switch(element.operator) {
      case '$set': {
        sqlFragment = `
json_set(
  c.doc,
  ${element.operandsArr.map(item => {
    const ref = item[0].$ref;
    const val = item[1];

    const fieldPathSegments = ref.split('.');

    const sqlFieldRef = fieldPathSegments.reduce((acc, seg, index, arr) => {
      return !isNaN(Number(seg))
        ? `${acc}[${seg}]`
        : `${acc}.${seg}`;
    }, '$');

    const sqlValue = Array.isArray(val) || (!!val && typeof val === 'object')
      ? `${JSON_TYPE}(${getValueSqlFragment(val)})`
      : getValueSqlFragment(val);

    return `'${sqlFieldRef}'\n,\t${sqlValue}`;
  })}
)        
`;
      }
    }
  }

  return sqlFragment;
}