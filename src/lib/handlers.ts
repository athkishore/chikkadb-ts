import { ObjectId } from "bson";
import type { ParsedOpQueryPayload, ParsedOpReplyPayload, WireMessage } from "./wire.js";

export function handleOpQuery(payload: ParsedOpQueryPayload): ParsedOpReplyPayload {
  const responsePayload = {
    responseFlags: 8,
    cursorID: 0n,
    startingFrom: 0,
    numberReturned: 1,
    documents: [
      {
        helloOk: true,
        ismaster: true,
        topologyVersion: {
          processId: new ObjectId(),
          counter: 0,        
        },
        maxBsonObjectSize: 16777216,
        maxMessageSizeBytes: 48000000,
        maxWriteBatchSize: 100000,
        localTime: new Date(),
        logicalSessionTimeoutMinutes: 30,
        connectionId: 6,
        minWireVersion: 0,
        maxWireVersion: 21,
        readOnly: false,
        ok: 1,
      },
    ],
  };

  return responsePayload;
}