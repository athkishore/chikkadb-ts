import type { ProjectionDocIR, ProjectionNodeIR } from "@chikkadb/interfaces/command/types";

export function project(doc: Record<string, any>, projection: ProjectionDocIR) {
  const includePaths = getPathsFromIR(projection.include);
  const excludePaths = getPathsFromIR(projection.exclude);



  const projectedDoc = includePaths.length > 0
    ? projectDocInclusion(doc, includePaths)
    : excludePaths.length > 0
    ? projectDocExclusion(doc, excludePaths)
    : doc;

  return projectedDoc;
}

function projectDocInclusion(doc: Record<string, any>, includePaths: string[], parentPath = '') {
  // const copy_of_doc = structuredClone(doc);
  const copy_of_doc = doc;

  for (const [key, value] of Object.entries(copy_of_doc)) {
    if (Array.isArray(value)) {
      const matchingPaths = includePaths.filter(p => p.match(parentPath ? `${parentPath}.${key}` : key));
      if (matchingPaths.length === 0) {
        delete copy_of_doc[key];
        continue;
      }

      const isExactMatch = matchingPaths.length === 1 && matchingPaths[0] === (parentPath ? `${parentPath}.${key}` : key);
      if (isExactMatch) continue;

      const updatedArr = value.map(el => {
        if (!Array.isArray(el) && el !== null && typeof el === 'object') {
          return projectDocInclusion(el, includePaths, parentPath ? `${parentPath}.${key}` : key);
        } else {
          return undefined;
        }
      }).filter(el => el !== undefined);

      copy_of_doc[key] = updatedArr;
    } else if (value !== null && typeof value === 'object') {
      const matchingPaths = includePaths.filter(p => p.match(parentPath ? `${parentPath}.${key}` : key));
      if (matchingPaths.length === 0) {
        delete copy_of_doc[key];
        continue;
      }

      const isExactMatch = matchingPaths.length === 1 && matchingPaths[0] === (parentPath ? `${parentPath}.${key}` : key);
      if (isExactMatch) continue;

      const updatedObj = projectDocInclusion(value, includePaths, parentPath ? `${parentPath}.${key}` : key);
      copy_of_doc[key] = updatedObj;

    } else {
      const matchingPaths = includePaths.filter(p => p.match(parentPath ? `${parentPath}.${key}` : key));
      const isExactMatch = matchingPaths.length === 1 && matchingPaths[0] === (parentPath ? `${parentPath}.${key}` : key);

      if (!isExactMatch) {
        delete copy_of_doc[key];
      }
    }
  }

  return copy_of_doc;
}

function projectDocExclusion(doc: Record<string, any>, excludePaths: string[], parentPath = '') {
  for (const [key, value] of Object.entries(doc)) {
    const matchingPaths = excludePaths.filter(p => p.match(parentPath ? `${parentPath}.${key}` : key));
    const isExactMatch = matchingPaths.length === 1 && matchingPaths[0] === (parentPath ? `${parentPath}.${key}` : key);

    if (Array.isArray(value)) {
      if (matchingPaths.length === 0) {
        continue;
      }

      if (isExactMatch) {
        delete doc[key];
        continue;
      }

      const updatedArr = value.map(el => {
        if (!Array.isArray(el) && el !== null && typeof el === 'object') {
          return projectDocExclusion(el, excludePaths, parentPath ? `${parentPath}.${key}` : key);
        } else {
          return undefined;
        }
      }).filter(el => el !== undefined);

      doc[key] = updatedArr;
    } else if (value !== null && typeof value === 'object') {
      if (matchingPaths.length === 0) {
        continue;
      }

      if (isExactMatch) {
        delete doc[key];
        continue;
      }

      const updatedObj = projectDocExclusion(value, excludePaths, parentPath ? `${parentPath}.${key}` : key);
      doc[key] = updatedObj;
    } else {
      if (isExactMatch) {
        delete doc[key];
      }
    }
  }

  return doc;
}

function getPathsFromIR(nodes: ProjectionNodeIR[]) {
  const paths: string[] = [];

  function walk(node: ProjectionNodeIR, parentPath: string) {
    if (node.children.length === 0) {
      paths.push(`${parentPath}${parentPath === '' ? '' : '.'}${node.path}`);
      return;
    }

    for (const child of node.children) {
      walk(child, `${parentPath}${parentPath === '' ? '' : '.'}${node.path}`);
    }
  }

  for (const node of nodes) {
    walk(node, '');
  }

  return paths;

}
