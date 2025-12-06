import type { AggregationStageIR_$count } from "#src/types.js";

export function translateCountToSQL(stage: AggregationStageIR_$count, index: number, collection: string): string {
  const { key } = stage;

  let s = '';
  s += `stage${index} AS (\n`;
  s += `  SELECT\n`;
  s += `    null as id,\n`;
  s += `    json_object(\n`;
  s += `      '${key}',\n`;
  s += `       COUNT(DISTINCT(${index === 0 ? collection : `stage${index - 1}`}.id))\n`
  s += `    ) as doc\n`;
  s += `  FROM ${index === 0 ? collection : `stage${index - 1}`}\n`;
  s += `)`;

  return s;
}