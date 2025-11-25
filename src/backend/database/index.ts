import Database from 'better-sqlite3';
const DB_PATH = 'data/db';


export const db = new Database(`${DB_PATH}/test.sqlite`);