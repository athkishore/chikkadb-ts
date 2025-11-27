import { db } from "#backend/database/index.js";
import type { Database } from "better-sqlite3";

export function generateAndExecuteSQL_ListCollections(command: ListCollectionsCommandIR, db: Database) {
  const stmt = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  const result = stmt.all();
  console.log(result);
  return result;
}

type ListCollectionsCommandIR = {
  command: 'listCollections';
  database: string;
  nameOnly?: boolean;
}
