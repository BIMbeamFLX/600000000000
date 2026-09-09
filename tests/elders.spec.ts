// SPDX-License-Identifier: MIT
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const roster = JSON.parse(readFileSync(
  path.resolve(__dirname, "../data/elders-2026-09-09.json"), "utf8"
));

test("fixed founding list reserves exactly 630 tokens and never copies new public members", async ({ page }) => {
  expect(roster.founders).toHaveLength(30);
  expect(roster.founders.reduce((sum: number, founder: { allocation_atoms: number }) =>
    sum + founder.allocation_atoms, 0)).toBe(63_000_000_000);
  const keys = roster.founders.map((founder: { pubkey: string | null }) => founder.pubkey).filter(Boolean);
  expect(new Set(keys).size).toBe(keys.length);
  expect(roster.founders.find((founder: { name: string }) => founder.name === "Gadaj").pubkey)
    .toBeNull();
  await page.route("**/members.json", route => route.fulfill({ json: { members: [{ name: "outsider" }] } }));
  await page.goto("/elders.html");
  await expect(page.locator("#founder-list li")).toHaveCount(30);
  await expect(page.locator("#founder-list")).not.toContainText("outsider");
  await expect(page.getByRole("button", { name: "Claim 21 · not open yet" })).toBeDisabled();
});

for (const recognized of [true, false]) {
  test(`${recognized ? "founder" : "outsider"} key gets an honest roster result, never a payout`, async ({ page }) => {
    const key = recognized ? roster.founders[0].pubkey : "ff".repeat(32);
    await page.addInitScript(pubkey => {
      Object.defineProperty(window, "nostr", {
        value: { getPublicKey: async () => pubkey, signEvent: () => { throw new Error("No signing"); } }
      });
    }, key);
    await page.goto("/elders.html");
    await page.getByRole("button", { name: "Check my elder key" }).click();
    await expect(page.getByRole("status")).toContainText(recognized
      ? "your key matches the founding roster" : "not on the recorded founding list");
    await expect(page.locator("#elder-claim")).toBeDisabled();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(page.locator("#public-key")).toBeEmpty();
  });
}

for (const failure of ["unavailable", "duplicate"]) {
  test(`${failure} roster fails closed`, async ({ page }) => {
    await page.route("**/data/elders-2026-09-09.json", route => {
      if (failure === "unavailable") return route.fulfill({ status: 503, body: "Unavailable" });
      const broken = structuredClone(roster);
      broken.founders[1].pubkey = broken.founders[0].pubkey;
      return route.fulfill({ json: broken });
    });
    await page.goto("/elders.html");
    await expect(page.getByRole("status")).toContainText("roster could not be verified");
    await expect(page.locator("#connect")).toBeDisabled();
    await expect(page.locator("#elder-claim")).toBeDisabled();
  });
}

for (const width of [390, 1440]) {
  test(`elder desk renders at ${width}px without overflow or asset errors`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/elders.html");
    await expect(page.locator("#founder-list li")).toHaveCount(30);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath(`elders-${width}.png`), fullPage: true });
  });
}
