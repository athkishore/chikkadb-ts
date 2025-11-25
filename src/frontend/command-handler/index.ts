import { executeQueryIR } from "#backend/index.js";
import { generateQueryIRFromCommand } from "#frontend/query-parser/index.js";
import type { OpMsgPayload, OpMsgPayloadSection, WireMessage } from "#frontend/server/lib/wire.js";
import type { CommandResponse, MQLCommand } from "#frontend/types.js";
import { ObjectId } from "bson";

export async function getResponse(message: WireMessage): Promise<WireMessage> {
  const { header, payload } = message;
  const { opCode, requestID } = header;

  const responseHeader = {
    messageLength: 0, // will be set by encoder
    requestID: 1, // TODO: Unhardcode - maintain state for each connection, maybe in the server
    responseTo: requestID,
    opCode: opCode === 2004 ? 1 : 2013, // Handle only OP_QUERY and OP_MSG
  };

  if (opCode === 2004) {
    // hardcoded response
    return {
      header: responseHeader,
      payload: {
        _type: 'OP_REPLY',
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
            localTime: new Date().toISOString(),
            logicalSessionTimeoutMinutes: 30,
            connectionId: 1,
            minWireVersion: 0,
            maxWireVersion: 21,
            readOnly: false,
            ok: 1,
          },
        ],
      },
    }
  } else if (opCode === 2013) {
    const responsePayload = await handleOpMsg(payload as OpMsgPayload);
    console.log(responsePayload);
    if (responsePayload) {
      return {
        header: responseHeader,
        payload: responsePayload,
      }
    }

    throw new Error('Unable to get response for requestId: ' + requestID);
  }

  throw new Error('Unknown opcode: ' + opCode);
}

export async function handleOpMsg(payload: OpMsgPayload): Promise<OpMsgPayload | undefined> {
  const { sections } = payload;
  const command = getCommandFromOpMsgBody(sections[0] as Extract<OpMsgPayload, { sectionKind: 0 }>)
  
  if (!command) {
    return {
      _type: 'OP_MSG',
      flagBits: 0,
      sections: [
        {
          sectionKind: 0,
          document: {
            ok: 0,
            errmsg: `No such command: '${Object.keys((sections[0] as Extract<OpMsgPayloadSection, { sectionKind: 0 }>).document)[0]}'`,
            code: 59,
            codeName: 'CommandNotFound',
          },
        },
      ],
    };
  }

  switch (command.command) {
    case 'buildInfo': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              version: 'x',
              ok: 1,
            },
          },
        ],
      };
    }

    case 'getParameter': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              ok: 1,
            },
          },
        ],
      };
    }

    case 'aggregate': {
      // Dummy response for handshake messages
      // Actual aggregate will be implemented later
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              cursor: {}
            }
          }
        ]
      };
    }

    case 'ping': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: { ok: 1 },
          },
        ],
      };
    }

    case 'getLog': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              totalLinesWritten: 0,
              log: [],
              ok: 1,
            },
          },
        ],
      };
    }

    case 'hello': {
      return {
        _type: 'OP_MSG',
        flagBits: 0,
        sections: [
          {
            sectionKind: 0,
            document: {
              isWritable: true,
              topologyVersion: {
                processId: new ObjectId(),
                counter: 0,
              },
              maxBsonObjectSize: 16777216,
              maxMessageSizeBytes: 48000000,
              maxWriteBatchSize: 100000,
              localTime: new Date().toISOString(),
              logicalSessionTimeoutMinutes: 30,
              connectionId: 1,
              minWireVersion: 0,
              maxWireVersion: 21,
              readonly: false,
              ok: 1,
            },
          },
        ],
      };
    }

  }


  const queryIR = generateQueryIRFromCommand(command);
  const resultIR = executeQueryIR(queryIR);

  console.log(resultIR);
  

  return {
    _type: 'OP_MSG',
    flagBits: 0,
    sections: [
      {
        sectionKind: 0,
        document: resultIR,
      }
    ]
  };
}

function getCommandFromOpMsgBody(
  body: Extract<OpMsgPayloadSection, { sectionKind: 0 }>
): MQLCommand | undefined {
  const commandType = MONGODB_COMMANDS.find(cmd => cmd === Object.keys(body.document)[0]);
  
  if (!commandType) return undefined;

  const { document } = body;
  switch (commandType) {
    case 'buildInfo': {
      return {
        command: 'buildInfo',
        database: document.$db,
      };
    }

    case 'getParameter': {
      return {
        command: 'getParameter',
        database: document.$db,
        featureCompatibilityVersion: document.featureCompatibilityVersion,
      };
    }

    case 'aggregate': {
      return {
        command: 'aggregate',
        database: document.$db,
        pipeline: document.pipeline,
        cursor: document.cursor,
      };
    }

    case 'ping': {
      return {
        command: 'ping',
        database: document.$db,
      };
    }

    case 'getLog': {
      return {
        command: 'getLog',
        database: document.$db,
        value: document.getLog,
      };
    }

    case 'hello': {
      return {
        command: 'hello',
        database: document.$db,
      }
    }

    case 'endSessions': {
      return {
        command: 'endSessions',
        database: document.$db,
      };
    }

    case 'create': {
      return {
        command: 'create',
        database: document.$db,
        collection: document.create,
      };
    }
  }
}

const MONGODB_COMMANDS = [
  'buildInfo',
  'getParameter',
  'aggregate',
  'ping',
  'getLog',
  'hello',
  'endSessions',
  'create',
] as const;