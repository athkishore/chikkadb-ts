import { BSON } from 'bson';
import fs from 'fs';

// We use the name 'sections' in plural, in case we want to
// extend the function to support kind-1 sections later. For now,
// we will accept only a single document as the body.
function encodeSections(commandDoc: any) {
  const sectionKindByte = Buffer.alloc(1);
  sectionKindByte.writeInt8(0);
  const sections = BSON.serialize(commandDoc);
  return Buffer.concat([sectionKindByte, sections]);
}

function encodePayload({
  commandDoc,
  flagBits,
}: {
  commandDoc: any,
  flagBits: number,
}): Buffer {
  const flagBitsBuf = Buffer.alloc(4);
  flagBitsBuf.writeInt32LE(flagBits); 

  const sectionsBuf = encodeSections(commandDoc);

  return Buffer.concat([flagBitsBuf, sectionsBuf]);
}

function encodeOpMsg({
  commandDoc,
  flagBits,
}: {
  commandDoc: any,
  flagBits: number,
}): Buffer {
  const payloadBuf = encodePayload({
    commandDoc,
    flagBits,
  });

  // Four int32 fields in the header
  const messageHeaderBuf = Buffer.alloc(16); 

  const messageLength = messageHeaderBuf.length + payloadBuf.length;
  messageHeaderBuf.writeInt32LE(messageLength, 0);

  // requestID will be a dynamically generated reference in practice.
  const requestID = 1;
  messageHeaderBuf.writeInt32LE(requestID, 4);

  // responseTo will usually be 0 for client-sent messages
  const responseTo = 0;
  messageHeaderBuf.writeInt32LE(responseTo, 8);

  // opCode for OP_MSG is 2013
  const opCode = 2013;
  messageHeaderBuf.writeInt32LE(opCode, 12);

  return Buffer.concat([messageHeaderBuf, payloadBuf]);
}

const commandDoc = {
  $db: 'app',
  insert: 'users',
  documents: [
    {
      username: 'user1',
      email: 'user1@example.org',
    },
  ],
};

const opMsgBuf = encodeOpMsg({
  commandDoc,
  flagBits: 0,
});

fs.writeFileSync('insert.hex', opMsgBuf);
