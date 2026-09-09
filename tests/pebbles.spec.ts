// SPDX-License-Identifier: MIT
import { expect, test, type Page } from "@playwright/test";

const PUBLIC_KEY = "a1".repeat(32);

/** Install a browser signer fixture; signing must never be requested by this preview. */
async function installSigner(page: Page, result: string | null): Promise<void> {
  await page.addInitScript((key) => {
    Object.defineProperty(window, "nostr", {
      value: {
        getPublicKey: async () => {
          if (key === null) throw new Error("User declined");
          return key;
        },
        signEvent: () => { throw new Error("Unexpected signing request"); }
      }
    });
  }, result);
}

test("welcome page loads its assets and keeps payouts explicitly closed", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/pebbles.html");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveTitle("The Pebbles — 600.wtf");
  await expect(page.getByRole("heading", { name: "Small stone. Big company." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim · coming soon" })).toBeDisabled();
  await expect(page.getByText("FAUCET NOT OPEN YET", { exact: true })).toBeVisible();
  expect(await page.locator(".sacred-stone").evaluate((image: HTMLImageElement) =>
    image.complete && image.naturalWidth > 0)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath("pebbles-desktop.png"), fullPage: true });
});

test("missing signer offers recovery without asking for private keys", async ({ page }) => {
  await page.goto("/pebbles.html");
  await page.getByRole("button", { name: "Connect with Nostr" }).click();
  await expect(page.getByRole("status")).toContainText("No Nostr signer found");
  await expect(page.getByRole("status")).toContainText("Never paste your private key here");
  await expect(page.locator("input")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Connect with Nostr" })).toBeEnabled();
});

test("NIP-07 connection stays local and does not grant membership or unlock claims", async ({ page }) => {
  await installSigner(page, PUBLIC_KEY.toUpperCase());
  const outbound: string[] = [];
  page.on("request", request => {
    if (["fetch", "xhr", "websocket"].includes(request.resourceType())) {
      outbound.push(request.url());
    }
  });
  await page.goto("/pebbles.html");
  await page.getByRole("button", { name: "Connect with Nostr" }).click();
  await expect(page.locator("#public-key")).toHaveText(PUBLIC_KEY);
  await expect(page.getByRole("status")).toContainText("Membership and token claims open when");
  await expect(page.getByRole("button", { name: "Claim · coming soon" })).toBeDisabled();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })))
    .toEqual({ local: 0, session: 0 });
  expect(outbound).toEqual([]);

  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.locator("#public-key")).toBeEmpty();
  await expect(page.getByRole("button", { name: "Connect with Nostr" })).toBeFocused();
  await page.reload();
  await expect(page.locator("#connection")).toBeHidden();
});

for (const [label, result] of [["declined", null], ["invalid", "<script>bad</script>"]] as const) {
  test(`${label} signer response leaves the page retryable`, async ({ page }) => {
    await installSigner(page, result);
    await page.goto("/pebbles.html");
    await page.getByRole("button", { name: "Connect with Nostr" }).click();
    await expect(page.getByRole("status")).toContainText("Nothing was claimed or registered");
    await expect(page.getByRole("button", { name: "Connect with Nostr" })).toBeEnabled();
    await expect(page.locator("#connection")).toBeHidden();
  });
}

test("pending signer prevents repeated connection requests", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "nostr", {
      value: { getPublicKey: () => new Promise(() => {}), signEvent: () => {} }
    });
  });
  await page.goto("/pebbles.html");
  const connect = page.getByRole("button", { name: "Connect with Nostr" });
  await connect.click();
  await expect(connect).toBeDisabled();
  await expect(connect).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toContainText("Check your Nostr signer");
});

for (const width of [320, 390, 768]) {
  test(`layout and keyboard FAQ work at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/pebbles.html");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const question = page.locator("summary").filter({ hasText: "What does connecting do?" });
    await question.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("It asks your NIP-07 browser signer", { exact: false }))
      .toBeVisible();
    await question.press("Enter");
    if (width === 390) {
      await page.screenshot({ path: info.outputPath("pebbles-mobile.png"), fullPage: true });
    }
  });
}

test("no JavaScript still explains faucet status and offers working navigation", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/pebbles.html");
  await expect(page.locator(".no-script")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect with Nostr" })).toBeDisabled();
  await page.getByRole("link", { name: "Explore the 600 Liquid asset" }).click();
  await expect(page).toHaveURL(/liquid\.html$/);
  await context.close();
});
