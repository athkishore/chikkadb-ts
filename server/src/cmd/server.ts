import { Socket, createServer } from "net";
import { encodeMessage, processBuffer } from "../lib/wire.js";
import { type WireMessage } from "@chikkadb/interfaces/wire/types";
import { getResponse } from "../command-handler.js";
import { logWireConn, logWireMsg } from "../lib/utils.js";
import { startupOptions } from "../config.js";
import fs from 'fs';

const HOST = startupOptions.bind_ip_all 
  ? '0.0.0.0' 
  : startupOptions.bind_ip ?? '127.0.0.1';

const isHostFilePath = (HOST as string).startsWith('/');

const PORT = startupOptions.port;

const server = createServer(handleNewConnection);

async function handleNewConnection(sock: Socket) {
  logWireConn('client connected from port:', sock.remotePort);

  const bufHolder = { buf: Buffer.alloc(0) };

  sock.on('data', async (data) => {
    bufHolder.buf = Buffer.concat([bufHolder.buf, data]);
    const messages = processBuffer(bufHolder);
    for (const message of messages) {
      logWireMsg(`C -> S message`, message.header);
      logWireMsg('%O', message.payload);
      const responseBuf = await getEncodedResponse(message);
      sock.write(responseBuf);
    }
  });

  sock.on('error', (error) => {
    console.error(error);
    sock.destroy();
  });
}

if (isHostFilePath) {
  server.listen(HOST, () => {
    console.log(`Custom Mongo Server listening on`, HOST);
  })
} else {
  server.listen(isHostFilePath ? HOST : PORT, () => {
    console.log(`Custom Mongo Server listening on`, `${HOST}:${PORT}`);
  });    
}

process.on('exit', () => {
  if (isHostFilePath && fs.existsSync(HOST)) fs.unlinkSync(HOST);
});
process.on('SIGINT', () => process.exit());

async function getEncodedResponse(message: WireMessage): Promise<Buffer> {
  const response = await getResponse(message);
  const responseBuf = encodeMessage(response);

  return responseBuf;
}