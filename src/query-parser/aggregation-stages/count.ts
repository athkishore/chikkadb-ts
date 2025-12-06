import type { AggregationStageIR_$count, AggregationStage_$count } from "#src/types.js";

export function parseCountStage(stage: AggregationStage_$count): AggregationStageIR_$count {
  return stage;
}