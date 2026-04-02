import "./style.css";
import { drawEgg } from "./eggDraw";
import { Game } from "./game";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const hintCanvas = document.querySelector<HTMLCanvasElement>("#target-hint");
const hintBtn = document.querySelector<HTMLButtonElement>("#hint-btn");
const winEl = document.querySelector<HTMLDivElement>("#win");
const winGoldenEl = document.querySelector<HTMLParagraphElement>("#win-golden");
const winScoreEl = document.querySelector<HTMLParagraphElement>("#win-score");
const runningScoreEl = document.querySelector<HTMLSpanElement>("#running-score");
const replayBtn = document.querySelector<HTMLButtonElement>("#replay");
const openShareBtn = document.querySelector<HTMLButtonElement>("#open-share");
const shareSheet = document.querySelector<HTMLDivElement>("#share-sheet");
const shareBackdrop = document.querySelector<HTMLDivElement>("#share-sheet-backdrop");
const shareTextPreview = document.querySelector<HTMLParagraphElement>("#share-text-preview");
const shareNativeBtn = document.querySelector<HTMLButtonElement>("#share-native");
const shareCopyBtn = document.querySelector<HTMLButtonElement>("#share-copy");
const shareCloseBtn = document.querySelector<HTMLButtonElement>("#share-close");
const timerEl = document.querySelector<HTMLSpanElement>("#timer");
const peekBtn = document.querySelector<HTMLButtonElement>("#peek-btn");
const peekOverlay = document.querySelector<HTMLDivElement>("#peek-overlay");
const peekThumbCanvas = document.querySelector<HTMLCanvasElement>("#peek-thumb");
const scoreBtnEl = document.querySelector<HTMLButtonElement>("#score-btn");
const pauseScreenEl = document.querySelector<HTMLDivElement>("#pause-screen");
const pauseShareBtn = document.querySelector<HTMLButtonElement>("#pause-share");
const pauseResumeBtn = document.querySelector<HTMLButtonElement>("#pause-resume");
const nextRoundBtnEl = document.querySelector<HTMLButtonElement>("#next-round-btn");
const interactionBlockerEl = document.querySelector<HTMLDivElement>("#interaction-blocker");
const topRowEl = document.querySelector<HTMLDivElement>(".top-row");
const startScreenEl = document.querySelector<HTMLDivElement>("#start-screen");
const startPlayBtn = document.querySelector<HTMLButtonElement>("#start-play-btn");

if (
  !canvas ||
  !hintCanvas ||
  !hintBtn ||
  !winEl ||
  !winGoldenEl ||
  !winScoreEl ||
  !runningScoreEl ||
  !replayBtn ||
  !openShareBtn ||
  !shareSheet ||
  !shareBackdrop ||
  !shareTextPreview ||
  !shareNativeBtn ||
  !shareCopyBtn ||
  !shareCloseBtn ||
  !timerEl ||
  !peekBtn ||
  !peekOverlay ||
  !peekThumbCanvas ||
  !scoreBtnEl ||
  !pauseScreenEl ||
  !pauseShareBtn ||
  !pauseResumeBtn ||
  !nextRoundBtnEl ||
  !interactionBlockerEl ||
  !topRowEl ||
  !startScreenEl ||
  !startPlayBtn
) {
  throw new Error("Missing DOM nodes");
}

const gameCanvas = canvas;
const hintCanvasEl = hintCanvas;
const hintButton = hintBtn;
const winElement = winEl;
const winGoldenElement = winGoldenEl;
const winScoreElement = winScoreEl;
const runningScoreSpan = runningScoreEl;
const replayButton = replayBtn;
const openShareButton = openShareBtn;
const shareSheetEl = shareSheet;
const shareBackdropEl = shareBackdrop;
const shareTextPreviewEl = shareTextPreview;
const shareNativeButton = shareNativeBtn;
const shareCopyButton = shareCopyBtn;
const shareCloseButton = shareCloseBtn;
const timerElement = timerEl;
const peekButton = peekBtn;
const peekOverlayEl = peekOverlay;
const peekThumbEl = peekThumbCanvas;
const scoreButton = scoreBtnEl;
const pauseScreen = pauseScreenEl;
const pauseShareButton = pauseShareBtn;
const pauseResumeButton = pauseResumeBtn;
const nextRoundButton = nextRoundBtnEl;
const interactionBlocker = interactionBlockerEl;
const startScreen = startScreenEl;

const game = new Game(gameCanvas);

let gameHasStarted = false;

/** True while showing the forced hint after "Next Round" — block play until the new round starts. */
let inputLockedForHintReveal = false;

