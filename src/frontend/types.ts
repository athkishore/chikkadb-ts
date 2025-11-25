export type MQLCommand = 
  | CreateCommand // create collection
  | DropCommand   // drop collection
  | InsertCommand
  | FindCommand
  | UpdateCommand
  | DeleteCommand
  | BuildInfoCommand
  | GetParameterCommand
  | AggregateCommand
  | PingCommand
  | GetLogCommand
  | HelloCommand
  | EndSessionsCommand

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
  filter: Record<string, any>;
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
}


export type CommandResponse = {};