import type { DeleteCommandIR, FilterNodeIR } from "../types.js";
import type { Database } from "better-sqlite3";
import { getWhereClauseFromAugmentedFilter, traverseFilterAndTranslateCTE, type TranslationContext } from "./common/filter.js";
import { logSql, logSqlResult } from "./lib/utils.js";

function translateCommandToSQL({
  collection,
  filterIR,
}: {
  collection: string;
  filterIR: FilterNodeIR;
}) {
  if (filterIR.operator === '$and' && filterIR.operands.length === 0) {
    return `DELETE FROM ${collection} AS c`;
  }

  const context: TranslationContext = {
    conditionCTEs: [],
  };

  traverseFilterAndTranslateCTE(filterIR, context);

  const whereFragment = getWhereClauseFromAugmentedFilter(filterIR, context);

  const {
    conditionCTEs
  } = context;

  let sql = `\
DELETE
FROM ${collection} AS c
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

/* TODO: Standardize return type of generateAndExuteSQL functions */
export function generateAndExecuteSQL_Delete(command: DeleteCommandIR, db: Database) {
  const { collection, deletes } = command;

  // validate and sanitize inputs

  const filterIR = deletes[0]?.filter;
  if (!filterIR) throw new Error('Missing filter for delete');

  const sql = translateCommandToSQL({ collection, filterIR });

  logSql(sql);

  const stmt = db.prepare(sql);
  const result = stmt.run();

  logSqlResult(result);

  return {
    ok: 1,
  };
}