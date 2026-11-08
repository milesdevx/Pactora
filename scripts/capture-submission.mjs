import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const url = "https://pactora-tan.vercel.app/help";
const output = "docs/submission/screenshots";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const captures = [];
try {
  for (const [name, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (response?.status() !== 200) throw new Error(`Live help page returned HTTP ${response?.status()}.`);
    await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
      let element = document.querySelector("main h1");
      if (!element) return false;
      while (element) {
        const style = getComputedStyle(element);
        if (Number(style.opacity) < 0.99 || style.visibility === "hidden" || style.display === "none") return false;
        element = element.parentElement;
      }
      return true;
    }, undefined, { timeout: 45_000 });
    if (errors.length) throw new Error("Live page had a browser exception; screenshot is not verified.");
    const file = join(output, `live-v1-help-${name}.png`);
    await page.screenshot({ path: file, fullPage: name === "mobile" });
    captures.push({ file, viewport, url, status: 200, contentRendered: true, capturedAt: new Date().toISOString(), release: "Existing live V1; not V2 deployment or payment evidence" });
    await page.close();
  }
  writeFileSync(join(output, "capture.json"), JSON.stringify({ note: "Real live-page screenshots, no wallet/provider injection and no simulated transactions.", captures }, null, 2) + "\n");
  console.log(JSON.stringify({ captures }, null, 2));
} finally { await browser.close(); }
