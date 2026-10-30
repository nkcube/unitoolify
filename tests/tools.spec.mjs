import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Don't let the consent banner intercept clicks during tests.
  await page.addInitScript(() => localStorage.setItem("ut-consent", "denied"));
  await page.route("https://pagead2.googlesyndication.com/**", (route) => {
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
});

/** Live formatting is debounced (200 ms), so let it settle before reading. */
async function output(page, selector = "#outputText") {
  await page.waitForTimeout(320);
  return page.locator(selector).inputValue();
}

test.describe("Base64", () => {
  test("encodes and decodes a 300 KB payload without crashing", async ({
    page,
  }) => {
    await page.goto("/base64encode/");
    const payload = "a".repeat(300 * 1000);
    await page.locator("#inputText").fill(payload);
    await expect
      .poll(
        async () => (await page.locator("#outputText").inputValue()).length,
        {
          timeout: 20000,
        },
      )
      .toBe(400000);
    const encoded = await page.locator("#outputText").inputValue();

    await page.goto("/base64decode/");
    await page.locator("#inputText").fill(encoded);
    await expect(page.locator("#outputText")).toHaveValue(payload, {
      timeout: 15000,
    });
  });

  test("honours URL-safe and MIME options", async ({ page }) => {
    await page.goto("/base64encode/");
    await page.locator("#inputText").fill("subjects?_d=1");
    await page.locator("#urlSafe").check();
    const urlSafe = await page.locator("#outputText").inputValue();
    expect(urlSafe).not.toMatch(/[+/=]/);

    await page.locator("#urlSafe").uncheck();
    await page.locator("#splitLines").check();
    await page.locator("#inputText").fill("x".repeat(200));
    const chunked = await output(page);
    // A textarea normalises CRLF to LF, so split on newlines here.
    expect(chunked.split("\n")[0].length).toBe(76);
    expect(chunked.split("\n")).toHaveLength(4);
  });

  test("decodes binary payloads and reports them as non-text", async ({
    page,
  }) => {
    await page.goto("/base64decode/");
    await page.locator("#inputText").fill("/w=="); // 0xFF, invalid UTF-8
    await expect(page.locator("#outputText")).toHaveValue(/Binary data/);
  });
});

