import { parseUpdateCommand } from '#src/query-parser/update.js';
import { generateAndExecuteSQLFromQueryIR } from '#src/sql-generator/index.js';
import assert from 'assert';
import Database from 'better-sqlite3';
import { ObjectId } from 'bson';
import fs from 'fs';
import { after, before, describe, it } from 'node:test';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const transaction = db.transaction(documents => {
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

type Test = {
  type: 'test';
  name: string;
  input: { filter: Record<string, any>; update: Record<string, any>; };
  expect: (resultDocs: Record<string, any>[], collnDocs: Record<string, any>[]) => boolean;
};

type Suite = {
  type: 'suite';
  name: string;
  children: (Suite | Test)[];
};

const suite: Suite = {
  type: 'suite',
  name: 'update command',
  children: [
    {
      type: 'suite',
      name: 'operator $set',
      children: [
        {
          type: 'test',
          name: 'updates existing top-level field',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                email: 'user1.new@example.org',
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.email === 'user1.new@example.org';
          },
        },
        {
          type: 'test',
          name: 'creates new top-level field',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                testField: 'value',
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.testField === 'value';
          },
        },
        {
          type: 'test',
          name: 'sets multiple top-level fields',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                x: 'foo',
                y: 'bar',
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.x === 'foo'
              && result[0]!.y === 'bar';
          },
        },
        {
          type: 'test',
          name: 'updates existing nested field inside object',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                'address.street': 'Sankey Road',
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.address.street === 'Sankey Road';
          }
        },
        {
          type: 'test',
          name: 'sets multiple fields inside object',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                'address.x': 'foo',
                'address.y': 'bar',
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.address.x === 'foo'
              && result[0]!.address.y === 'bar';
          }
        },
        {
          type: 'test',
          name: 'creates parent object field if it does not exist',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                'obj.x': 1,
              },
            },
          },
          expect: result => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.obj
              && result[0]!.obj.x === 1;
          }
        },
      ]
    },
    {
      type: 'suite',
      name: 'operator $unset',
      children: [
        {
          type: 'test',
          name: 'removes existing top-level field',
          input: {
            filter: { username: 'user1' },
            update: {
              $unset: {
                active: null,
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.active === undefined;
          }
        },
      ]
    }
  ]
};

function executeTest(test: Test) {
  it(test.name, () => {
    const commandIR = parseUpdateCommand({
      command: 'update',
      database: 'test',
      collection: 'users',
      updates: [{
        q: test.input.filter,
        u: test.input.update,
      }],
    });

    const sqlResult = generateAndExecuteSQLFromQueryIR(commandIR, db);
    const sqlResultDocuments = sqlResult.cursor.firstBatch;

    assert(test.expect(sqlResultDocuments, seedCollections[0].documents));
  });
}

function executeSuite(suite: Suite) {
  describe(suite.name, () => {
    for (const child of suite.children) {
      if (child.type === 'suite') {
        executeSuite(child);
      } else {
        executeTest(child);
      }
    }
  });
}

executeSuite(suite);

after(() => {
  db.close();
});