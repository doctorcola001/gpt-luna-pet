const { _electron: electron } = require("playwright-core");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  const packagedExecutable = process.env.PET_EXECUTABLE;
  const thoughtsPath = packagedExecutable
    ? path.join(path.dirname(packagedExecutable), "thoughts.json")
    : path.join(root, "thoughts.json");
  const expectedThoughts = JSON.parse(fs.readFileSync(thoughtsPath, "utf8"));
  const electronApp = await electron.launch({
    executablePath: packagedExecutable || process.env.ELECTRON_PATH || "D:/FORDS/hermestools/wb40-luna-electron/node_modules/electron/dist/electron.exe",
    args: packagedExecutable ? [] : [root],
    env
  });
  const page = await electronApp.firstWindow();
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setIgnoreMouseEvents(false));
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("requestfailed", request => errors.push(`${request.url()}: ${request.failure().errorText}`));
  await page.waitForFunction(() => document.getElementById("sprite").naturalWidth > 0);

  assert.equal(await page.locator("#animator").getAttribute("data-state"), "b-idle");
  assert.equal(await page.locator(".form-tab").count(), 2);
  assert.equal(await page.locator("#state-select option").count(), 4);
  assert.ok((await page.locator("link[rel=icon]").getAttribute("href")).endsWith("assets/app-icon.png"));
  assert.equal(await page.locator("#settings-panel").getAttribute("aria-hidden"), "true");
  assert.equal(await page.locator("[data-setting]").count(), 7);
  assert.equal(await page.locator("[data-appearance]").count(), 3);
  assert.equal(await page.locator("#c-bounce-mode option").count(), 3);
  assert.equal(await page.locator("#b-thought-mode option").count(), 2);
  assert.equal(await page.locator("#c-thought-mode option").count(), 2);
  await page.waitForFunction(() => document.getElementById("app-version").textContent.includes("v1.3.0"));
  assert.equal(await page.locator("#app-version").textContent(), "gpt-luna-pet v1.3.0");
  assert.equal(await page.locator(".form-switch-note").textContent(), "B：发呆、飞起来、工作（也许？）、寝了");

  const pet = page.locator("#pet");
  async function pointAtPet() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const box = await pet.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.evaluate(({ x, y }) => {
        document.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true }));
      }, { x, y });
      await page.waitForTimeout(50);
      if (await pet.evaluate(element => element.classList.contains("paused") && element.classList.contains("cursor-over"))) return;
    }
  }
  await page.waitForTimeout(250);
  const idleStart = await pet.boundingBox();
  await page.waitForTimeout(1100);
  const idleLater = await pet.boundingBox();
  assert.ok(Math.hypot(idleLater.x - idleStart.x, idleLater.y - idleStart.y) < 0.1, "B idle must stay stationary");
  await pointAtPet();
  assert.ok(await pet.evaluate(element => element.classList.contains("paused") && element.classList.contains("cursor-over")));
  assert.equal(await page.locator("#settings-gear").evaluate(element => getComputedStyle(element).pointerEvents), "auto");
  await page.evaluate(() => document.getElementById("settings-gear").click());
  assert.equal(await page.locator("#settings-panel").getAttribute("aria-hidden"), "false");
  const panelMetrics = await page.locator("#settings-panel").evaluate(element => {
    const rect = element.getBoundingClientRect();
    const meta = element.querySelector(".panel-meta").getBoundingClientRect();
    const version = element.querySelector(".app-version").getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, metaBottom: meta.bottom, versionBottom: version.bottom, viewport: innerHeight };
  });
  assert.ok(panelMetrics.top >= 0, "settings panel top must remain visible");
  assert.ok(panelMetrics.bottom <= panelMetrics.viewport, "settings panel bottom must not be clipped");
  assert.ok(panelMetrics.metaBottom <= panelMetrics.viewport, "settings footer metadata must be visible");
  assert.ok(panelMetrics.versionBottom <= panelMetrics.viewport, "version information must be visible");

  async function setRange(key, value) {
    await page.locator(`[data-setting="${key}"]`).evaluate((input, next) => {
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  await setRange("stayMin", 8);
  await setRange("stayMax", 2);
  await page.locator("#save-settings").click();
  assert.match(await page.locator("#settings-error").textContent(), /最短停留/);
  await setRange("stayMax", 9);
  await page.locator("#save-settings").click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("luna-pet-settings-v1")).stayMin), 8);
  await page.locator("#reset-settings").click();
  assert.equal(await page.locator("[data-setting=\"speed\"]").inputValue(), "24");

  await page.locator("#c-bounce-mode").selectOption("uniform");
  await page.locator("#b-thought-mode").selectOption("sequential");
  await page.locator("#save-settings").click();
  assert.equal(await pet.getAttribute("data-c-bounce"), "uniform");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("luna-pet-appearance-v1")).bThoughtMode), "sequential");
  await page.locator("#reset-settings").click();
  assert.equal(await pet.getAttribute("data-c-bounce"), "squash");
  assert.equal(await page.locator("#b-thought-mode").inputValue(), "random");

  await setRange("scale", 0.8);
  await page.locator("#save-settings").click();
  const scaledBox = await pet.boundingBox();
  assert.ok(Math.abs(scaledBox.width - 256) <= 1 && Math.abs(scaledBox.height - 288) <= 1, "scale setting must resize the whole pet");
  await page.locator("#reset-settings").click();
  const defaultBox = await pet.boundingBox();
  assert.ok(Math.abs(defaultBox.width - 272) <= 1 && Math.abs(defaultBox.height - 306) <= 1, "reset must restore the 85% default scale");
  assert.equal(await page.locator('[data-setting="scale"]').inputValue(), "0.85");
  assert.equal(await page.locator('[data-output="scale"]').textContent(), "85%");

  await page.locator("#state-select").selectOption("b-wings");
  const wingSources = new Set();
  const wingDeadline = Date.now() + 1250;
  while (Date.now() < wingDeadline) {
    wingSources.add((await page.locator("#sprite").getAttribute("src")).split("/").pop());
    await page.waitForTimeout(55);
  }
  assert.ok(wingSources.size >= 7, `24-frame/8-drawing loop should cycle the drawings, saw ${[...wingSources].join(",")}`);
  assert.ok([...wingSources].every(file => /^b-wing-\d{2}\.png$/.test(file)));

  await page.locator("#state-select").selectOption("b-scratch");
  assert.ok((await page.locator("#sprite").getAttribute("src")).endsWith("b-scratch.png"));
  const scratchAnimation = await page.locator("#motion").evaluate(element => getComputedStyle(element).animationName);
  assert.equal(scratchAnimation, "scratch");
  await page.locator("#state-select").selectOption("b-sleep");
  await page.waitForTimeout(700);
  assert.ok(await page.locator(".sleep-z").count() > 0, "sleeping B should emit Z particles");
  const zDistances = await page.locator(".sleep-z").evaluateAll(elements => elements.map(element => Number(element.dataset.distance)));
  assert.ok(zDistances.every(distance => distance > 0 && distance <= 300), "Z particles must stay within 300px");
  assert.ok(await page.locator(".sleep-z").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 36), "Z text must be enlarged");

  await page.locator("[data-form=\"C\"]").click();
  await page.waitForFunction(() => document.getElementById("animator").dataset.state === "c-noodle", null, { timeout: 3000 });
  assert.ok((await page.locator("#sprite").getAttribute("src")).endsWith("c-native.png"));
  assert.equal(await page.locator("#motion").evaluate(element => getComputedStyle(element).animationName), "none");
  const cBounce = await page.evaluate(() => {
    const animation = document.getElementById("squash").getAnimations().find(item => item.animationName === "c-idle-bounce");
    return {
      duration: animation.effect.getTiming().duration,
      infinite: animation.effect.getTiming().iterations === Infinity,
      transforms: animation.effect.getKeyframes().map(frame => frame.transform)
    };
  });
  assert.deepEqual(cBounce, { duration: 800, infinite: true, transforms: ["scale(1)", "scale(1.18, 0.85)", "scale(1)"] });
  assert.equal(await page.locator("#squash").evaluate(element => getComputedStyle(element).animationName), "c-idle-bounce");
  assert.equal(await page.locator("#squash").evaluate(element => getComputedStyle(element).animationIterationCount), "infinite");
  assert.equal(await page.locator("#c-thought").evaluate(element => element.classList.contains("show")), true);
  assert.equal(await page.locator("#bubble-text").textContent(), expectedThoughts.C[0]);
  const bubbleStyle = await page.locator("#c-thought").evaluate(element => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, fontWeight: style.fontWeight, color: style.color, animation: style.animationName, background: style.backgroundImage };
  });
  assert.equal(bubbleStyle.fontSize, "20px");
  assert.equal(bubbleStyle.fontWeight, "800");
  assert.equal(bubbleStyle.color, "rgb(101, 41, 141)");
  assert.equal(bubbleStyle.animation, "bubble-in");
  assert.ok(bubbleStyle.background.includes("bubble-cloud.svg"));
  await page.locator("#close-settings").click();
  await page.mouse.move(10, 10);
  const movingStart = await pet.boundingBox();
  await page.waitForTimeout(1600);
  const movingLater = await pet.boundingBox();
  assert.ok(Math.hypot(movingLater.x - movingStart.x, movingLater.y - movingStart.y) > 5, "C should keep moving without input");
  await page.waitForTimeout(3400);
  assert.equal(await page.locator("#bubble-text").textContent(), expectedThoughts.C[1]);
  const liveBounce = await page.evaluate(() => {
    const animation = document.getElementById("squash").getAnimations().find(item => item.animationName === "c-idle-bounce");
    return animation ? { duration: animation.effect.getTiming().duration, infinite: animation.effect.getTiming().iterations === Infinity } : null;
  });
  assert.deepEqual(liveBounce, { duration: 800, infinite: true });

  const bubbleLines = expectedThoughts.C;
  await page.locator("#c-thought").click({ force: true });
  assert.equal(await page.locator("#bubble-text").textContent(), bubbleLines[2]);
  for (let index = 3; index < bubbleLines.length; index += 1) {
    await page.locator("#c-thought").click({ force: true });
    assert.equal(await page.locator("#bubble-text").textContent(), bubbleLines[index]);
  }
  await page.locator("#c-thought").click({ force: true });
  assert.equal(await page.locator("#bubble-text").textContent(), bubbleLines[0]);

  await pointAtPet();
  await page.evaluate(() => document.getElementById("settings-gear").click());
  await page.locator("[data-form=\"B\"]").click();
  await page.waitForFunction(() => document.getElementById("animator").dataset.state === "b-idle", null, { timeout: 3000 });
  await page.waitForFunction(() => document.getElementById("c-thought").classList.contains("show"), null, { timeout: 3000 });
  assert.ok(expectedThoughts.B.includes(await page.locator("#bubble-text").textContent()), "B transformation should show one external thought");
  await page.locator("#state-select").selectOption("b-sleep");
  assert.ok((await page.locator("#sprite").getAttribute("src")).endsWith("b-sleep.png"));
  await page.waitForTimeout(700);
  const sleepCount = await page.locator(".sleep-z").count();
  await page.evaluate(() => {
    LunaCore.CLICK_TRANSFORM_CHANCE = 1;
    LunaCore.pickForm = () => "C";
  });
  await pet.click({ force: true, position: { x: 160, y: 160 } });
  await page.waitForTimeout(80);
  assert.equal(await page.locator("#animator").getAttribute("data-state"), "b-sleep", "sleep click must not transform");
  assert.equal(await page.locator("#c-thought").getAttribute("aria-hidden"), "true", "sleep click must not open a thought bubble");
  assert.ok(await page.locator(".sleep-z").count() >= Math.min(3, sleepCount + 3), "sleep click must emit Z particles");

  const alarmState = await page.locator("#alarm-button").evaluate(element => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, pointer: style.pointerEvents };
  });
  assert.deepEqual(alarmState, { opacity: "1", pointer: "auto" });
  await page.evaluate(() => document.getElementById("alarm-button").click());
  await page.waitForTimeout(120);
  assert.ok(await page.locator("#hammer").evaluate(element => Number(getComputedStyle(element).opacity) > 0), "alarm should swing the toy hammer");
  await page.waitForFunction(() => document.getElementById("animator").dataset.state === "b-idle", null, { timeout: 3000 });
  assert.equal(await page.locator("#bonk").evaluate(element => element.getAnimations().length > 0), true, "bonk transition should cover the state switch");
  await page.waitForTimeout(1050);
  assert.equal(await page.locator("#c-thought").getAttribute("aria-hidden"), "true");
  const afterAlarm = await page.locator("#alarm-button").evaluate(element => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, pointer: style.pointerEvents };
  });
  assert.deepEqual(afterAlarm, { opacity: "0", pointer: "none" });
  assert.equal(await page.locator("#hammer").evaluate(element => getComputedStyle(element).opacity), "0");

  await page.evaluate(() => { LunaCore.CLICK_TRANSFORM_CHANCE = 0; });
  await pet.click({ force: true, position: { x: 160, y: 160 } });
  await page.waitForFunction(() => document.getElementById("c-thought").classList.contains("show"), null, { timeout: 3000 });
  assert.ok(expectedThoughts.B.includes(await page.locator("#bubble-text").textContent()), "clicking awake B should show a thought");

  await page.locator("#close-settings").click();
  await page.mouse.move(10, 10);
  await page.waitForTimeout(260);
  assert.equal(await page.locator("#settings-gear").evaluate(element => getComputedStyle(element).opacity), "0");

  await page.evaluate(() => {
    LunaCore.CLICK_TRANSFORM_CHANCE = 1;
    LunaCore.pickForm = () => "C";
  });
  await pet.click({ force: true, position: { x: 160, y: 160 } });
  await page.waitForFunction(() => document.getElementById("animator").dataset.state === "c-noodle", null, { timeout: 3000 });
  assert.equal(await page.locator("#toast").textContent(), "变身！");
  assert.equal(await page.locator("#toast").evaluate(element => getComputedStyle(element).fontSize), "15px");
  assert.equal(await page.locator(".sleep-z").count(), 0, "sleep particles must clear when leaving B");
  await page.waitForTimeout(900);
  await pointAtPet();
  await page.evaluate(() => document.getElementById("settings-gear").click());
  await page.locator("#c-thought").click({ force: true });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.documentElement.classList.remove("desktop");
    document.documentElement.classList.add("preview");
  });
  const petBox = await pet.boundingBox();
  const panelBox = await page.locator("#settings-panel").boundingBox();
  const bubbleBox = await page.locator("#c-thought").boundingBox();
  const margin = 70;
  const left = Math.min(petBox.x, panelBox.x, bubbleBox.x);
  const top = Math.min(petBox.y, panelBox.y, bubbleBox.y);
  const right = Math.max(petBox.x + petBox.width, panelBox.x + panelBox.width, bubbleBox.x + bubbleBox.width);
  const bottom = Math.max(petBox.y + petBox.height, panelBox.y + panelBox.height, bubbleBox.y + bubbleBox.height);
  const clip = {
    x: Math.max(0, left - margin),
    y: Math.max(0, top - 50),
    width: Math.min(1080, right - left + margin * 2),
    height: Math.min(1300, bottom - top + 100)
  };
  await page.screenshot({ path: path.resolve(__dirname, "..", "preview.png"), clip });
  assert.deepEqual(errors, []);
  console.log("PASS cloud bubble, 85% default, alarm/hammer/bonk, enlarged Z, version footer and 15px toast all work");
  await electronApp.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