/**
 * When the peek overlay or Next Round button is up (or we're in the hint-reveal pause),
 * block all interaction with the top row and canvas so only the overlay / Next Round is tappable.
 */
function syncInteractionBlocker(): void {
  const peekOpen =
    !game.isGoldenYolkRound && !peekOverlayEl.classList.contains("hidden");
  const nextVisible = !nextRoundButton.classList.contains("hidden");
  const block = peekOpen || nextVisible || inputLockedForHintReveal;
  const peekOnlyBlock = peekOpen && !nextVisible && !inputLockedForHintReveal;

  interactionBlocker.classList.toggle("hidden", !block);
  interactionBlocker.classList.toggle("interaction-blocker--canvas-only", peekOnlyBlock);

  gameCanvas.toggleAttribute("inert", block);

  if (!block) {
    topRowEl!.toggleAttribute("inert", false);
    timerElement.toggleAttribute("inert", false);
    scoreButton.toggleAttribute("inert", false);
  } else if (peekOnlyBlock) {
    /* Peek overlay open: leave peek button active; block timer/score only. */
    topRowEl!.toggleAttribute("inert", false);
    timerElement.toggleAttribute("inert", true);
    scoreButton.toggleAttribute("inert", true);
  } else {
    topRowEl!.toggleAttribute("inert", true);
    timerElement.toggleAttribute("inert", false);
    scoreButton.toggleAttribute("inert", false);
  }
}

// Configure native status bar and hide splash screen when running as a native app
void StatusBar.setStyle({ style: Style.Dark }).catch(() => {
  // Silently ignore – not running in a native Capacitor context (e.g. web browser)
});
void SplashScreen.hide().catch(() => {
  // Silently ignore – not running in a native Capacitor context
});

const canUseNativeShare =
  typeof navigator !== "undefined" && typeof navigator.share === "function";

function buildShareMessage(): { text: string; url: string } {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `I scored ${totalScore} in Egg Hunt! Can you find the egg?`;
  return { text, url };
}

function setShareSheetOpen(open: boolean): void {
  shareSheetEl.classList.toggle("hidden", !open);
  shareSheetEl.setAttribute("aria-hidden", open ? "false" : "true");
  if (open) {
    const { text, url } = buildShareMessage();
    shareTextPreviewEl.textContent = url ? `${text}\n\n${url}` : text;
    shareNativeButton.hidden = !canUseNativeShare;
    shareNativeButton.disabled = !canUseNativeShare;
  }
}

async function copyShareMessage(): Promise<void> {
  const { text, url } = buildShareMessage();
  const full = url ? `${text}\n${url}` : text;
  try {
    await navigator.clipboard.writeText(full);
    const prev = shareCopyButton.textContent;
    shareCopyButton.textContent = "Copied!";
    window.setTimeout(() => {
      shareCopyButton.textContent = prev;
    }, 1600);
  } catch {
    shareCopyButton.textContent = "Copy failed";
    window.setTimeout(() => {
      shareCopyButton.textContent = "Copy message";
    }, 1600);
  }
}

