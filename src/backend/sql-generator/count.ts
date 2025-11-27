import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";

export function generateAndExecuteSQL_Count(command: CountCommandIR, db: Database) {
  const { collection, database } = command;
  const isCollectionNameValid = validateIdentifier(collection);

  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');

  const stmt = db.prepare(`SELECT COUNT(DISTINCT id) FROM ${collection}`);
  const result = stmt.get();

  return {
    n: Object.values(result as Object)[0],
    ok: 1,
  };
}

type CountCommandIR = {
  command: 'count';
  database: string;
  collection: string;
};