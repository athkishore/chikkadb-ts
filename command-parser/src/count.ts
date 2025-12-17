import type { CountCommand, CountCommandIR } from "@chikkadb/interfaces/command/types";
import { parseFilterDoc } from "./common/filter.js";

export function parseCountCommand(command: CountCommand): CountCommandIR {
  const [error, filterIR] = parseFilterDoc(command.query, { parentKey: null });

  if (error) throw error;

  return {
    ...command,
    filter: filterIR,
  };
}