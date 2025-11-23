import { Socket, createServer } from "net";
import { encodeMessage, processBuffer, type WireMessage } from "../lib/wire.js";
import { ObjectId } from "bson";

const HOST = '127.0.0.1';
const PORT = 9000;

const server = createServer(handleNewConnection);

async function handleNewConnection(sock: Socket) {
  console.log('client connected from port:', sock.remotePort);

  const bufHolder = { buf: Buffer.alloc(0) };

  sock.on('data', async (data) => {
    bufHolder.buf = Buffer.concat([bufHolder.buf, data]);
    const messages = processBuffer(bufHolder);
    for (const message of messages) {
      console.log(`C -> S message`, message.header);
      console.dir(message.payload, { depth: null });
      const responseBuf = await getEncodedResponse(message);
      sock.write(responseBuf);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Custom Mongo Server listening on`, `${HOST}:${PORT}`);
});

async function getEncodedResponse(message: WireMessage): Promise<Buffer> {
  // const response = await getResponse(message);
  // const responseBuf = encodeMessage(response);

  // return responseBuf;
  return Buffer.alloc(0);
}