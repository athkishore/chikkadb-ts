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
  | FilterNodeIR_$exists;

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

  '$exists',
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
}

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