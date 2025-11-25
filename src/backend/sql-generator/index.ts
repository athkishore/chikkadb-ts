import type { QueryIR } from "#shared/types.js";
import Database from "better-sqlite3";
import { generatePreparedStatement_Create } from "./create.js";
export function generatePreparedStatementFromQueryIR(commandIR: any, db: Database.Database): Database.Statement {
  switch (commandIR.command) {
    case 'create': {
      return generatePreparedStatement_Create(commandIR, db);
    }
  }
  
  return db.prepare('');
}