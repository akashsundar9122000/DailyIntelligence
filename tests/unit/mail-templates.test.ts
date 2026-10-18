import { describe, expect, it } from "vitest";

import { brand } from "@/config/brand";
import { renderMail } from "@/lib/mail/templates";

describe("renderMail", () => {
  it("escapes everything it is given, so a name cannot inject markup", () => {
    const { html } = renderMail({
      subject: "Hello",
      heading: "<script>alert(1)</script>",
      paragraphs: ['Hi <b>"you"</b> & co'],
      action: { label: "Open", url: 'https://example.in/?a=1&b="x"' },
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a=1&amp;b=&quot;x&quot;");
  });

  it("carries the same content as plain text, for clients that show only that", () => {
    const { text } = renderMail({
      subject: "Your code",
      heading: "Confirm your email",
      paragraphs: ["Enter this code to finish signing up."],
      code: "482913",
      footnote: "If you did not ask for this, ignore this message.",
    });
    expect(text).toContain("Confirm your email");
    expect(text).toContain("482913");
    expect(text).toContain("ignore this message");
  });

  it("signs with the configured brand name", () => {
    const rendered = renderMail({ subject: "s", heading: "h", paragraphs: [] });
    expect(rendered.html).toContain(brand.name);
    expect(rendered.text.startsWith(brand.name)).toBe(true);
  });
});
