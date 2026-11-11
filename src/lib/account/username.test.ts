import { describe, expect, it } from "vitest";
import { usernameError } from "./username";

describe("username rule", () => {
  it("accepts 3-20 letters, numbers, underscores", () => expect(usernameError("Rook_42")).toBeNull());
  it("rejects names shorter than 3", () => expect(usernameError("ab")).not.toBeNull());
  it("rejects names longer than 20", () => expect(usernameError("a".repeat(21))).not.toBeNull());
  it("rejects spaces and symbols", () => expect(usernameError("rook knight!")).not.toBeNull());
});
