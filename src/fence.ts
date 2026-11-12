const FENCE_TAGS = [
  "verified-actor",
  "untrusted-grounding",
  "untrusted-references",
  "untrusted-conversation",
  "untrusted-question",
] as const;

/**
 * Remove fence tags so untrusted text cannot close a block or open the verified one.
 * Matching is case-insensitive and allows whitespace, newlines, and attributes inside the tag.
 */
export function neutralize(text: string): string {
  const pattern = new RegExp(FENCE_TAGS.map((tag) => `<\\s*/?\\s*${tag}\\b[^>]*>`).join("|"), "gi");
  return text.replace(pattern, "");
}

export function fence(tag: (typeof FENCE_TAGS)[number], text: string): string {
  return `<${tag}>\n${neutralize(text)}\n</${tag}>`;
}
