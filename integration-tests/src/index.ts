import { spawn } from 'child_process';
import { glob } from 'glob';
import path from 'path';

const testFiles = process.argv.slice(2);

async function runTests() {
  // globalSetup

  const filesRel = await glob(`**/*.test.ts`);
  const filesAbs = filesRel
    .map(file => path.resolve(file))
    .filter(fileAbs => testFiles.length > 0 ? testFiles.some(el => fileAbs.match(el)) : true);

  const nodeArgs = ['--import', 'tsx', '--test', ...filesAbs];

  const testProcess = spawn('node', nodeArgs, {
    stdio: 'inherit',
  });

  testProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Tests failed with exit code ${code}`);
      // globalTearDown
      process.exit(code);
    } else {
      console.log(`Tests passed successfully`);
      // globalTearDown
      process.exit(code);
    }
  });
}

runTests();