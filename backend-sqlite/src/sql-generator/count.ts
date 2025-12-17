import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import type { CountCommandIR, FilterNodeIR } from "@chikkadb/interfaces/command/types";
import { getWhereClauseFromAugmentedFilter, traverseFilterAndTranslateCTE, type TranslationContext } from "./common/filter.js";
import { logSql, logSqlResult } from "./lib/utils.js";

export function generateAndExecuteSQL_Count(command: CountCommandIR, db: Database) {
  const { collection, database } = command;
  const isCollectionNameValid = validateIdentifier(collection);

  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');

  // const stmt = db.prepare(`SELECT COUNT(DISTINCT id) FROM ${collection}`);
  // const result = stmt.get();

  const sql = translateQueryToSQL({ collection, filter: command.filter })
  logSql(sql);
  const stmt = db.prepare(sql);
  const result = stmt.get();
  logSqlResult(result);

  return {
    n: Object.values(result as Object)[0],
    ok: 1,
  };
}

function translateQueryToSQL({
  collection,
  filter,
}: {
  collection: string;
  filter: FilterNodeIR;
}) {
  if (filter.operator === '$and' && filter.operands.length === 0) {
    return `SELECT COUNT(DISTINCT(id)) FROM ${collection} c`;
  }

  const context: TranslationContext = {
    conditionCTEs: [],
  };

  traverseFilterAndTranslateCTE(filter, context);

  const whereFragment = getWhereClauseFromAugmentedFilter(filter, context);

  const { conditionCTEs } = context;

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