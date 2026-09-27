# Vector Vanguard: Tactical Tower Defense

[![Live App](https://img.shields.io/badge/Play-Live%20Deployment-06b6d4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://ais-pre-o5prox5zigutbifupbskyw-537735573587.europe-west2.run.app)
[![Tech Stack](https://img.shields.io/badge/Stack-TypeScript%20%7C%20HTML5%20Canvas%20%7C%20Vite%20%7C%20TailwindCSS-3b82f6?style=for-the-badge)](https://ais-pre-o5prox5zigutbifupbskyw-537735573587.europe-west2.run.app)

> A modular sci-fi HTML5 Canvas tower defense game featuring dual-branch tower specializations, elemental combos, battlefield hazard traps, persistent command research, dynamic environmental weather, and multi-game modes.

---

## 🌐 Live Deployments & URLs

- **Published Game URL**: [https://ais-pre-o5prox5zigutbifupbskyw-537735573587.europe-west2.run.app](https://ais-pre-o5prox5zigutbifupbskyw-537735573587.europe-west2.run.app)
- **Development App URL**: [https://ais-dev-o5prox5zigutbifupbskyw-537735573587.europe-west2.run.app](https://ais-dev-o5prox5zigutbifupbskyw-537735573587.europe-west2.run.app)

---

## 🎮 Key Features

### 1. Dual-Branch Tower Specializations (Level 4 Fork)
Upon reaching Level 3, towers unlock a permanent specialization fork rather than linear upgrades:
- **Gatling Laser**:
  - **Path A: Sniper Railgun**: +70% Range, +200% Damage, and 80% armor-piercing kinetic rounds.
  - **Path B: Pulse Accelerator**: 0.05s blistering fire rate with 2× bonus damage against energy shields.
- **Plasma Mortar**:
  - **Path A: Cluster Bombard**: Primary shell fractures into 3 secondary sub-explosives upon detonation.
  - **Path B: Seismic Napalm**: Impact creates a persistent 6-second molten puddle inflicting 40 burn DPS.
- **Frost Beam**:
  - **Path A: Blizzard Core**: Passive cryo-aura continuously chills all hostiles within range simultaneously.
  - **Path B: Absolute Zero**: Direct beam inflicts 1.2s solid freeze stun and deals 2× damage to chilled foes.
- **Tesla Coil**:
  - **Path A: Voltage Cascade**: Branching chain lightning arcs across up to 6 targets with +60% arc damage.
  - **Path B: EMP Disruptor**: Instantly short-circuits energy shields and disables stealth cloaking.
- **Thermal Incinerator**:
  - **Path A: Magma Projector**: 75° wide fire cone projecting persistent molten ground pools.
  - **Path B: Hellfire Meltdown**: Blue-hot plasma inflicting Meltdown status (+50% bonus damage from all sources).

### 2. Elemental Combo Reactions
Status effects interact dynamically on hostiles to detonate chemical reactions:
- **Thermal Shock (`✦ THERMAL SHOCK!`)**: Chilled enemies struck by Fire or Hazards trigger a thermal shatter (+110 bonus damage and 50% armor reduction).
- **Superconductor (`✦ SUPERCONDUCTOR!`)**: Chilled enemies struck by Tesla chain lightning arc a high-voltage shockwave (+75 AoE damage & 0.4s stun) to all nearby targets.
- **Plasma Flare (`✦ PLASMA FLARE!`)**: Burning enemies struck by Plasma Mortar shells detonate a fiery secondary explosion (+90 burst AoE damage).

### 3. Deployable Battlefield Traps & Hazards
Placeable directly on enemy roadway paths to halt runners:
- **Laser Tripwire (`[6]`)**: Dual-emitter optical tripwire dealing 140 slicing damage (3 charges).
- **Cryo Landmine (`[7]`)**: Concealed road mine detonating on contact to freeze an entire 75px radius.
- **Concussion Mine (`[8]`)**: High-explosive pressure plate detonating for 240 heavy blast damage in a 70px AoE.
- **Napalm Ground Puddles**: Persistent burning terrain created by Seismic Napalm and Magma Projectors.

### 4. Commander Tactical Superweapons
Active ground-targeted superweapons with dedicated cooldowns:
- **EMP Blast (`[Q]`)**: Electromagnetic pulse disabling shields, decloaking stealth units, and stunning all hostiles for 3.5s.
- **Orbital Bombardment (`[E]`)**: Catastrophic kinetic strike dealing 450 targeted damage with radial shockwave falloff.
- **Overdrive Hypercharge (`[R]`)**: Overclocks all defensive grid towers, doubling their attack fire rate for 6 seconds.

### 5. Dynamic Environmental Weather Modifiers
Atmospheric weather systems rotating every 4 waves with live canvas particle effects:
- **☀️ Clear Atmosphere**: Normal baseline combat conditions.
- **⚡ EM Lightning Storm**: +30% Tesla damage, ambient lightning flicker, and static surges.
- **🌫️ Dense Nebula Fog**: 15% hostile evasion/cloak chance, rolling fog particles, and reduced range.
- **🔥 Solar Flare**: +35% Incinerator and Plasma Mortar damage with rising ember sparks.
- **❄️ Cryo Cold Front**: +25% Frost tower range and freeze duration with drifting snow crystals.

### 6. Wave Threat Radar & Enemy Composition Preview
- Real-time threat radar on HUD and battlefield canvas during preparation phases.
- Previews exact enemy counts (Scouts, Infiltrators, Shielded Cruisers, Goliaths, Swarmers, Bosses).
- Badges warning of tactical threat affixes (🛡️ Heavy Armor, ⚡ Energy Shields, 👻 Stealth Cloaks, 👑 Boss Threats).

### 7. Multiple Game Modes
- **Campaign**: 20-wave defensive operations across multiple sectors (Alpha, Beta, Gamma).
- **Endless Survival**: Procedural, infinitely scaling waves to test grid sustainability.
- **Boss Rush**: High-intensity battles featuring dreadnoughts and armored escorts every wave with 3× bounties.
- **Tactical Sandbox**: 99,999 credits, immortal base core, and instant manual enemy spawner for testing.

### 8. Command Tech Tree & Persistent Research (`[T]`)
- Earn **Core Tech Points (`⭐`)** by clearing waves, defeating bosses, and unlocking commendations.
- Saved in browser `localStorage` across play sessions with full respec/refund capabilities:
  - **Tungsten Munitions**: +15% Gatling & Railgun Damage per rank.
  - **Plasma Condenser**: +18% Mortar Splash & Damage per rank.
  - **Cryo Supercooler**: +15% Frost Slow & Combo Yield per rank.
  - **Flux Superconductors**: +1 Chain Target & +15% Tesla Damage per rank.
  - **Napalm Accelerants**: +20% Incinerator & Trap Burn DPS per rank.
  - **Titanium Bulkheads**: +5 Base Core Integrity per rank.
  - **War Chest Reserve**: +100 Starting Energy Credits per rank.
  - **Orbital Uplink Flux**: -15% Superweapon Cooldowns per rank.

### 9. Tactical After-Action Debrief (`[D]`)
- Automated debrief modal on Victory or Core Breach (also accessible via `[D]` anytime):
  - Mission Combat Grade (**Rank S+, S, A, B, C, F**).
  - MVP Tactical Tower card (highest DPS, coordinates, kills).
  - Damage contribution progress meters by tower archetype and elemental damage type.
  - Total elemental combos and hazard detonation tallies.

### 10. Interactive Hostile Codex (`[C]`)
- Live telemetry viewer with rotating canvas miniature previews of all 7 hostile signatures:
  - **Scout Runner**: Fast agile unit vulnerable to rapid single-target lasers.
  - **Stealth Infiltrator**: Periodically cloaks with 30% optical damage mitigation.
  - **Shielded Cruiser**: Frontline cruiser with rechargeable kinetic energy barrier.
  - **Goliath Hex-Tank**: Colossal hull with 35% base armor plating.
  - **Swarmer Carrier**: Ruptures upon destruction into 3 mini-swarm runners.
  - **Mini-Swarmer**: Rapid rushers released from ruptured chassis.
  - **Apex Dreadnought**: Colossal boss flagship appearing at wave milestones with heavy escorts.
- Detailed stats: Hull HP, Speed, Armor Mitigation %, Shield Points, Traits, and Counter Strategies.

### 11. Commendations & Achievement System (`[A]`)
- 14 tracked tactical milestones with HUD toast notifications, progress counters, and `localStorage` persistence.
- Milestones include *First Blood*, *Centurion (100 Kills)*, *Vanguard Ace (500 Kills)*, *Flawless Defense*, *Peak Overclock*, *High Voltage*, *Chemical Reaction*, *Minefield Architect*, and *Apex Predator*.

---

## ⌨️ Controls & Keyboard Shortcuts

| Shortcut | Action |
|:---:|:---|
| **`[1] - [5]`** | Select Tower to construct (Gatling, Mortar, Frost, Tesla, Incinerator) |
| **`[6] - [8]`** | Select Road Trap to deploy (Tripwire, Cryo Mine, Concussion Mine) |
| **`[Q]`** | Trigger EMP Stun Blast Superweapon |
| **`[E]`** | Target Orbital Bombardment Missile Strike |
| **`[R]`** | Activate Overdrive Hypercharge (+100% fire rate) |
| **`[T]`** | Open Command Tech Tree & Research Modal |
| **`[C]`** | Open Interactive Hostile Codex |
| **`[D]`** | Open Tactical After-Action Debrief & Damage Breakdown |
| **`[A]`** | View Tactical Achievements & Commendations |
| **`[G]`** | Toggle Global Range Coverage Circles |
| **`[N]`** | Launch Next Wave immediately (grants early call bonus credits) |
| **`[U]`** | Upgrade Selected Tower |
| **`[S]`** | Sell Selected Tower (70% credit refund) |
| **`[Space]`** | Pause / Resume Battle Simulation |
| **`[Esc]`** | Cancel Targeting / Deselect / Close Open Modals |

---

## 🛠️ Architecture & Tech Stack

- **Rendering Engine**: HTML5 Canvas with Retina high-DPI scaling via `devicePixelRatio` and vector coordinate transformations.
- **Language**: TypeScript (strict mode, fully typed entities and interfaces).
- **Styling**: Tailwind CSS with dark-mode glassmorphic HUD overlays, telemetry cards, and animated status meters.
- **Audio System**: Web Audio API synthesizer generating real-time procedural sound effects (lasers, mortar booms, electric arcs, flamethrowers, thunderclaps, and UI chimes) with zero external audio assets.
- **Build Tool**: Vite.
