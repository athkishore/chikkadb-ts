import { createConnection, createServer, Socket } from 'node:net';
import { decodeMessage, type WireMessage } from './wire-lib.js';

// We will start the mongod server on port 9000, 
// not the traditional port 27017. 
// Instead we will bind our eavesdropping proxy 
// to 27017 and forward messages to 9000.
const MONGOD_HOST = '127.0.0.1';
const MONGOD_PORT = 9000;

const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 27017;

async function handleNewConnection(clientSock: Socket) {
  console.log('client connected from port:', clientSock.remotePort);

  // open a corresponding connection 
  // to mongod server on port 9000
  const serverSock = createConnection(
    { host: MONGOD_HOST, port: MONGOD_PORT },
    () => console.log('created proxy connection to mongod server')
  );

  const c2sBufHolder = { buf: Buffer.alloc(0) };
  const s2cBufHolder = { buf: Buffer.alloc(0) };

  // register a callback to forward to server
  // any data sent from client
  clientSock.on('data', (data) => {
    serverSock.write(data);
    c2sBufHolder.buf = Buffer.concat([c2sBufHolder.buf, data]);
    const messages = processBuffer(c2sBufHolder); // to be defined
    messages.forEach(message => {
      console.log(`C -> S message`, message);
    });
  });

  // register a callback to forward to client
  // any data sent from server
  serverSock.on('data', (data) => {
    clientSock.write(data);
    s2cBufHolder.buf = Buffer.concat([s2cBufHolder.buf, data]);
    const messages = processBuffer(s2cBufHolder);
    messages.forEach(message => {
      console.log('S -> C message', message);
    })
  });
}

const server = createServer(handleNewConnection);

server.listen(LISTEN_PORT, LISTEN_PORT, () => {
  console.log(
    'Mongo TCP proxy listening on',
    `${LISTEN_HOST}:${LISTEN_PORT}`,
    '->',
    `${MONGOD_HOST}:${MONGOD_PORT}`,
  );
})

function processBuffer(bufHolder: { buf: Buffer }) {
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

