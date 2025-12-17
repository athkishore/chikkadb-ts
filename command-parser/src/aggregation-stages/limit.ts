import type { AggregationStageIR_$limit, AggregationStage_$limit } from "@chikkadb/interfaces/command/types";

export function parseLimitStage(stage: AggregationStage_$limit): AggregationStageIR_$limit {
  return stage;
}