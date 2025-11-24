import type { QueryIR } from "#shared/types.js";
import Database from "better-sqlite3";
export function generatePreparedStatementFromQueryIR(queryIR: QueryIR, db: Database.Database): Database.Statement {
  return db.prepare('');
}