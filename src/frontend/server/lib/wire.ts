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
    | OpReplyPayload
    | OpMsgPayload;
};

export type OpQueryPayload = {
  _type: 'OP_QUERY';
  flags: number;
  fullCollectionName: string;
  numberToSkip: number;
  numberToReturn: number;
  query: BSON.Document;
  returnFieldsSelector?: BSON.Document | undefined;
};

export type OpReplyPayload = {
  _type: 'OP_REPLY';
  responseFlags: number;
  cursorID: BigInt;
  startingFrom: number;
  numberReturned: number;
  documents: BSON.Document[];
};

export type OpMsgPayload = {
  _type: 'OP_MSG';
  flagBits: number;
  sections: OpMsgPayloadSection[];
  checksum?: number;
};

export type OpMsgPayloadSection = {
  sectionKind: 0;
  document: BSON.Document;
} | {
  sectionKind: 1;
  size: number;
  documentSequenceIdentifier: string;
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
    case 2013:
      payload = decodeOpMsgPayload(buf.subarray(16));
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

function decodeOpMsgPayload(buf: Buffer): OpMsgPayload {
  let pointer = 0;
  const flagBits = buf.readInt32LE(pointer);
  pointer += 4;

  const sections = decodeOpMsgPayloadSections(buf, pointer);

  // Skip the optional checksum

  return {
    _type: 'OP_MSG',
    flagBits,
    sections,
  }
}

function decodeOpMsgPayloadSections(buf: Buffer, offset: number): OpMsgPayloadSection[] {
  const sections: OpMsgPayloadSection[] = [];
  let pointer = offset;

  while (pointer < buf.length) {
    const sectionKind = buf.readUint8(pointer);
    pointer += 1;

    switch(sectionKind) {
      case 0: {
        const size = buf.readInt32LE(pointer);
        const { documents, len } = readBSONDocuments(buf.subarray(pointer, pointer + size), 0);
        // TODO: Assert that exactly one document exists

        const section = {
          sectionKind,
          document: documents[0]!,
        };

        sections.push(section);
        pointer += size;
        break;
      }

      case 1: {
        const size = buf.readInt32LE(pointer);
        pointer += 4;

        const { s: documentSequenceIdentifier, len } = readNullTerminatedString(buf, offset + pointer);
        pointer += len;

        const { documents } = readBSONDocuments(buf, pointer);

        // TODO: Assert that there are no more bytes to be decoded

        const section = {
          sectionKind,
          size,
          documentSequenceIdentifier,
          documents,
        };

        sections.push(section);
        break;
      }
    }
  }

  return sections;
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

export function encodeMessage({
  header: {
    requestID,
    responseTo,
    opCode,
  },
  payload,
}: WireMessage) {
  let payloadBuf: Buffer;

  switch(payload._type) {
    case 'OP_REPLY':
      payloadBuf = encodeOpReplyPayload(payload);
      break;

    case 'OP_MSG':
      payloadBuf = encodeOpMsgPayload(payload);
      break;

    default:
      throw new Error(`Uknown opcode: ${payload._type}`)
  } 

  const headerBuf = Buffer.alloc(16);

  const messageLength = headerBuf.length + payloadBuf.length;
  headerBuf.writeInt32LE(messageLength, 0);
  headerBuf.writeInt32LE(requestID, 4);
  headerBuf.writeInt32LE(responseTo, 8);
  headerBuf.writeInt32LE(opCode, 12);

  return Buffer.concat([headerBuf, payloadBuf]);

}

function encodeOpReplyPayload(payload: OpReplyPayload): Buffer {
  const {
    responseFlags,
    cursorID,
    startingFrom,
    numberReturned,
    documents
  } = payload;

  const responseFlagsBytes = Buffer.alloc(4);
  responseFlagsBytes.writeInt32LE(responseFlags);

  const cursorIDBytes = Buffer.alloc(8);
  cursorIDBytes.writeBigInt64LE(cursorID as bigint);

  const startingFromBytes = Buffer.alloc(4);
  startingFromBytes.writeInt32LE(startingFrom);

  const numberReturnedBytes = Buffer.alloc(4);
  numberReturnedBytes.writeInt32LE(numberReturned);

  const documentsBytes = documents.reduce((buf: Buffer, doc) => Buffer.concat([buf, BSON.serialize(doc)]), Buffer.alloc(0))

  return Buffer.concat([
    responseFlagsBytes,
    cursorIDBytes,
    startingFromBytes,
    numberReturnedBytes,
    documentsBytes,
  ]);  
}

function encodeOpMsgPayload(payload: OpMsgPayload): Buffer {
  const {
    flagBits,
    sections,
    checksum,
  } = payload;

  const flagBitsBytes = Buffer.alloc(4);
  flagBitsBytes.writeInt32LE(flagBits);

  const sectionsBytes = encodeOpMsgPayloadSections(sections);
  
  const checksumBytes = checksum !== undefined ? Buffer.alloc(4) : undefined;
  checksumBytes && checksum !== undefined && checksumBytes.writeInt32LE(checksum);

  return Buffer.concat([
    flagBitsBytes,
    sectionsBytes,
    checksumBytes,
  ].filter(Boolean as unknown as <T>(x: T | false | null | undefined) => x is T));
}

function encodeOpMsgPayloadSections(sections: OpMsgPayloadSection[]): Buffer {
  let sectionsBytes = Buffer.alloc(0);

  for (const section of sections) {
    switch (section.sectionKind) {
      case 0: {
        const {
          sectionKind,
          document,
        } = section;
        const sectionKindBytes = Buffer.alloc(1);
        sectionKindBytes.writeUint8(sectionKind);
        
        const documentBytes = BSON.serialize(document);

        sectionsBytes = Buffer.concat([
          sectionsBytes,
          sectionKindBytes,
          documentBytes,
        ]);

        break;
      }

      case 1: {
        const {
          sectionKind,
          // size: will be calculated after encoding
          documentSequenceIdentifier,
          documents,
        } = section;

        const sectionKindBytes = Buffer.alloc(1);
        sectionKindBytes.writeUint8(sectionKind);

        const documentSequenceIdentifierBytes = Buffer.from(
          documentSequenceIdentifier,
          'utf-8'
        );

        const documentsBytes = documents.reduce((buf: Buffer, doc) =>
          Buffer.concat([buf, BSON.serialize(doc)])
        , Buffer.alloc(0));

        const size = 4 + documentSequenceIdentifierBytes.length + documentsBytes.length;
        const sizeBytes = Buffer.alloc(4);
        sizeBytes.writeInt32LE(size);

        sectionsBytes = Buffer.concat([
          sectionsBytes,
          sizeBytes,
          documentSequenceIdentifierBytes,
          documentsBytes
        ]);
      }
    }
  }

  return sectionsBytes;
}

export function processBuffer(bufHolder: { buf: Buffer }) {
  const buf = bufHolder.buf;
  let offset = 0;
  let messages: WireMessage[] = [];

  // If the buffer has less than 4 bytes to read, we
  // haven't received the messageLength field yet
  while(buf.length - offset >= 4) {
    const messageLength = buf.readInt32LE(offset);

    // If the buffer has less than messageLenth bytes to read,
    // wait till more bytes arrive
    if (buf.length - offset < messageLength) break;

    const messageBuf = buf.subarray(offset, offset + messageLength);

    const message = decodeMessage(messageBuf);
    messages.push(message);

    offset += messageLength;

    // Remove the processed bytes from the buffer
    bufHolder.buf = buf.subarray(offset);
  }
  return messages;
}
