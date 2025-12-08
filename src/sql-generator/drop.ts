import type { DropCommandIR } from "#src/types.js";
import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";

export function generateAndExecuteSQL_Drop(command: DropCommandIR, db: Database) {
  
  const { collection } = command;
  const isCollectionNameValid = validateIdentifier(collection);

  if (!isCollectionNameValid) throw new Error('Invalid collection name');
  const statement = db.prepare(`DROP TABLE IF EXISTS ${collection}`);
  statement.run();

  return { ok: 1 };
}