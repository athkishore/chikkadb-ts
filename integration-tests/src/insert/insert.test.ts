import Database from 'better-sqlite3';
import { ObjectId } from 'bson';
import { before, describe, it } from 'node:test';
import { generateAndExecuteSQLFromQueryIR } from '@chikkadb/backend-sqlite';
import assert from 'assert';
import type { InsertCommandIR } from '@chikkadb/interfaces/command/types';
import { parseFromCustomJSON, stringifyToCustomJSON } from '@chikkadb/interfaces/lib/json';

const collection = 'users';
const documents = [
  {
    _id: new ObjectId(),
    username: 'user1',
  },
  {
    _id: new ObjectId(),
    username: 'user2',
  },
];

let db: Database.Database;
before(() => {
  db = new Database();
});

describe('insert command', () => {
  it('inserts new documents in the specified collection', () => {
    db.exec(`CREATE TABLE ${collection} (doc TEXT, id TEXT UNIQUE AS (json_extract(doc, '$._id')))`);      
    
    const command: InsertCommandIR = {
      command: 'insert',
      database: 'test',
      collection,
      documents,
    };

    generateAndExecuteSQLFromQueryIR(command, db, '');

    const stmt = db.prepare(`SELECT doc FROM ${collection}`);
    const stmtResult = stmt.all();

    assert.equal(stmtResult.length, documents.length);
    for (const document of documents) {
      const resultDocJSON = (stmtResult.find((el: any) => parseFromCustomJSON(el.doc).username === document.username) as any)?.doc;

      assert.equal(stringifyToCustomJSON(document), resultDocJSON);
    }
  });
});


