import { generateAndExecuteSQLFromQueryIR } from "#sql-generator/index.js";
import { parseFindCommand } from "#src/query-parser/find.js";
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

type Test = {
  type: 'test';
  name: string;
  input: { filter: Record<string, any>; };
  expect: (resultDocs: Record<string, any>[], collnDocs: Record<string, any>[]) => boolean,
};

type Suite = {
  type: 'suite';
  name: string;
  children: (Suite | Test)[];
};

const suite: Suite = {
  type: 'suite',
  name: 'find command',
  children: [
    {
      type: 'test',
      name: 'fetches all documents with empty filter',
      input: {
        filter: {}
      },
      expect: (result, collection) => result.length === collection.length,
    },
    {
      type: 'suite',
      name: 'filters a document by top-level field',
      children: [
        {
          type: 'suite',
          name: 'string field',
          children: [
            {
              type: 'test',
              name: 'using $eq',
              input: {
                filter: { username: 'user1' },
              },
              expect: (result) => result.length === 1
                && result[0]!.username === 'user1',
            },
            {
              type: 'test',
              name: 'using $gt',
              input: {
                filter: { username: { $gt: 'user2' } },
              },
              expect: (result) => result.length === 1
                && result[0]!.username === 'user3',
            },
            {
              type: 'test',
              name: 'using $gte',
              input: {
                filter: { username: { $gte: 'user2' } },
              },
              expect: (result) => {
                const usernames = result.map(el => el.username);
                return usernames.length === 2
                  && usernames.includes('user2')
                  && usernames.includes('user3');
              },
            },
            {
              type: 'test',
              name: 'using $lt',
              input: {
                filter: { username: { $lt: 'user2' } },
              },
              expect: result => result.length === 1 && result[0]!.username === 'user1',
            },
            {
              type: 'test',
              name: 'using $lte',
              input: {
                filter: { username: { $lte: 'user2' } },
              },
              expect: result => {
                const usernames = result.map(el => el.username);
                return usernames.length === 2
                  && usernames.includes('user1')
                  && usernames.includes('user2');
              },
            },
            {
              type: 'test',
              name: 'using $ne',
              input: {
                filter: { username: { $ne: 'user2' } },
              },
              expect: result => {
                const usernames = result.map(el => el.username);
                return usernames.length === 2
                  && usernames.includes('user1')
                  && usernames.includes('user3');
              },
            }
          ]
        },
        {
          type: 'suite',
          name: 'array field',
          children: [
            {
              type: 'test',
              name: 'primitive value - using $eq',
              input: {
                filter: { follows: 'user2' },
              },
              expect: (result) => result.length === 2,
            },
            {
              type: 'test',
              name: 'primitive value - using $gt',
              input: {
                filter: { follows: { $gt: 'user2' } },
              },
              expect: result => result.length === 1
                && result[0]!.username === 'user1',
            },
            {
              type: 'test',
              name: 'primitive value - using $gte',
              input: {
                filter: { follows: { $gte: 'user2' } }
              },
              expect: result => result.length === 2,
            },
            {
              type: 'test',
              name: 'primitive value - using $lt',
              input: {
                filter: { follows: { $lt: 'user2' } },
              },
              expect: result => result.length === 0,
            },
            {
              type: 'test',
              name: 'primitive value - using $lte',
              input: {
                filter: { follows: { $lte: 'user2' } },
              },
              expect: result => result.length === 2,
            },
            // {
            //   type: 'test',
            //   name: 'primitive value - using $ne',
            //   input: {
            //     filter: { follows: { $ne: 'user3' } },
            //   },
            //   expect: result => {
            //     const usernames = result.map(el => el.username);
            //     return usernames.length === 2
            //       && usernames.includes('user2')
            //       && usernames.includes('user3');
            //   },
            // },
            {
              type: 'test',
              name: 'array value - using $eq - returns exact match',
              input: {
                filter: { follows: ['user3', 'user2'] }
              },
              expect: result => result.length === 1,
            },
            {
              type: 'test',
              name: 'array value - using $eq - does not return inexact match',
              input: {
                filter: { follows: ['user2', 'user3'] },
              },
              expect: result => result.length === 0,
            },
          ],
        },
        {
          type: 'suite',
          name: 'null field',
          children: [
            /*  
            *   This behaviour is different from MongoDB 
            *   In MongoDB, it also returns documents where
            *   the field doesn't exist
            */
            {
              type: 'test',
              name: 'using $eq',
              input: {
                filter: { homepage: null },
              },
              expect: result => result.length === 1
                && result[0]!.username === 'user1',
            },
            {
              type: 'test',
              name: 'using $ne',
              input: {
                filter: { homepage: { $ne: null } },
              },
              expect: result => result.length === 1
                && result[0]!.username === 'user2',
            }
          ]
        },
        {
          type: 'suite',
          name: 'using $exists',
          children: [
            {
              type: 'test',
              name: 'field exists',
              input: {
                filter: { homepage: { $exists: true } },
              },
              expect: result => result.length === 2,
            },
            {
              type: 'test',
              name: 'field does not exist',
              input: {
                filter: { homepage: { $exists: false } },
              },
              expect: result => result.length === 1,
            },
          ],
        }
      ]
    },
    {
      type: 'suite',
      name: 'filters a document by a nested field inside an object',
      children: [
        {
          type: 'test',
          name: 'using $eq',
          input: {
            filter: { 'address.city': 'Bangalore' }
          },
          expect: result => result.length === 1
            && result[0]!.username === 'user1',
        },
        {
          type: 'test',
          name: 'using $exists: true',
          input: {
            filter: { 'address.pin': { $exists: true } },
          },
          expect: result => result.length === 2,
        },
        {
          type: 'test',
          name: 'using $exists: false',
          input: {
            filter: { 'address.pin': { $exists: false } },
          },
          expect: result => result.length === 1,
        }
      ]
    },
    {
      type: 'suite',
      name: 'filters a document by a nested field in an array element',
      children: [
        {
          type: 'test',
          name: 'using $eq',
          input: {
            filter: { 'phones.type': 'mobile' },
          },
          expect: result => result.length === 2,
        },
        {
          type: 'test',
          name: 'using $exists: true',
          input: { filter: { 'phones.type': { $exists: true } } },
          expect: result => result.length === 2,
        },
        {
          type: 'test',
          name: 'using $exists: false',
          input: { filter: { 'phones.type': { $exists: false } } },
          expect: result => result.length === 1,
        }
      ],
    }
  ]
};

function executeTest(test: Test) {
  it(test.name, () => {
    const comamndIR = parseFindCommand({
      command: 'find',
      database: 'test',
      collection: 'users',
      filter: test.input.filter,
    });
  
    const sqlResult = generateAndExecuteSQLFromQueryIR(comamndIR, db);
    const sqlResultDocuments = sqlResult.cursor.firstBatch;
  
    assert(test.expect(sqlResultDocuments, seedCollections[0].documents));
  });
}

function executeSuite(suite: Suite) {
  describe(suite.name, () => {
    for (const child of suite.children) {
      if (child.type === 'suite') {
        executeSuite(child)
      } else {
        executeTest(child);
      }
    }
  })
}

executeSuite(suite);
