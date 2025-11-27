import type { FindCommand } from "#frontend/types.js";
import type { FindCommandIR } from "#shared/types.js";
import { parseFilterDoc } from "./common/filter.js";

export function parseFindCommand(command: FindCommand): FindCommandIR {
  const [error, filterIR] = parseFilterDoc(command.filter, { parentKey: null });

  if (error) throw error;

  return {
    ...command,
    filter: filterIR,
  };
}