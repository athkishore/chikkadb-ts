import config from "../../config.js";
import type { ProjectionDocIR, ProjectionNodeIR } from "@chikkadb/interfaces/command/types";

const JSON_TYPE = config.enableJSONB ? 'jsonb' : 'json';

export function getProjectionFragment(projection: ProjectionDocIR) {
  const includePaths = getPathsFromIR(projection.include);
  const excludePaths = getPathsFromIR(projection.exclude);

  // TODO: Sanitize paths

  const fragment = includePaths.length > 0 
    ? generateIncludeProjectionSQL(includePaths)
    : excludePaths.length > 0
    ? generateExcludeProjectionSQL(excludePaths)
    : '';
  

  return fragment;
  
}

function generateIncludeProjectionSQL(includePaths: string[]) {
  let s = '';
  s += `(\n`;
  s += `  WITH\n`;
  
  /** include_paths CTE */
  s += `  include_paths AS (\n`;
  
  let maxPathLength = 0;
  for (const [index, path] of includePaths.entries()) {
    const pathLength = path.split('.').length;
    if (pathLength > maxPathLength) maxPathLength = pathLength;
    s += `    SELECT '${path}' AS _path, ${pathLength} AS _length\n`;
    if (index < includePaths.length - 1) {
      s += `    UNION\n`;
    }
  }
  
  s += `  ),\n`;
  /** End of include_paths CTE */

  let pathIndex = 0;

  while (pathIndex < maxPathLength) {
    /** p{i} CTE */
    s += `  p${pathIndex}${pathIndex === maxPathLength - 1 ? '_mod' : ''} AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx < pathIndex; idx++) {
      s += `      p${pathIndex - 1}_each.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex - 1}_each.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex - 1}_each.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex - 1}_each.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      je.key AS p${pathIndex}_k,\n`;
    s += `      je.type AS p${pathIndex}_t,\n`;
    
    if (pathIndex === 0) {
      s += `      je.value AS p${pathIndex}_v\n`;
    } else {
      const pathMatchExp = getPathMatchExp(pathIndex, `p${pathIndex - 1}_each`);
      s += `      CASE (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${pathMatchExp})\n`;
      s += `        WHEN TRUE THEN je.value\n`;
      s += `        ELSE p${pathIndex - 1}_each.p${pathIndex - 1}_each_v\n`;
      s += `      END AS p${pathIndex}_v\n`;
    }

    if (pathIndex === 0) {
      s += `    FROM ${JSON_TYPE}_each(c.doc) AS je\n`;
    } else {
      s += `    FROM\n`;
      s += `      p${pathIndex - 1}_each\n`;
      s += `      CROSS JOIN (SELECT 1)\n`;
      s += `      LEFT JOIN ${JSON_TYPE}_each(\n`;
      s += `        CASE p${pathIndex - 1}_each.p${pathIndex - 1}_each_t = 'object' AND (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${getPathMatchExp(pathIndex, `p${pathIndex - 1}_each`)})\n`;
      s += `          WHEN TRUE THEN p${pathIndex - 1}_each.p${pathIndex - 1}_each_v\n`;
      s += `          ELSE '{}'\n`;
      s += `        END\n`;
      s += `      ) AS je\n`;
    }

    s += `    WHERE (\n`;
    s += `      SELECT 1\n`;
    s += `      FROM include_paths\n`;
    s += `      WHERE (\n`;
    
    if (pathIndex === 0) {
      s += `        include_paths._path LIKE je.key || '%'\n`;
    } else {
      s += `        CASE include_paths._length\n`;
      
      for (let l = 1; l <= pathIndex; l++) {
        s += `          WHEN ${l} THEN include_paths._path LIKE ${getPathMatchExp(l, `p${pathIndex - 1}_each`, { suffix: true, suffixDot: false })}\n`;
      }
      s += `          ELSE include_paths._path LIKE ${getPathMatchExp(pathIndex, `p${pathIndex - 1}_each`, { suffix: false, suffixDot: false })} je.key || '%'\n`;
      s += `        END\n`;
    }

    s += `      )\n`;
    s += `    )\n`;

    s += `  )${maxPathLength > 1 ? ',' : ''}\n`;
    /** End of p{i} CTE */

    if (pathIndex === maxPathLength - 1) {
      pathIndex++;
      continue;
    }
    
    /** p{i}_each CTE */
    s += `  p${pathIndex}_each AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx < pathIndex; idx++) {
      s += `      p${pathIndex}.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex}.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex}.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex}.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      p${pathIndex}.p${pathIndex}_k AS p${pathIndex}_k,\n`;
    s += `      p${pathIndex}.p${pathIndex}_t AS p${pathIndex}_t,\n`;
    s += `      CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `        WHEN TRUE THEN je.key\n`;
    s += `        ELSE null\n`;
    s += `      END AS p${pathIndex}_each_i,\n`;
    s += `      CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `        WHEN TRUE THEN je.type\n`;
    s += `        ELSE p${pathIndex}.p${pathIndex}_t\n`
    s += `      END AS p${pathIndex}_each_t,\n`;
    s += `      CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `        WHEN TRUE THEN je.value\n`;
    s += `        ELSE p${pathIndex}.p${pathIndex}_v\n`;
    s += `      END AS p${pathIndex}_each_v\n`;
    s += `    FROM\n`;
    s += `      p${pathIndex}\n`;
    s += `      CROSS JOIN (SELECT 1)\n`;
    s += `      LEFT JOIN ${JSON_TYPE}_each(\n`;
    s += `        CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `          WHEN TRUE THEN p${pathIndex}.p${pathIndex}_v\n`;
    s += `          ELSE '[]'\n`;
    s += `        END\n`;
    s += `      ) AS je\n`;
    s += `  ),\n`;
    /** End of p{i}_each CTE */
    pathIndex++;
  }

  pathIndex -= 2;
  while (pathIndex >= 0) {
    /** p{i}_each_mod CTE */
    s += `  p${pathIndex}_each_mod AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx <= pathIndex; idx++) {
      s += `      p${pathIndex + 1}_mod.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex + 1}_mod.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex + 1}_mod.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex + 1}_mod.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      CASE p${pathIndex + 1}_mod.p${pathIndex}_each_t = 'object' AND (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex + 1}_mod`)}) \n`;
    s += `        WHEN TRUE THEN ${JSON_TYPE}_group_object(\n`;
    s += `          p${pathIndex+1}_mod.p${pathIndex + 1}_k,\n`;
    s += `          CASE p${pathIndex + 1}_mod.p${pathIndex + 1}_t = 'array' OR p${pathIndex + 1}_mod.p${pathIndex + 1}_t = 'object' WHEN TRUE THEN ${JSON_TYPE}(p${pathIndex + 1}_mod.p${pathIndex + 1}_v) ELSE p${pathIndex + 1}_mod.p${pathIndex + 1}_v END\n`;
    s += `        )\n`;
    s += `        ELSE p${pathIndex + 1}_mod.p${pathIndex + 1}_v\n`;
    s += `      END AS p${pathIndex}_each_v\n`
    s += `    FROM p${pathIndex + 1}_mod\n`;
    s += `    GROUP BY `;
    for (let idx = 0; idx <= pathIndex; idx++) {
      s += `p${pathIndex + 1}_mod.p${idx}_k, p${pathIndex + 1}_mod.p${idx}_each_i`;
      if (idx < pathIndex) { s += ', '; } else { s += '\n'; }
    }
    s += `  ),\n`;
    /** End of p{i}_each_mod */

    /** p{i}_mod CTE */
    s += `  p${pathIndex}_mod AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx < pathIndex; idx++) {
      s += `      p${pathIndex}_each_mod.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex}_each_mod.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex}_each_mod.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex}_each_mod.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      p${pathIndex}_each_mod.p${pathIndex}_k AS p${pathIndex}_k,\n`;
    s += `      p${pathIndex}_each_mod.p${pathIndex}_t AS p${pathIndex}_t,\n`;
    s += `      CASE p${pathIndex}_each_mod.p${pathIndex}_t = 'array' AND (SELECT 1 FROM include_paths WHERE include_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}_each_mod`)})\n`;
    s += `        WHEN TRUE THEN ${JSON_TYPE}_group_array(\n`;
    s += `          CASE p${pathIndex}_each_mod.p${pathIndex}_each_t = 'array' OR p${pathIndex}_each_mod.p${pathIndex}_each_t = 'object'\n`;
    s += `            WHEN TRUE THEN ${JSON_TYPE}(p${pathIndex}_each_mod.p${pathIndex}_each_v)\n`;
    s += `            ELSE p${pathIndex}_each_mod.p${pathIndex}_each_v\n`;
    s += `          END\n`;
    s += `        )\n`;
    s += `        ELSE p${pathIndex}_each_mod.p${pathIndex}_each_v\n`;
    s += `      END AS p${pathIndex}_v\n`;
    s += `    FROM p${pathIndex}_each_mod\n`;
    s += `    GROUP BY `;
    for (let idx = 0; idx <= pathIndex; idx++) {
      s += `p${pathIndex}_each_mod.p${idx}_k`;
      if (idx < pathIndex) {
        s += `, p${pathIndex}_each_mod.p${idx}_each_i, `;
      } else {
        s += '\n';
      }
    }
    s += `  )${pathIndex > 0 ? ',' : ''}\n`;
    /** End of p{i}_mod CTE */
    pathIndex--;
  }

  s += `  SELECT json_group_object(p0_mod.p0_k, ${JSON_TYPE}(p0_mod.p0_v)) FROM p0_mod\n`;

  s += `) AS doc`;

  return s;
}

