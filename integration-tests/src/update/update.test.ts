import { parseFromCustomJSON, stringifyToCustomJSON } from '@chikkadb/interfaces/lib/json';
import { generateQueryIRFromCommand } from '@chikkadb/command-parser';
import { generateAndExecuteSQLFromQueryIR } from '@chikkadb/backend-sqlite';
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

const seedCollections = parseFromCustomJSON(fs.readFileSync(file, 'utf-8'));

let db: Database.Database;
before(() => {
  db = new Database();
  for (const coln of seedCollections) {
    const { collection, documents } = coln;
    db.exec(`CREATE TABLE ${collection} (doc TEXT, id TEXT UNIQUE AS (json_extract(doc, '$._id')))`);

    const insert = db.prepare(`INSERT INTO ${collection} VALUES (?)`);
    const transaction = db.transaction(documents => {
      for (const document of documents) {
        const _id = new ObjectId();
        insert.run(
          stringifyToCustomJSON({ _id, ...document })
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
          name: 'creates parent object of nested field if it does not exist',
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
        /**
         * This behaviour is different from MongoDB
         * It creates an object and sets key 0 to the value
         * ChikkaDB creates an array and sets first element to value
         */
        {
          type: 'test',
          name: 'creates parent array of index if it does not exist - only if index is 0',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                'arr.0': 1,
                'arr2.1': 10,
              },
            },
          },
          expect: result => {
            return result.length === 1
              && result[0]!.username === 'user1'
              && result[0]!.arr && result[0]!.arr[0] === 1
              && !result[0]!.arr2;
          }
        },
        /**
         * MongoDB returns an error while
         * ChikkaDB doesn't since SQLite json_set silently ignores it
         * TODO: use RAISE() in SQL statements if needed
         */
        {
          type: 'test',
          name: 'does not set a nested field if parent is a primitive',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                'obj.x.y': 2,
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && typeof result[0]!.obj.x === 'number'
              && result[0]!.obj.x === 1;
          },
        },
        {
          type: 'test',
          name: 'sets boolean value',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                bool: true,
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.bool === true;
          },
        },
        {
          type: 'test',
          name: 'sets null value',
          input: {
            filter: { username: 'user1' },
            update: {
              $set: {
                nil: null,
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && result[0]!.nil === null;
          }
        }
      ],
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
        // Add test for no change in the case of non-existent field
        {
          type: 'test',
          name: 'removes existing nested field inside object',
          input: {
            filter: { username: 'user1' },
            update: {
              $unset: {
                'address.x': null,
              },
            },
          },
          expect: (result) => {
            return result.length === 1
              && !('x' in result[0]!.address)
              && result[0]!.address.y === 'bar';
          },
        },
        /**
         * Deviation in Behaviour:
         * MongoDB sets the array element at index to null
         * ChikkaDB removes the element and reduces the size of the array.
         */
        {
          type: 'test',
          name: 'removes array element at index',
          input: {
            filter: { username: 'user1' },
            update: {
              $unset: {
                'follows.1': null,
              },
            },
          },
          expect: result => {
            return result[0]!.follows.length === 1 
              && !result[0]!.follows.includes('user2');
          }
        },
        {
          type: 'test',
          name: 'does not implicitly remove nested fields from member objects of array field',
          input: {
            filter: { username: 'user1' },
            update: {
              $unset: {
                'phones.type': null,
              },
            },
          },
          expect: result =>
            result[0]!.phones.every((el: any) => 'type' in el)
        },
        {
          type: 'test',
          name: 'removes existing nested field in object at explcit array index',
          input: {
            filter: { username: 'user1' },
            update: {
              $unset: {
                'phones.0.type': null,
              },
            },
          },
          expect: result => 
            !('type' in result[0]!.phones[0])
            && ('type' in result[0]!.phones[1]),
        }
      ]
    },
  ]
};

function executeTest(test: Test) {
  it(test.name, () => {
    const commandIR = generateQueryIRFromCommand({
      command: 'update',
      database: 'test',
      collection: 'users',
      updates: [{
        q: test.input.filter,
        u: test.input.update,
      }],
    });

    const sqlResult = generateAndExecuteSQLFromQueryIR(commandIR, db, '');
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