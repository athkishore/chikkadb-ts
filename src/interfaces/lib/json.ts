import { ObjectId, EJSON } from "bson";

export function stringifyToCustomJSON(value: any) {
  // return EJSON.stringify(value, { relaxed: false });
  return JSON.stringify(value, (_, value) => {
    if (value && typeof value.toHexString === 'function') {
      return { $oid: value.toHexString() };
    }

    if (value instanceof Date) {
      return { $date: value.toISOString() };
    }

    return value;
  });
}

export function parseFromCustomJSON(text: string) {
  // return EJSON.parse(text, { relaxed: false });
  return JSON.parse(text, (_, value) => {
    if (value && typeof value === 'object') {
      if (value.$oid) {
        return new ObjectId(value.$oid as string);
      }
      if (value.$date) {
        return new Date(value.$date);
      }
    }
    return value;
  });
}