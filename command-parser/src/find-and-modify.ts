import type { FindAndModifyCommand, FindAndModifyCommandIR } from "@chikkadb/interfaces/command/types";
import { parseFilterDoc } from "./common/filter.js";
import { parseUpdateDoc } from "./common/update.js";

export function parseFindAndModifyCommand(command: FindAndModifyCommand): FindAndModifyCommandIR {
  const { query, update } = command;

  const [filterParseError, filterIR] = parseFilterDoc(query, { parentKey: null });
  if (filterParseError) throw filterParseError;

  const [updateParseError, updateIR] = parseUpdateDoc(update);
  if (updateParseError) throw updateParseError;

  return {
    ...command,
    filter: filterIR,
    update: updateIR,
  };
}