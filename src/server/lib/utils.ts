import debug from 'debug';

export const logWireMsg = debug('wire:msg');
export const logWireConn = debug('wire:conn');

export function prettyPrintHex(buf: Buffer, wordLength = 4, lineLength = 16): void {
  const bytesFormatted = [...buf].map(byte => byte.toString(16).padStart(2, '0').toUpperCase());
  for (const [index, byte] of bytesFormatted.entries()) {
    const isStartOfLine = index % lineLength === 0;
    const isEndOfLine = (index + 1) % lineLength === 0;
    const isEndOfWord = (index + 1) % wordLength === 0;

    // if (isStartOfLine) process.stdout.write(index.toString(16).padStart(4, '0') + '  ');
    process.stdout.write(byte + ' ');
    if (isEndOfLine) process.stdout.write('\n');
    if (!isEndOfLine && isEndOfWord) process.stdout.write(' ');
  }
  process.stdout.write('\n');
}

export function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}
