# Filter

The filter is an object (in other words, a document) that specifies the conditions to be matched during a command. It is an input component of `count`, `find`, `findAndModify`, `update`, `delete`, etc.

This page lists the various formats in which filter expressions can be specified in a filter object, in accordance with the MongoDB query language. The following cases have been [tested](/tests/find/find.test.ts) for correctness.

1. Empty filter - select all documents in a collection
```typescript
{}
```

2. Implicit equality condition for top-level fields
Example:
```typescript
{ 
  "username": "user1",
}
```

3. Explicit conditions using [filter operators](./filter-operators.md)
Examples:
```typescript
{
  "age": { "$gte": 25 }
}
```
```typescript
{
  "homepage": { "$exists": true }
}
```

4. Composite conditions using [logical operators](./filter-operators.md#logical-operators)
Example:
```typescript
{
  $or: [
    { "age": { "$gte": 25 } },
    { "homepage": { "$exists": true } }
  ]
}
```

5. Conditions involving nested fields
Examples:
```typescript
{
  "address.city": "Bangalore"
}
```
```typescript
{
  "address.pin": { "$exists": true }
}
```

6. Implicitly match elements of an array field

The following returns a match if either the value or `roles` is `"admin"` or `roles` is an array containing the value `"admin"`.

```typescript
{
  "roles": "admin"
}
```

If an array value is provided, it looks for an exact match (matching only if the field has the same elements in the exact same order), or if the field is an array of arrays with any of the element-arrays being an exact match.

```typescript
{
  "roles": ["admin", "manager"]
}
```

7. Impicit conditions on nested fields in an array of objects

The following condition matches both an object field `phones` which has a nested field `type` with value `"mobile"`, as well as an array field `phones` in which at least one element is an object with the nested field `type` having value `"mobile"`.

```typescript
{
  "phones.type": "mobile"
}
```

8. Explicit array index matching

```typescript
{
  "roles.0": "admin"
}
```
```typescript
{
  "phones.0.type": "mobile"
}
```

Reference: https://www.mongodb.com/docs/v7.0/tutorial/query-documents/