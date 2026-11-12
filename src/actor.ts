import { ChatActorRequiredError } from "./errors.js";

/** Who is speaking. The browser never supplies this. The host binds it from the session. */
export type ChatActor =
  { kind: "user"; id: string; displayName?: string } | { kind: "visitor"; id: string };

/**
 * `app` is the signed-in product. A turn refuses to run without a user.
 * `public` is a page anyone can open. A signed-in user is still used when the
 * session has one; otherwise the host's visitor id is used.
 */
export type ChatAudience = "app" | "public";

export interface SessionIdentity {
  userId?: string | null;
  displayName?: string | null;
}

const ID_MAX = 128;
const NAME_MAX = 80;

function isControl(char: string): boolean {
  const code = char.charCodeAt(0);
  return code <= 31 || code === 127;
}

function hasControl(value: string): boolean {
  for (const char of value) {
    if (isControl(char)) return true;
  }
  return false;
}

/** One line. Newlines and other controls must not add a second field. */
function singleLine(value: string): string {
  let out = "";
  for (const char of value) out += isControl(char) ? " " : char;
  return out.replace(/ {2,}/g, " ").trim();
}

function cleanId(value: string): string {
  const id = value.trim();
  if (!id || id.length > ID_MAX || hasControl(id)) throw new ChatActorRequiredError();
  return id;
}

function cleanName(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const name = singleLine(value);
  if (!name) return undefined;
  return name.slice(0, NAME_MAX);
}

/** Bind the signed-in user. Throws when the session has no user id. */
export function bindAppUser(
  user:
    | {
        id: string;
        displayName?: string | null;
      }
    | null
    | undefined,
): ChatActor {
  if (!user) throw new ChatActorRequiredError();
  const displayName = cleanName(user.displayName);
  return displayName
    ? { kind: "user", id: cleanId(user.id), displayName }
    : { kind: "user", id: cleanId(user.id) };
}

/** Bind an anonymous visitor on a public page. */
export function bindVisitor(visitorId: string): ChatActor {
  return { kind: "visitor", id: cleanId(visitorId) };
}

/**
 * Default identity for a turn. A session user always wins, on an app page and
 * on a public page. An app page with no session user throws. A public page
 * with no session user uses `visitorId`.
 */
export function actorFromSession(
  session: SessionIdentity | null | undefined,
  options?: { audience?: ChatAudience; visitorId?: string },
): ChatActor {
  const audience = options?.audience ?? "app";
  const userId = session?.userId?.trim();
  if (userId) {
    return bindAppUser({ id: userId, displayName: session?.displayName });
  }
  if (audience === "app") throw new ChatActorRequiredError();
  return bindVisitor(options?.visitorId ?? "");
}

/** Refuse a visitor on an app surface, and refuse a blank id on either surface. */
export function assertActor(audience: ChatAudience, actor: ChatActor): void {
  if (!actor.id.trim() || actor.id.length > ID_MAX || hasControl(actor.id)) {
    throw new ChatActorRequiredError();
  }
  if (audience === "app" && actor.kind !== "user") throw new ChatActorRequiredError();
}