function generateExcludeProjectionSQL(excludePaths: string[]) {
  console.log(excludePaths);
  let s = '';
  s += `(\n`;
  s += `  WITH\n`;

  /** exclude_paths CTE */
  s += `  exclude_paths AS (\n`;

  let maxPathLength = 0;
  for (const [index, path] of excludePaths.entries()) {
    const pathLength = path.split('.').length;
    if (pathLength > maxPathLength) maxPathLength = pathLength;
    s += `    SELECT '${path}' AS _path, ${pathLength} AS _length\n`;
    if (index < excludePaths.length - 1) {
      s += `    UNION\n`;
    }
  }

  s += `  ),\n`;
  /** End of exclude_paths CTE */

  let pathIndex = 0;

  while (pathIndex < maxPathLength) {
    /** p{i} CTE */
    s += `  p${pathIndex}${pathIndex === maxPathLength - 1 ? '_mod' : ''} AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx < pathIndex; idx++) {
      s += `      p${pathIndex - 1}_each.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex - 1}_each.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex - 1}_each.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex - 1}_each.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      je.key AS p${pathIndex}_k,\n`;
    s += `      je.type AS p${pathIndex}_t,\n`;
    
    if (pathIndex === 0) {
      s += `      je.value AS p${pathIndex}_v\n`;
    } else {
      s += `      CASE p${pathIndex - 1}_each.p${pathIndex -1}_each_t = 'object' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex, `p${pathIndex - 1}_each`)})\n`;
      s += `        WHEN TRUE THEN je.value\n`;
      s += `        ELSE p${pathIndex - 1}_each.p${pathIndex - 1}_each_v\n`;
      s += `      END AS p${pathIndex}_v\n`;
    }

    if (pathIndex === 0) {
      s += `    FROM ${JSON_TYPE}_each(c.doc) AS je\n`;
    } else {
      s += `    FROM\n`;
      s += `      p${pathIndex - 1}_each\n`;
      s += `      CROSS JOIN (SELECT 1)\n`;
      s += `      LEFT JOIN ${JSON_TYPE}_each(\n`;
      s += `        CASE p${pathIndex - 1}_each.p${pathIndex - 1}_each_t = 'object' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex, `p${pathIndex - 1}_each`)})\n`;
      s += `          WHEN TRUE THEN p${pathIndex - 1}_each.p${pathIndex - 1}_each_v\n`;
      s += `          ELSE '{}'\n`;
      s += `        END\n`;
      s += `      ) AS je\n`;
    }

    s += `    WHERE NOT EXISTS (\n`;
    s += `      SELECT 1\n`;
    s += `      FROM exclude_paths\n`;
    s += `      WHERE (\n`;
    s += `        CASE exclude_paths._length\n`;
    s += `          WHEN ${pathIndex + 1} THEN exclude_paths._path LIKE ${pathIndex === 0 ? '' : getPathMatchExp(pathIndex, `p${pathIndex - 1}_each`, { suffix: false, suffixDot: false })} je.key\n`;
    s += `          ELSE FALSE\n`;
    s += `        END\n`;
    s += `      )\n`;
    s += `    )\n`;
    s += `  )${maxPathLength > 1 ? ',' : ''}\n`;
    /** End of p{i} CTE */

    if (pathIndex === maxPathLength - 1) {
      pathIndex++;
      continue;
    }

    /** p{i}_each CTE */
    s += `  p${pathIndex}_each AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx < pathIndex; idx++) {
      s += `      p${pathIndex}.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex}.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex}.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex}.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      p${pathIndex}.p${pathIndex}_k AS p${pathIndex}_k,\n`;
    s += `      p${pathIndex}.p${pathIndex}_t AS p${pathIndex}_t,\n`;
    s += `      CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `        WHEN TRUE THEN je.key\n`;
    s += `        ELSE null\n`;
    s += `      END AS p${pathIndex}_each_i,\n`;
    s += `      CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `        WHEN TRUE THEN je.type\n`;
    s += `        ELSE p${pathIndex}.p${pathIndex}_t\n`;
    s += `      END AS p${pathIndex}_each_t,\n`;
    s += `      CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `        WHEN TRUE THEN je.value\n`;
    s += `        ELSE p${pathIndex}.p${pathIndex}_v\n`;
    s += `      END AS p${pathIndex}_each_v\n`;
    s += `    FROM\n`;
    s += `      p${pathIndex}\n`;
    s += `      CROSS JOIN (SELECT 1)\n`;
    s += `      LEFT JOIN ${JSON_TYPE}_each(\n`;
    s += `        CASE p${pathIndex}.p${pathIndex}_t = 'array' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}`)})\n`;
    s += `          WHEN TRUE THEN p${pathIndex}.p${pathIndex}_v\n`;
    s += `          ELSE '[]'\n`;
    s += `        END\n`;
    s += `      ) AS je\n`;
    s += `  ),\n`;
    /** End of p{i}_each CTE */
    pathIndex++;
  }

  pathIndex -= 2;
  while (pathIndex >= 0) {
    /** p{i}_each_mod CTE */
    s += `  p${pathIndex}_each_mod AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx <= pathIndex; idx++) {
      s += `      p${pathIndex + 1}_mod.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex + 1}_mod.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex + 1}_mod.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex + 1}_mod.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      CASE p${pathIndex + 1}_mod.p${pathIndex}_each_t = 'object' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex + 1}_mod`)})\n`;
    s += `        WHEN TRUE THEN ${JSON_TYPE}_group_object(\n`;
    s += `          p${pathIndex + 1}_mod.p${pathIndex + 1}_k,\n`;
    s += `          CASE p${pathIndex + 1}_mod.p${pathIndex + 1}_t = 'array' OR p${pathIndex + 1}_mod.p${pathIndex + 1}_t = 'object' WHEN TRUE THEN ${JSON_TYPE}(p${pathIndex + 1}_mod.p${pathIndex + 1}_v) ELSE p${pathIndex + 1}_mod.p${pathIndex + 1}_v END\n`;
    s += `        )\n`;
    s += `        ELSE p${pathIndex + 1}_mod.p${pathIndex + 1}_v\n`;
    s += `      END AS p${pathIndex}_each_v\n`;
    s += `    FROM p${pathIndex + 1}_mod\n`;
    s += `    GROUP BY `;
    for (let idx = 0; idx <= pathIndex; idx++) {
      s += `p${pathIndex + 1}_mod.p${idx}_k, p${pathIndex + 1}_mod.p${idx}_each_i`;
      if (idx < pathIndex) { s += ', '; } else { s += '\n'; }
    }
    s += `  ),\n`;
    /** End of p{i}_each_mod CTE */

    /** p{i}_mod CTE */
    s += `  p${pathIndex}_mod AS (\n`;
    s += `    SELECT\n`;
    for (let idx = 0; idx < pathIndex; idx++) {
      s += `      p${pathIndex}_each_mod.p${idx}_k AS p${idx}_k,\n`;
      s += `      p${pathIndex}_each_mod.p${idx}_t AS p${idx}_t,\n`;
      s += `      p${pathIndex}_each_mod.p${idx}_each_i AS p${idx}_each_i,\n`;
      s += `      p${pathIndex}_each_mod.p${idx}_each_t AS p${idx}_each_t,\n`;
    }
    s += `      p${pathIndex}_each_mod.p${pathIndex}_k AS p${pathIndex}_k,\n`;
    s += `      p${pathIndex}_each_mod.p${pathIndex}_t AS p${pathIndex}_t,\n`;
    s += `      CASE p${pathIndex}_each_mod.p${pathIndex}_t = 'array' AND (SELECT 1 FROM exclude_paths WHERE exclude_paths._path LIKE ${getPathMatchExp(pathIndex + 1, `p${pathIndex}_each_mod`)})\n`;
    s += `        WHEN TRUE THEN ${JSON_TYPE}_group_array(\n`;
    s += `          CASE p${pathIndex}_each_mod.p${pathIndex}_each_t = 'array' OR p${pathIndex}_each_mod.p${pathIndex}_each_t = 'object'\n`;
    s += `            WHEN TRUE THEN ${JSON_TYPE}(p${pathIndex}_each_mod.p${pathIndex}_each_v)\n`;
    s += `            ELSE p${pathIndex}_each_mod.p${pathIndex}_each_v\n`;
    s += `          END\n`;
    s += `        )\n`;
    s += `        ELSE p${pathIndex}_each_mod.p${pathIndex}_each_v\n`;
    s += `      END AS p${pathIndex}_v\n`;
    s += `    FROM p${pathIndex}_each_mod\n`;
    s += `    GROUP BY `;
    for (let idx = 0; idx <= pathIndex; idx++) {
      s += `p${pathIndex}_each_mod.p${idx}_k`;
      if (idx < pathIndex) {
        s += `, p${pathIndex}_each_mod.p${idx}_each_i, `;
      } else {
        s += '\n';
      }
    }
    s += `  )${pathIndex > 0 ? ',' : ''}\n`;
    /** End of p{i}_mod CTE */
    pathIndex--;
  }

  s += `  SELECT json_group_object(p0_mod.p0_k, ${JSON_TYPE}(p0_mod.p0_v)) FROM p0_mod\n`;
  s += `) AS doc`;

  return s;
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

function getPathMatchExp(pathIndex: number, tablePrefix: string, options = { suffix: true, suffixDot: true }) {
  return Array.from({ length: pathIndex })
    .reduce((acc, _, index) => {
      let fragment = acc;
      fragment += `${tablePrefix}.p${index}_k`;
      if (index === pathIndex - 1 && options.suffix) {
        fragment += ` || '${options.suffixDot ? '.' : ''}%'`;
      } else {
        fragment += ` || '.' || `;
      }
      return fragment;
    }, '');
}