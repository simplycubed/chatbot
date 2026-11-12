import { describe, expect, it } from "vitest";
import { actorFromSession, assertActor, bindAppUser, bindVisitor } from "../src/actor.js";
import { ChatActorRequiredError } from "../src/errors.js";

describe("bindAppUser", () => {
  it("requires an id", () => {
    expect(() => bindAppUser(null)).toThrow(ChatActorRequiredError);
    expect(() => bindAppUser(undefined)).toThrow(ChatActorRequiredError);
    expect(() => bindAppUser({ id: "   " })).toThrow(ChatActorRequiredError);
    expect(() => bindAppUser({ id: "x".repeat(129) })).toThrow(ChatActorRequiredError);
  });

  it("trims the id and keeps a display name", () => {
    expect(bindAppUser({ id: " user-1 ", displayName: " Ada " })).toEqual({
      kind: "user",
      id: "user-1",
      displayName: "Ada",
    });
  });

  it("rejects an id with a control character and flattens a display name", () => {
    expect(() => bindAppUser({ id: "user-1\nid: other" })).toThrow(ChatActorRequiredError);
    expect(bindAppUser({ id: "user-1", displayName: "Ada\nid: other" })).toEqual({
      kind: "user",
      id: "user-1",
      displayName: "Ada id: other",
    });
  });

  it("omits a blank display name and caps a long one", () => {
    expect(bindAppUser({ id: "user-1", displayName: "  " })).toEqual({
      kind: "user",
      id: "user-1",
    });
    const actor = bindAppUser({ id: "user-1", displayName: "n".repeat(100) });
    expect(actor.kind === "user" && actor.displayName?.length).toBe(80);
  });
});

describe("bindVisitor", () => {
  it("requires a visitor id", () => {
    expect(() => bindVisitor("")).toThrow(ChatActorRequiredError);
    expect(bindVisitor(" vis-1 ")).toEqual({ kind: "visitor", id: "vis-1" });
  });
});

describe("actorFromSession", () => {
  it("uses the session user by default on an app page", () => {
    expect(actorFromSession({ userId: "user-1", displayName: "Ada" })).toEqual({
      kind: "user",
      id: "user-1",
      displayName: "Ada",
    });
  });

  it("throws on an app page when the session has no user", () => {
    expect(() => actorFromSession(null)).toThrow(ChatActorRequiredError);
    expect(() => actorFromSession({ userId: "  " })).toThrow(ChatActorRequiredError);
  });

  it("prefers the session user on a public page", () => {
    expect(
      actorFromSession({ userId: "user-1" }, { audience: "public", visitorId: "vis-1" }),
    ).toEqual({ kind: "user", id: "user-1" });
  });

  it("uses the visitor id on a public page with no session user", () => {
    expect(actorFromSession(null, { audience: "public", visitorId: "vis-1" })).toEqual({
      kind: "visitor",
      id: "vis-1",
    });
  });

  it("rejects a public page that also has no visitor id", () => {
    expect(() => actorFromSession(null, { audience: "public" })).toThrow(ChatActorRequiredError);
  });
});

describe("assertActor", () => {
  it("rejects a visitor on an app page and a blank id", () => {
    expect(() => assertActor("app", { kind: "visitor", id: "vis-1" })).toThrow(
      ChatActorRequiredError,
    );
    expect(() => assertActor("public", { kind: "visitor", id: " " })).toThrow(
      ChatActorRequiredError,
    );
    expect(() => assertActor("public", { kind: "user", id: "x".repeat(129) })).toThrow(
      ChatActorRequiredError,
    );
    expect(() => assertActor("app", { kind: "user", id: "user-1\nid: other" })).toThrow(
      ChatActorRequiredError,
    );
  });

  it("accepts a user on an app page and a visitor on a public page", () => {
    expect(() => assertActor("app", { kind: "user", id: "user-1" })).not.toThrow();
    expect(() => assertActor("public", { kind: "visitor", id: "vis-1" })).not.toThrow();
  });
});
