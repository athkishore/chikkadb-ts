## General Approach

ChikkaDB stores documents as either plain text JSON or the very closely related [SQLite JSONB]()https://sqlite.org/jsonb.html in a single column. Even though SQLite can understand [JSON5](https://spec.json5.org/) extenstions, its json functions always return canonical JSON as defined in RFC8259(https://datatracker.ietf.org/doc/html/rfc8259). 

In the interest of consistency, ChikkaDB stores only canonical JSON. This means that the data types that can be stored in the database are: string, number, boolean, null, array, and object. 

## BSON Support through Extended JSON

However, this does not mean that these are the only datatypes available to the user. ChikkaDB is aware of the additional types in MongoDB's BSON specification, and strives to provide a compatible environment for data imported from MongoDB to be stored and processed. This is achieved by storing special BSON types using the [Extended JSON](https://www.mongodb.com/docs/manual/reference/mongodb-extended-json) notation.

Here is an illustration of all the different BSON types are represented in a ChikkaDB document. Whenever a value cannot be represented in canonical JSON, the Extended JSON representation is used.

### MinKey
```json
{ "$minKey": 1 }
```

### Null
Canonical JSON - null

### Numbers (except Decimal128)
Int32, Int64, and Double are represented as a number in canonical JSON.

### Decimal128
```json
{
  "$numberDecimal": "<number>"
}
```

### String
Canonical JSON - string

### Object
Canonical JSON - object

### Array
Canonical JSON - array

### BinData

## Operating on non-Canonical JSON values

## Known Limitations