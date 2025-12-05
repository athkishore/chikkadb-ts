import type Database from "better-sqlite3";
import { validateIdentifier } from "./utils.js";

export function generateAndExecuteSQL_Create(command: CreateCommandIR, db: Database.Database) {
  const isCollectionNameValid = validateIdentifier(command.collection);
  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');
  const statement = db.prepare(`CREATE TABLE IF NOT EXISTS ${command.collection} (id TEXT, doc TEXT)`);
  statement.run()
  
  return { ok: 1 };
}

type CreateCommandIR = {
  command: 'create';
  database: string;
  collection: string;
}