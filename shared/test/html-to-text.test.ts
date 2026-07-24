import { describe, expect, it } from "vitest";
import { htmlToText } from "../src/html-to-text.js";

describe("htmlToText", () => {
  it("converts <br> tags to newlines", () => {
    expect(htmlToText("line one<br>line two<br/>line three")).toBe("line one\nline two\nline three");
  });

  it("converts <p> tags to paragraph breaks", () => {
    expect(htmlToText("<p>first</p><p>second</p>")).toBe("first\n\nsecond");
  });

  it("converts <div> tags to newlines", () => {
    expect(htmlToText("<div>first</div><div>second</div>")).toBe("first\nsecond");
  });

  it("converts <li> items to '- ' prefixed lines", () => {
    expect(htmlToText("<ul><li>one</li><li>two</li></ul>")).toBe("- one\n- two");
  });

  it("decodes common entities", () => {
    expect(htmlToText("Tom &amp; Jerry &lt;3 &quot;fun&quot; &#39;times&#39;&nbsp;here")).toBe(
      'Tom & Jerry <3 "fun" \'times\' here',
    );
  });

  it("strips remaining unknown tags", () => {
    expect(htmlToText("<span>hello</span> <strong>world</strong>")).toBe("hello world");
  });

  it("collapses 3+ newlines to 2", () => {
    expect(htmlToText("a<br><br><br><br>b")).toBe("a\n\nb");
  });

  it("trims the result", () => {
    expect(htmlToText("<p>  padded  </p>")).toBe("padded");
  });

  it("returns empty string for null or undefined", () => {
    expect(htmlToText(null)).toBe("");
    expect(htmlToText(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });
});
