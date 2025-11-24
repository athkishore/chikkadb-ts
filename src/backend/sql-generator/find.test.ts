import { translateQueryToSQL } from "./find.js";
import { parseFilterDoc } from "#frontend/query-parser/filter.js";

const collection = process.argv[2];
if (!collection) throw new Error('collection required');

const filterJSON = process.argv[3];
if (!filterJSON) throw new Error('filter required');

const filter = JSON.parse(filterJSON);

const [error, canonicalFilter] = parseFilterDoc(filter, { parentKey: null });

if (error) throw error;

const sql = translateQueryToSQL({
  collection,
  canonicalFilter,
});

console.log(sql);
