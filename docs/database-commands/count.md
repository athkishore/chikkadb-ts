Reference: https://www.mongodb.com/docs/manual/reference/command/count

## Command Format

```typescript
{
  "count": <collection>,
  "query": <document>,
}
```
`limit` and `skip` will be added later.

See [Filter Operators](../operators/filter-operators.md) to find out which query operators are supported.

## Result Format

```typescript
{
  "n": <count>,
  "ok": 1
}
```

## Implementation

`count` is implemented using a `SELECT COUNT(DISTINCT(id)) ...` statement. You can find the source code [here](/src/sql-generator/count.ts).