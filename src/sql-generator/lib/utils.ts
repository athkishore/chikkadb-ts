import debug from 'debug';
export const logSql = debug('sqlite:sql');
export const logSqlResult = debug('sqlite:result');
export const logSqlExecTime = debug('sqlite:time');