import { parseFromCustomJSON, stringifyToCustomJSON } from "@chikkadb/interfaces/lib/json";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from 'fs';
import Database from "better-sqlite3";
import { after, before, describe, it } from "node:test";
import { ObjectId } from "bson";
import { generateQueryIRFromCommand } from "@chikkadb/command-parser";
import { generateAndExecuteSQLFromQueryIR } from "@chikkadb/backend-sqlite";
import assert, { ok } from "node:assert";

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
    const transaction = db.transaction((documents) => {
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
  input: {
    filter: Record<string, any>;
    projection: Record<string, any>;
  };
  expect: (resultDocs: Record<string, any>[], originalDocs: Record<string, any>[]) => boolean;
};

type Suite = {
  type: 'suite';
  name: string;
  children: (Suite | Test)[];
};

const suite: Suite = {
  type: 'suite',
  name: 'projection',
  children: [
    {
      type: 'suite',
      name: 'inclusion projection',
      children: [
        {
          type: 'test',
          name: 'includes top-level fields that exist',
          input: {
            filter: {},
            projection: { _id: 1, username: 1 },
          },
          expect: (result) => {
            return result.every((doc: any) => {
              const keys = Object.keys(doc);
              return keys.length === 2
                && keys.includes('_id')
                && keys.includes('username');
            });
          },
        }
      ],
    },
    {
      type: 'suite',
      name: 'exclusion projection',
      children: [
        {
          type: 'test',
          name: 'excludes top-level fields that exist',
          input: {
            filter: {},
            projection: { email: 0, age: 0 },
          },
          expect: (resultDocs, originalDocs) => {
            return resultDocs.every(resultDoc => {
              const originalDoc = originalDocs.find(d => d.username === resultDoc.username);
              if (!originalDoc) return false;

              const originalDocKeys = Object.keys(originalDoc);
              const resultDocKeys = Object.keys(resultDoc);

              return originalDocKeys.every(originalDocKey => {
                if (originalDocKey === 'email' || originalDocKey === 'age') {
                  return !resultDocKeys.includes(originalDocKey);
                } else {
                  return resultDocKeys.includes(originalDocKey);
                }
              }); 
            });
          }
        },
        {
          type: 'test',
          name: 'excludes nested field in object',
          input: {
            filter: {},
            projection: { 'address.street': 0 },
          },
          expect: (resultDocs, originalDocs) => {
            return resultDocs.every(resultDoc => {
              const originalDoc = originalDocs.find(d => d.username === resultDoc.username);
              if (!originalDoc) return false;

              const originalDocKeys = Object.keys(originalDoc);
              const resultDocKeys = Object.keys(resultDoc).filter(k => k !== '_id');

              if (originalDocKeys.length !== resultDocKeys.length) {
                return false;
              }

              const originalDocAddressKeys = Object.keys(originalDoc.address);
              const resultDocAddressKeys = Object.keys(resultDoc.address);

              return originalDocAddressKeys.every(oKey => {
                if (oKey === 'street') {
                  return !resultDocAddressKeys.includes(oKey);
                } else {
                  return resultDocAddressKeys.includes(oKey);
                }
              });
            });
          },
        }
      ],
    }
  ],
}

function executeTest(test: Test) {
  it(test.name, () => {
    const commandIR = generateQueryIRFromCommand({
      command: 'find',
      database: 'test',
      collection: 'users',
      filter: test.input.filter,
      projection: test.input.projection,
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