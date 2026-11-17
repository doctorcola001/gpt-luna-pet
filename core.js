(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LunaCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LIMITS = Object.freeze({
    speed: [10, 80],
    changeRate: [0.05, 0.5],
    maxDistance: [50, 800],
    pauseChance: [0.01, 0.3],
    stayMin: [0.05, 10],
    stayMax: [0.05, 10],
    scale: [0.5, 1]
  });

  const DEFAULTS = Object.freeze({
    speed: 24,
    changeRate: 0.05,
    maxDistance: 220,
    pauseChance: 0.06,
    stayMin: 1.5,
    stayMax: 4,
    scale: 0.85
  });

  const FORM_WEIGHTS = Object.freeze({ B: 50, C: 50 });
  const CLICK_TRANSFORM_CHANCE = 0.15;

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function validateSettings(candidate) {
    const result = {};
    for (const [key, range] of Object.entries(LIMITS)) {
      const value = Number(candidate[key]);
      if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
        return { ok: false, message: `${key} 必须在 ${range[0]}–${range[1]} 之间` };
      }
      result[key] = value;
    }
    if (result.stayMin > result.stayMax) {
      return { ok: false, message: "最短停留时间不能大于最长停留时间" };
    }
    return { ok: true, settings: result };
  }

  function sanitizeSettings(candidate) {
    const result = { ...DEFAULTS };
    if (!candidate || typeof candidate !== "object") return result;
    for (const [key, range] of Object.entries(LIMITS)) {
      const value = Number(candidate[key]);
      if (Number.isFinite(value)) result[key] = clamp(value, range[0], range[1]);
    }
    if (result.stayMin > result.stayMax) {
      result.stayMin = DEFAULTS.stayMin;
      result.stayMax = DEFAULTS.stayMax;
    }
    return result;
  }

  function pickForm(random = Math.random) {
    return random() * 100 < FORM_WEIGHTS.B ? "B" : "C";
  }

  function randomDestination(x, y, bounds, maxDistance, random = Math.random) {
    const angle = random() * Math.PI * 2;
    const distance = maxDistance * (0.35 + random() * 0.65);
    return {
      x: clamp(x + Math.cos(angle) * distance, 0, Math.max(0, bounds.width)),
      y: clamp(y + Math.sin(angle) * distance, 0, Math.max(0, bounds.height))
    };
  }

  class Pathfinder {
    constructor(getSettings, getBounds, random = Math.random) {
      this.getSettings = getSettings;
      this.getBounds = getBounds;
      this.random = random;
      this.x = 0;
      this.y = 0;
      this.destinationX = 0;
      this.destinationY = 0;
      this.facing = 1;
      this.waitRemaining = 0;
      this.chooseDestination();
    }

    chooseDestination() {
      const settings = this.getSettings();
      const destination = randomDestination(this.x, this.y, this.getBounds(), settings.maxDistance, this.random);
      this.destinationX = destination.x;
      this.destinationY = destination.y;
    }

    setPosition(x, y) {
      const bounds = this.getBounds();
      this.x = clamp(x, 0, Math.max(0, bounds.width));
      this.y = clamp(y, 0, Math.max(0, bounds.height));
      this.chooseDestination();
    }

    update(deltaSeconds, suspended = false, allowPause = true) {
      const events = [];
      if (suspended || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return events;
      const dt = Math.min(deltaSeconds, 0.1);
      const settings = this.getSettings();
      const bounds = this.getBounds();

      if (this.waitRemaining > 0) {
        this.waitRemaining = Math.max(0, this.waitRemaining - dt);
        if (this.waitRemaining === 0) this.chooseDestination();
        return events;
      }

      if (this.random() < 1 - Math.exp(-settings.changeRate * dt)) {
        this.chooseDestination();
        events.push({ type: "redirect" });
      }

      const dx = this.destinationX - this.x;
      const dy = this.destinationY - this.y;
      const distance = Math.hypot(dx, dy);
      const step = settings.speed * dt;

      if (distance <= Math.max(step, 2)) {
        this.x = this.destinationX;
        this.y = this.destinationY;
        if (allowPause && this.random() < settings.pauseChance) {
          this.waitRemaining = settings.stayMin + this.random() * (settings.stayMax - settings.stayMin);
          events.push({ type: "pause", duration: this.waitRemaining, sleep: this.random() < 0.6 });
        } else {
          this.chooseDestination();
        }
      } else {
        this.x += dx / distance * step;
        this.y += dy / distance * step;
        if (Math.abs(dx) > 0.5) this.facing = dx > 0 ? 1 : -1;
      }

      let collision = null;
      if (this.x <= 0) { this.x = 0; collision = "left"; }
      else if (this.x >= bounds.width) { this.x = Math.max(0, bounds.width); collision = "right"; }
      if (this.y <= 0) { this.y = 0; collision = collision || "top"; }
      else if (this.y >= bounds.height) { this.y = Math.max(0, bounds.height); collision = collision || "bottom"; }

      if (collision) {
        const inset = Math.min(80, settings.maxDistance * 0.5);
        this.destinationX = collision === "left" ? clamp(this.x + inset, 0, bounds.width)
          : collision === "right" ? clamp(this.x - inset, 0, bounds.width) : this.x;
        this.destinationY = collision === "top" ? clamp(this.y + inset, 0, bounds.height)
          : collision === "bottom" ? clamp(this.y - inset, 0, bounds.height) : this.y;
        if (collision === "left") this.facing = 1;
        if (collision === "right") this.facing = -1;
        events.push({ type: "collision", edge: collision });
      }
      return events;
    }
  }

  return {
    LIMITS,
    DEFAULTS,
    FORM_WEIGHTS,
    CLICK_TRANSFORM_CHANCE,
    clamp,
    validateSettings,
    sanitizeSettings,
    pickForm,
    randomDestination,
    Pathfinder
  };
});
