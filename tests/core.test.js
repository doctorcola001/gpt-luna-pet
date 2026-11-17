const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../core.js");

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}

test("conservative defaults satisfy every configured range", () => {
  assert.deepEqual(Core.validateSettings(Core.DEFAULTS).ok, true);
  assert.equal(Core.DEFAULTS.speed, 24);
  assert.equal(Core.DEFAULTS.changeRate, 0.05);
  assert.equal(Core.DEFAULTS.scale, 0.85);
  assert.equal(Core.CLICK_TRANSFORM_CHANCE, 0.15);
});

test("minimum stay cannot exceed maximum stay", () => {
  const result = Core.validateSettings({ ...Core.DEFAULTS, stayMin: 6, stayMax: 2 });
  assert.equal(result.ok, false);
  assert.match(result.message, /最短停留/);
});

test("out-of-range movement values are rejected and sanitized", () => {
  assert.equal(Core.validateSettings({ ...Core.DEFAULTS, speed: 81 }).ok, false);
  assert.equal(Core.sanitizeSettings({ speed: 500 }).speed, 80);
  assert.equal(Core.sanitizeSettings({ speed: -2 }).speed, 10);
  assert.equal(Core.validateSettings({ ...Core.DEFAULTS, scale: 1.2 }).ok, false);
  assert.equal(Core.sanitizeSettings({ scale: 2 }).scale, 1);
  assert.equal(Core.sanitizeSettings({ scale: 0.2 }).scale, 0.5);
});

test("two active forms use an even 50/50 weight after removing A", () => {
  assert.deepEqual(Core.FORM_WEIGHTS, { B: 50, C: 50 });
  assert.equal(Core.pickForm(() => 0.49), "B");
  assert.equal(Core.pickForm(() => 0.5), "C");
  assert.equal(Core.pickForm(() => 0.99), "C");
});

test("destinations remain inside the available screen", () => {
  for (let index = 0; index < 100; index += 1) {
    const point = Core.randomDestination(10, 10, { width: 100, height: 80 }, 800);
    assert.ok(point.x >= 0 && point.x <= 100);
    assert.ok(point.y >= 0 && point.y <= 80);
  }
});

test("path speed is measured in pixels per second", () => {
  const settings = { ...Core.DEFAULTS, speed: 20, changeRate: 0.05 };
  const pet = new Core.Pathfinder(() => settings, () => ({ width: 1000, height: 600 }), () => 0.5);
  pet.setPosition(500, 200);
  pet.destinationX = 400;
  pet.destinationY = 200;
  pet.update(0.1);
  assert.ok(Math.abs(pet.x - 498) < 1e-9);
  assert.equal(pet.facing, -1);
});

test("suspension freezes all path movement", () => {
  const pet = new Core.Pathfinder(() => Core.DEFAULTS, () => ({ width: 500, height: 500 }), () => 0.5);
  pet.setPosition(200, 200);
  pet.destinationX = 300;
  pet.destinationY = 200;
  const events = pet.update(1, true);
  assert.equal(pet.x, 200);
  assert.deepEqual(events, []);
});

test("arrival can pause and requests B sleep with 60 percent branch", () => {
  const settings = { ...Core.DEFAULTS, pauseChance: 1, stayMin: 2, stayMax: 2 };
  const pet = new Core.Pathfinder(() => settings, () => ({ width: 500, height: 500 }), () => 0);
  pet.setPosition(200, 200);
  pet.destinationX = 200;
  pet.destinationY = 200;
  const sequence = [0.9, 0, 0, 0];
  pet.random = () => sequence.shift() ?? 0;
  const events = pet.update(0.1);
  const pause = events.find(event => event.type === "pause");
  assert.ok(pause);
  assert.equal(pause.sleep, true);
  assert.equal(pause.duration, 2);
});

test("C-form movement can suppress all arrivals pauses and keep roaming", () => {
  const settings = { ...Core.DEFAULTS, pauseChance: 1, stayMin: 2, stayMax: 2 };
  const pet = new Core.Pathfinder(() => settings, () => ({ width: 500, height: 500 }), () => 0.9);
  pet.setPosition(200, 200);
  pet.destinationX = 200;
  pet.destinationY = 200;
  const events = pet.update(0.1, false, false);
  assert.equal(events.some(event => event.type === "pause"), false);
  assert.equal(pet.waitRemaining, 0);
  assert.ok(pet.destinationX !== 200 || pet.destinationY !== 200);
});

test("screen collision reports edge and redirects inward", () => {
  const pet = new Core.Pathfinder(() => Core.DEFAULTS, () => ({ width: 500, height: 500 }), () => 0.5);
  pet.x = 0;
  pet.y = 200;
  pet.destinationX = -50;
  pet.destinationY = 200;
  const events = pet.update(0.1);
  assert.ok(events.some(event => event.type === "collision" && event.edge === "left"));
  assert.ok(pet.destinationX > pet.x);
  assert.equal(pet.facing, 1);
});

test("B states, repaired C, eight wing drawings, duck audio and big-head icons exist", () => {
  const root = path.resolve(__dirname, "..");
  const sprites = ["b-idle", "b-scratch", "b-sleep", "c-native"];
  for (const name of sprites) {
    const file = path.join(root, "assets", "sprites", `${name}.png`);
    assert.ok(fs.statSync(file).size > 1000, `${file} should not be empty`);
  }
  const wingFrames = fs.readdirSync(path.join(root, "assets", "sprites", "wings")).filter(file => /^b-wing-\d{2}\.png$/.test(file));
  assert.equal(wingFrames.length, 8);
  assert.ok(fs.statSync(path.join(root, "assets", "bubble-cloud.svg")).size > 100);
  const audio = fs.readFileSync(path.join(root, "assets", "audio", "duck-squeak.mp3"));
  assert.ok(audio.length > 10000, "duck-squeak.mp3 should be present");
  assert.ok(audio.toString("ascii", 0, 3) === "ID3" || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0), "duck-squeak.mp3 should be an MP3 stream");
  for (const name of ["app-icon.png", "tray-icon.png", "tray-icon.ico"]) {
    assert.ok(fs.statSync(path.join(root, "assets", name)).size > 1000);
  }
  const frames = fs.readdirSync(path.join(root, "assets", "transition")).filter(file => /^ab-\d{2}\.png$/.test(file));
  assert.equal(frames.length, 30, "temporarily hidden A assets should remain archived");
});

console.log(`\n${passed} tests passed.`);
