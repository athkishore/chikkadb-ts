import type { MQLCommand } from "#frontend/types.js";
import type { QueryIR } from "#shared/types.js";

export function generateQueryIRFromCommand(command: MQLCommand): any {
  switch (command.command) {
    case 'create': {
      return command;
    }
  }
}