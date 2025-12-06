import type { AggregateCommandIR, AggregationStageIR } from "#src/types.js";
import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import { logSql, logSqlResult } from "./lib/utils.js";
import { parseFromCustomJSON } from "#src/interfaces/lib/json.js";
import { translatePipelineToSQL } from "./aggregation-stages/pipeline.js";

export function generateAndExecuteSQL_Aggregate(
  command: AggregateCommandIR,
  db: Database
) {
  const { collection, database, pipeline } = command;

  if (pipeline.some(s => s === null)) {
    // No Op if any of the stages are not implemented
    // TODO: Return proper error response for this case
    return {
      cursor: {
        firstBatch: [],
        id: 0n,
        ns: `${database}.${collection}`,
      },
      ok: 1,
    };
  }

  if (collection === 1) {
    throw new Error('Non-collection stages not implemented');
  }

  const isCollectionNameValid = validateIdentifier(collection);

  if (!isCollectionNameValid) {
    throw new Error('Invalid collection name');
  }

  const getTablesStmt = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  const tables = getTablesStmt.all();

  if (!tables.some((t: any) => t.name === collection)) {
    return {
      cursor: {
        firstBatch: [],
        id: 0n,
        ns: `${database}.${collection}`,
      },
      ok: 1,
    };
  }

  const sql = translateQueryToSQL({
    collection,
    pipeline,
  });

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
  }
}

function translateQueryToSQL({
  collection, 
  pipeline,
}: {
  collection: string;
  pipeline: AggregationStageIR[];
}): string {
  const pipelineCTEs = translatePipelineToSQL(pipeline, collection);


  let sql = ''
  sql += `WITH\n`;
  sql += `${pipelineCTEs.join(',\n')}\n`;
  sql += `SELECT stage${pipelineCTEs.length - 1}.doc\n`;
  sql += `FROM stage${pipelineCTEs.length - 1}`;

  return sql;
}