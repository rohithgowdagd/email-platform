import { describe, it, expect } from "vitest";

import {
  type ConditionNode,
  evaluateConditions,
  parseConditions,
  parseFormValue,
  resolvePath,
} from "./conditions";

const PAYLOAD = {
  plan: "pro",
  age: 25,
  tags: ["a", "b"],
  name: "alex",
  maybe: null,
  user: { email: "a@b.com" },
};

describe("resolvePath", () => {
  it("returns the whole payload for an empty expression", () => {
    expect(resolvePath(PAYLOAD, "")).toBe(PAYLOAD);
  });

  it("returns the whole payload for '$' alone", () => {
    expect(resolvePath(PAYLOAD, "$")).toBe(PAYLOAD);
  });

  it("strips the '$.' prefix before descending", () => {
    expect(resolvePath(PAYLOAD, "$.plan")).toBe("pro");
  });

  it("descends through dot-notation paths", () => {
    expect(resolvePath(PAYLOAD, "user.email")).toBe("a@b.com");
  });

  it("returns undefined for a missing leaf key", () => {
    expect(resolvePath(PAYLOAD, "user.phone")).toBeUndefined();
  });

  it("returns undefined when descending into a non-object", () => {
    // age is a number; trying to descend through it yields undefined,
    // not a thrown error
    expect(resolvePath(PAYLOAD, "age.years")).toBeUndefined();
  });
});

describe("evaluateConditions — null", () => {
  it("returns true when the condition tree is null (always fire)", () => {
    expect(evaluateConditions(null, PAYLOAD)).toBe(true);
  });
});

describe("evaluateConditions — leaf operators", () => {
  it("eq returns true on strict equality", () => {
    expect(
      evaluateConditions({ op: "eq", path: "plan", value: "pro" }, PAYLOAD),
    ).toBe(true);
  });

  it("eq returns false on mismatch", () => {
    expect(
      evaluateConditions({ op: "eq", path: "plan", value: "free" }, PAYLOAD),
    ).toBe(false);
  });

  it("neq is the inverse of eq", () => {
    expect(
      evaluateConditions({ op: "neq", path: "plan", value: "free" }, PAYLOAD),
    ).toBe(true);
    expect(
      evaluateConditions({ op: "neq", path: "plan", value: "pro" }, PAYLOAD),
    ).toBe(false);
  });

  it("gt / gte / lt / lte compare numbers", () => {
    expect(
      evaluateConditions({ op: "gt", path: "age", value: 18 }, PAYLOAD),
    ).toBe(true);
    expect(
      evaluateConditions({ op: "gte", path: "age", value: 25 }, PAYLOAD),
    ).toBe(true);
    expect(
      evaluateConditions({ op: "lt", path: "age", value: 18 }, PAYLOAD),
    ).toBe(false);
    expect(
      evaluateConditions({ op: "lte", path: "age", value: 25 }, PAYLOAD),
    ).toBe(true);
  });

  it("gt returns false (no error) when either side isn't a number", () => {
    expect(
      evaluateConditions({ op: "gt", path: "plan", value: 18 }, PAYLOAD),
    ).toBe(false);
    expect(
      evaluateConditions({ op: "gt", path: "age", value: "old" }, PAYLOAD),
    ).toBe(false);
  });

  it("in returns true when the resolved value is in the array", () => {
    expect(
      evaluateConditions(
        { op: "in", path: "plan", value: ["pro", "team"] },
        PAYLOAD,
      ),
    ).toBe(true);
  });

  it("in returns false when the resolved value isn't in the array", () => {
    expect(
      evaluateConditions(
        { op: "in", path: "plan", value: ["free", "starter"] },
        PAYLOAD,
      ),
    ).toBe(false);
  });

  it("in returns false when value isn't an array (defensive)", () => {
    expect(
      evaluateConditions(
        // intentional shape mismatch — value should be an array
        { op: "in", path: "plan", value: "pro" as unknown as unknown[] },
        PAYLOAD,
      ),
    ).toBe(false);
  });

  it("contains finds a substring inside a string", () => {
    expect(
      evaluateConditions(
        { op: "contains", path: "name", value: "le" },
        PAYLOAD,
      ),
    ).toBe(true);
  });

  it("contains finds an element inside an array", () => {
    expect(
      evaluateConditions(
        { op: "contains", path: "tags", value: "a" },
        PAYLOAD,
      ),
    ).toBe(true);
  });

  it("contains returns false when the needle isn't present", () => {
    expect(
      evaluateConditions(
        { op: "contains", path: "tags", value: "z" },
        PAYLOAD,
      ),
    ).toBe(false);
  });

  it("exists is true for a present key", () => {
    expect(evaluateConditions({ op: "exists", path: "plan" }, PAYLOAD)).toBe(
      true,
    );
  });

  it("exists is false for a missing key", () => {
    expect(evaluateConditions({ op: "exists", path: "phone" }, PAYLOAD)).toBe(
      false,
    );
  });

  it("exists is true for a key whose value is null (documents !== undefined semantics)", () => {
    // Intentional: 'exists' only checks that the path resolves to something
    // other than undefined. A null value still counts as "exists" — null is a
    // declared value, missing is the absence of one.
    expect(evaluateConditions({ op: "exists", path: "maybe" }, PAYLOAD)).toBe(
      true,
    );
  });
});

