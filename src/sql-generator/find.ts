import config from "../config.js";
import { 
  type FilterNodeIR, 
  type FindCommandIR
} from "../types.js";
import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import { 
  getWhereClauseFromAugmentedFilter, 
  traverseFilterAndTranslateCTE, 
  type TranslationContext 
} from "./common/filter.js";
import { parseFromCustomJSON } from "#src/interfaces/lib/json.js";
import { logSql, logSqlResult } from "./lib/utils.js";





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
  if (canonicalFilter.operator === '$and' && canonicalFilter.operands.length === 0) {
    return `SELECT c.doc FROM ${collection} c`;
  }

  const context: TranslationContext = {
    conditionCTEs: [],
  };

  traverseFilterAndTranslateCTE(canonicalFilter, context);

  const whereFragment = getWhereClauseFromAugmentedFilter(canonicalFilter, context);

  const {
    conditionCTEs
  } = context;

  let sql = `\
SELECT c.doc
FROM ${collection} c
WHERE EXISTS (
  WITH
  ${conditionCTEs.join(',')}
  SELECT 1
  FROM (SELECT 1)
  ${conditionCTEs.map((_, index) => {
    return `FULL OUTER JOIN condition_${index} c${index} ON 1=1`;
  }).join('\n')}
  WHERE
    ${whereFragment}
)
  `;

  return sql;
  
}




export function generateAndExecuteSQL_Find(command: FindCommandIR, db: Database) {
  const { collection, database } = command;
  const isCollectionNameValid = validateIdentifier(collection);

  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');

  // const stmt = db.prepare(`SELECT doc FROM ${collection}`);
  // const result = stmt.all();

  const sql = translateQueryToSQL({ collection, canonicalFilter: command.filter });

  logSql(sql);

  const stmt = db.prepare(sql);
  const result = stmt.all();

  logSqlResult(result);

  return { 
    cursor: {
      firstBatch: result.map(el => parseFromCustomJSON((el as any).doc)),
      id: 0n,
      ns: `${database}.${collection}`,
    },
    ok: 1,
  };
}
