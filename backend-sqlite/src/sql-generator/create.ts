import type Database from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import config from "../config.js";

export function generateAndExecuteSQL_Create(command: CreateCommandIR, db: Database.Database) {
  /**
   * This is a temporary fix for testing. The proper solution is to have a meta table
   * mapping mongodb collection names to sqlite table names so that all valid
   * mongodb collection names can be supported.
   */
  const collection = command.collection.replaceAll('.', '_').replaceAll('-', '_');
  const isCollectionNameValid = validateIdentifier(collection);
  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');
  const statement = db.prepare(`CREATE TABLE IF NOT EXISTS ${collection} (doc ${config.enableJSONB ? 'BLOB' : 'TEXT'}, id TEXT UNIQUE AS (json_extract(doc, '$._id')))`);
  statement.run()
  
  return { ok: 1 };
}

type CreateCommandIR = {
  command: 'create';
  database: string;
  collection: string;
}