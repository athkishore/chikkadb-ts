import type { AggregationStageIR_$count, AggregationStage_$count } from "@chikkadb/interfaces/command/types";

export function parseCountStage(stage: AggregationStage_$count): AggregationStageIR_$count {
  return stage;
}