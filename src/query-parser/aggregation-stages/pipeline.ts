import type { AggregationStage, AggregationStageIR } from "#src/types.js";
import { parseCountStage } from "./count.js";
import { parseMatchStage } from "./match.js";

export function parsePipeline(pipeline: AggregationStage[]): AggregationStageIR[] {
  const pipelineIR: AggregationStageIR[] = [];

  for (const stage of pipeline) {
    switch(stage.stage) {
      case '$match': {
        pipelineIR.push(parseMatchStage(stage));
        break;
      }
      case '$count': {
        pipelineIR.push(parseCountStage(stage));
        break;
      }
      default: {
        throw new Error('Unknown stage: ', (stage as any).stage);
      }
    }
    
  }

  return pipelineIR;
}