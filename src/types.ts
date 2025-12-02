export type MQLCommand = 
  | CreateCommand // create collection
  | DropCommand   // drop collection
  | InsertCommand
  | FindCommand
  | CountCommand
  | UpdateCommand
  | FindAndModifyCommand
  | DeleteCommand
  | BuildInfoCommand
  | GetParameterCommand
  | AggregateCommand
  | PingCommand
  | GetLogCommand
  | HelloCommand
  | EndSessionsCommand
  | ConnectionStatusCommand
  | HostInfoCommand
  | ListDatabasesCommand
  | ListCollectionsCommand

export type CreateCommand = {
  command: 'create';
  database: string;
  collection: string;
  // TODO: options
};

export type DropCommand = {
  command: 'drop';
  database: string;
  collection: string;
};

export type InsertCommand = {
  command: 'insert';
  database: string;
  collection: string;
  documents: Record<string, any>[];
};

export type FindCommand = {
  command: 'find';
  database: string;
  collection: string;
  filter: Record<string, any>;
  projection?: Record<string, any>;
  sort?: Record<string, any>;
  limit?: number;
  skip?: number;
};

export type CountCommand = {
  command: 'count';
  database: string;
  collection: string;
  query: Record<string, any>;
  limit?: number;
  skip?: number;
};

export type UpdateCommand = {
  command: 'update';
  database: string;
  collection: string;
  updates: {
    q: Record<string, any>;
    u: Record<string, any>; // TODO: aggregation pipeline
  }[];
};

export type FindAndModifyCommand = {
  command: 'findAndModify';
  database: string;
  collection: string;
  query: Record<string, any>; // TODO: aggregation pipeline
  update: Record<string, any>;
};

export type DeleteCommand = {
  command: 'delete';
  database: string;
  collection: string;
  deletes: {
    q: Record<string, any>;
    limit?: number;
  }[];
};

export type BuildInfoCommand = {
  command: 'buildInfo';
  database: string;
};

export type GetParameterCommand = {
  command: 'getParameter';
  database: string;
  featureCompatibilityVersion?: any;
}

export type AggregateCommand = {
  command: 'aggregate';
  database: string;
  pipeline: any[];
  cursor: any;
};

export type PingCommand = {
  command: 'ping';
  database: string;
};

export type GetLogCommand = {
  command: 'getLog';
  database: string;
  value: '*' | 'global' | 'startupWarnings';
};

export type HelloCommand = {
  command: 'hello';
  database: string;
};

export type EndSessionsCommand = {
  command: 'endSessions';
  database: string;
};

export type ConnectionStatusCommand = {
  command: 'connectionStatus';
  database: string;
  showPrivileges?: boolean;
};

export type HostInfoCommand = {
  command: 'hostInfo';
  database: string;
};

export type ListDatabasesCommand = {
  command: 'listDatabases';
  database: string;
  // filter
  nameOnly?: boolean;
};

export type ListCollectionsCommand = {
  command: 'listCollections';
  database: string;
  // filter
  nameOnly?: boolean;
};


export type CommandResponse = {};

export type FilterDoc = Record<string, any>;

export type FilterNodeIR = 
  | FilterNodeIR_DocLevel
  | FilterNodeIR_FieldLevel;

export type FilterNodeIR_DocLevel = 
  | FilterNodeIR_$and
  | FilterNodeIR_$or
  | FilterNodeIR_$nor;

export type FilterNodeIR_FieldLevel = 
  | FilterNodeIR_$eq
  | FilterNodeIR_$gt
  | FilterNodeIR_$gte
  | FilterNodeIR_$lt
  | FilterNodeIR_$lte
  | FilterNodeIR_$ne
  | FilterNodeIR_$in
  | FilterNodeIR_$nin
  | FilterNodeIR_$exists
  | FilterNodeIR_$not;

export type FilterNodeIR_$and = {
  operator: '$and';
  operands: FilterNodeIR[];
};

export type FilterNodeIR_$or = {
  operator: '$or';
  operands: FilterNodeIR[];
};

