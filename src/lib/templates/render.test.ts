import { describe, it, expect } from "vitest";

import {
  autoParagraph,
  derivePlaceholders,
  extractReferences,
  parsePlaceholders,
  renderTemplate,
  setByPath,
  slugify,
  validatePlaceholders,
} from "./render";

describe("extractReferences", () => {
  it("pulls a single {{name}} reference out of plain text", () => {
    expect([...extractReferences("Hello {{user}}")]).toEqual(["user"]);
  });

  it("supports dot-notation paths", () => {
    expect([...extractReferences("Hi {{user.name}}")]).toEqual(["user.name"]);
  });

  it("dedupes repeated references", () => {
    const refs = extractReferences("{{x}} and {{x}} again");
    expect(refs.size).toBe(1);
    expect([...refs]).toEqual(["x"]);
  });

  it("tolerates whitespace inside the braces", () => {
    expect([...extractReferences("Hi {{  user.name  }}")]).toEqual([
      "user.name",
    ]);
  });

  it("returns an empty set for text with no placeholders", () => {
    expect(extractReferences("just plain text").size).toBe(0);
  });

  it("ignores empty {{ }} braces", () => {
    expect(extractReferences("noise {{}} more noise").size).toBe(0);
  });

  it("ignores kebab-case identifiers (regex only matches word chars + dots)", () => {
    expect(extractReferences("{{user-name}}").size).toBe(0);
  });
});

describe("derivePlaceholders", () => {
  it("returns placeholders sorted alphabetically", () => {
    const result = derivePlaceholders({
      subject: "{{c}}",
      bodyHtml: "{{a}} {{b}}",
    });
    expect(result.map((p) => p.name)).toEqual(["a", "b", "c"]);
  });

  it("dedupes across subject and body", () => {
    const result = derivePlaceholders({
      subject: "{{user.name}}",
      bodyHtml: "<p>Hi {{user.name}}</p>",
    });
    expect(result.map((p) => p.name)).toEqual(["user.name"]);
  });

  it("returns an empty array when there are no references", () => {
    expect(derivePlaceholders({ subject: "", bodyHtml: "" })).toEqual([]);
  });

  it("marks every derived placeholder as not required with empty sample", () => {
    const [first] = derivePlaceholders({
      subject: "{{x}}",
      bodyHtml: "",
    });
    expect(first).toEqual({ name: "x", required: false, sample: "" });
  });
});

describe("autoParagraph", () => {
  it("wraps a single line of plain text in <p>", () => {
    expect(autoParagraph("Hello world")).toBe("<p>Hello world</p>");
  });

  it("splits blank-line-separated paragraphs into multiple <p>s", () => {
    expect(autoParagraph("First.\n\nSecond.")).toBe(
      "<p>First.</p>\n<p>Second.</p>",
    );
  });

  it("converts single newlines inside a paragraph to <br>", () => {
    expect(autoParagraph("Line one\nLine two")).toBe(
      "<p>Line one<br>Line two</p>",
    );
  });

  it("leaves input alone when any HTML tag is present", () => {
    const html = "<p>Already <strong>tagged</strong></p>";
    expect(autoParagraph(html)).toBe(html);
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(autoParagraph("   \n\n  ")).toBe("");
  });
});

describe("setByPath", () => {
  it("sets a shallow key", () => {
    const target: Record<string, unknown> = {};
    setByPath(target, "name", "Alex");
    expect(target).toEqual({ name: "Alex" });
  });

  it("creates intermediate objects for a nested path", () => {
    const target: Record<string, unknown> = {};
    setByPath(target, "user.address.city", "NYC");
    expect(target).toEqual({ user: { address: { city: "NYC" } } });
  });

  it("overrides a primitive when traversing through it", () => {
    const target: Record<string, unknown> = { user: "old" };
    setByPath(target, "user.name", "Alex");
    expect(target).toEqual({ user: { name: "Alex" } });
  });

  it("overrides an array when traversing through it (arrays aren't treated as containers)", () => {
    const target: Record<string, unknown> = { items: [1, 2, 3] };
    setByPath(target, "items.count", 3);
    expect(target).toEqual({ items: { count: 3 } });
  });

  it("preserves sibling keys when setting a nested value", () => {
    const target: Record<string, unknown> = {
      user: { name: "Alex", email: "a@b.com" },
    };
    setByPath(target, "user.name", "Bea");
    expect(target).toEqual({ user: { name: "Bea", email: "a@b.com" } });
  });
});

describe("slugify", () => {
  it("lowercases and converts spaces to hyphens", () => {
    expect(slugify("Welcome Email")).toBe("welcome-email");
  });

  it("strips special characters", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("collapses consecutive hyphens", () => {
    expect(slugify("multi---hyphen")).toBe("multi-hyphen");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("---trim me---")).toBe("trim-me");
  });

  it("truncates to 80 characters", () => {
    expect(slugify("a".repeat(100))).toHaveLength(80);
  });
});

describe("parsePlaceholders", () => {
  it("returns [] for non-array input", () => {
    expect(parsePlaceholders(null)).toEqual([]);
    expect(parsePlaceholders("not an array")).toEqual([]);
    expect(parsePlaceholders({ name: "x" })).toEqual([]);
  });

  it("drops entries without a string name", () => {
    expect(parsePlaceholders([{ name: 1 }, { foo: "bar" }, null])).toEqual([]);
  });

  it("coerces optional fields with safe defaults", () => {
    expect(parsePlaceholders([{ name: "x" }])).toEqual([
      { name: "x", type: undefined, required: false, sample: undefined },
    ]);
  });

  it("keeps valid entries when mixed with invalid ones", () => {
    const result = parsePlaceholders([
      { name: "good", required: true },
      { name: 42 },
      { name: "also-good", sample: "demo" },
    ]);
    expect(result.map((p) => p.name)).toEqual(["good", "also-good"]);
    expect(result[0].required).toBe(true);
    expect(result[1].sample).toBe("demo");
  });
});

