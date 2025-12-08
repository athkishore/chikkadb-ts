import Database from 'better-sqlite3';
import fs from 'fs';
import { startupOptions } from '#src/server/config.js';

const DB_PATH = startupOptions.dbpath;

if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });

export function listDatabases() {
  const filenames = fs.readdirSync(DB_PATH);

  const databaseFilenames = filenames.filter(f => /.*sqlite$/.test(f)); 

  const databases = databaseFilenames.map(f => f.split('.')[0]);

  return databases;
}

export function getDatabase(name: string) {
  const db = new Database(`${DB_PATH}/${name}.sqlite`);
  return db;
}

export function deleteDatabase(name: string): Error | 0 {
  try {
    if (fs.existsSync(`${DB_PATH}/${name}.sqlite`)) {
      fs.unlinkSync(`${DB_PATH}/${name}.sqlite`);
    }

    return 0;
  } catch (error) {
    return error as Error;
  }
  
}