async function runNativeShare(): Promise<void> {
  if (!canUseNativeShare) return;
  const { text, url } = buildShareMessage();
  try {
    await navigator.share({
      title: "Egg Hunt",
      text,
      url: url || undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    await copyShareMessage();
  }
}

/** Session total until refresh; floored at 0. */
let totalScore = 0;

const PTS_CORRECT_GOLDEN_NO_HINT = 50;
const PTS_CORRECT_WITH_HINT = 0;
const PTS_WRONG_EGG = -1;

/** Crossing each multiple of this score (250, 500, …) unlocks the next Golden Yolk round. */
const GOLDEN_YOLK_SCORE_STEP = 250;

/** Internal length of a normal round; UI stays at 60 for the first two ticks (62→61) then follows 60…0. */
const ROUND_TIME_NORMAL = 61;
const ROUND_TIME_GOLDEN = 20;
/** Hint unlocks when the on-screen countdown shows this value or lower (normal rounds only). */
const HINT_UNLOCK_DISPLAYED = 30;

let timeRemaining = ROUND_TIME_NORMAL;
let timerInterval: ReturnType<typeof setInterval> | null = null;
/** True while the pause screen is open; timer ticks are skipped. */
let timerPaused = false;

/** Seconds shown in the HUD (golden rounds use the raw internal countdown). */
function getDisplayedTimeRemaining(): number {
  if (game.isGoldenYolkRound) return timeRemaining;
  return timeRemaining > 60 ? 60 : timeRemaining;
}

function updateTimerDisplay(): void {
  const d = getDisplayedTimeRemaining();
  timerElement.textContent = String(d);
  timerElement.classList.toggle("urgent", d <= 10);
}

function stopTimer(): void {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer(duration: number): void {
  stopTimer();
  timeRemaining = duration;
  timerPaused = false;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    if (timerPaused) return;
    timeRemaining = Math.max(0, timeRemaining - 1);
    updateTimerDisplay();
    if (!game.isGoldenYolkRound && getDisplayedTimeRemaining() <= HINT_UNLOCK_DISPLAYED && !game.hintShown) {
      hintButton.disabled = false;
    }
    if (timeRemaining <= 0) {
      stopTimer();
      handleTimeUp();
    }
  }, 1000);
}

function cancelFlash(): void {
  if (flashRAF !== null) {
    cancelAnimationFrame(flashRAF);
    flashRAF = null;
  }
}

const PTS_TIMEOUT_PENALTY = -10;

function handleTimeUp(): void {
  cancelFlash();
  closePeekOverlay();
  // Penalty applies when the player taps "Next Round" (not when the timer hits zero).
  // Hide hint button, replace with Next Round button
  hintButton.hidden = true;
  nextRoundButton.classList.remove("hidden");
  syncInteractionBlocker();
}

let pendingGoldenYolkRound = false;

function crossedGoldenMilestone(scoreBefore: number, scoreAfter: number): boolean {
  return (
    Math.floor(scoreBefore / GOLDEN_YOLK_SCORE_STEP) <
    Math.floor(scoreAfter / GOLDEN_YOLK_SCORE_STEP)
  );
}

function updateRunningScoreDisplay(): void {
  runningScoreSpan.textContent = String(totalScore);
}

function addScore(delta: number): void {
  totalScore = Math.max(0, totalScore + delta);
  updateRunningScoreDisplay();
}

// ─── Canvas flash feedback ────────────────────────────────────────────────────

let flashRAF: number | null = null;

/**
 * Draws a fading colour overlay on the game canvas for ~600ms.
 * game.draw() is called each frame so the eggs remain visible underneath.
 */
function triggerFlash(
  r: number,
  g: number,
  b: number,
  label: string,
  onComplete?: () => void,
): void {
  if (flashRAF !== null) {
    cancelAnimationFrame(flashRAF);
    flashRAF = null;
  }
  const DURATION = 350;
  const startTime = performance.now();
  const ctx = gameCanvas.getContext("2d");
  if (!ctx) {
    onComplete?.();
    return;
  }

  const frame = (now: number): void => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / DURATION);
    const alpha = 0.32 * (1 - progress);

    // Redraw eggs first (this sets the transform to dpr scale and clears the canvas)
    game.draw();

    // Flash overlay in CSS pixel space (same transform left by game.draw)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fillRect(0, 0, game.viewWidth, game.viewHeight);

    if (label && alpha > 0.02) {
      const fontSize = Math.max(22, Math.floor(game.viewHeight * 0.055));
      ctx.save();
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Dark shadow for legibility
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 4)})`;
      ctx.fillText(label, game.viewWidth / 2, game.viewHeight / 2);
      ctx.restore();
    }

    if (progress < 1) {
      flashRAF = requestAnimationFrame(frame);
    } else {
      flashRAF = null;
      game.draw();
      onComplete?.();
    }
  };

  flashRAF = requestAnimationFrame(frame);
}

// ─── Peek overlay ────────────────────────────────────────────────────────────

let roundPreviewTimeout: ReturnType<typeof setTimeout> | null = null;

function setPeekOpen(open: boolean): void {
  peekOverlayEl.classList.toggle("hidden", !open);
  peekButton.setAttribute("aria-expanded", open ? "true" : "false");
  syncInteractionBlocker();
}

function closePeekOverlay(): void {
  setPeekOpen(false);
}

/**
 * At the start of each normal round, auto-open the peek overlay for 3 seconds
 * so the player sees which egg to find. The timer is paused during this preview.
 * Closing early via the X button also unpauses the timer immediately.
 */
function showRoundPreview(): void {
  if (game.isGoldenYolkRound) {
    syncInteractionBlocker();
    return;
  }
  if (roundPreviewTimeout !== null) {
    clearTimeout(roundPreviewTimeout);
    roundPreviewTimeout = null;
  }
  setPeekOpen(true);
  timerPaused = true;
  roundPreviewTimeout = setTimeout(() => {
    roundPreviewTimeout = null;
    closePeekOverlay();
    timerPaused = false;
  }, 3000);
}

/** Called when the user manually closes the peek overlay mid-preview. */
function onPeekClosedByUser(): void {
  if (roundPreviewTimeout !== null) {
    clearTimeout(roundPreviewTimeout);
    roundPreviewTimeout = null;
    timerPaused = false;
  }
  closePeekOverlay();
}

// ─── Pause screen ─────────────────────────────────────────────────────────────

function setPauseOpen(open: boolean): void {
  pauseScreen.classList.toggle("hidden", !open);
  timerPaused = open;
}

// ─── Golden mode UI sync ──────────────────────────────────────────────────────

function syncGoldenModeUi(): void {
  document.getElementById("app")?.classList.toggle("golden-mode", game.isGoldenYolkRound);
  if (game.isGoldenYolkRound) {
    const ctx = hintCanvasEl.getContext("2d");
    if (ctx) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = 112;
      const cssH = 148;
      hintCanvasEl.width = Math.floor(cssW * dpr);
      hintCanvasEl.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
    }
    hintButton.disabled = true;
    closePeekOverlay();
    clearPeekThumb();
  } else {
    drawTargetHint();
    // Hint starts locked; the timer enables it when the on-screen countdown reaches HINT_UNLOCK_DISPLAYED.
    hintButton.disabled = true;
  }
}

function clearPeekThumb(): void {
  const ctx = peekThumbEl.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = 40;
  const cssH = 40;
  peekThumbEl.width = Math.floor(cssW * dpr);
  peekThumbEl.height = Math.floor(cssH * dpr);
  peekThumbEl.style.width = `${cssW}px`;
  peekThumbEl.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.fillRect(0, 0, cssW, cssH);
}

/** Mini target egg on the peek toggle (same pattern as the large hint panel). */
function drawPeekThumb(): void {
  const ctx = peekThumbEl.getContext("2d");
  const egg = game.getTargetEgg();
  if (!ctx || !egg) {
    clearPeekThumb();
    return;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = 40;
  const cssH = 40;
  peekThumbEl.width = Math.floor(cssW * dpr);
  peekThumbEl.height = Math.floor(cssH * dpr);
  peekThumbEl.style.width = `${cssW}px`;
  peekThumbEl.style.height = `${cssH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "rgba(252, 248, 255, 0.98)";
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.save();
  ctx.translate(cssW / 2, cssH / 2);
  drawEgg(ctx, egg.style, 17, egg.rotation);
  ctx.restore();
}

