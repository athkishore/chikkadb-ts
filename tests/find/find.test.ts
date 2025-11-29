import { generateAndExecuteSQLFromQueryIR } from "#sql-generator/index.js";
import type { FindCommandIR } from "../../src/types.js";
import assert from "assert";
import Database from "better-sqlite3";
import { ObjectId } from "bson";
import fs from 'fs';
import { before, describe, it } from "node:test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.join(__dirname, './seed.json');

const seedCollections = JSON.parse(fs.readFileSync(file, 'utf-8'));

let db: Database.Database;
before(() => {
  db = new Database();
  for (const coln of seedCollections) {
    const { collection, documents } = coln;
    db.exec(`CREATE TABLE ${collection} (id TEXT, doc TEXT)`);

    const insert = db.prepare(`INSERT INTO ${collection} VALUES (?, ?)`);
    const transaction = db.transaction((documents) => {
      for (const document of documents) {
        const _id = new ObjectId();
        insert.run(
          _id.toHexString(),
          JSON.stringify({ _id: _id.toHexString(), ...document })
        );
      }
    });

    transaction(documents);
  }
});

describe('find command', () => {
  it('fetches all documents with empty filter', () => {
    const command: FindCommandIR = {
      command: 'find',
      database: 'test',
      collection: seedCollections[0].collection,
      filter: { operator: '$and', operands: [] },
    };

    const sqlResult = generateAndExecuteSQLFromQueryIR(command, db);
    const sqlResultDocuments = sqlResult.cursor.firstBatch;

    const documents = seedCollections[0].documents;

    assert.equal(documents.length, sqlResultDocuments.length);
    for (const document of documents) {
      const resultDoc = sqlResultDocuments.find((el: any) => el.username === document.username);
      delete resultDoc['_id'];

      assert.equal(JSON.stringify(document), JSON.stringify(resultDoc));
    }
  });

  describe('filters a document by top-level string field', () => {
    it('using $eq', () => {
      const command: FindCommandIR = {
        command: 'find',
        database: 'test',
        collection: seedCollections[0].collection,
        filter: { operator: '$eq', operands: [{ $ref: 'username' }, 'user1']},
      };
  
      const sqlResult = generateAndExecuteSQLFromQueryIR(command, db);
      const sqlResultDocuments = sqlResult.cursor.firstBatch;
  
      assert.equal(sqlResultDocuments.length, 1);
      assert.equal(sqlResultDocuments[0].username, 'user1');
    });

    it('using $gt', () => {
      const command: FindCommandIR = {
        command: 'find',
        database: 'test',
        collection: seedCollections[0].collection,
        filter: { operator: '$gt', operands: [{ $ref: 'username' }, 'user2' ] },
      };

      const sqlResult = generateAndExecuteSQLFromQueryIR(command, db);
      const sqlResultDocuments = sqlResult.cursor.firstBatch;

      assert.equal(sqlResultDocuments.length, 1);
      assert.equal(sqlResultDocuments[0].username, 'user3');
    });

    it('using $gte', () => {
      const command: FindCommandIR = {
        command: 'find',
        database: 'test',
        collection: seedCollections[0].collection,
        filter: { operator: '$gte', operands: [{ $ref: 'username' }, 'user2'] },
      };

      const sqlResult = generateAndExecuteSQLFromQueryIR(command, db);
      const sqlResultDocuments = sqlResult.cursor.firstBatch;

      assert.equal(sqlResultDocuments.length, 2);
      for (const document of sqlResultDocuments) {
        assert(document.username >= 'user2');
      }
    })
  });

  describe('filters a document by a nested field inside an object', () => {
    it('using $eq', () => {
      const command: FindCommandIR = {
        command: 'find',
        database: 'test',
        collection: seedCollections[0].collection,
        filter: { operator: '$eq', operands: [{ $ref: 'address.city' }, 'Bangalore']},
      };

      const sqlResult = generateAndExecuteSQLFromQueryIR(command, db);
      const sqlResultDocuments = sqlResult.cursor.firstBatch;

      assert.equal(sqlResultDocuments.length, 1);
      assert.equal(sqlResultDocuments[0].username, 'user1');
    });
  });

  describe('filters a document by a nested field in an array element', () => {
    it('using $eq', () => {
      const command: FindCommandIR = {
        command: 'find',
        database: 'test',
        collection: seedCollections[0].collection,
        filter: { operator: '$eq', operands: [{ $ref: 'phones.type' }, 'mobile'] },
      };

      const sqlResult = generateAndExecuteSQLFromQueryIR(command, db);
      const sqlResultDocuments = sqlResult.cursor.firstBatch;

      assert.equal(sqlResultDocuments.length, 2);
    })
  });
})