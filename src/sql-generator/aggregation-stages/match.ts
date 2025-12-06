import type { AggregationStageIR_$match } from "#src/types.js";
import { getWhereClauseFromAugmentedFilter, traverseFilterAndTranslateCTE, type TranslationContext } from "../common/filter.js";

export function translateMatchToSQL(stage: AggregationStageIR_$match, index: number, collection: string): string {
  const { filter } = stage;

  if (filter.operator === '$and' && filter.operands.length === 0) {
    let s = '';
    s += `stage${index} AS (\n`;
    s += `  SELECT id, c.doc\n`;
    s += `  FROM ${index === 0 ? collection : `stage${index - 1}`} c\n`;
    s += `)`;

    return s;
  }

  const context: TranslationContext = {
    conditionCTEs: [],
  };

  traverseFilterAndTranslateCTE(filter, context);

  const whereFragment = getWhereClauseFromAugmentedFilter(filter, context);

  const { conditionCTEs } = context;

  let s = '';
  s += `stage${index} AS (\n`;
  s += `  SELECT c.id, c.doc\n`;
  s += `  FROM ${index === 0 ? collection : `stage${index - 1}`} c\n`;
  s += `  WHERE EXISTS (\n`;
  s += `    WITH ${conditionCTEs.join(',')}\n`;
  s += `    SELECT 1\n`;
  s += `    FROM (SELECT 1)\n`;
  s += `    ${conditionCTEs.map((_, index) => `FULL OUTER JOIN condition_${index} c${index} ON 1=1`).join('\n')}\n`;
  s += `    WHERE ${whereFragment}\n`;
  s += `  )\n`;
  s += `)`;

  return s;
}