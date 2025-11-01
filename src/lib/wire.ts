import { BSON } from "bson";
import assert from "node:assert";

const REQUEST_ID = 2;
const OP_MSG = 2013;

export function buildOpMsg(doc: Record<string, any>): Buffer {
  const bsonBytes = BSON.serialize(doc);
  const flags = Buffer.alloc(4);
  const sectionKind = Buffer.from([0x00]);
  const body = Buffer.concat([flags, sectionKind, bsonBytes]);
  const msgLen = 16 + body.length;

  const header = Buffer.alloc(16);
  header.writeInt32LE(msgLen, 0);
  header.writeInt32LE(REQUEST_ID, 4);
  header.writeInt32LE(0, 8);
  header.writeInt32LE(OP_MSG, 12);

  return Buffer.concat([header, body]);
}

interface BufferHolder {
  buf: Buffer;
}

export function processBuffer(bufObj: BufferHolder, handler: (msg: Buffer) => void) {
  let buf = bufObj.buf;
  let offset = 0;
  
  while(buf.length - offset >= 4) {
    const messageLength = buf.readInt32LE(offset);
    if (messageLength <= 0) {
      throw new Error('Invalid messageLength: ' + messageLength);
      bufObj.buf = Buffer.alloc(0);
      return;
    }
    if (buf.length - offset < messageLength) break;

    const message = buf.subarray(offset, offset + messageLength);
    handler(message);
    offset += messageLength;
  }

  if (offset < buf.length) {
    bufObj.buf = buf.subarray(offset);
  } else {
    bufObj.buf = Buffer.alloc(0);
  }
}

export type ParsedOpQueryPayload = {
  flags: number;
  fullCollectionName: string;
  numberToSkip: number;
  numberToReturn: number;
  query: Record<string, any>;
  returnFieldsSelector?: Record<string, any>;
};

function readNullTerminatedString(buf: Buffer, offset: number): { s: string, len: number } {
  let s = '';
  let pointer = offset;
  while (buf[pointer] !== 0) {
    if (pointer >= buf.length) throw new Error('Buffer overrun');
    
    s += buf.toString('utf-8', pointer, pointer + 1);
    pointer++;
  }
  return {
    s,
    len: (pointer - offset) + 1,
  };
}

export type ReadBSONResult = {
  docs: Record<string, any>[];
  remaining: Buffer;
}
function readBSONDocuments(buf: Buffer, offset: number): ReadBSONResult {
  let docs: Record<string, any>[] = [];
  let pointer = offset;

  while (pointer < buf.length) {
    if (buf.length - pointer < 4) break;
    const size = buf.readInt32LE(pointer);
    if (buf.length - pointer < size) break;
    const docBuf = buf.subarray(pointer, pointer + size);
    try {
      const doc = BSON.deserialize(docBuf);
      docs.push(doc);
    } catch {
      throw new Error('Invalid BSON at offset ' + pointer);
    }
    pointer += size;
  }

  return {
    docs,
    remaining: buf.subarray(pointer),
  }
}

export function parseOpQueryPayload(payload: Buffer): ParsedOpQueryPayload | null /* Handle error */ {
  let offset = 0;
  
  if (payload.length - offset < 4) return null;
  const flags = payload.readInt32LE(offset);
  offset += 4;

  const { s: fullCollectionName, len } = readNullTerminatedString(payload, offset);
  offset += len;

  const numberToSkip = payload.readInt32LE(offset);
  offset += 4;

  const numberToReturn = payload.readInt32LE(offset);
  offset += 4;

  const { docs: [query, returnFieldsSelector] } = readBSONDocuments(payload.subarray(offset), 0);
  
  if (!query) return null;

  return {
    flags,
    fullCollectionName,
    numberToSkip,
    numberToReturn,
    query,
  };

}

export type ParsedOpReplyPayload = {
  responseFlags: number;
  cursorID: BigInt;
  startingFrom: number;
  numberReturned: number;
  documents: Record<string, any>[];
}

