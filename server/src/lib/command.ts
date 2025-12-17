import type { MQLCommand } from "@chikkadb/interfaces/command/types";
import type { OpMsgPayload } from "@chikkadb/interfaces/wire/types";

export function getCommandFromOpMsg(payload: OpMsgPayload): MQLCommand {
  return {
    command: 'create',
    database: '',
    collection: '',
  };
}