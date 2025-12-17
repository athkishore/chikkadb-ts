import type { DeleteCommand, DeleteCommandIR } from "@chikkadb/interfaces/command/types";
import { parseFilterDoc } from "./common/filter.js";

export function parseDeleteCommand(command: DeleteCommand): DeleteCommandIR {
  const { deletes } = command;

  const filter = deletes[0]?.q;

  // TODO: Support multiple deletes

  if (!filter) throw new Error('Missing filter for delete');

  const [error, filterIR] = parseFilterDoc(filter, { parentKey: null });

  if (error) throw error;

  return {
    ...command,
    deletes: [
      {
        filter: filterIR,
        limit: deletes[0]?.limit,
      }
    ]
  }
}