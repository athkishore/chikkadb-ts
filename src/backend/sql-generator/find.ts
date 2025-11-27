import config from "../config.js";
import { 
  type FilterNodeIR, 
  type FindCommandIR
} from "#shared/types.js";
import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import { 
  getWhereClauseFromAugmentedFilter, 
  traverseFilterAndTranslateCTE, 
  type TranslationContext 
} from "./common/filter.js";





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

  console.dir(canonicalFilter, { depth: null });

  traverseFilterAndTranslateCTE(canonicalFilter, context);

  console.dir(canonicalFilter, { depth: null });
  console.log(context.conditionCTEs);
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




export function generateAndExecuteSQL_Find(command: FindCommandIR, db: Database) {
  const { collection, database } = command;
  const isCollectionNameValid = validateIdentifier(collection);

  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');

  // const stmt = db.prepare(`SELECT doc FROM ${collection}`);
  // const result = stmt.all();

  const sql = translateQueryToSQL({ collection, canonicalFilter: command.filter });

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
