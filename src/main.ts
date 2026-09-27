/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Game, GameMode, MapSector } from './engine/Game';
import { EnemyType } from './entities/Enemy';
import { HazardType } from './entities/Hazards';
import { TargetingMode, TowerType } from './entities/Tower';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Game canvas element not found');

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

    game.ctx.scale(dpr, dpr);
  }
  setupHiDPICanvas();

  // -------------------------------------------------------------
  // Coordinate Mapping
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
    // 1. If an active commander ability is being targeted, trigger ground strike!
    if (game.activeAbilityTarget) {
      game.executeGroundTargetedAbility(game.mousePixelX, game.mousePixelY);
      return;
    }

    // 2. If a trap is selected, attempt trap deployment
    if (game.selectedBuildTrap) {
      const placed = game.buildTrapAtHover();
      if (placed) {
        clearBuildSelection();
      }
      return;
    }

    // 3. If a tower archetype is selected in build menu, attempt placement
    if (game.selectedBuildType) {
      const placed = game.buildTowerAtHover();
      if (placed) {
        clearBuildSelection();
      }
      return;
    }

    // 4. Otherwise, inspect clicked tower or deselect
    const clickedTower = game.getTowerAt(game.mouseGridX, game.mouseGridY);
    if (clickedTower) {
      game.selectTower(clickedTower);
    } else {
      game.selectTower(null);
    }
  });

  // Right-click cancels build / ability targeting mode
  canvas.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    clearBuildSelection();
    game.activeAbilityTarget = null;
    game.selectTower(null);
  });

  // -------------------------------------------------------------
  // Sidebar Build Card Selector
  // -------------------------------------------------------------
  const towerCards = document.querySelectorAll('.tower-card');
  const trapCards = document.querySelectorAll('.trap-card');

  function clearBuildSelection() {
    game.selectedBuildType = null;
    game.selectedBuildTrap = null;
    towerCards.forEach((c) => c.classList.remove('selected'));
    trapCards.forEach((c) => c.classList.remove('selected'));
  }

  function selectBuildCard(type: TowerType) {
    if (game.selectedBuildType === type) {
      clearBuildSelection();
      return;
    }

    clearBuildSelection();
    game.activeAbilityTarget = null;
    game.selectTower(null);

    const card = document.getElementById(`card-tower-${type}`);
    if (card) {
      card.classList.add('selected');
      game.selectedBuildType = type;
    }
  }

  function selectTrapCard(trapType: HazardType) {
    if (game.selectedBuildTrap === trapType) {
      clearBuildSelection();
      return;
    }

    clearBuildSelection();
    game.activeAbilityTarget = null;
    game.selectTower(null);

    const card = document.getElementById(`card-trap-${trapType}`);
    if (card) {
      card.classList.add('selected');
      game.selectedBuildTrap = trapType;
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

  trapCards.forEach((card) => {
    card.addEventListener('click', () => {
      const trapType = card.getAttribute('data-trap') as HazardType;
      if (trapType) {
        selectTrapCard(trapType);
      }
    });
  });

  // -------------------------------------------------------------
  // Map Sector Switching
  // -------------------------------------------------------------
  const sectorPills = document.querySelectorAll('.sector-pill');
  sectorPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const sector = pill.getAttribute('data-sector') as MapSector;
      if (sector) {
        sectorPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        clearBuildSelection();
        game.setSector(sector);
      }
    });
  });

  // -------------------------------------------------------------
  // Game Mode Switching
  // -------------------------------------------------------------
  const modePills = document.querySelectorAll('.mode-pill');
  modePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const mode = pill.getAttribute('data-mode') as GameMode;
      if (mode) {
        modePills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        clearBuildSelection();
        game.setGameMode(mode);
      }
    });
  });

  // -------------------------------------------------------------
  // Commander Superweapons
  // -------------------------------------------------------------
  const btnEmp = document.getElementById('btn-ability-emp');
  btnEmp?.addEventListener('click', () => {
    clearBuildSelection();
    game.triggerAbilityEmp();
  });

  const btnOrbital = document.getElementById('btn-ability-orbital');
  btnOrbital?.addEventListener('click', () => {
    clearBuildSelection();
    game.triggerAbilityOrbital();
  });

  const btnOverdrive = document.getElementById('btn-ability-overdrive');
  btnOverdrive?.addEventListener('click', () => {
    game.triggerAbilityOverdrive();
  });

  // -------------------------------------------------------------
  // Global Range Toggle
  // -------------------------------------------------------------
  const btnToggleRanges = document.getElementById('btn-toggle-ranges');
  btnToggleRanges?.addEventListener('click', () => {
    game.showAllRanges = !game.showAllRanges;
    btnToggleRanges.classList.toggle('active', game.showAllRanges);
  });

  // -------------------------------------------------------------
  // Inspector Panel Action Bindings
  // -------------------------------------------------------------
  const btnUpgrade = document.getElementById('btn-upgrade-tower');
  btnUpgrade?.addEventListener('click', () => {
    game.upgradeSelectedTowerStandard();
  });

  const btnSell = document.getElementById('btn-sell-tower');
  btnSell?.addEventListener('click', () => {
    game.sellSelectedTower();
  });

  const targetingPills = document.querySelectorAll('.target-pill');
  targetingPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const mode = pill.getAttribute('data-mode') as TargetingMode;
      if (mode) {
        game.setTargetingMode(mode);
      }
    });
  });

  // Level 4 Specialization Branch Buttons
  const btnBranchA = document.getElementById('btn-branch-a');
  btnBranchA?.addEventListener('click', () => {
    game.upgradeSelectedTowerBranch('A');
  });

  const btnBranchB = document.getElementById('btn-branch-b');
  btnBranchB?.addEventListener('click', () => {
    game.upgradeSelectedTowerBranch('B');
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
  // Tech Tree Modal Bindings
  // -------------------------------------------------------------
  const btnTechTree = document.getElementById('btn-tech-tree');
  btnTechTree?.addEventListener('click', () => {
    game.toggleTechTreeModal();
  });

  const btnCloseTech = document.getElementById('btn-close-tech');
  btnCloseTech?.addEventListener('click', () => {
    game.closeTechTreeModal();
  });

  const btnResetTech = document.getElementById('btn-reset-tech');
  btnResetTech?.addEventListener('click', () => {
    if (confirm('Reset and reclaim all spent Tech Points?')) {
      game.resetTechTree();
    }
  });

  // -------------------------------------------------------------
  // After-Action Debrief Modal Bindings
  // -------------------------------------------------------------
  const btnDebrief = document.getElementById('btn-debrief');
  btnDebrief?.addEventListener('click', () => {
    game.toggleDebriefModal();
  });

  const btnCloseDebrief = document.getElementById('btn-close-debrief');
  btnCloseDebrief?.addEventListener('click', () => {
    game.closeDebriefModal();
  });

  const btnViewDebrief = document.getElementById('btn-view-debrief-modal');
  btnViewDebrief?.addEventListener('click', () => {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) modalOverlay.classList.remove('active');
    game.openDebriefModal();
  });

  // -------------------------------------------------------------
  // Hostile Codex Modal Bindings
  // -------------------------------------------------------------
  const btnCodex = document.getElementById('btn-codex');
  btnCodex?.addEventListener('click', () => {
    game.toggleCodexModal();
  });

  const btnOpenCodexLink = document.getElementById('btn-open-codex-link');
  btnOpenCodexLink?.addEventListener('click', () => {
    game.openCodexModal();
  });

  const btnCloseCodex = document.getElementById('btn-close-codex');
  btnCloseCodex?.addEventListener('click', () => {
    game.closeCodexModal();
  });

  const codexNavItems = document.querySelectorAll('.codex-nav-item');
  codexNavItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const enemyType = btn.getAttribute('data-enemy') as EnemyType;
      if (enemyType) game.renderCodexEnemy(enemyType);
    });
  });

  const quickCodexRows = document.querySelectorAll('.codex-quick-btn');
  quickCodexRows.forEach((row) => {
    row.addEventListener('click', () => {
      const enemyType = row.getAttribute('data-enemy') as EnemyType;
      if (enemyType) game.openCodexModal(enemyType);
    });
  });

  // -------------------------------------------------------------
  // Achievements Modal Bindings
  // -------------------------------------------------------------
  const btnAchievements = document.getElementById('btn-achievements');
  btnAchievements?.addEventListener('click', () => {
    game.toggleAchievementsModal();
  });

  const btnCloseAchievements = document.getElementById('btn-close-achievements');
  btnCloseAchievements?.addEventListener('click', () => {
    game.closeAchievementsModal();
  });

  const achievementsModal = document.getElementById('achievements-modal');
  achievementsModal?.addEventListener('click', (e: MouseEvent) => {
    if (e.target === achievementsModal) {
      game.closeAchievementsModal();
    }
  });

  // -------------------------------------------------------------
  // Keyboard Hotkeys
  // -------------------------------------------------------------
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    if (e.code === 'Space') {
      e.preventDefault();
      btnPause?.click();
      return;
    }

    if (key === '1') selectBuildCard('gatling');
    else if (key === '2') selectBuildCard('mortar');
    else if (key === '3') selectBuildCard('frost');
    else if (key === '4') selectBuildCard('tesla');
    else if (key === '5') selectBuildCard('incinerator');
    else if (key === '6') selectTrapCard('tripwire');
    else if (key === '7') selectTrapCard('cryo_mine');
    else if (key === '8') selectTrapCard('concussion_mine');
    else if (key === 'q') {
      clearBuildSelection();
      game.triggerAbilityEmp();
    } else if (key === 'e') {
      clearBuildSelection();
      game.triggerAbilityOrbital();
    } else if (key === 'r') {
      game.triggerAbilityOverdrive();
    } else if (key === 'g') {
      btnToggleRanges?.click();
    } else if (key === 't') {
      game.toggleTechTreeModal();
    } else if (key === 'c') {
      game.toggleCodexModal();
    } else if (key === 'd') {
      game.toggleDebriefModal();
    } else if (key === 'a') {
      game.toggleAchievementsModal();
    } else if (key === 'escape') {
      game.closeAchievementsModal();
      game.closeTechTreeModal();
      game.closeDebriefModal();
      game.closeCodexModal();
      clearBuildSelection();
      game.activeAbilityTarget = null;
      game.selectTower(null);
    } else if (key === 'n') {
      game.startNextWave(true);
    } else if (key === 'u') {
      game.upgradeSelectedTowerStandard();
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

    game.update(dt);
    game.render();

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame((time) => {
    lastFrameTime = time;
    requestAnimationFrame(gameLoop);
  });
});
