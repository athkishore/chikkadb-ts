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
    | OPReplyPayload;
    // todo: OP_MSG
};

type OpQueryPayload = {
  _type: 'OP_QUERY';
  flags: number;
  fullCollectionName: string;
  numberToSkip: number;
  numberToReturn: number;
  query: Record<string, any>;
  returnFieldsSelector?: Record<string, any>;
};

type OPReplyPayload = {
  _type: 'OP_REPLY';
  responseFlags: number;
  cursorID: BigInt;
  startingFrom: number;
  numberReturned: number;
  documents: Record<string, any>[];
};

export function decodeMessage(buf: Buffer): WireMessage {
  const messageLength = buf.readInt32LE(0);
  const requestID = buf.readInt32LE(4);
  const responseTo = buf.readInt32LE(8);
  const opCode = buf.readInt32LE(12);

  // todo: decode payload

  return {
    header: { messageLength, requestID, responseTo, opCode },
    payload: {
      _type: 'OP_QUERY',
      flags: 0,
      fullCollectionName: '',
      numberToSkip: 0,
      numberToReturn: 0,
      query: {}
    }
  };
}