function drawTargetHint(): void {
  const ctx = hintCanvasEl.getContext("2d");
  const egg = game.getTargetEgg();
  if (!ctx || !egg) {
    clearPeekThumb();
    return;
  }

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = 112;
  const cssH = 148;
  hintCanvasEl.width = Math.floor(cssW * dpr);
  hintCanvasEl.height = Math.floor(cssH * dpr);
  hintCanvasEl.style.width = `${cssW}px`;
  hintCanvasEl.style.height = `${cssH}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "rgba(252, 248, 255, 0.98)";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.save();
  ctx.translate(cssW / 2, cssH / 2);
  // Use a fixed preview scale so the egg fills the hint panel regardless of game egg size.
  drawEgg(ctx, egg.style, 36, egg.rotation);
  ctx.restore();

  drawPeekThumb();
}

function syncCanvasSize(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  // Measure the canvas element directly so the top row height is excluded.
  const w = Math.max(1, Math.floor(gameCanvas.clientWidth || window.innerWidth));
  const h = Math.max(320, Math.floor(gameCanvas.clientHeight || window.innerHeight * 0.85));
  gameCanvas.width = Math.floor(w * dpr);
  gameCanvas.height = Math.floor(h * dpr);
  game.resize(w, h, dpr);
  syncGoldenModeUi();
}

function showWin(show: boolean, goldenUnlocked = false): void {
  winElement.classList.toggle("hidden", !show);
  if (!show) {
    setShareSheetOpen(false);
    // Ensure Next Round button is gone and hint button is visible on replay
    nextRoundButton.classList.add("hidden");
    hintButton.hidden = false;
    inputLockedForHintReveal = false;
    syncInteractionBlocker();
  }
  if (show) {
    hintButton.disabled = true;
    winScoreElement.textContent = `Total score: ${totalScore}`;
    winScoreElement.hidden = false;
    const showGoldenLine = goldenUnlocked;
    winGoldenElement.classList.toggle("hidden", !showGoldenLine);
    winGoldenElement.hidden = !showGoldenLine;
  } else {
    winScoreElement.hidden = true;
    winGoldenElement.hidden = true;
    winGoldenElement.classList.add("hidden");
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

replayButton.addEventListener("click", () => {
  const useGolden = pendingGoldenYolkRound;
  pendingGoldenYolkRound = false;
  showWin(false);
  game.newRound(useGolden);
  syncGoldenModeUi();
  startTimer(useGolden ? ROUND_TIME_GOLDEN : ROUND_TIME_NORMAL);
  showRoundPreview();
});

openShareButton.addEventListener("click", () => {
  setShareSheetOpen(true);
});

shareBackdropEl.addEventListener("click", () => {
  setShareSheetOpen(false);
});

shareCloseButton.addEventListener("click", () => {
  setShareSheetOpen(false);
});

shareNativeButton.addEventListener("click", () => {
  void runNativeShare();
});

shareCopyButton.addEventListener("click", () => {
  void copyShareMessage();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!shareSheetEl.classList.contains("hidden")) {
    setShareSheetOpen(false);
    return;
  }
  if (!pauseScreen.classList.contains("hidden")) {
    setPauseOpen(false);
    return;
  }
  if (!peekOverlayEl.classList.contains("hidden")) {
    onPeekClosedByUser();
  }
});

hintButton.addEventListener("click", () => {
  if (game.hasWon) return;
  game.showHint();
  hintButton.disabled = true;
});

peekButton.addEventListener("click", () => {
  if (!gameHasStarted) return;
  if (peekOverlayEl.classList.contains("hidden")) {
    setPeekOpen(true);
  } else {
    onPeekClosedByUser();
  }
});

scoreButton.addEventListener("click", () => {
  if (!gameHasStarted || game.hasWon) return;
  setPauseOpen(true);
});

pauseResumeButton.addEventListener("click", () => {
  setPauseOpen(false);
});

pauseShareButton.addEventListener("click", () => {
  setShareSheetOpen(true);
});

nextRoundButton.addEventListener("click", () => {
  addScore(PTS_TIMEOUT_PENALTY);
  nextRoundButton.classList.add("hidden");
  inputLockedForHintReveal = true;
  syncInteractionBlocker();
  // Show where the egg was via the hint arrow
  game.forceShowHint();
  // Give the player 2 seconds to see the egg location, then advance
  window.setTimeout(() => {
    hintButton.hidden = false;
    hintButton.disabled = true;
    pendingGoldenYolkRound = false;
    game.newRound(false);
    syncGoldenModeUi();
    startTimer(ROUND_TIME_NORMAL);
    inputLockedForHintReveal = false;
    showRoundPreview();
    syncInteractionBlocker();
  }, 2000);
});

startPlayBtn.addEventListener("click", () => {
  if (gameHasStarted) return;
  gameHasStarted = true;
  startScreen.classList.add("hidden");
  startScreen.setAttribute("aria-hidden", "true");
  startTimer(ROUND_TIME_NORMAL);
  showRoundPreview();
});

gameCanvas.addEventListener(
  "pointerdown",
  (e) => {
    if (e.button !== 0) return;
    if (!gameHasStarted) return;
    // Ignore taps when overlays are blocking
    if (!pauseScreen.classList.contains("hidden")) return;
    if (!winElement.classList.contains("hidden")) return;
    const rect = gameCanvas.getBoundingClientRect();
    const vw = game.viewWidth;
    const vh = game.viewHeight;
    if (vw <= 0 || vh <= 0 || rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * vw;
    const y = ((e.clientY - rect.top) / rect.height) * vh;
    game.handlePointer(
      x,
      y,
      () => {
        stopTimer();
        closePeekOverlay();
        const scoreBefore = totalScore;
        const roundPts = game.hintShown
          ? PTS_CORRECT_WITH_HINT
          : game.isGoldenYolkRound
            ? PTS_CORRECT_GOLDEN_NO_HINT
            : getDisplayedTimeRemaining();
        addScore(roundPts);
        const goldenUnlocked = crossedGoldenMilestone(scoreBefore, totalScore);
        if (goldenUnlocked) pendingGoldenYolkRound = true;
        hintButton.disabled = true;
        // Green flash, then show win overlay once it's visible
        triggerFlash(0, 180, 0, "", () => {
          showWin(true, goldenUnlocked);
        });
      },
      () => {
        addScore(PTS_WRONG_EGG);
        triggerFlash(220, 30, 30, "-1 pt");
      },
    );
  },
  { passive: true },
);

const ro = new ResizeObserver(() => {
  syncCanvasSize();
});
ro.observe(gameCanvas);

syncCanvasSize();
window.addEventListener("resize", syncCanvasSize);