export type FilterNodeIR_$nor = {
  operator: '$nor';
  operands: FilterNodeIR[];
};

export type FilterNodeIR_$not = {
  operator: '$not';
  operands: [FilterNodeIR];
};

export type FilterNodeIR_$eq = {
  operator: '$eq';
  operands: [FieldReference, Value];
};

export type FilterNodeIR_$gt = {
  operator: '$gt';
  operands: [FieldReference, Value];
};

export type FilterNodeIR_$gte = {
  operator: '$gte';
  operands: [FieldReference, Value];
};

export type FilterNodeIR_$lt = {
  operator: '$lt';
  operands: [FieldReference, Value];
};

export type FilterNodeIR_$lte = {
  operator: '$lte';
  operands: [FieldReference, Value];
};

export type FilterNodeIR_$ne = {
  operator: '$ne';
  operands: [FieldReference, Value];
};

export type FilterNodeIR_$in = {
  operator: '$in';
  operands: [FieldReference, Array<any>];
};

export type FilterNodeIR_$nin = {
  operator: '$nin';
  operands: [FieldReference, Array<any>]
}

export type FilterNodeIR_$exists = {
  operator: '$exists';
  operands: [FieldReference, boolean];
};

export type FieldReference = {
  $ref: string;
};

export type Value = 
  | string
  | number
  | null
  | Array<any>
  | Object;

export const FIELD_LEVEL_FILTER_OPERATORS = [
  '$eq',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$ne',
  '$in',
  '$nin',

  '$exists',

  '$not',
] as const;

export const DOC_LEVEL_FILTER_OPERATORS = [
  '$and',
  '$or',
  '$nor',
];

export const UPDATE_OPERATORS_FIELD = [
  '$set',
  '$unset',
] as const;

export type UpdateNodeIR = 
  | UpdateNodeIR_$set
  | UpdateNodeIR_$unset;

export type UpdateNodeIR_$set = {
  operator: '$set';
  operandsArr: [FieldReference, Value][];
};

export type UpdateNodeIR_$unset = {
  operator: '$unset';
  operandsArr: [FieldReference, Value][];
};

export type CommandIR = 
  | FindCommandIR
  | CountCommandIR
  | DeleteCommandIR
  | InsertCommandIR
  | UpdateCommandIR
  | FindAndModifyCommandIR
  | CreateCommandIR
  | ListDatabasesCommandIR
  | ListCollectionsCommandIR;

export type CommandResult = 
  | InsertCommandResult;

export type FindCommandIR = {
  command: 'find';
  database: string;
  collection: string;
  filter: FilterNodeIR;
  // projection: ProjectionNodeIR;
};

export type CountCommandIR = {
  command: 'count';
  database: string;
  collection: string;
  filter: FilterNodeIR;
};

export type DeleteCommandIR = {
  command: 'delete';
  database: string;
  collection: string;
  deletes: {
    filter: FilterNodeIR;
    limit?: number | undefined;
  }[];
}

export type InsertCommandIR = {
  command: 'insert';
  database: string;
  collection: string;
  documents: Record<string, any>[];
};

export type InsertCommandResult = {
  _type: 'insert';
  ok: 0 | 1;
  n: number;
};

export type CreateCommandIR = {
  command: 'create';
  database: string;
  collection: string;
};

export type UpdateCommandIR = {
  command: 'update';
  database: string;
  collection: string;
  updates: {
    filter: FilterNodeIR;
    update: UpdateNodeIR[];
  }[];
};

export type FindAndModifyCommandIR = {
  command: 'findAndModify';
  database: string;
  collection: string;
  filter: FilterNodeIR;
  update: UpdateNodeIR[];
};

export type FindAndModifyCommandResult = {
  _type: 'findAndModify';
  value: Record<string, any>;
  ok: 0 | 1;
}

export type ListDatabasesCommandIR = {
  command: 'listDatabases';
  database: string;
};

export type ListCollectionsCommandIR = {
  command: 'listCollections';
  database: string;
};

export type QueryIR = {};
export type ResultIR = {};