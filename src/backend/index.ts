import type { QueryIR, ResultIR } from "#shared/types.js";
import { db } from "./database/index.js";
import { generatePreparedStatementFromQueryIR } from "./sql-generator/index.js";

export function executeQueryIR(queryIR: QueryIR) : ResultIR {
  const stmt = generatePreparedStatementFromQueryIR(queryIR, db);

  const result = stmt.all();
  return {};
}