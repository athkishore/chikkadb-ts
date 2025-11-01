import net, { Socket } from 'node:net';
import { BSON } from 'bson';
import assert from 'node:assert';
import { prettyPrintHex } from '../lib/utils.js';
import { parseOpMsgPayload, parseOpQueryPayload, parseOpReplyPayload, processBuffer } from '../lib/wire.js';
import { log } from 'node:console';

const LISTEN_HOST = '0.0.0.0';
const LISTEN_PORT = 27017;

const MONGOD_HOST = '127.0.0.1';
const MONGOD_PORT = 9000;




const server = net.createServer((clientSock: Socket) => {
  const clientRemote = `${clientSock.remoteAddress}:${clientSock.remotePort}`;
  log('Client connected', clientRemote);

  const serverSock = net.createConnection(
    { host: MONGOD_HOST, port: MONGOD_PORT },
    () => log("Connected to mongod", `${MONGOD_HOST}:${MONGOD_PORT}`)
  );

  const c2sBuf = { buf: Buffer.alloc(0) };
  const s2cBuf = { buf: Buffer.alloc(0) };

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
            console.dir(parsedPayload, { depth: null });
            break;
          }

          case 1: {
            const parsedPayload = parseOpReplyPayload(payload);
            console.dir(parsedPayload, { depth: null });
            break;
          }

          case 2013: {
            const parsedPayload = parseOpMsgPayload(payload);
            console.dir(parsedPayload, { depth: null });
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
            console.dir(parsedPayload, { depth: null });
            break;
          }

          case 1: {
            const parsedPayload = parseOpReplyPayload(payload);
            console.dir(parsedPayload, { depth: null });
            break;
          }

          case 2013: {
            const parsedPayload = parseOpMsgPayload(payload);
            console.dir(parsedPayload, { depth: null });
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
