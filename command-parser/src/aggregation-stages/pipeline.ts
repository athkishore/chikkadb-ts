import type { AggregationStage, AggregationStageIR } from "@chikkadb/interfaces/command/types";
import { parseCountStage } from "./count.js";
import { parseLimitStage } from "./limit.js";
import { parseMatchStage } from "./match.js";

export function parsePipeline(pipeline: AggregationStage[]): AggregationStageIR[] {
  const pipelineIR: AggregationStageIR[] = [];

  for (const stage of pipeline) {
    switch(stage?.stage) {
      case '$match': {
        pipelineIR.push(parseMatchStage(stage));
        break;
      }
      case '$count': {
        pipelineIR.push(parseCountStage(stage));
        break;
      }
      case '$limit': {
        pipelineIR.push(parseLimitStage(stage));
        break;
      }
      default: {
        pipelineIR.push(null as any);
        // throw new Error('Unknown stage: ' + (stage as any).stage);
      }
    }
    
  }

  return pipelineIR;
}