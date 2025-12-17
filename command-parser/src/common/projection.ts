import type { ProjectionDoc, ProjectionDocIR, ProjectionNodeIR } from "@chikkadb/interfaces/command/types";

export function parseProjectionDoc(
  projectionDoc: ProjectionDoc,
): [Error, null] | [null, ProjectionDocIR] {
  try {
    const parseResult: ProjectionDocIR = {
      include: [],
      exclude: [],
    };

    const elements = Object.entries(projectionDoc);

    for (const [key, value] of elements) {
      const error = parseProjectionElement(key, value, {
        parentPath: [],
        parseResult,
      });
      if (error) throw error;
    }

    return [null, parseResult];
  } catch (error) {
    return [error as Error, null];
  }
}

function parseProjectionElement(
  key: string, 
  value: 1 | 0 | ProjectionDoc,
  context: {
    parentPath: string[];
    parseResult: ProjectionDocIR;
  }
): Error | null {
  try {
    const { parentPath, parseResult } = context;
    const pathSegments = key.split('.');

    if (value === 1 || value === 0) {
      let parentNodeArr = value === 1 ? parseResult.include : parseResult.exclude;

      const segments = parentPath.concat(pathSegments);
      for (const [index, segment] of segments.entries()) {
        let child = parentNodeArr.find(el => el.path === segment);
        if (!child) {
          child = {
            path: segment,
            children: [],
          };
          parentNodeArr.push(child);
        }

        if (index < segments.length - 1) {
          parentNodeArr = child.children;
        }
      }
    } else {
      for (const [k, v] of Object.entries(value)) {
        const error = parseProjectionElement(k, v, {
          parentPath: parentPath.concat(pathSegments),
          parseResult,
        });

        if (error) throw error;
      }
    }

    return null;
  } catch (error) {
    return error as Error;
  }
}
