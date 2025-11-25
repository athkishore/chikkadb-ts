import type Database from "better-sqlite3";

export function generatePreparedStatement_Create(command: CreateCommandIR, db: Database.Database) {
  const statement = db.prepare(`CREATE TABLE ? (id TEXT, doc TEXT)`);
  statement.bind(command.collection);
  return statement;
}

type CreateCommandIR = {
  command: 'create';
  database: string;
  collection: string;
}