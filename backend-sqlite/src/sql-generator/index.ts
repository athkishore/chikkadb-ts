import type { CommandIR, QueryIR } from "@chikkadb/interfaces/command/types";
import Database from "better-sqlite3";
import { generateAndExecuteSQL_Create } from "./create.js";
import { generateAndExecuteSQL_Insert } from "./insert.js";
import { generateAndExecuteSQL_Find } from "./find.js";
import { deleteDatabase, getDatabase, listDatabases } from "../database.js";
import { generateAndExecuteSQL_ListCollections } from "./list-collections.js";
import { generateAndExecuteSQL_Count } from "./count.js";
import { generateAndExecuteSQL_Delete } from "./delete.js";
import { generateAndExecuteSQL_Update } from "./update.js";
import { generateAndExecuteSQL_FindAndModify } from "./find-and-modify.js";
import { logSqlExecTime } from "./lib/utils.js";
import { generateAndExecuteSQL_Aggregate } from "./aggregate.js";
import { generateAndExecuteSQL_Drop } from "./drop.js";

export function generateAndExecuteSQLFromQueryIR(commandIR: CommandIR, db: Database.Database, DB_PATH: string): any /* Add strong typing */ {
  switch (commandIR.command) {
    case 'create': {
      return generateAndExecuteSQL_Create(commandIR, db);
    }

    case 'insert': {
      return generateAndExecuteSQL_Insert(commandIR, db);
    }

    case 'find': {
      return generateAndExecuteSQL_Find(commandIR, db);
    }

    case 'count': {
      return generateAndExecuteSQL_Count(commandIR, db);
    }

    case 'delete': {
      return generateAndExecuteSQL_Delete(commandIR, db);
    }

    case 'update': {
      return generateAndExecuteSQL_Update(commandIR, db);
    }

    case 'findAndModify': {
      return generateAndExecuteSQL_FindAndModify(commandIR, db);
    }

    case 'aggregate': {
      return generateAndExecuteSQL_Aggregate(commandIR, db);
    }

    case 'listDatabases': {
      return {
        databases: listDatabases(DB_PATH).map(d => ({ name: d })),
        ok: 1,
      };
    }

    case 'listCollections': {
      const collections = generateAndExecuteSQL_ListCollections(commandIR, db);
      
      return {
        cursor: {
          id: 0n,
          ns: `${commandIR.database}.$cmd.listCollections`,
          firstBatch: collections.map((c: any) => ({
            ...c,
            type: 'collection',
          }))
        },
        ok: 1,
      };
    }

    case 'drop': {
      return generateAndExecuteSQL_Drop(commandIR, db);
    }

    case 'dropDatabase': {
      db.close();
      const result = deleteDatabase(commandIR.database, DB_PATH);
      if (result === 0) {
        return { ok: 1 };
      } else {
        return { ok: 0 };
      }
    }
  }
  
  return db.prepare('');
}

export function executeQueryIR(command: CommandIR, DB_PATH: string) : any {
  try {
    const db = getDatabase(command.database, DB_PATH);

    const start = Date.now();
    const result = generateAndExecuteSQLFromQueryIR(command, db, DB_PATH);
    const end = Date.now();

    logSqlExecTime(`Executed in ${end-start} ms`);

    try {
      db.close();
    } catch (error) {
      console.error(error);
    }
    
    return result;
  } catch (error) {
    console.error(error);
    return {
      ok: 0,
    }
  }
  
}
