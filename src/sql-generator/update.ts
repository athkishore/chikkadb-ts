import type { FilterNodeIR, UpdateCommandIR, UpdateNodeIR } from "../types.js";
import type { Database } from "better-sqlite3";
import { getWhereClauseFromAugmentedFilter, traverseFilterAndTranslateCTE, type TranslationContext } from "./common/filter.js";
import { getUpdateFragment } from "./common/update.js";


export function generateAndExecuteSQL_Update(command: UpdateCommandIR, db: Database) {
  const { collection, updates, database } = command;

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
  const result = stmt.all();

  return {
    cursor: {
      firstBatch: result.map(el => JSON.parse((el as any).doc)),
      id: 0n,
      ns: `${database}.${collection}`,
    },
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
${whereClause}
RETURNING doc;
`;
  
  return sql;
}