describe("evaluateConditions — boolean composition", () => {
  const T: ConditionNode = { op: "eq", path: "plan", value: "pro" };
  const F: ConditionNode = { op: "eq", path: "plan", value: "free" };

  it("and is true when every arg is true", () => {
    expect(evaluateConditions({ op: "and", args: [T, T] }, PAYLOAD)).toBe(true);
  });

  it("and is false when any arg is false", () => {
    expect(evaluateConditions({ op: "and", args: [T, F] }, PAYLOAD)).toBe(
      false,
    );
  });

  it("and of zero args is vacuously true ([].every === true)", () => {
    expect(evaluateConditions({ op: "and", args: [] }, PAYLOAD)).toBe(true);
  });

  it("or is true when any arg is true", () => {
    expect(evaluateConditions({ op: "or", args: [F, T] }, PAYLOAD)).toBe(true);
  });

  it("or is false when every arg is false", () => {
    expect(evaluateConditions({ op: "or", args: [F, F] }, PAYLOAD)).toBe(false);
  });

  it("or of zero args is vacuously false ([].some === false)", () => {
    expect(evaluateConditions({ op: "or", args: [] }, PAYLOAD)).toBe(false);
  });

  it("not inverts its argument", () => {
    expect(evaluateConditions({ op: "not", arg: T }, PAYLOAD)).toBe(false);
    expect(evaluateConditions({ op: "not", arg: F }, PAYLOAD)).toBe(true);
  });

  it("evaluates a deeply nested tree correctly", () => {
    // (plan === "pro") AND ( (tags contains "a") OR NOT exists("phone") )
    const tree: ConditionNode = {
      op: "and",
      args: [
        { op: "eq", path: "plan", value: "pro" },
        {
          op: "or",
          args: [
            { op: "contains", path: "tags", value: "a" },
            { op: "not", arg: { op: "exists", path: "phone" } },
          ],
        },
      ],
    };
    expect(evaluateConditions(tree, PAYLOAD)).toBe(true);
  });
});

describe("parseConditions", () => {
  it("returns null for null input", () => {
    expect(parseConditions(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseConditions(undefined)).toBeNull();
  });

  it("returns null for non-object input (e.g. a string)", () => {
    expect(parseConditions("eq")).toBeNull();
  });

  it("passes through a well-shaped object", () => {
    const node = { op: "eq", path: "plan", value: "pro" };
    expect(parseConditions(node)).toBe(node);
  });
});

describe("parseFormValue", () => {
  it("returns empty string for empty input", () => {
    expect(parseFormValue("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(parseFormValue("   ")).toBe("");
  });

  it("parses a JSON number", () => {
    expect(parseFormValue("123")).toBe(123);
  });

  it("parses a JSON array", () => {
    expect(parseFormValue("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("parses a JSON object", () => {
    expect(parseFormValue('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns a raw unquoted string as-is when JSON.parse fails", () => {
    // 'pro' is not valid JSON (would need to be '"pro"'). Users shouldn't
    // have to think about quoting in a UI text input, so we fall back to the
    // trimmed raw string.
    expect(parseFormValue("pro")).toBe("pro");
  });

  it("trims leading and trailing whitespace", () => {
    expect(parseFormValue("  pro  ")).toBe("pro");
  });
});
