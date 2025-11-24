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
  | FilterNodeIR_$ne;

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
] as const;

export const DOC_LEVEL_FILTER_OPERATORS = [
  '$and',
  '$or',
  '$nor',
];


export type QueryIR = {};
export type ResultIR = {};