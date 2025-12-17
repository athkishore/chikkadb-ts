import type { AggregationStageIR } from "@chikkadb/interfaces/command/types";
import { translateCountToSQL } from "./count.js";
import { translateLimitToSQL } from "./limit.js";
import { translateMatchToSQL } from "./match.js";

export function translatePipelineToSQL(pipeline: AggregationStageIR[], collection: string): string[] {
  const pipelineCTEs: string[] = [];

  for (const [index, stage] of pipeline.entries()) {
    switch(stage.stage) {
      case '$match': {
        pipelineCTEs.push(translateMatchToSQL(stage, index, collection));
        break;
      }
      case '$count': {
        pipelineCTEs.push(translateCountToSQL(stage, index, collection));
        break;
      }
      case '$limit': {
        pipelineCTEs.push(translateLimitToSQL(stage, index, collection));
        break;
      }
      default: {
        throw new Error(`Unknown stage: ${(stage as any).stage}`);
      }
    }
  }

  return pipelineCTEs;
}