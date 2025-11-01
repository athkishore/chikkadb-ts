import net, { Socket } from 'node:net';
import { BSON } from 'bson';
import assert from 'node:assert';

const LISTEN_HOST = '0.0.0.0';
const LISTEN_PORT = 27017;

const MONGOD_HOST = '127.0.0.1';
const MONGOD_PORT = 9000;

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

interface BufferHolder {
  buf: Buffer;
}

// let docs: any[] = [];
// if (opCode === 2013) {            // OP_MSG
//   docs = parseOpMsg(payload);
// } else if (opCode === 2004 || opCode === 1) { // OP_QUERY / OP_REPLY
//   const { docs: d } = extractBsonDocs(payload);
//   docs = d;
// }

// if (docs.length) {
//   log(`  Parsed ${docs.length} BSON doc(s)`);
//   docs.forEach((d, i) => log(`    doc[${i}]`, JSON.stringify(d)));
// } else {
//   log(`  No BSON docs found, raw hex`, prettyHex(payload, 128));
// }


function processBuffer(bufObj: BufferHolder, handler: (msg: Buffer) => void) {
  let buf = bufObj.buf;
  let offset = 0;
  
  while(buf.length - offset >= 4) {
    const messageLength = buf.readInt32LE(offset);
    if (messageLength <= 0) {
      log('Invalid messageLength', messageLength);
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

interface ExtractedDocs {
  docs: any[];
  raw: Buffer[];
}

// function extractBsonDocs(payload: Buffer): ExtractedDocs {
//   const docs: any[] = [];
//   const raw: Buffer[] = [];
//   let i = 0;

//   while (i + 4 <= payload.length) {
//     const docLen = payload.readInt32LE(i);
//     if (docLen <= 0 || i + docLen > payload.length) break;

//     const docBuf = payload.subarray(i, i + docLen);

//     try {
//       const doc = BSON.deserialize(docBuf);
//       docs.push(doc);
//     } catch {
//       raw.push(docBuf);
//     }
//     i += docLen;
//   }

//   if (i < payload.length) raw.push(payload.subarray(1));
//   return { docs, raw };
// }

function parseOpMsg(payload: Buffer): any[] {
  const docs: any[] = [];
  let offset = 0;

  if (payload.length < 4) return docs;
  offset += 4;

  while (offset < payload.length) {
    const sectionKind = payload[offset];
    offset += 1;

    if (sectionKind === 0) {
      const remaining = payload.subarray(offset);
      const docLen = remaining.readInt32LE(0);
      if (docLen > 0 && docLen <= remaining.length) {
        const docBuf = remaining.subarray(0, docLen);

        try {
          docs.push(BSON.deserialize(docBuf));
        } catch {

        }

        offset += docLen;
      } else {
        break;
      }
    } else if (sectionKind === 1) {
      const size = payload.readInt32LE(offset);
      const end = offset + size;
      const seqIdEnd = payload.indexOf(0, offset + 4);
      if (seqIdEnd < 0 || seqIdEnd >= end) break;
      let pos = seqIdEnd + 1;
      while (pos + 4 <= end) {
        const docLen = payload.readInt32LE(pos);
        if (docLen <= 0 || pos + docLen > end) break;
        const docBuf = payload.subarray(pos, pos + docLen);
        try {
          docs.push(BSON.deserialize(docBuf));
        } catch {}
        pos += docLen;
      }
      offset = end;
    } else {
      break;
    }
  }
  return docs;
}

function prettyPrintHex(buf: Buffer, wordLength = 4, lineLength = 16): void {
  const bytesFormatted = [...buf].map(byte => byte.toString(16).padStart(2, '0').toUpperCase());
  for (const [index, byte] of bytesFormatted.entries()) {
    const isStartOfLine = index % lineLength === 0;
    const isEndOfLine = (index + 1) % lineLength === 0;
    const isEndOfWord = (index + 1) % wordLength === 0;

    if (isStartOfLine) process.stdout.write(index.toString(16).padStart(4, '0') + '  ');
    process.stdout.write(byte + ' ');
    if (isEndOfLine) process.stdout.write('\n');
    if (!isEndOfLine && isEndOfWord) process.stdout.write(' ');
  }
  process.stdout.write('\n');
}

type ParsedOpQueryPayload = {
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

type ReadBSONResult = {
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

function parseOpQueryPayload(payload: Buffer): ParsedOpQueryPayload | null /* Handle error */ {
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

type ParsedOpReplyPayload = {
  responseFlags: number;
  cursorID: BigInt;
  startingFrom: number;
  numberReturned: number;
  documents: Record<string, any>[];
}

function parseOpReplyPayload(payload: Buffer): ParsedOpReplyPayload | null /*Handle error*/ {
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

type ParsedOpMsgPayload = {
  flagBits: number;
  sections: OpMsgPayloadSection[];
  checksum?: number;
}

function parseOpMsgPayload(payload: Buffer): ParsedOpMsgPayload | null /*Handle error*/ {
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
        console.log(buf, pointer);
        const { docs, remaining } = readBSONDocuments(buf, pointer);
        assert.equal(docs.length, 1);
        assert.equal(remaining.length, 0);
        if (!docs[0]) throw new Error('Error');

        const section = {
          sectionKind,
          doc: docs[0],
        };

        sections.push(section);
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
      }
    }
  }

  return sections;
}

const server = net.createServer((clientSock: Socket) => {
  const clientRemote = `${clientSock.remoteAddress}:${clientSock.remotePort}`;
  log('Client connected', clientRemote);

  const serverSock = net.createConnection(
    { host: MONGOD_HOST, port: MONGOD_PORT },
    () => log("Connected to mongod", `${MONGOD_HOST}:${MONGOD_PORT}`)
  );

  const c2sBuf: BufferHolder = { buf: Buffer.alloc(0) };
  const s2cBuf: BufferHolder = { buf: Buffer.alloc(0) };

  clientSock.on('data', (chunk: Buffer) => {
    serverSock.write(chunk);
    c2sBuf.buf = Buffer.concat([c2sBuf.buf, chunk]);

    processBuffer(c2sBuf, (message) => {
      const messageLength = message.readInt32LE(0);
      const requestID = message.readInt32LE(4);
      const responseTo = message.readInt32LE(8);
      const opCode = message.readInt32LE(12);
      const payload = message.subarray(16);

      log('C->S message', { from: clientRemote, messageLength, requestID, responseTo, opCode });
      prettyPrintHex(chunk);
      try {
        switch(opCode) {
          case 2004: {
            const parsedPayload = parseOpQueryPayload(payload);
            console.log(parsedPayload);
            break;
          }

          case 1: {
            const parsedPayload = parseOpReplyPayload(payload);
            console.log(parsedPayload);
            break;
          }

          case 2013: {
            const parsedPayload = parseOpMsgPayload(payload);
            console.log(parsedPayload);
            break;
          }
        }
      } catch(e: any) {
        log('  BSON parse error (client->server):', e?.message);
        log('  payload hex sample:', payload);
      }
    });
  });

  serverSock.on('data', (chunk: Buffer) => {
    clientSock.write(chunk);

    s2cBuf.buf = Buffer.concat([s2cBuf.buf, chunk]);

    processBuffer(s2cBuf, (message) => {
      const messageLength = message.readInt32LE(0);
      const requestID = message.readInt32LE(4);
      const responseTo = message.readInt32LE(8);
      const opCode = message.readInt32LE(12);
      const payload = message.subarray(16);

      log('S->C message', { to: clientRemote, messageLength, requestID, responseTo, opCode });
      prettyPrintHex(chunk);
      try {
        switch(opCode) {
          case 2004: {
            const parsedPayload = parseOpQueryPayload(payload);
            console.log(parsedPayload);
            break;
          }

          case 1: {
            const parsedPayload = parseOpReplyPayload(payload);
            console.log(parsedPayload);
            break;
          }
        }
      } catch(e: any) {
        log('  BSON parse error (server->client):', e?.message);
        log('  payload hex sample:', payload);
      }
    });
  });

  const closeBoth = (reason: string): void => {
    log('Closing sockets due to', reason);
    if (!clientSock.destroyed) clientSock.destroy();
    if (!serverSock.destroyed) serverSock.destroy();
  };

  clientSock.on('error', (err: Error) => {
    log('Client socket error:', err.message);
    closeBoth('client error');
  });

  serverSock.on('error', (err: Error) => {
    log('Server socket error:', err.message);
    closeBoth('server error');
  });

  clientSock.on('close', () => {
    log('Client closed', clientRemote);
    if (!serverSock.destroyed) serverSock.end();
  });

  serverSock.on('close', () => {
    log('Server closed connection to mongod');
    if (!clientSock.destroyed) clientSock.end();
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  log(
    "Mongo TCP proxy listening on",
    `${LISTEN_HOST}:${LISTEN_PORT}`,
    '->',
    `${MONGOD_HOST}:${MONGOD_PORT}`
  );
});