test.describe("JSON formatter", () => {
  test("tab indentation produces a real tab", async ({ page }) => {
    await page.goto("/prettify-json/");
    await page.locator("#inputText").fill('{"a":{"b":1}}');
    await page.locator("#indentSpace").selectOption("tab");
    const out = await output(page);
    expect(out).toContain('\n\t"a"');
    expect(out).not.toContain("\\t");
  });

  test("invalid JSON reports a line and column", async ({ page }) => {
    await page.goto("/prettify-json/");
    await page.locator("#inputText").fill('{\n  "a": 1,\n}');
    await expect(page.locator("#errorMsg")).toContainText(
      /Invalid JSON \(line 3/,
    );
  });

  test("switching indentation reformats an existing result", async ({
    page,
  }) => {
    await page.goto("/prettify-json/");
    await page.locator("#inputText").fill('{"a":1}');
    await page.locator("#indentSpace").selectOption("4");
    await expect(page.locator("#outputText")).toHaveValue('{\n    "a": 1\n}');
  });
});

test.describe("YAML", () => {
  test("YAML to JSON keeps dates as strings", async ({ page }) => {
    await page.goto("/convert-yaml-to-json/");
    await page.locator("#inputText").fill("date: 2024-01-01\ncount: 2");
    const out = await output(page);
    expect(JSON.parse(out)).toEqual({ date: "2024-01-01", count: 2 });
  });

  test("YAML to JSON handles multiple documents", async ({ page }) => {
    await page.goto("/convert-yaml-to-json/");
    await page.locator("#inputText").fill("a: 1\n---\nb: 2");
    const out = await output(page);
    expect(JSON.parse(out)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("YAML to JSON tab option emits a real tab", async ({ page }) => {
    await page.goto("/convert-yaml-to-json/");
    await page.locator("#inputText").fill("a:\n  b: 1");
    await page.locator("#indentSpace").selectOption("tab");
    const out = await output(page);
    expect(out).toContain('\n\t"a"');
    expect(out).not.toContain("\\t");
  });

  test("JSON to YAML does not fold long values", async ({ page }) => {
    await page.goto("/convert-json-to-yaml/");
    const long = "word ".repeat(40).trim();
    await page.locator("#inputText").fill(JSON.stringify({ note: long }));
    const out = await output(page);
    expect(out).toContain(long);
  });

  test("YAML formatter reports syntax errors", async ({ page }) => {
    await page.goto("/prettify-yaml/");
    await page.locator("#inputText").fill("a:\n  - b\n c: 1");
    await expect(page.locator("#errorMsg")).toContainText(/Invalid YAML/);
  });
});

test.describe("URL codecs", () => {
  test("encodes in component, strict, URI and form modes", async ({ page }) => {
    await page.goto("/url-encode-string/");
    await page.locator("#inputText").fill("a b!c/d?e=1&f=2");

    await page.locator("#mode").selectOption("component");
    const component = await page.locator("#outputText").inputValue();
    expect(component).toBe("a%20b!c%2Fd%3Fe%3D1%26f%3D2");

    await page.locator("#mode").selectOption("strict");
    expect(await page.locator("#outputText").inputValue()).toContain("b%21c");

    await page.locator("#mode").selectOption("uri");
    expect(await page.locator("#outputText").inputValue()).toBe(
      "a%20b!c/d?e=1&f=2",
    );

    await page.locator("#mode").selectOption("form");
    expect(await page.locator("#outputText").inputValue()).toContain("a+b");
  });

  test("decodes + as space and survives malformed escapes", async ({
    page,
  }) => {
    await page.goto("/url-decode-string/");
    await page.locator("#inputText").fill("hello+world%21%ZZ");
    await expect(page.locator("#outputText")).toHaveValue("hello world!%ZZ");
  });
});

test.describe("HTML codecs", () => {
  test("escape mode covers attributes and non-ASCII", async ({ page }) => {
    await page.goto("/html-encode-string/");
    await page.locator("#inputText").fill('<a href="x">café</a>');

    const text = await page.locator("#outputText").inputValue();
    expect(text).toBe('&lt;a href="x"&gt;café&lt;/a&gt;');

    await page.locator("#mode").selectOption("attribute");
    expect(await page.locator("#outputText").inputValue()).toContain(
      "&quot;x&quot;",
    );

    await page.locator("#mode").selectOption("nonascii");
    expect(await page.locator("#outputText").inputValue()).toContain(
      "caf&#233;",
    );
  });

  test("decodes entities without breaking on a literal closing tag", async ({
    page,
  }) => {
    await page.goto("/html-decode-string/");
    await page
      .locator("#inputText")
      .fill("&lt;p&gt;hi&lt;/p&gt; &amp;amp; &#128512;");
    await expect(page.locator("#outputText")).toHaveValue("<p>hi</p> &amp; 😀");
  });
});

test.describe("UUID generator", () => {
  test("generates 10,000 v4 UUIDs", async ({ page }) => {
    await page.goto("/uuid-generator/");
    await page.locator("#uuidCount").fill("10000");
    await page.locator("#generateBtn").click();
    const lines = (await page.locator("#outputText").inputValue()).split("\n");
    expect(lines).toHaveLength(10000);
    expect(lines[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  test("v1 uses a random node, uppercase and no hyphens apply", async ({
    page,
  }) => {
    await page.goto("/uuid-generator/");
    await page.locator('input[name="uuidVersion"][value="1"]').check();
    await page.locator("#uuidCount").fill("50");
    await page.locator("#uppercase").check();
    await page.locator("#noHyphens").check();
    await page.locator("#generateBtn").click();
    const lines = (await page.locator("#outputText").inputValue()).split("\n");
    expect(lines[0]).toMatch(/^[0-9A-F]{12}1[0-9A-F]{3}[89AB][0-9A-F]{15}$/);
    expect(new Set(lines).size).toBe(50);
  });
});

test.describe("Docker converters", () => {
  test("docker run becomes a compose service", async ({ page }) => {
    await page.goto("/composerize/");
    await page
      .locator("#inputText")
      .fill("docker run -d -p 8080:80 --name web nginx");
    await expect(page.locator("#outputText")).toHaveValue(/services:/, {
      timeout: 15000,
    });
    const out = await page.locator("#outputText").inputValue();
    expect(out).toContain("image: nginx");
    expect(out).toContain("8080:80");
  });

  test("compose becomes docker run", async ({ page }) => {
    await page.goto("/decomposerize/");
    await page
      .locator("#inputText")
      .fill(
        'services:\n  web:\n    image: nginx\n    ports:\n      - "8080:80"',
      );
    await expect(page.locator("#outputText")).toHaveValue(/docker run/, {
      timeout: 15000,
    });
    expect(await page.locator("#outputText").inputValue()).toContain(
      "-p 8080:80",
    );
    // One command is one line — the readout must not say "1 lines".
    await expect(page.locator("#meta")).toHaveText("1 line");
  });

  test("live mode can be switched off and the button still converts", async ({
    page,
  }) => {
    await page.goto("/composerize/");
    await page.locator("#liveMode").uncheck();
    await page.locator("#inputText").fill("docker run -p 8080:80 nginx");
    await page.waitForTimeout(500);
    await expect(page.locator("#outputText")).toHaveValue("");

    await page.locator("#convertBtn").click();
    await expect(page.locator("#outputText")).toHaveValue(/image: nginx/, {
      timeout: 15000,
    });
    await expect(page.locator("#meta")).toHaveText(/\d+ lines?$/);
  });
});

test.describe("Bookmark separator", () => {
  test("switches orientation and mints unique fragments", async ({ page }) => {
    await page.goto("/bookmark-separator/");
    await expect(page.locator("#dragLinkVert")).toHaveAttribute(
      "href",
      /#bookmark-separator-vert-/,
    );
    await page.locator("#tab-horz").click();
    await expect(page.locator("#panel-horz")).toBeVisible();
    await expect(page.locator("#panel-vert")).toBeHidden();
    const first = await page.locator("#dragLinkHorz").getAttribute("href");
    await page
      .locator("#dragLinkHorz")
      .dispatchEvent("mousedown", { button: 0 });
    const second = await page.locator("#dragLinkHorz").getAttribute("href");
    expect(second).not.toBe(first);
  });
});

test.describe("Clipboard", () => {
  test("copy writes the output and confirms", async ({ page }) => {
    await page.goto("/base64encode/");
    await page.locator("#inputText").fill("hi");
    await page.locator("#copyBtn").click();
    await expect(page.locator("#copyBtn")).toHaveText("Copied!");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toBe("aGk=");
    await expect(page.locator("#copyBtn")).toHaveText("Copy", {
      timeout: 4000,
    });
  });
});
