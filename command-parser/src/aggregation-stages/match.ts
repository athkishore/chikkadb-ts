import type { AggregationStageIR_$match, AggregationStage_$match } from "@chikkadb/interfaces/command/types";
import { parseFilterDoc } from "../common/filter.js";

export function parseMatchStage(stage: AggregationStage_$match): AggregationStageIR_$match {
  const { filter } = stage;

  const [error, filterIR] = parseFilterDoc(filter, { parentKey: null });

  if (error) throw error;

  return {
    stage: '$match',
    filter: filterIR,
  };
}