import puppeteer from "puppeteer";
import dotenv from "dotenv";

dotenv.config();

const { HANA_USER, HANA_PASS, HANA_INSTANCE_URL } = process.env;

if (!HANA_USER || !HANA_PASS || !HANA_INSTANCE_URL) {
  console.error("❌ Missing HANA_USER, HANA_PASS, or HANA_INSTANCE_URL in .env file.");
  process.exit(1);
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  // const browser = await puppeteer.launch({
  //   headless: false,
  //   defaultViewport: null,
  //   args: ["--start-maximized"],
  // });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    console.log("🔁 Navigating to the HANA instance page...");
    await page.goto(HANA_INSTANCE_URL, { waitUntil: "networkidle2" });

    console.log("🔐 Locating the email input field...");
    await page.waitForSelector("input#j_username", { timeout: 10000 });
    await page.type("input#j_username", HANA_USER);
    await page.click("button[type='submit']");
    await wait(3000);
    console.log("🔑 Email submitted, waiting for password...");

    console.log("🍪 Checking for cookie banner...");
    try {
      await page.waitForSelector('#truste-consent-required', { timeout: 5000 });
      await page.click('#truste-consent-required');
      console.log("🍪 'Reject All' clicked.");
    } catch {
      console.log("🍪 Cookie banner not displayed, continuing...");
    }

    console.log("🔑 Waiting for password input field...");
    await page.waitForSelector("#password", { visible: true, timeout: 10000 });
    await page.type("#password", HANA_PASS, { delay: 100 });

    console.log("🔓 Clicking the 'Sign in' button...");
    await page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some(btn => btn.textContent?.trim() === "Sign in");
    }, { timeout: 10000 });

    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent?.trim(), btn);
      if (text === "Sign in") {
        await btn.click();
        break;
      }
    }

    console.log("⏳ Waiting for the main dashboard to load...");
    await page.waitForFunction(() => {
      const el = document.querySelector("span[id*='actionBtn'][id*='instancesTable'][id*='inner']");
      return !!el;
    }, { timeout: 30000 });
    console.log("✅ Logged in successfully, instance action button is visible.");

    console.log("⋯ Clicking the action (ellipsis) button...");
    const actionButton = await page.$("span[id*='actionBtn'][id*='instancesTable'][id*='inner']");
    if (!actionButton) throw new Error("❌ Action button (ellipsis) not found.");
    await actionButton.click();
    await wait(1000);

    console.log("🚀 Waiting for 'Start' menu item to appear...");
    await page.waitForSelector("div[id$='--start-btn-txt']", { timeout: 10000 });

    const startButton = await page.$("div[id$='--start-btn-txt']");
    if (!startButton) throw new Error("❌ 'Start' button not found.");

    const startText = await page.evaluate(el => el.textContent?.trim(), startButton);
    if (startText !== "Start") throw new Error("❌ 'Start' button text mismatch.");

    console.log("✅ Clicking the 'Start' button...");
    await startButton.click();

    console.log("🕒 Waiting for 15 minutes...");
    await wait(15 * 60 * 1000); // 900,000 ms
    console.log("⏱️ Wait complete.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