describe("validatePlaceholders", () => {
  it("returns empty arrays when body and declarations align", () => {
    const result = validatePlaceholders({
      subject: "Hi {{user.name}}",
      bodyHtml: "<p>{{plan}}</p>",
      bodyText: null,
      placeholders: [
        { name: "user.name", required: false },
        { name: "plan", required: false },
      ],
    });
    expect(result).toEqual({ undeclared: [], unused: [] });
  });

  it("detects an undeclared reference in the body", () => {
    const { undeclared } = validatePlaceholders({
      subject: "Hi",
      bodyHtml: "<p>{{order.total}}</p>",
      bodyText: null,
      placeholders: [],
    });
    expect(undeclared).toEqual(["order.total"]);
  });

  it("detects an undeclared reference in the subject", () => {
    const { undeclared } = validatePlaceholders({
      subject: "Order #{{order.id}}",
      bodyHtml: "<p>Thanks!</p>",
      bodyText: null,
      placeholders: [],
    });
    expect(undeclared).toEqual(["order.id"]);
  });

  it("detects an undeclared reference in body_text", () => {
    const { undeclared } = validatePlaceholders({
      subject: "Hi",
      bodyHtml: "<p>Welcome</p>",
      bodyText: "Hello {{customer.code}}",
      placeholders: [],
    });
    expect(undeclared).toEqual(["customer.code"]);
  });

  it("reports declared-but-unused placeholders as unused", () => {
    const { unused } = validatePlaceholders({
      subject: "Hi",
      bodyHtml: "<p>Welcome</p>",
      bodyText: null,
      placeholders: [{ name: "ghost", required: false }],
    });
    expect(unused).toEqual(["ghost"]);
  });

  it("returns both lists when there are issues on both sides", () => {
    const result = validatePlaceholders({
      subject: "Hi {{new_ref}}",
      bodyHtml: "<p>body</p>",
      bodyText: null,
      placeholders: [{ name: "stale", required: false }],
    });
    expect(result).toEqual({ undeclared: ["new_ref"], unused: ["stale"] });
  });

  it("sorts both arrays alphabetically for stable output", () => {
    const { undeclared } = validatePlaceholders({
      subject: "{{c}} {{a}} {{b}}",
      bodyHtml: "",
      bodyText: null,
      placeholders: [],
    });
    expect(undeclared).toEqual(["a", "b", "c"]);
  });

  it("treats bodyText=null as an empty string (no false positives)", () => {
    const result = validatePlaceholders({
      subject: "Hi",
      bodyHtml: "<p>plain</p>",
      bodyText: null,
      placeholders: [],
    });
    expect(result).toEqual({ undeclared: [], unused: [] });
  });
});

describe("renderTemplate", () => {
  it("substitutes a simple placeholder in subject and body", () => {
    const result = renderTemplate({
      subject: "Hi {{name}}",
      bodyHtml: "<p>Hello {{name}}</p>",
      bodyText: null,
      placeholders: [],
      values: { name: "Alex" },
    });
    expect(result).toEqual({
      ok: true,
      subject: "Hi Alex",
      html: "<p>Hello Alex</p>",
      text: "",
    });
  });

  it("resolves nested dot-notation paths", () => {
    const result = renderTemplate({
      subject: "Hi {{user.name}}",
      bodyHtml: "",
      bodyText: null,
      placeholders: [],
      values: { user: { name: "Bea" } },
    });
    expect(result.ok && result.subject).toBe("Hi Bea");
  });

  it("renders missing optional placeholders as empty strings", () => {
    const result = renderTemplate({
      subject: "Hi {{missing}}!",
      bodyHtml: "",
      bodyText: null,
      placeholders: [],
      values: {},
    });
    expect(result.ok && result.subject).toBe("Hi !");
  });

  it("returns {ok:false, missing} when a required placeholder is absent", () => {
    const result = renderTemplate({
      subject: "Hi",
      bodyHtml: "<p>{{plan}}</p>",
      bodyText: null,
      placeholders: [{ name: "plan", required: true }],
      values: {},
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.missing).toEqual(["plan"]);
  });

  it("treats an empty string as a missing required value", () => {
    const result = renderTemplate({
      subject: "Hi",
      bodyHtml: "<p>{{plan}}</p>",
      bodyText: null,
      placeholders: [{ name: "plan", required: true }],
      values: { plan: "" },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.missing).toEqual(["plan"]);
  });

  it("renders body_text when provided", () => {
    const result = renderTemplate({
      subject: "Hi",
      bodyHtml: "",
      bodyText: "Plain {{x}}",
      placeholders: [],
      values: { x: "ok" },
    });
    expect(result.ok && result.text).toBe("Plain ok");
  });

  it("returns text='' when bodyText is null", () => {
    const result = renderTemplate({
      subject: "Hi",
      bodyHtml: "",
      bodyText: null,
      placeholders: [],
      values: {},
    });
    expect(result.ok && result.text).toBe("");
  });
});
