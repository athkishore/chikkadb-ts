import type { BSON } from "bson";

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
