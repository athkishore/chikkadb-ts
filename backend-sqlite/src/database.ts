import Database from 'better-sqlite3';
import fs from 'fs';

export function listDatabases(DB_PATH: string) {
  if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
  const filenames = fs.readdirSync(DB_PATH);

  const databaseFilenames = filenames.filter(f => /.*sqlite$/.test(f)); 

  const databases = databaseFilenames.map(f => f.split('.')[0]);

  return databases;
}

export function getDatabase(name: string, DB_PATH: string): Database.Database {
  if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
  const db = new Database(`${DB_PATH}/${name}.sqlite`);
  return db;
}

export function deleteDatabase(name: string, DB_PATH: string): Error | 0 {
  try {
    if (fs.existsSync(`${DB_PATH}/${name}.sqlite`)) {
      fs.unlinkSync(`${DB_PATH}/${name}.sqlite`);
    }

    return 0;
  } catch (error) {
    return error as Error;
  }
  
}