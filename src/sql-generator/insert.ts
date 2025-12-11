import type { Database } from "better-sqlite3";
import { validateIdentifier } from "./utils.js";
import { ObjectId } from "bson";
import type { InsertCommandIR, InsertCommandResult } from "../types.js";
import { stringifyToCustomJSON } from "#src/interfaces/lib/json.js";
import config from "#src/config.js";

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

export function generateAndExecuteSQL_Insert(command: InsertCommandIR, db: Database): InsertCommandResult {
  const { collection, documents } = command;
  
  const isCollectionNameValid = validateIdentifier(collection);
  if (!isCollectionNameValid) throw new Error('Invalid Collection Name');

  const isDocumentsValid = Array.isArray(documents) && documents.every(d => d !== null && typeof d === 'object');
  if (!isDocumentsValid) throw new Error('Invalid Documents');

  const insert = db.prepare(`INSERT INTO ${collection} (doc) VALUES (${JSON_TYPE}(?))`);
  const transaction = db.transaction(documents => {
    for (const document of documents) {
      insert.run(
        stringifyToCustomJSON(document._id === undefined ? { _id: new ObjectId(), ...document } : document),
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
