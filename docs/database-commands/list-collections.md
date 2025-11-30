Reference: https://www.mongodb.com/docs/manual/reference/command/listCollections

## Command Format

```typescript
{
  "listCollections": <any value - ignored>,
  "$db": <database name>
}
```
## Command Fields

- `$db`: the name of the database whose collections are to be listed

CUrrently no additional fields are supported.

## Result Format

```typescript
{
  "cursor": {
    "id": <Long>,
    "ns": <namespace>,
    "firstBatch": [{ "name": <collection name> }]
  },
  "ok": 1
}
```

## Behaviour

As of now, only the names of the collections are returned. It is as if `nameOnly` is always set to true. 