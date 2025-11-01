import { BSON } from 'bson';
import net, { Socket } from 'node:net';
import { buildOpReplyBuffer, parseOpQueryPayload } from '../lib/wire.js';
import { handleOpQuery } from '../lib/handlers.js';
import { prettyPrintHex } from '../lib/utils.js';

const LISTEN_PORT = 27017;
const LISTEN_HOST = '0.0.0.0';

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

interface BufferHolder {
  buf: Buffer;
}

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

function prettyHex(buf: Buffer, max = 80): string {
  if (!buf || buf.length === 0) return '<empty>';
  const s = buf.toString('hex');
  return s.length <= max ? s : s.slice(0, max) + '...';
}


const server = net.createServer((clientSock: Socket) => {
  const clientRemote = `${clientSock.remoteAddress}:${clientSock.remotePort}`;
  console.log('Client connected', clientRemote);

  const bufHolder = { buf: Buffer.alloc(0) };

  clientSock.on('data', (chunk: Buffer) => {
    // log(prettyHex(chunk));
    prettyPrintHex(chunk);
    bufHolder.buf = Buffer.concat([bufHolder.buf, chunk]);

    processBuffer(bufHolder, (message) => {
      const messageLength = message.readInt32LE(0);
      const requestID = message.readInt32LE(4);
      const responseTo = message.readInt32LE(8);
      const opCode = message.readInt32LE(12);
      const payload = message.subarray(16);

      log('message from client', { from: clientRemote, messageLength, requestID, responseTo, opCode });

      try {
        switch(opCode) {
          case 2004: {
            const parsedPayload = parseOpQueryPayload(payload);
            console.dir(parsedPayload, { depth: null });
            if (!parsedPayload) throw new Error('missing payload');
            const response = handleOpQuery(parsedPayload);
            const responseBuffer = buildOpReplyBuffer(response, requestID);

            console.log('reply from server', { to: clientRemote, response });
            clientSock.write(responseBuffer);
            break;
          }

          case 1: {
            // const parsedPayload
          }
        }
      } catch(e: any) {
        log('  payload parse error:', e?.message);
        log('  payload hex sample:', prettyHex(payload, 128));
      }
    })

  })
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`MongoDB-SQLite listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
})