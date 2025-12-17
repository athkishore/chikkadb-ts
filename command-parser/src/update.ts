import type { UpdateCommand, UpdateCommandIR } from "@chikkadb/interfaces/command/types";
import { parseFilterDoc } from "./common/filter.js";
import { parseUpdateDoc } from "./common/update.js";

export function parseUpdateCommand(command: UpdateCommand): UpdateCommandIR {
  const { updates } = command;

  const { q, u } = updates?.[0] ?? {};

  // TODO: Support multiple updates

  if (!q) throw new Error('Missing filter');
  if (!u) throw new Error('Missing update');

  const [filterParseError, filterIR] = parseFilterDoc(q, { parentKey: null });
  if (filterParseError) throw filterParseError;

  const [updateParseError, updateIR] = parseUpdateDoc(u);
  if (updateParseError) throw updateParseError;

  return {
    ...command,
    updates: [{
      filter: filterIR,
      update: updateIR,
    }]
  }
}
