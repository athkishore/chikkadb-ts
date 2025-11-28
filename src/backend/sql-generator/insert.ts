import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import { ObjectId } from "bson";
import type { InsertCommandIR, InsertCommandResult } from "#shared/types.js";

export function generateAndExecuteSQL_Insert(command: InsertCommandIR, db: Database): InsertCommandResult {
  const { collection, documents } = command;
  
  const isCollectionNameValid = validateIdentifier(collection);
  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');

  const isDocumentsValid = Array.isArray(documents) && documents.every(d => d !== null && typeof d === 'object');
  if (!isDocumentsValid) throw new Error('Invalid Documents');

  const insert = db.prepare(`INSERT INTO ${collection} VALUES (?, ?)`);
  const transaction = db.transaction(documents => {
    for (const document of documents) {
      const { _id } = document;
      insert.run(
        _id instanceof ObjectId ? _id.toHexString() : _id,
        JSON.stringify(document)
      );
    }
  });

  transaction(documents);

  return {
    _type: 'insert',
    n: documents.length,
    ok: 1,
  };
}
