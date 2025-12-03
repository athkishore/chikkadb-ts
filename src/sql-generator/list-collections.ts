import type { Database } from "better-sqlite3";
import { logSqlResult } from "./lib/utils.js";

export function generateAndExecuteSQL_ListCollections(command: ListCollectionsCommandIR, db: Database) {
  const stmt = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  const result = stmt.all();
  logSqlResult(result);
  return result;
}

type ListCollectionsCommandIR = {
  command: 'listCollections';
  database: string;
  nameOnly?: boolean;
}
