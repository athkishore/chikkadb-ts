import type { FilterNodeIR, UpdateCommandIR, UpdateNodeIR } from "#shared/types.js";
import type { Database } from "better-sqlite3";
import { getWhereClauseFromAugmentedFilter, traverseFilterAndTranslateCTE, type TranslationContext } from "./common/filter.js";
import config from "#backend/config.js";
import { getValueSqlFragment } from "./common/filter.js";

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

export function generateAndExecuteSQL_Update(command: UpdateCommandIR, db: Database) {
  const { collection, updates } = command;

  // TODO: validate and sanitize inputs
  // TODO: Support multiple updates

  const u = updates[0];
  const { filter, update } = u ?? {};

  console.log(command);

  if (!filter) throw new Error('Missing filter for update');
  if (!update) throw new Error('Missing update');

  const sql = translateCommandToSQL({ collection, filter, update });

  console.log(sql);

  const stmt = db.prepare(sql);
  const result = stmt.run();

  console.log(result);
  return {
    ok: 1,
  };
}

export function translateCommandToSQL({
  collection,
  filter,
  update,
}: {
  collection: string;
  filter: FilterNodeIR;
  update: UpdateNodeIR[];
}) {
  const filterContext: TranslationContext = {
    conditionCTEs: [],
  };

  traverseFilterAndTranslateCTE(filter, filterContext);
  
  const { conditionCTEs } = filterContext;

  const whereClause = filter.operator === '$and' && filter.operands.length === 0
    ? ''
    : `\
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
    ${getWhereClauseFromAugmentedFilter(filter, filterContext)}
)
`;

  
  const updateFragment = getUpdateFragment(update);

  let sql = `
UPDATE ${collection} AS c
set doc = ${updateFragment}
${whereClause};
`;
  
  return sql;
}

function getUpdateFragment(update: UpdateNodeIR[]) {
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