import type { AggregationStageIR_$limit, AggregationStage_$limit } from "#src/types.js";

export function parseLimitStage(stage: AggregationStage_$limit): AggregationStageIR_$limit {
  return stage;
}