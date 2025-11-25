import type Database from "better-sqlite3";
import { validateIdentifier } from "./utils.js";

export function generatePreparedStatement_Create(command: CreateCommandIR, db: Database.Database) {
  const isCollectionNameValid = validateIdentifier(command.collection);
  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');
  const statement = db.prepare(`CREATE TABLE ${command.collection} (id TEXT, doc TEXT)`);
  return statement;
}

type CreateCommandIR = {
  command: 'create';
  database: string;
  collection: string;
}