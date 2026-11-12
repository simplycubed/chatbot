const FENCE_TAGS = [
  "verified-actor",
  "untrusted-grounding",
  "untrusted-references",
  "untrusted-conversation",
  "untrusted-question",
] as const;

/** Remove fence tags so untrusted text cannot close a block or open the verified one. */
export function neutralize(text: string): string {
  let out = text;
  for (const tag of FENCE_TAGS) {
    out = out.replaceAll(`<${tag}>`, "").replaceAll(`</${tag}>`, "");
  }
  return out;
}

export function fence(tag: (typeof FENCE_TAGS)[number], text: string): string {
  return `<${tag}>\n${neutralize(text)}\n</${tag}>`;
}
