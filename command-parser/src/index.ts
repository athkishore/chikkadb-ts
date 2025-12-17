import type { MQLCommand, CommandIR } from "@chikkadb/interfaces/command/types";
import { parseAggregateCommand } from "./aggregate.js";
import { parseCountCommand } from "./count.js";
import { parseDeleteCommand } from "./delete.js";
import { parseFindAndModifyCommand } from "./find-and-modify.js";
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

    case 'findAndModify': {
      return parseFindAndModifyCommand(command);
    }

    case 'aggregate': {
      return parseAggregateCommand(command);
    }

    case 'count': {
      return parseCountCommand(command);
    }

    case 'listDatabases': {
      return command;
    }

    case 'listCollections': {
      return command;
    }

    case 'drop': {
      return command;
    }

    case 'dropDatabase': {
      return command;
    }
  }

  // TODO: handle errors

  return command as any;
  // throw new Error('Unable to parse command into IR: ' + command.command)
}