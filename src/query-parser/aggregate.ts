import type { AggregateCommand, AggregateCommandIR } from "#src/types.js";
import { parsePipeline } from "./aggregation-stages/pipeline.js";

export function parseAggregateCommand(command: AggregateCommand): AggregateCommandIR {
  const { pipeline } = command;

  const pipelineIR = parsePipeline(pipeline);

  const commandIR = {
    ...command,
    pipeline: pipelineIR,
  };
  
  return commandIR;
}