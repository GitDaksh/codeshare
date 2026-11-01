import { describe, expect, it } from "vitest";
import { canEdit, publicRoom, roleOf } from "../../src/lib/access";
import { Room } from "../../src/models/Room";

function room() {
  return new Room({
    name: "Graphs",
    ownerId: "user_owner",
    language: "python",
    members: ["user_owner", "user_editor", "user_viewer"],
    viewers: ["user_viewer"],
  });
}

describe("room roles", () => {
  it("gives the owner, members and viewers the right role, and strangers none", () => {
    const r = room();
    expect(roleOf(r, "user_owner")).toBe("owner");
    expect(roleOf(r, "user_editor")).toBe("editor");
    expect(roleOf(r, "user_viewer")).toBe("viewer");
    expect(roleOf(r, "user_stranger")).toBeNull();
  });

  it("lets only owners and editors edit", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit(null)).toBe(false);
    expect(canEdit(undefined)).toBe(false);
  });

  it("shows invite links only to people who may invite, and never the member lists", () => {
    const r = room();
    const forOwner = publicRoom(r, "owner") as Record<string, unknown>;
    const forViewer = publicRoom(r, "viewer") as Record<string, unknown>;
    expect(forOwner.invites).toEqual({ edit: r.inviteCode, view: r.viewInviteCode });
    expect(forViewer.invites).toBeUndefined();
    for (const shown of [forOwner, forViewer]) {
      expect(shown.members).toBeUndefined();
      expect(shown.viewers).toBeUndefined();
      expect(shown.inviteCode).toBeUndefined();
      expect(shown.viewInviteCode).toBeUndefined();
    }
  });
});
