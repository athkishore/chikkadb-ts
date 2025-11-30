Reference: https://www.mongodb.com/docs/manual/reference/command/listdatabases/

## Command Format

```typescript
{
  "listDatabases": <any value - ignored>
}
```

## Command Fields

Currently no additional fields are supported. 

## Result Format

```typescript
{
  "databases": [
    {
      "name": <database name>
    },
    ...
  ],
  "ok": 1
}
```

## Behaviour

As of now, only the names of the databases are returned. It is as if `nameOnly` is set to true always. In the future, additional information might be added to conform better to the MongoDB behaviour.

In ChikkaDB, `listDatabases` is just like any other command. It can be executed using `db.runCommand` in addition to `db.adminCommand`.
