/** RED stub: neutral values so the target tests fail on their assertions. */
export function normalizeDescription(text: string): string {
  return text;
}

export function ruleMapKey(rfc: string, key: string): string {
  return rfc + key;
}
