/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Game } from './engine/Game';
import { TargetingMode, TowerType } from './entities/Tower';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Game canvas element not found');

  // Initialize Game instance
  const game = new Game(canvas);

  // -------------------------------------------------------------
  // HiDPI / Retina Canvas Viewport Setup
  // -------------------------------------------------------------
  function setupHiDPICanvas() {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = 1000;
    const logicalHeight = 650;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    // Scale canvas context to map logical units to high-res pixels
    game.ctx.scale(dpr, dpr);
  }
  setupHiDPICanvas();

  // -------------------------------------------------------------
  // Mouse & Pointer Interaction
  // -------------------------------------------------------------
  function getCanvasCoordinates(e: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width * (window.devicePixelRatio || 1));
    const scaleY = canvas.height / (rect.height * (window.devicePixelRatio || 1));
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const coords = getCanvasCoordinates(e);
    game.mousePixelX = coords.x;
    game.mousePixelY = coords.y;
    game.mouseGridX = Math.floor(coords.x / game.cellWidth);
    game.mouseGridY = Math.floor(coords.y / game.cellHeight);
    game.isMouseInsideCanvas = true;
  });

  canvas.addEventListener('mouseenter', () => {
    game.isMouseInsideCanvas = true;
  });

  canvas.addEventListener('mouseleave', () => {
    game.isMouseInsideCanvas = false;
  });

  canvas.addEventListener('click', () => {
    // If a tower archetype is selected in build menu, attempt placement
    if (game.selectedBuildType) {
      const placed = game.buildTowerAtHover();
      if (placed) {
        // Clear build selection after successful placement
        clearBuildSelection();
      }
      return;
    }

    // Otherwise, check if user clicked on an existing placed tower
    const clickedTower = game.getTowerAt(game.mouseGridX, game.mouseGridY);
    if (clickedTower) {
      game.selectTower(clickedTower);
    } else {
      // Clicked on empty terrain, deselect
      game.selectTower(null);
    }
  });

  // Right-click cancels build mode
  canvas.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    clearBuildSelection();
    game.selectTower(null);
  });

  // -------------------------------------------------------------
  // Sidebar Build Card Selector
  // -------------------------------------------------------------
  const towerCards = document.querySelectorAll('.tower-card');

  function clearBuildSelection() {
    game.selectedBuildType = null;
    towerCards.forEach((c) => c.classList.remove('selected'));
  }

  function selectBuildCard(type: TowerType) {
    if (game.selectedBuildType === type) {
      // Toggle off if already selected
      clearBuildSelection();
      return;
    }

    clearBuildSelection();
    game.selectTower(null); // Clear selected existing tower

    const card = document.getElementById(`card-tower-${type}`);
    if (card) {
      card.classList.add('selected');
      game.selectedBuildType = type;
    }
  }

  towerCards.forEach((card) => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-tower') as TowerType;
      if (type) {
        selectBuildCard(type);
      }
    });
  });

  // -------------------------------------------------------------
  // Inspector Panel Action Bindings
  // -------------------------------------------------------------
  const btnUpgrade = document.getElementById('btn-upgrade-tower');
  btnUpgrade?.addEventListener('click', () => {
    game.upgradeSelectedTower();
  });

  const btnSell = document.getElementById('btn-sell-tower');
  btnSell?.addEventListener('click', () => {
    game.sellSelectedTower();
  });

  // Targeting Mode Pills
  const targetingPills = document.querySelectorAll('.target-pill');
  targetingPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const mode = pill.getAttribute('data-mode') as TargetingMode;
      if (mode) {
        game.setTargetingMode(mode);
      }
    });
  });

  // -------------------------------------------------------------
  // Top Command Bar Controls
  // -------------------------------------------------------------
  const btnNextWave = document.getElementById('btn-next-wave');
  btnNextWave?.addEventListener('click', () => {
    game.startNextWave(true);
  });

  const btnSpeed1 = document.getElementById('btn-speed-1');
  const btnSpeed2 = document.getElementById('btn-speed-2');
  const btnSpeed4 = document.getElementById('btn-speed-4');
  const speedBtns = [btnSpeed1, btnSpeed2, btnSpeed4];

  function setSpeed(multiplier: number, activeBtn: HTMLElement | null) {
    game.speedMultiplier = multiplier;
    game.isPaused = false;
    speedBtns.forEach((b) => b?.classList.remove('active'));
    activeBtn?.classList.add('active');
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.textContent = '⏸';
  }

  btnSpeed1?.addEventListener('click', () => setSpeed(1.0, btnSpeed1));
  btnSpeed2?.addEventListener('click', () => setSpeed(2.0, btnSpeed2));
  btnSpeed4?.addEventListener('click', () => setSpeed(4.0, btnSpeed4));

  const btnPause = document.getElementById('btn-pause');
  btnPause?.addEventListener('click', () => {
    game.isPaused = !game.isPaused;
    btnPause.textContent = game.isPaused ? '▶' : '⏸';
    if (!game.isPaused) {
      speedBtns.forEach((b) => b?.classList.remove('active'));
      if (game.speedMultiplier === 1) btnSpeed1?.classList.add('active');
      else if (game.speedMultiplier === 2) btnSpeed2?.classList.add('active');
      else if (game.speedMultiplier === 4) btnSpeed4?.classList.add('active');
    }
  });

  const btnSound = document.getElementById('btn-sound');
  btnSound?.addEventListener('click', () => {
    const isMuted = game.sound.toggleMute();
    btnSound.textContent = isMuted ? '🔇' : '🔊';
  });

  const btnReset = document.getElementById('btn-reset');
  btnReset?.addEventListener('click', () => {
    if (confirm('Restart battlefield operation?')) {
      game.restart();
      clearBuildSelection();
    }
  });

  const btnModalRestart = document.getElementById('btn-modal-restart');
  btnModalRestart?.addEventListener('click', () => {
    game.restart();
    clearBuildSelection();
  });

  // -------------------------------------------------------------
  // Keyboard Hotkeys
  // -------------------------------------------------------------
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    // Prevent default scrolling for Space
    if (e.code === 'Space') {
      e.preventDefault();
      btnPause?.click();
      return;
    }

    if (key === '1') {
      selectBuildCard('gatling');
    } else if (key === '2') {
      selectBuildCard('mortar');
    } else if (key === '3') {
      selectBuildCard('frost');
    } else if (key === 'escape') {
      clearBuildSelection();
      game.selectTower(null);
    } else if (key === 'n') {
      game.startNextWave(true);
    } else if (key === 'u') {
      game.upgradeSelectedTower();
    } else if (key === 's') {
      game.sellSelectedTower();
    }
  });

  // -------------------------------------------------------------
  // Animation & Execution Loop Runner
  // -------------------------------------------------------------
  let lastFrameTime = performance.now();

  function gameLoop(currentFrameTime: number) {
    const dt = (currentFrameTime - lastFrameTime) / 1000;
    lastFrameTime = currentFrameTime;

    // Execute state updates
    game.update(dt);

    // Render single canvas frame
    game.render();

    requestAnimationFrame(gameLoop);
  }

  // Kickoff animation loop
  requestAnimationFrame((time) => {
    lastFrameTime = time;
    requestAnimationFrame(gameLoop);
  });
});
