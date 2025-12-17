import type { FindCommand, FindCommandIR } from "@chikkadb/interfaces/command/types";
import { parseFilterDoc } from "./common/filter.js";
import { parseProjectionDoc } from "./common/projection.js";
import { parseSortDoc } from "./common/sort.js";

export function parseFindCommand(command: FindCommand): FindCommandIR {
  const [error, filterIR] = parseFilterDoc(command.filter, { parentKey: null });
  const [sortError, sortIR] = command.sort ? parseSortDoc(command.sort) : [];
  const [projectionError, projectionIR] = command.projection ? parseProjectionDoc(command.projection) : [];

  if (error) throw error;
  if (sortError) throw sortError;
  if (projectionError) throw projectionError;

  const commandIR = {
    ...command,
    filter: filterIR,
    sort: sortIR,
    projection: projectionIR,
  };

  if (typeof command.limit === 'number') commandIR.limit = command.limit;
  if (typeof command.skip === 'number') commandIR.skip = command.skip;

  return commandIR;
}