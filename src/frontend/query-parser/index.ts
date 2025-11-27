import type { MQLCommand } from "#frontend/types.js";
import type { CommandIR, QueryIR } from "#shared/types.js";
import { parseDeleteCommand } from "./delete.js";
import { parseFindCommand } from "./find.js";
import { parseUpdateCommand } from "./update.js";

export function generateQueryIRFromCommand(command: MQLCommand): CommandIR {
  switch (command.command) {
    case 'create': {
      return command;
    }

    case 'insert': {
      return command;
    }

    case 'find': {
      return parseFindCommand(command);
    }

    case 'delete': {
      return parseDeleteCommand(command);
    }

    case 'update': {
      return parseUpdateCommand(command);
    }

    case 'listDatabases': {
      return command;
    }

    case 'listCollections': {
      return command;
    }
  }

  // TODO: handle errors

  return command as any;
  // throw new Error('Unable to parse command into IR: ' + command.command)
}