import Database from 'better-sqlite3';
import { BSON, ObjectId } from 'bson';
import fs from 'fs';
import { before, describe, it } from 'node:test';
import { generateAndExecuteSQLFromQueryIR } from '#backend/sql-generator/index.js';
import assert from 'assert';
import { fileURLToPath } from 'url';
import path from 'path';
import type { InsertCommandIR } from '#shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


let db: Database.Database;
let collectionObjs: { collection: string; documents: Record<string, any>[] }[];
before(() => {
  db = new Database();
  collectionObjs = JSON.parse(fs.readFileSync(path.join(__dirname, './seed.json'), 'utf-8'));
});

describe('insert command', () => {
  it('inserts new documents in the specified collection', () => {
    for (const collectionObj of collectionObjs) {
      const { collection, documents } = collectionObj;
      db.exec(`CREATE TABLE ${collection} (id TEXT, doc TEXT)`);
      
      const documentsWithId = documents.map(d => ({ ...d, _id: new ObjectId() })) as any;

      const command: InsertCommandIR = {
        command: 'insert',
        database: 'test',
        collection,
        documents: documentsWithId,
      };

      generateAndExecuteSQLFromQueryIR(command, db);

      const stmt = db.prepare(`SELECT doc FROM ${collection}`);
      const stmtResult = stmt.all();

      assert.equal(stmtResult.length, documents.length);
      for (const document of documentsWithId) {
        const resultDocJSON = (stmtResult.find((el: any) => JSON.parse(el.doc).username === document.username) as any)?.doc;

        assert.equal(JSON.stringify(document), resultDocJSON);
      }
    }
  })
});


