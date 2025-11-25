export function validateIdentifier(name: string) {
  return /^[A-Za-z0-9_]+$/.test(name);
}