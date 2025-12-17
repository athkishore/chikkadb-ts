import config from "../../config.js";
import { stringifyToCustomJSON } from "@chikkadb/interfaces/lib/json";
import type { UpdateNodeIR, Value } from "@chikkadb/interfaces/command/types";

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

export function getUpdateFragment(update: UpdateNodeIR[]) {
  for (const element of update) {
    switch(element.operator) {
      case '$set': {
        const argPairs = element.operandsArr.map((item, index, arr) => {
          const ref = item[0].$ref;
          const val = item[1];

          const fieldPathSegments = ref.split('.');

          const sqlFieldRef = fieldPathSegments.reduce((acc, seg) => {
            return !isNaN(Number(seg))
              ? `${acc}[${seg}]`
              : `${acc}.${seg}`;
          }, '$');

          const sqlValue = Array.isArray(val) || (!!val && typeof val === 'object')
            ? `${JSON_TYPE}(${getValueSqlFragment(val)})`
            : getValueSqlFragment(val);

          let s = '';
          s += `'${sqlFieldRef}',\n`;
          s += `${sqlValue}${index === arr.length - 1 ? '' : ','}\n`;
          return s;
        });


        let s = '';
        s += `${JSON_TYPE}_set(\n`;
        s += `  c.doc,\n`;
        for (const argPair of argPairs) {
          s += argPair;
        }
        s += `)\n`;
        return s;
      }

      case '$unset': {
        const args = element.operandsArr.map((item, index, arr) => {
          const ref = item[0].$ref;

          const fieldPathSegments = ref.split('.');

          const sqlFieldRef = fieldPathSegments.reduce((acc, seg) => {
            return !isNaN(Number(seg))
              ? `${acc}[${seg}]`
              : `${acc}.${seg}`;
          }, '$');

          let s = '';
          s += `'${sqlFieldRef}'${index === arr.length - 1 ? '' : ','}\n`;
          return s;
        });

        let s = '';
        s += `${JSON_TYPE}_remove(\n`;
        s += `  c.doc,\n`;
        for (const arg of args) {
          s += arg;
        }
        s += `)\n`;
        return s;
      }

      case '$inc': {
        const argPairs = element.operandsArr.map((item, index, arr) => {
          const ref = item[0].$ref;
          const val = item[1];

          const fieldPathSegments = ref.split('.');

          const sqlFieldRef = fieldPathSegments.reduce((acc, seg) => {
            return !isNaN(Number(seg))
              ? `${acc}[${seg}]`
              : `${acc}.${seg}`;
          }, '$');

          const sqlValue = getValueSqlFragment(val);

          let s = '';
          s += `'${sqlFieldRef}',\n`;
          s += `CASE\n`;
          s += `  WHEN json_type(c.doc, '${sqlFieldRef}') IN ('integer', 'real')\n`;
          s += `    THEN json_extract(c.doc, '${sqlFieldRef}') + ${sqlValue}\n`;
          s += `  ELSE json_extract(c.doc, '${sqlFieldRef}')\n`;
          s += `END${index === arr.length - 1 ? '' : ','}\n`;
          return s;
        });

        let s = '';
        s += `${JSON_TYPE}_set(\n`;
        s += `  c.doc,\n`;
        for (const argPair of argPairs) {
          s += argPair;
        }
        s += `)\n`;
        return s;
      }

      case '$mul': {
        const argPairs = element.operandsArr.map((item, index, arr) => {
          const ref = item[0].$ref;
          const val = item[1];

          const fieldPathSegments = ref.split('.');

          const sqlFieldRef = fieldPathSegments.reduce((acc, seg) => {
            return !isNaN(Number(seg))
              ? `${acc}[${seg}]`
              : `${acc}.${seg}`;
          }, '$');

          const sqlValue = getValueSqlFragment(val);

          let s = '';
          s += `'${sqlFieldRef}',\n`;
          s += `CASE\n`;
          s += `  WHEN json_type(c.doc, '${sqlFieldRef}') IN ('integer', 'real')\n`;
          s += `    THEN json_extract(c.doc, '${sqlFieldRef}') * ${sqlValue}\n`;
          s += `  ELSE json_extract(c.doc, '${sqlFieldRef}')\n`;
          s += `END${index === arr.length - 1 ? '' : ','}\n`;
          return s;
        });

        let s = '';
        s += `${JSON_TYPE}_set(\n`;
        s += `  c.doc,\n`;
        for (const argPair of argPairs) {
          s += argPair;
        }
        s += `)\n`;
        return s;
      }

      case '$max': {
        const argPairs = element.operandsArr.map((item, index, arr) => {
          const ref = item[0].$ref;
          const val = item[1];

          const fieldPathSegments = ref.split('.');

          const sqlFieldRef = fieldPathSegments.reduce((acc, seg) => {
            return !isNaN(Number(seg))
              ? `${acc}[${seg}]`
              : `${acc}.${seg}`;
          }, '$');

          const sqlValue = getValueSqlFragment(val);

          let s = '';
          s += `'${sqlFieldRef}',\n`;
          s += `CASE\n`;
          s += `  WHEN json_extract(c.doc, '${sqlFieldRef}') < ${sqlValue}\n`;
          s += `    THEN ${sqlValue}\n`;
          s += `  ELSE json_extract(c.doc, '${sqlFieldRef}')\n`;
          s += `END${index === arr.length - 1 ? '' : ','}\n`;
          return s;
        });

        let s = '';
        s += `${JSON_TYPE}_set(\n`;
        s += `  c.doc,\n`;
        for (const argPair of argPairs) {
          s += argPair;
        }
        s += `)\n`;
        return s;
      }

      case '$min': {
        const argPairs = element.operandsArr.map((item, index, arr) => {
          const ref = item[0].$ref;
          const val = item[1];

          const fieldPathSegments = ref.split('.');

          const sqlFieldRef = fieldPathSegments.reduce((acc, seg) => {
            return !isNaN(Number(seg))
              ? `${acc}[${seg}]`
              : `${acc}.${seg}`;
          }, '$');

          const sqlValue = getValueSqlFragment(val);

          let s = '';
          s += `'${sqlFieldRef}',\n`;
          s += `CASE\n`;
          s += `  WHEN json_extract(c.doc, '${sqlFieldRef}') > ${sqlValue}\n`;
          s += `    THEN ${sqlValue}\n`;
          s += `  ELSE json_extract(c.doc, '${sqlFieldRef}')\n`;
          s += `END${index === arr.length - 1 ? '' : ','}\n`;
          return s;
        });

        let s = '';
        s += `${JSON_TYPE}_set(\n`;
        s += `  c.doc,\n`;
        for (const argPair of argPairs) {
          s += argPair;
        }
        s += `)\n`;
        return s;
      }
    }
  }
}

export function getValueSqlFragment(value: Value) {
  if (typeof value === 'string') {
    return `'${value}'`;
  } else if (typeof value === 'number') {
    return `${value}`;
  } else if (typeof value === 'boolean') {
    return value ? `json('true')` : `json('false')`;
  } else if (value === null) {
    return 'NULL';
  } else if (Array.isArray(value)) {
    return `${JSON_TYPE}('${stringifyToCustomJSON(value)}')`;
  } else if (typeof value === 'object') {
    return `${JSON_TYPE}('${stringifyToCustomJSON(value)}')`;
  }

  throw new Error('Unknown type for value: ' + value);
}