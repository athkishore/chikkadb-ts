import type { FilterNodeIR, FindAndModifyCommandIR, UpdateNodeIR } from "#shared/types.js";
import type { Database } from "better-sqlite3";
import { getWhereClauseFromAugmentedFilter, traverseFilterAndTranslateCTE, type TranslationContext } from "./common/filter.js";
import { getUpdateFragment } from "./common/update.js";

export function generateAndExecuteSQL_FindAndModify(command: FindAndModifyCommandIR, db: Database) {
  const { collection, filter, update } = command;

  const sql = translateCommandToSQL({ collection, filter, update });

  console.log(sql);

  const stmt = db.prepare(sql);
  const result = stmt.run();

  console.log(result);
  return {
    ok: 1,
  };
}

function translateCommandToSQL({
  collection,
  filter,
  update,
}: {
  collection: string;
  filter: FilterNodeIR;
  update: UpdateNodeIR[];
}) {
  const filterContext: TranslationContext = {
    conditionCTEs: [],
  };

  traverseFilterAndTranslateCTE(filter, filterContext);

  const { conditionCTEs } = filterContext;

  const whereClause = filter.operator === '$and' && filter.operands.length === 0
    ? ''
    : `\
WHERE EXISTS (
  WITH
  ${conditionCTEs.join(',')}
  SELECT 1
  ${conditionCTEs.map((_, index) => {
    return index === 0
      ? `FROM condition_${index} c${index}`
      : `FULL OUTER JOIN condition_${index} c${index} ON 1=1`;
  }).join('\n')}
  WHERE
    ${getWhereClauseFromAugmentedFilter(filter, filterContext)}
)
`;
  const updateFragment = getUpdateFragment(update);

  let sql = `
UPDATE ${collection} AS c
set doc = ${updateFragment}
${whereClause};
`;

  return sql;
}