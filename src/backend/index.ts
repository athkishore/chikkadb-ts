import type { QueryIR, ResultIR } from "#shared/types.js";
import { db } from "./database/index.js";
import { generatePreparedStatementFromQueryIR } from "./sql-generator/index.js";

export function executeQueryIR(queryIR: any) : any {
  const stmt = generatePreparedStatementFromQueryIR(queryIR, db);

  if (queryIR.command === 'find') {
    stmt.all();
  } else {
    const result = stmt.run();
    console.log(result);
  }

  return {};
}