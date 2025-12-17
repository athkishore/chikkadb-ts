import { 
  type FilterNodeIR, 
  type FindCommandIR,
  type ProjectionDocIR,
  type SortNodeIR
} from "@chikkadb/interfaces/command/types";
import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import { 
  getWhereClauseFromAugmentedFilter, 
  traverseFilterAndTranslateCTE, 
  type TranslationContext 
} from "./common/filter.js";
import { parseFromCustomJSON, stringifyToCustomJSON } from "@chikkadb/interfaces/lib/json";
import { logSql, logSqlResult } from "./lib/utils.js";
import { getSortFragment } from "./common/sort.js";
// import { getProjectionFragment } from "./common/projection.js";
import { project } from "./user-defined-functions/projection.js";

// This is a fickle implementation that can change drastically
// as and when new optimizations are discovered. But the
// interface is unlikely to change.
export function translateQueryToSQL({
  collection,
  canonicalFilter,
  sort,
  limit,
  skip,
  projection,
}: {
  collection: string;
  canonicalFilter: FilterNodeIR;
  sort: SortNodeIR | undefined;
  limit: number | undefined;
  skip: number | undefined;
  projection: ProjectionDocIR | undefined;
}) {
  const sortFragment = sort ? getSortFragment(sort) : '';

  // const projectionFragment = projection ? getProjectionFragment(projection) || 'c.doc' : 'c.doc';
  const projectionFragment = projection ? `_project(c.doc) AS doc` : `c.doc`;

  if (canonicalFilter.operator === '$and' && canonicalFilter.operands.length === 0) {
    let sql = '';
    sql += `SELECT ${projectionFragment}\n`;
    sql += `FROM ${collection} c\n`;
    sql += sortFragment + '\n';
    if (limit !== undefined) {
      sql += `LIMIT ${limit}\n`;
    }
    if (skip !== undefined) {
      sql += `OFFSET ${skip}`;
    }
    return sql;
  }

  const context: TranslationContext = {
    conditionCTEs: [],
  };

  traverseFilterAndTranslateCTE(canonicalFilter, context);

  const whereFragment = getWhereClauseFromAugmentedFilter(canonicalFilter, context);

  const {
    conditionCTEs
  } = context;

  let sql = '';
  sql += `SELECT ${projectionFragment}\n`;
  sql += `FROM ${collection} c\n`;
  sql += `WHERE EXISTS (\n`;
  sql += `  WITH ${conditionCTEs.join(',')}\n`;
  sql += `  SELECT 1\n`;
  sql += `  FROM (SELECT 1)\n`;
  sql += `  ${conditionCTEs.map((_, index) => `FULL OUTER JOIN condition_${index} c${index} ON 1=1`).join('\n')}\n`;
  sql += `  WHERE ${whereFragment}\n`;
  sql += `)\n`;
  sql += `${sortFragment}\n`;
  if (limit !== undefined) {
    sql += `LIMIT ${limit}\n`;
  }
  if (skip !== undefined) {
    sql += `OFFSET ${skip}\n`;
  }

  return sql;
  
}




export function generateAndExecuteSQL_Find(command: FindCommandIR, db: Database) {
  const { collection, database, sort, projection } = command;
  const isCollectionNameValid = validateIdentifier(collection);

  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');

  const getTablesStmt = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
  const tables = getTablesStmt.all();

  if (projection) {
    db.function('_project', (docJSON: string) => stringifyToCustomJSON(project(parseFromCustomJSON(docJSON), projection)));
  }

  if (!tables.some((t: any) => t.name === collection)) {
    return {
      cursor: {
        firstBatch: [],
        id: 0n,
        ns: `${database}.${collection}`,
      },
      ok: 1,
    }
  }

  // const stmt = db.prepare(`SELECT doc FROM ${collection}`);
  // const result = stmt.all();

  const sql = translateQueryToSQL({ collection, canonicalFilter: command.filter, sort, limit: command.limit, skip: command.skip, projection: command.projection });

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
