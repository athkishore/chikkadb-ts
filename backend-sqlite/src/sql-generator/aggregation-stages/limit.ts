import type { AggregationStageIR_$limit } from "@chikkadb/interfaces/command/types";

export function translateLimitToSQL(stage: AggregationStageIR_$limit, index: number, collection: string) {
  const { limit } = stage;

  let s= '';
  s += `stage${index} AS (\n`;
  s += `  SELECT\n`;
  s += `     ${index === 0 ? collection : `stage${index - 1}`}.id AS id,\n`;
  s += `     ${index === 0 ? collection : `stage${index - 1}`}.doc AS doc\n`;
  s += `   FROM ${index === 0 ? collection : `stage${index - 1}`}\n`;
  s += `   LIMIT ${limit}`;
  s += `)`;

  return s;
}