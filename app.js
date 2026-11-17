(() => {
  "use strict";

  const Core = window.LunaCore;
  const PET_WIDTH = 320;
  const PET_HEIGHT = 360;
  const STORAGE_KEY = "luna-pet-settings-v1";
  const APPEARANCE_KEY = "luna-pet-appearance-v1";
  const desktop = window.lunaDesktop || null;
  document.documentElement.classList.add(desktop ? "desktop" : "preview");

  const FORMS = {
    B: {
      label: "LUNA B",
      states: [
        { id: "b-idle", label: "原图 · 站立发呆（静止）", file: "assets/sprites/b-idle.png" },
        { id: "b-wings", label: "俯身扇动翅膀 · 24 帧循环", file: "assets/sprites/wings/b-wing-01.png" },
        { id: "b-scratch", label: "坐在地上拿纸挠头", file: "assets/sprites/b-scratch.png" },
        { id: "b-sleep", label: "盖被子戴眼罩睡觉", file: "assets/sprites/b-sleep.png" }
      ]
    },
    C: {
      label: "泡面 C",
      states: [
        { id: "c-noodle", label: "原生造型 · 保持 Q 弹", file: "assets/sprites/c-native.png" }
      ]
    }
  };
  const C_LYRIC_INTERVAL = 4.2;
  const WING_FRAME_PATHS = Array.from({ length: 8 }, (_, index) => `assets/sprites/wings/b-wing-${String(index + 1).padStart(2, "0")}.png`);
  const DEFAULT_APPEARANCE = Object.freeze({
    cBounceMode: "squash",
    bThoughtMode: "random",
    cThoughtMode: "sequential"
  });
  const DEFAULT_THOUGHTS = Object.freeze({
    B: Object.freeze(["啊吧啊吧", "GPT-6-Luna已连接", "额度耗尽", "用户不会发现..."]),
    C: Object.freeze([
      "哦耶耶",
      "桃花~谢了有玫瑰",
      "人生几十年总会有雨来陪！",
      "哦！潇潇洒洒 赴会今不醉不归！",
      "耶！往事后不后悔慢慢去体会！",
      "此刻朋友这杯酒最珍贵！",
      "快把满上干了这杯大声歌唱～",
      "好朋友～好朋友～今宵多欢畅～",
      "理想改变了我们的模样～",
      "也让我懂得了要珍惜的肩膀～",
      "阳光总会在风雨之后撒向苍茫",
      "让我们抬起头学会了坚强～",
      "就像朋友的这杯烈酒烫我上～",
      "温暖我凡事别再放上！"
    ])
  });

  const pet = document.getElementById("pet");
  const petScale = document.getElementById("pet-scale");
  const sleepZs = document.getElementById("sleep-zs");
  const sprite = document.getElementById("sprite");
  const squash = document.getElementById("squash");
  const animator = document.getElementById("animator");
  const flip = document.getElementById("flip");
  const motion = document.getElementById("motion");
  const gear = document.getElementById("settings-gear");
  const panel = document.getElementById("settings-panel");
  const stateSelect = document.getElementById("state-select");
  const errorText = document.getElementById("settings-error");
  const statusText = document.getElementById("settings-status");
  const quitButton = document.getElementById("quit-pet");
  const toast = document.getElementById("toast");
  const thoughtBubble = document.getElementById("c-thought");
  const bubbleText = document.getElementById("bubble-text");
  const alarmButton = document.getElementById("alarm-button");
  const hammer = document.getElementById("hammer");
  const bonk = document.getElementById("bonk");
  const appVersionLabel = document.getElementById("app-version");

  let settings = loadSettings();
  let appearance = loadAppearance();
  let thoughts = { B: [...DEFAULT_THOUGHTS.B], C: [...DEFAULT_THOUGHTS.C] };
  let customized = hasSavedSettings() || hasSavedAppearance();
  let currentForm = "B";
  let currentState = "b-idle";
  let hovered = false;
  let settingsOpen = false;
  let dragging = false;
  let transitioning = false;
  let transitionSerial = 0;
  let queuedTransform = null;
  let squashAnimation = null;
  let toastTimer = 0;
  let wingElapsed = 0;
  let wingArtIndex = -1;
  let sleepZElapsed = 0;
  let nextSleepZDelay = 0.4;
  let sleepSlamBusy = false;
  let desktopInteractive = true;
  let bubbleIndex = 0;
  let bThoughtIndex = -1;
  let bubbleForm = null;
  let bubbleHideTimer = 0;
  let cLyricElapsed = 0;

  function petMetrics() {
    const scale = Number.isFinite(Number(settings.scale)) ? Number(settings.scale) : 0.85;
    return {
      scale,
      width: Math.round(PET_WIDTH * scale),
      height: Math.round(PET_HEIGHT * scale)
    };
  }

  function applyPetScale() {
    const metrics = petMetrics();
    pet.style.width = `${metrics.width}px`;
    pet.style.height = `${metrics.height}px`;
    petScale.style.transform = `scale(${metrics.scale})`;
  }

  const path = new Core.Pathfinder(
    () => settings,
    () => {
      const size = petMetrics();
      return { width: Math.max(0, innerWidth - size.width), height: Math.max(0, innerHeight - size.height) };
    }
  );

  function minimumPetY() {
    const scale = petMetrics().scale;
    return thoughtBubble.classList.contains("show") ? Math.ceil(122 * scale) : 0;
  }
  const initialSize = petMetrics();
  path.setPosition(
    Math.max(0, (innerWidth - initialSize.width) * 0.62),
    Math.max(0, innerHeight - initialSize.height - 45)
  );

  function hasSavedSettings() {
    try { return localStorage.getItem(STORAGE_KEY) !== null; }
    catch { return false; }
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? Core.sanitizeSettings(JSON.parse(saved)) : { ...Core.DEFAULTS };
    } catch {
      return { ...Core.DEFAULTS };
    }
  }

  function hasSavedAppearance() {
    try { return localStorage.getItem(APPEARANCE_KEY) !== null; }
    catch { return false; }
  }

  function sanitizeAppearance(candidate) {
    const result = { ...DEFAULT_APPEARANCE };
    if (!candidate || typeof candidate !== "object") return result;
    if (["squash", "uniform", "off"].includes(candidate.cBounceMode)) result.cBounceMode = candidate.cBounceMode;
    if (["random", "sequential"].includes(candidate.bThoughtMode)) result.bThoughtMode = candidate.bThoughtMode;
    if (["random", "sequential"].includes(candidate.cThoughtMode)) result.cThoughtMode = candidate.cThoughtMode;
    return result;
  }

  function loadAppearance() {
    try {
      return sanitizeAppearance(JSON.parse(localStorage.getItem(APPEARANCE_KEY)));
    } catch {
      return { ...DEFAULT_APPEARANCE };
    }
  }

  function applyAppearance() {
    pet.dataset.cBounce = appearance.cBounceMode;
  }

  function updateStatus() {
    statusText.textContent = customized ? "已应用保存参数" : "首次运行 · 保守参数";
  }

  function fillControls() {
    document.querySelectorAll("[data-setting]").forEach(input => {
      input.value = settings[input.dataset.setting];
      updateOutput(input.dataset.setting, input.value);
    });
    document.querySelectorAll("[data-appearance]").forEach(select => {
      select.value = appearance[select.dataset.appearance];
    });
    applyAppearance();
    applyPetScale();
    updateStatus();
  }

  function updateOutput(key, rawValue) {
    const output = document.querySelector(`[data-output="${key}"]`);
    const value = Number(rawValue);
    const formats = {
      speed: () => `${Math.round(value)} px/s`,
      changeRate: () => `${value.toFixed(2)} /s`,
      maxDistance: () => `${Math.round(value)} px`,
      pauseChance: () => `${Math.round(value * 100)}%`,
      stayMin: () => `${value.toFixed(2)} s`,
      stayMax: () => `${value.toFixed(2)} s`,
      scale: () => `${Math.round(value * 100)}%`
    };
    output.textContent = formats[key]();
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1700);
  }

  function setState(stateId) {
    const config = FORMS[currentForm].states.find(state => state.id === stateId) || FORMS[currentForm].states[0];
    currentState = config.id;
    animator.dataset.state = config.id;
    sprite.src = config.file;
    sprite.alt = config.label;
    stateSelect.value = config.id;
    wingElapsed = 0;
    wingArtIndex = -1;
    pet.classList.toggle("c-mode", config.id === "c-noodle");
    pet.classList.toggle("sleeping", config.id === "b-sleep");
    if (config.id === "b-sleep") {
      clearAlarmEffects();
      sleepZElapsed = 0;
      nextSleepZDelay = 0.25;
    } else {
      clearSleepZ();
      if (!sleepSlamBusy) clearAlarmEffects();
    }
    if (config.id === "c-noodle") {
      path.waitRemaining = 0;
      path.chooseDestination();
      showThoughtBubble(true);
    } else {
      hideThoughtBubble();
    }
  }

  function clearSleepZ() {
    sleepZs.replaceChildren();
    sleepZElapsed = 0;
  }

  function spawnSleepZ() {
    if (sleepZs.childElementCount > 12) sleepZs.firstElementChild?.remove();
    const z = document.createElement("span");
    z.className = "sleep-z";
    z.textContent = "Z";
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 200;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const size = 36 + Math.random() * 18;
    z.dataset.distance = String(Math.round(distance));
    z.style.left = "52%";
    z.style.top = "52%";
    z.style.fontSize = `${size}px`;
    z.style.opacity = "0";
    sleepZs.append(z);
    const drift = Math.random() < 0.5 ? -1 : 1;
    const turn = drift * (12 + Math.random() * 26);
    z.animate([
      { transform: "translate(-50%, -50%) translate(0, 0) scale(.55) rotate(0deg)", opacity: 0 },
      { transform: `translate(-50%, -50%) translate(${dx * .3}px, ${dy * .3}px) scale(1) rotate(${turn * .3}deg)`, opacity: 1, offset: .18 },
      { transform: `translate(-50%, -50%) translate(${dx * .72}px, ${dy * .72}px) scale(${.9 + Math.random() * .2}) rotate(${turn * .7}deg)`, opacity: 1, offset: .68 },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${.8 + Math.random() * .35}) rotate(${turn}deg)`, opacity: 0 }
    ], {
      duration: 1500 + distance * 2.1 + Math.random() * 450,
      easing: "cubic-bezier(.16,.62,.28,1)"
    }).finished.then(() => z.remove()).catch(() => z.remove());
  }

  function clearAlarmEffects() {
    hammer.getAnimations().forEach(animation => animation.cancel());
    bonk.getAnimations().forEach(animation => animation.cancel());
    hammer.style.opacity = "0";
    bonk.style.opacity = "0";
    pet.classList.remove("alarm-swing");
    sleepSlamBusy = false;
  }

  async function ringAlarm() {
    if (sleepSlamBusy || currentForm !== "B" || currentState !== "b-sleep") return;
    sleepSlamBusy = true;
    pet.classList.add("alarm-swing");
    hammer.style.opacity = "1";
    const swing = hammer.animate([
      { opacity: 0, transform: "translate(92px, -108px) rotate(-62deg) scale(.8)" },
      { opacity: 1, transform: "translate(55px, -62px) rotate(-35deg) scale(.92)", offset: .3 },
      { opacity: 1, transform: "translate(-22px, 38px) rotate(24deg) scale(1.03)" }
    ], { duration: 340, easing: "cubic-bezier(.35,.05,.2,1)", fill: "forwards" });
    try {
      await swing.finished;
    } catch {
      clearAlarmEffects();
      return;
    }
    if (currentState !== "b-sleep") {
      clearAlarmEffects();
      return;
    }

    const alarmFade = hammer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: "forwards" });
    bonk.style.opacity = "1";
    const impact = bonk.animate([
      { opacity: 1, transform: "scale(.55) rotate(-10deg)" },
      { opacity: 1, transform: "scale(1.08) rotate(-4deg)", offset: .18 },
      { opacity: 1, transform: "scale(1) rotate(-7deg)", offset: .68 },
      { opacity: 0, transform: "scale(1.26) rotate(-7deg)" }
    ], { duration: 900, easing: "cubic-bezier(.2,.8,.25,1)", fill: "forwards" });

    setState("b-idle");
    await wait(900);
    impact.cancel();
    alarmFade.cancel();
    bonk.style.opacity = "0";
    clearAlarmEffects();
  }

  function thoughtLinesFor(form) {
    const lines = thoughts[form];
    return Array.isArray(lines) && lines.length ? lines : DEFAULT_THOUGHTS[form];
  }

  function chooseThoughtIndex(form, current, initial = false) {
    const lines = thoughtLinesFor(form);
    const mode = form === "B" ? appearance.bThoughtMode : appearance.cThoughtMode;
    if (mode === "random") {
      if (lines.length === 1) return 0;
      let next = Math.floor(Math.random() * lines.length);
      if (next === current) next = (next + 1) % lines.length;
      return next;
    }
    if (initial) return 0;
    return (current + 1) % lines.length;
  }

  function renderThought(form, index, animate = false) {
    clearTimeout(bubbleHideTimer);
    bubbleForm = form;
    const lines = thoughtLinesFor(form);
    const safeIndex = Math.max(0, Math.min(index, lines.length - 1));
    if (form === "B") bThoughtIndex = safeIndex;
    else bubbleIndex = safeIndex;
    bubbleText.textContent = lines[safeIndex];
    thoughtBubble.setAttribute("aria-hidden", "false");
    thoughtBubble.setAttribute("aria-label", `思考气泡：${lines[safeIndex]}。点击查看下一句`);
    thoughtBubble.classList.add("show");
    if (animate) {
      bubbleText.animate([
        { opacity: .15, transform: "translateY(3px)" },
        { opacity: 1, transform: "translateY(0)" }
      ], { duration: 180, easing: "ease-out" });
    }
    if (form === "B") {
      bubbleHideTimer = setTimeout(() => {
        if (bubbleForm === "B" && currentForm === "B") hideThoughtBubble();
      }, 4600);
    }
  }

  function showThoughtBubble(reset = false) {
    cLyricElapsed = 0;
    const initialIndex = appearance.cThoughtMode === "random"
      ? Math.floor(Math.random() * thoughtLinesFor("C").length)
      : 0;
    renderThought("C", reset ? initialIndex : chooseThoughtIndex("C", bubbleIndex));
  }

  function showBThoughtBubble() {
    bThoughtIndex = chooseThoughtIndex("B", bThoughtIndex, bThoughtIndex < 0);
    renderThought("B", bThoughtIndex);
  }

  function hideThoughtBubble() {
    clearTimeout(bubbleHideTimer);
    thoughtBubble.classList.remove("show");
    thoughtBubble.setAttribute("aria-hidden", "true");
    bubbleForm = null;
    cLyricElapsed = 0;
  }

  function advanceThoughtBubble() {
    if (!thoughtBubble.classList.contains("show")) {
      if (currentForm === "C") showThoughtBubble(true);
      else showBThoughtBubble();
      return;
    }
    if (bubbleForm === "B") {
      bThoughtIndex = chooseThoughtIndex("B", bThoughtIndex);
      renderThought("B", bThoughtIndex, true);
      return;
    }
    cLyricElapsed = 0;
    bubbleIndex = chooseThoughtIndex("C", bubbleIndex);
    renderThought("C", bubbleIndex, true);
  }

  async function loadThoughtContent() {
    let loaded = null;
    try {
      if (desktop && typeof desktop.loadThoughts === "function") {
        loaded = await desktop.loadThoughts();
      } else {
        const response = await fetch("thoughts.json", { cache: "no-store" });
        if (response.ok) loaded = await response.json();
      }
    } catch {}
    if (!loaded) return;
    const normalize = value => Array.isArray(value)
      ? value.map(item => String(item).trim()).filter(Boolean)
      : typeof value === "string"
        ? value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
        : [];
    const nextB = normalize(loaded.B);
    const nextC = normalize(loaded.C);
    if (nextB.length) thoughts.B = nextB;
    if (nextC.length) thoughts.C = nextC;
    if (bubbleForm === "B") {
      bThoughtIndex = Math.min(bThoughtIndex, thoughtLinesFor("B").length - 1);
      renderThought("B", Math.max(0, bThoughtIndex));
    } else if (bubbleForm === "C") {
      bubbleIndex = Math.min(bubbleIndex, thoughtLinesFor("C").length - 1);
      renderThought("C", Math.max(0, bubbleIndex));
    }
  }

  function updateFormUI() {
    document.querySelectorAll(".form-tab").forEach(button => {
      button.classList.toggle("active", button.dataset.form === currentForm);
      button.setAttribute("aria-pressed", String(button.dataset.form === currentForm));
    });
    stateSelect.replaceChildren();
    FORMS[currentForm].states.forEach(state => {
      const option = document.createElement("option");
      option.value = state.id;
      option.textContent = state.label;
      stateSelect.append(option);
    });
    stateSelect.value = currentState;
  }

  function setForm(form, stateId = null) {
    if (!FORMS[form]) return;
    if (transitioning) {
      queuedTransform = { form, stateId };
      return;
    }
    if (form === currentForm) {
      setState(stateId || currentState);
      return;
    }
    const targetState = stateId || FORMS[form].states[0].id;
    runSimpleTransformation(form, targetState);
  }

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  async function runSimpleTransformation(targetForm, targetState) {
    const serial = ++transitionSerial;
    transitioning = true;
    clearSleepZ();
    const animation = motion.animate([
      { opacity: 1, transform: "scale(1)", filter: "brightness(1)" },
      { opacity: 0, transform: "scale(.78)", filter: "brightness(1.8)" }
    ], { duration: 170, fill: "forwards", easing: "ease-in" });
    await wait(170);
    if (serial !== transitionSerial) return;
    currentForm = targetForm;
    setState(targetState);
    updateFormUI();
    animation.cancel();
    motion.animate([
      { opacity: 0, transform: "scale(.78)", filter: "brightness(1.8)" },
      { opacity: 1, transform: "scale(1)", filter: "brightness(1)" }
    ], { duration: 230, easing: "cubic-bezier(.2,.9,.25,1.3)" });
    transitioning = false;
    if (targetForm === "B") {
      qSquash();
      showBThoughtBubble();
    }
    if (queuedTransform) {
      const queued = queuedTransform;
      queuedTransform = null;
      setForm(queued.form, queued.stateId);
    }
  }

  function qSquash() {
    if (squashAnimation) squashAnimation.cancel();
    squashAnimation = squash.animate([
      { transform: "scale(1, 1) translateY(0)" },
      { transform: "scale(1.16, .78) translateY(18px)", offset: .2 },
      { transform: "scale(.91, 1.13) translateY(-12px)", offset: .46 },
      { transform: "scale(1.055, .95) translateY(4px)", offset: .7 },
      { transform: "scale(.985, 1.018) translateY(-1px)", offset: .86 },
      { transform: "scale(1, 1) translateY(0)" }
    ], { duration: 480, easing: "ease-out" });
  }

  function playSqueak() {
    const sound = new Audio("assets/audio/duck-squeak.mp3");
    sound.volume = 0.65;
    sound.play().catch(() => {});
  }

  function handleClick() {
    if (sleepSlamBusy) return;
    const clickedForm = currentForm;
    const sleeping = clickedForm === "B" && currentState === "b-sleep";
    if (clickedForm !== "C") qSquash();
    playSqueak();
    if (sleeping) {
      for (let index = 0; index < 3; index += 1) spawnSleepZ();
      sleepZElapsed = 0;
      nextSleepZDelay = 0.65 + Math.random() * 0.45;
      return;
    }
    if (Math.random() < Core.CLICK_TRANSFORM_CHANCE) {
      let targetForm = Core.pickForm();
      if (targetForm === currentForm && FORMS[targetForm].states.length === 1) {
        targetForm = targetForm === "B" ? "C" : "B";
      }
      const candidates = FORMS[targetForm].states.filter(state => targetForm !== currentForm || state.id !== currentState);
      const pool = candidates.length ? candidates : FORMS[targetForm].states;
      const targetState = pool[Math.floor(Math.random() * pool.length)].id;
      setForm(targetForm, targetState);
      showToast("变身！");
      if (targetForm === "B" && clickedForm === "B") showBThoughtBubble();
      return;
    }
    if (currentForm === "B") showBThoughtBubble();
  }

  function openSettings() {
    settingsOpen = true;
    hovered = false;
    fillControls();
    errorText.textContent = "";
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    pet.classList.add("settings-open");
    pet.classList.remove("paused", "cursor-over");
    quitButton.hidden = !desktop;
    positionPanel();
    setDesktopInteractive(true);
  }

  function closeSettings() {
    settingsOpen = false;
    hovered = false;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    pet.classList.remove("settings-open", "paused", "cursor-over");
    pet.focus({ preventScroll: true });
  }

  function positionPanel() {
    if (!settingsOpen) return;
    const panelWidth = panel.offsetWidth || 348;
    const panelHeight = panel.offsetHeight || 580;
    const petSize = petMetrics();
    let left = path.x + petSize.width - 16;
    let top = path.y + petSize.height - panelHeight - 8;
    if (left + panelWidth > innerWidth - 10) left = path.x - panelWidth + 22;
    left = Core.clamp(left, 10, Math.max(10, innerWidth - panelWidth - 10));
    top = Core.clamp(top, 10, Math.max(10, innerHeight - panelHeight - 10));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function setDesktopInteractive(value) {
    if (!desktop || desktopInteractive === value) return;
    desktopInteractive = value;
    desktop.setInteractive(value);
  }

  function handlePointerRegion(event) {
    if (!desktop) return;
    const petRect = pet.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const bubbleRect = thoughtBubble.getBoundingClientRect();
    const inPet = event.clientX >= petRect.left && event.clientX <= petRect.right && event.clientY >= petRect.top && event.clientY <= petRect.bottom;
    const inPanel = settingsOpen && event.clientX >= panelRect.left && event.clientX <= panelRect.right && event.clientY >= panelRect.top && event.clientY <= panelRect.bottom;
    const inBubble = thoughtBubble.classList.contains("show") && event.clientX >= bubbleRect.left && event.clientX <= bubbleRect.right && event.clientY >= bubbleRect.top && event.clientY <= bubbleRect.bottom;
    setDesktopInteractive(inPet || inBubble || inPanel);
    if (inPet) {
      hovered = true;
      pet.classList.add("paused", "cursor-over");
    } else if (inBubble) {
      hovered = true;
      pet.classList.add("paused");
      pet.classList.remove("cursor-over");
    } else if (!settingsOpen) {
      hovered = false;
      pet.classList.remove("paused", "cursor-over");
    }
  }

  let dragStart = null;
  pet.addEventListener("pointerdown", event => {
    if (event.target.closest("button, .thought-bubble") || event.button !== 0) return;
    event.preventDefault();
    dragStart = { pointerX: event.clientX, pointerY: event.clientY, x: path.x, y: path.y, moved: false };
    pet.setPointerCapture(event.pointerId);
  });
  pet.addEventListener("pointermove", event => {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.pointerX;
    const dy = event.clientY - dragStart.pointerY;
    if (Math.hypot(dx, dy) > 6) {
      dragStart.moved = true;
      dragging = true;
      pet.classList.add("dragging");
      const size = petMetrics();
      path.x = Core.clamp(dragStart.x + dx, 0, Math.max(0, innerWidth - size.width));
      path.y = Core.clamp(dragStart.y + dy, minimumPetY(), Math.max(0, innerHeight - size.height));
    }
  });
  function finishDrag(event) {
    if (!dragStart) return;
    const wasMoved = dragStart.moved;
    dragStart = null;
    dragging = false;
    pet.classList.remove("dragging");
    if (pet.hasPointerCapture(event.pointerId)) pet.releasePointerCapture(event.pointerId);
    if (wasMoved) path.chooseDestination();
    else handleClick();
  }
  pet.addEventListener("pointerup", finishDrag);
  pet.addEventListener("pointercancel", event => {
    dragStart = null;
    dragging = false;
    pet.classList.remove("dragging");
    if (pet.hasPointerCapture(event.pointerId)) pet.releasePointerCapture(event.pointerId);
  });
  pet.addEventListener("pointerenter", () => { hovered = true; pet.classList.add("paused", "cursor-over"); });
  pet.addEventListener("pointerleave", () => { hovered = false; pet.classList.remove("paused", "cursor-over"); });
  pet.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target === pet) {
      event.preventDefault();
      handleClick();
    }
  });
  document.addEventListener("pointermove", handlePointerRegion, { passive: true });

  thoughtBubble.addEventListener("pointerdown", event => event.stopPropagation());
  thoughtBubble.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    advanceThoughtBubble();
  });
  thoughtBubble.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      advanceThoughtBubble();
    }
  });

  gear.addEventListener("click", event => { event.stopPropagation(); settingsOpen ? closeSettings() : openSettings(); });
  document.getElementById("close-settings").addEventListener("click", closeSettings);
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeSettings(); });
  document.querySelectorAll(".form-tab").forEach(button => button.addEventListener("click", () => setForm(button.dataset.form)));
  stateSelect.addEventListener("change", () => setState(stateSelect.value));
  alarmButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    ringAlarm();
  });

  document.querySelectorAll("[data-setting]").forEach(input => {
    input.addEventListener("input", () => {
      updateOutput(input.dataset.setting, input.value);
      errorText.textContent = "";
    });
  });
  document.querySelectorAll("[data-appearance]").forEach(select => {
    select.addEventListener("change", () => { errorText.textContent = ""; });
  });

  document.getElementById("save-settings").addEventListener("click", () => {
    const candidate = {};
    document.querySelectorAll("[data-setting]").forEach(input => { candidate[input.dataset.setting] = Number(input.value); });
    const validation = Core.validateSettings(candidate);
    if (!validation.ok) {
      errorText.textContent = validation.message;
      return;
    }
    const appearanceCandidate = {};
    document.querySelectorAll("[data-appearance]").forEach(select => {
      appearanceCandidate[select.dataset.appearance] = select.value;
    });
    const previousSize = petMetrics();
    settings = validation.settings;
    appearance = sanitizeAppearance(appearanceCandidate);
    const nextSize = petMetrics();
    path.x += (previousSize.width - nextSize.width) / 2;
    path.y += previousSize.height - nextSize.height;
    customized = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    } catch {
      showToast("参数已应用，但本地保存不可用");
    }
    applyAppearance();
    applyPetScale();
    path.setPosition(path.x, path.y);
    loadThoughtContent();
    path.chooseDestination();
    positionPanel();
    updateStatus();
    errorText.textContent = "";
    showToast("参数已保存并应用");
  });

  document.getElementById("reset-settings").addEventListener("click", () => {
    const previousSize = petMetrics();
    settings = { ...Core.DEFAULTS };
    appearance = { ...DEFAULT_APPEARANCE };
    customized = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(APPEARANCE_KEY);
    } catch {}
    const nextSize = petMetrics();
    path.x += (previousSize.width - nextSize.width) / 2;
    path.y += previousSize.height - nextSize.height;
    fillControls();
    path.setPosition(path.x, path.y);
    path.chooseDestination();
    positionPanel();
    errorText.textContent = "";
    showToast("已恢复保守参数");
  });

  quitButton.addEventListener("click", () => { if (desktop) desktop.quit(); });
  window.addEventListener("resize", () => {
    path.setPosition(path.x, path.y);
    positionPanel();
  });

  let previousTime = performance.now();
  function tick(now) {
    const dt = (now - previousTime) / 1000;
    previousTime = now;
    const stationary = currentState === "b-idle" || currentState === "b-sleep";
    const visualPaused = hovered || dragging || transitioning || document.hidden;
    const suspended = settingsOpen || stationary || visualPaused;
    const events = path.update(dt, suspended, currentForm !== "C");
    for (const event of events) {
      if (event.type === "collision" && currentForm !== "C") qSquash();
      if (event.type === "pause" && event.sleep) setForm("B", "b-sleep");
    }
    if (currentForm === "C" && !suspended) {
      cLyricElapsed += dt;
      if (cLyricElapsed >= C_LYRIC_INTERVAL) advanceThoughtBubble();
    }
    if (currentForm === "B" && currentState === "b-wings" && !visualPaused) {
      wingElapsed += dt;
      const frame = Math.floor((wingElapsed * 24) % 24);
      const artIndex = Math.floor(frame / 3);
      if (artIndex !== wingArtIndex) {
        wingArtIndex = artIndex;
        sprite.src = WING_FRAME_PATHS[artIndex];
      }
    }
    if (currentForm === "B" && currentState === "b-sleep" && !visualPaused) {
      sleepZElapsed += dt;
      if (sleepZElapsed >= nextSleepZDelay) {
        sleepZElapsed = 0;
        nextSleepZDelay = 0.38 + Math.random() * 0.42;
        spawnSleepZ();
      }
    }
    const minY = minimumPetY();
    if (path.y < minY) {
      path.y = minY;
      if (path.destinationY < minY) path.chooseDestination();
    }
    pet.style.transform = `translate3d(${path.x.toFixed(2)}px, ${path.y.toFixed(2)}px, 0)`;
    flip.style.transform = `scaleX(${path.facing})`;
    positionPanel();
    requestAnimationFrame(tick);
  }

  function preloadAssets() {
    const files = new Set(Object.values(FORMS).flatMap(form => form.states).map(state => state.file));
    WING_FRAME_PATHS.forEach(file => files.add(file));
    files.forEach(file => { const image = new Image(); image.src = file; });
  }

  async function loadAppVersion() {
    try {
      const version = await desktop?.getVersion?.();
      if (version) appVersionLabel.textContent = `gpt-luna-pet v${version}`;
    } catch {}
  }

  updateFormUI();
  fillControls();
  preloadAssets();
  loadThoughtContent();
  loadAppVersion();
  setDesktopInteractive(false);
  pet.style.transform = `translate3d(${path.x.toFixed(2)}px, ${path.y.toFixed(2)}px, 0)`;
  flip.style.transform = `scaleX(${path.facing})`;
  requestAnimationFrame(tick);
})();
