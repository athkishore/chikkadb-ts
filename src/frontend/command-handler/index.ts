import { executeQueryIR } from "#backend/index.js";
import { generateQueryIRFromCommand } from "#frontend/query-parser/index.js";
import type { CommandResponse, MQLCommand } from "#frontend/types.js";

export function executeCommand(command: MQLCommand): CommandResponse {
  const queryIR = generateQueryIRFromCommand(command);
  const resultIR = executeQueryIR(queryIR);
  

  return {};
}