export function parseOpReplyPayload(payload: Buffer): ParsedOpReplyPayload | null /*Handle error*/ {
  let offset = 0;
  if (payload.length - offset < 4) return null;
  const responseFlags = payload.readInt32LE(offset);
  offset += 4;

  if (payload.length - offset < 8) return null;
  const cursorID = payload.readBigInt64LE(offset);
  offset += 8;

  if (payload.length - offset < 4) return null;
  const startingFrom = payload.readInt32LE(offset);
  offset += 4;

  if (payload.length - offset < 4) return null;
  const numberReturned = payload.readInt32LE(offset);
  offset += 4;

  const { docs: documents } = readBSONDocuments(payload, offset);
  return {
    responseFlags,
    cursorID,
    startingFrom,
    numberReturned,
    documents
  };
}

export type ParsedOpMsgPayload = {
  flagBits: number;
  sections: OpMsgPayloadSection[];
  checksum?: number;
}

export function parseOpMsgPayload(payload: Buffer): ParsedOpMsgPayload | null /*Handle error*/ {
  let offset = 0;
  if (payload.length - offset < 4) return null;
  const flagBits = payload.readInt32LE(offset);
  offset += 4;

  const sections = readOpMsgPayloadSections(payload, offset);
  if (!sections) throw new Error('Error');

  return {
    flagBits,
    sections,
  };
}

type OpMsgPayloadSection = {
  sectionKind: 0;
  doc: Record<string, any>;
} | {
  sectionKind: 1;
  size: number;
  documentSequenceIdentifier: string;
  docs: Record<string, any>[];
};
function readOpMsgPayloadSections(buf: Buffer, offset: number): OpMsgPayloadSection[] | null {
  const sections: OpMsgPayloadSection[] = [];

  let pointer = offset;
  while (pointer < buf.length) {
    if (buf.length - pointer < 1) return null;
    const sectionKind = buf.readInt8(pointer);
    pointer += 1;

    switch(sectionKind) {
      case 0: {
        const size = buf.readInt32LE(pointer);
        const { docs, remaining } = readBSONDocuments(buf.subarray(pointer, pointer + size), 0);
        assert.equal(docs.length, 1);
        assert.equal(remaining.length, 0);
        if (!docs[0]) throw new Error('Error');

        const section = {
          sectionKind,
          doc: docs[0],
        };

        sections.push(section);
        pointer += size;
        break;
      }

      case 1: {
        // Handle errors and assert all results
        if (buf.length - pointer < 4) return null;
        const size = buf.readInt32LE(pointer);
        pointer += 4;

        const { s: documentSequenceIdentifier, len } = readNullTerminatedString(buf, offset + pointer);
        pointer += len;

        const { docs, remaining } = readBSONDocuments(buf, pointer);
        assert.equal(remaining.length, 0);

        const section = {
          sectionKind: sectionKind as 1,
          size,
          documentSequenceIdentifier,
          docs,
        };

        sections.push(section);
        break;
      }
    }
  }

  return sections;
}

type MessageHeader = {
  messageLength: number;
  requestID: number;
  responseTo: number;
  opCode: number;
};

export type WireMessage = Omit<MessageHeader, 'opCode'> & ({
  opCode: 1,
  payload: ParsedOpReplyPayload;
} | {
  opCode: 2004;
  payload: ParsedOpQueryPayload;
} | {
  opCode: 2013;
  payload: ParsedOpMsgPayload;
});

export function buildOpReplyBuffer(payload: ParsedOpReplyPayload, replyTo: number) {
  const bsonBytes = payload.documents.reduce((buf: Buffer, doc) => Buffer.concat([buf, BSON.serialize(doc)]), Buffer.alloc(0));
  const responseFlags = Buffer.from([0x08, 0x00, 0x00, 0x00]);
  const cursorID = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const startingFrom = Buffer.from([0x00, 0x00, 0x00, 0x00]);
  const numberReturned = Buffer.from([0x01, 0x00, 0x00, 0x00]);
  
  const responsePayload = Buffer.concat([responseFlags, cursorID, startingFrom, numberReturned, bsonBytes]);
  const msgLen = 16 + responsePayload.length;

  const messageHeader = Buffer.alloc(16);
  messageHeader.writeInt32LE(msgLen, 0);
  messageHeader.writeInt32LE(1, 4);
  messageHeader.writeInt32LE(replyTo, 8);
  messageHeader.writeInt32LE(1, 12);

  return Buffer.concat([messageHeader, responsePayload]);
}