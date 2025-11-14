import { BSON } from "bson";

export type MessageHeader = {
  messageLength: number;
  requestID: number;
  responseTo: number;
  opCode: number;
}

export type WireMessage = {
  header: MessageHeader;
  payload: 
    | OpQueryPayload
    | OpReplyPayload;
    // todo: OP_MSG
};

type OpQueryPayload = {
  _type: 'OP_QUERY';
  flags: number;
  fullCollectionName: string;
  numberToSkip: number;
  numberToReturn: number;
  query: BSON.Document;
  returnFieldsSelector?: BSON.Document | undefined;
};

type OpReplyPayload = {
  _type: 'OP_REPLY';
  responseFlags: number;
  cursorID: BigInt;
  startingFrom: number;
  numberReturned: number;
  documents: BSON.Document[];
};

export function decodeMessage(buf: Buffer): WireMessage {
  const messageLength = buf.readInt32LE(0);
  const requestID = buf.readInt32LE(4);
  const responseTo = buf.readInt32LE(8);
  const opCode = buf.readInt32LE(12);

  let payload: WireMessage['payload'];

  switch(opCode) {
    case 2004: 
      payload = decodeOpQueryPayload(buf.subarray(16));
      break;
    case 1:
      payload = decodeOpReplyPayload(buf.subarray(16));
      break;
    default:
      throw new Error('Unknown opcode');
  }

  return {
    header: { messageLength, requestID, responseTo, opCode },
    payload
  };
}

function decodeOpQueryPayload(buf: Buffer): OpQueryPayload {
  let pointer = 0;

  const flags = buf.readInt32LE(pointer);
  pointer += 4;

  const { s: fullCollectionName, len } = readNullTerminatedString(buf, pointer);
  pointer += len;

  const numberToSkip = buf.readInt32LE(pointer);
  pointer += 4;

  const numberToReturn = buf.readInt32LE(pointer);
  pointer += 4;

  const { documents: [query, returnFieldsSelector] } = readBSONDocuments(buf, pointer);

  console.log(flags, fullCollectionName, len, numberToSkip, numberToReturn);
  if (!query) throw new Error('Missing query')

  return {
    _type: 'OP_QUERY',
    flags,
    fullCollectionName,
    numberToSkip,
    numberToReturn,
    query,
    returnFieldsSelector,
  };
}

function decodeOpReplyPayload(buf: Buffer): OpReplyPayload {
  let pointer = 0;
  const responseFlags = buf.readInt32LE(pointer);
  pointer += 4;

  const cursorID = buf.readBigInt64LE(pointer);
  pointer += 8;

  const startingFrom = buf.readInt32LE(pointer);
  pointer += 4;

  const numberReturned = buf.readInt32LE(pointer);
  pointer += 4;

  const { documents } = readBSONDocuments(buf, pointer);

  return {
    _type: 'OP_REPLY',
    responseFlags,
    cursorID,
    startingFrom,
    numberReturned,
    documents,
  };
}

function readNullTerminatedString(buf: Buffer, offset: number): {
  s: string;
  len: number; // including the null termination byte
} {
  const nullIndex = buf.indexOf(0, offset);
  const s = buf.toString('utf-8', offset, nullIndex);
  
  return {
    s,
    len: (nullIndex - offset) + 1
  };
}

function readBSONDocuments(buf: Buffer, offset: number): {
  documents: BSON.Document[];
  len: number; // bytes read
} {
  let documents: BSON.Document[] = [];
  let pointer = offset;

  while (pointer < buf.length) {
    if (buf.length - pointer < 4) break;
    const size = buf.readInt32LE(pointer);
    if (buf.length - pointer < size) break;
    const docBuf = buf.subarray(pointer, pointer + size);
    try {
      const doc = BSON.deserialize(docBuf);
      documents.push(doc);
    } catch {
      throw new Error('Invalid BSON at offset ' + pointer);
    }
    pointer += size;
  }

  return {
    documents,
    len: pointer - offset,
  }
}