'use strict';

let game = null;

const liveStats = { day: 0, peakInfected: 0, totalDeaths: 0, r0: '—' };

function simulate() {
  clearGraph();

  liveStats.day          = 0;
  liveStats.peakInfected = 0;
  liveStats.totalDeaths  = 0;
  liveStats.r0           = '—';
  updateStatsDisplay();

  if (game) { game.destroy(true); game = null; }

  // Re-create Phaser container so Phaser gets a clean DOM node each run
  const simPanel = document.getElementById('simPanel');
  const old = document.getElementById('phaserContainer');
  if (old) old.remove();
  const container = document.createElement('div');
  container.id = 'phaserContainer';
  simPanel.insertBefore(container, simPanel.firstChild);

  // ── Constants ────────────────────────────────────────────────────────────
  const W          = 560;
  const H          = 400;
  const WALL       = 5;   // visual wall thickness + physics inset
  const RADIUS     = 5;
  const MIN_SPEED  = 38;
  const MAX_SPEED  = 82;
  const CAPTURE_MS = 400;
  const DAY_MS     = 2000;
  const WANING_MS  = 15000; // 15 s real-time before immunity wanes

  // ── Group refs (set in create, read in update/onContact) ─────────────────
  let healthy, infected, deceased, recovered, allPeople;
  const infectionTimers = new Map();  // person → timestamp of infection
  const recoveryTimers  = new Map();  // person → timestamp of recovery (for waning)

  let lastCapture   = 0;
  let lastDayTick   = 0;
  let newInfections = 0;
  let prevInfected  = 0;

  // ── Phaser config ─────────────────────────────────────────────────────────
  game = new Phaser.Game({
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent: 'phaserContainer',
    backgroundColor: 0x000000,
    scene: { preload, create, update },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false }
    }
  });

  // ── Preload: generate circle textures ────────────────────────────────────
  function preload() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const tex = (color, key, glowColor) => {
      g.clear();
      if (glowColor !== undefined) {
        // subtle glow ring
        g.fillStyle(glowColor, 0.25);
        g.fillCircle(RADIUS, RADIUS, RADIUS);
      }
      g.fillStyle(color, 1);
      g.fillCircle(RADIUS, RADIUS, RADIUS - 1);
      g.generateTexture(key, RADIUS * 2, RADIUS * 2);
    };

    tex(0x4CAF50, 'p_healthy');
    tex(0x4488ff, 'p_vaccinated',   0x88aaff);
    tex(0xe84545, 'p_infected',     0xff0000);
    tex(0xddaa00, 'p_asymptomatic', 0xffdd00); // yellow — looks almost healthy
    tex(0x00ddaa, 'p_recovered');
    tex(0x444444, 'p_dead');
    tex(0x7cb518, 'p_zombie',       0xaaff00);

    g.destroy();
  }

  // ── Create ────────────────────────────────────────────────────────────────
  function create() {
    allPeople = this.physics.add.group();
    healthy   = this.physics.add.group();
    infected  = this.physics.add.group();
    deceased  = this.physics.add.group();
    recovered = this.physics.add.group();

    const pop       = Math.min(input.population, 350);
    const vaccCount = Math.floor(pop * (input.vaccinationRate / 100));
    const initInf   = Math.min(input.virus, pop - vaccCount);

    for (let i = 0; i < pop; i++) {
      const isVacc = i < vaccCount;
      const p = spawnPerson.call(this, isVacc ? 'p_vaccinated' : 'p_healthy');
      p.isImmune = isVacc;
      p.isDead   = false;
      healthy.add(p);
      allPeople.add(p);
    }

    // Seed initial infected from non-vaccinated pool
    const candidates = healthy.getChildren().filter(p => !p.isImmune);
    for (let i = 0; i < initInf; i++) {
      const p = candidates[i] || healthy.getChildren()[i];
      if (!p) break;
      healthy.remove(p);
      infect(p);
    }

    // ── Visual walls drawn on top (depth 100) ─────────────────────────────
    // These are purely decorative — physics uses world bounds above.
    // Drawing them at high depth means they always appear over particles.
    const wg = this.add.graphics().setDepth(100);

    // Outer glow layers (progressively sharper)
    wg.lineStyle(7, 0x1a4d1a, 0.12);
    wg.strokeRect(WALL - 3, WALL - 3, W - (WALL - 3) * 2, H - (WALL - 3) * 2);

    wg.lineStyle(4, 0x2a6e2a, 0.25);
    wg.strokeRect(WALL - 1.5, WALL - 1.5, W - (WALL - 1.5) * 2, H - (WALL - 1.5) * 2);

    // Main wall line — sits exactly at the physics boundary
    wg.lineStyle(1.5, 0x4CAF50, 0.8);
    wg.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);

    // Corner accent marks
    const CL = 14;
    wg.lineStyle(2, 0x66bb6a, 1);
    [[WALL, WALL, 1, 1], [W - WALL, WALL, -1, 1],
     [WALL, H - WALL, 1, -1], [W - WALL, H - WALL, -1, -1]
    ].forEach(([cx, cy, sx, sy]) => {
      wg.lineBetween(cx + sx * CL, cy, cx, cy);
      wg.lineBetween(cx, cy, cx, cy + sy * CL);
    });

    // Overlap: infected touches healthy → attempt infection
    this.physics.add.overlap(infected, healthy, onContact, null, this);

    prevInfected = infected.children.size;
    updateStatsDisplay();
  }

  // ── Spawn one person ──────────────────────────────────────────────────────
  function spawnPerson(textureKey) {
    const margin = WALL + RADIUS + 2;
    const x = margin + Math.random() * (W - margin * 2);
    const y = margin + Math.random() * (H - margin * 2);
    const p = this.physics.add.sprite(x, y, textureKey);
    // No world-bounds collision — we handle it manually in update()
    // so fast particles can never clip through the wall between frames.
    p.body.setCollideWorldBounds(false);
    randomVelocity(p, MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED));
    return p;
  }

  // ── Infect a person ───────────────────────────────────────────────────────
  function infect(p) {
    // Asymptomatic: looks yellow, still spreads, resolves normally
    const isAsymp = input.asymptomaticRate > 0 && Math.random() < input.asymptomaticRate;
    p.setTexture(
      input.zombieMode ? 'p_zombie'
        : isAsymp      ? 'p_asymptomatic'
                       : 'p_infected'
    );
    p.setTint(0xffffff);
    p.isImmune      = false;
    p.isDead        = false;
    p.isAsymptomatic = isAsymp;
    infected.add(p);
    infectionTimers.set(p, Date.now());
    newInfections++;
  }

  // ── Velocity helpers ──────────────────────────────────────────────────────
  function randomVelocity(p, speed) {
    const a = Math.random() * Math.PI * 2;
    // Avoid near-horizontal/vertical angles that create long wall-grazing paths
    const adjusted = a + (Math.random() - 0.5) * 0.3;
    p.body.setVelocity(Math.cos(adjusted) * speed, Math.sin(adjusted) * speed);
  }

  // Inner boundary: one RADIUS inside the visual wall line
  const BOUND = WALL + RADIUS + 1;

  function constrainToBounds(p) {
    if (!p.body || p.isDead) return;

    let hitX = false;
    let hitY = false;

    // Clamp position back inside
    if (p.x < BOUND)       { p.x = BOUND;       hitX = true; }
    if (p.x > W - BOUND)   { p.x = W - BOUND;   hitX = true; }
    if (p.y < BOUND)       { p.y = BOUND;        hitY = true; }
    if (p.y > H - BOUND)   { p.y = H - BOUND;    hitY = true; }

    const spd = Math.hypot(p.body.velocity.x, p.body.velocity.y);

    if (hitX || hitY || spd < MIN_SPEED) {
      // Random direction biased toward the canvas center so the particle
      // always moves away from whichever wall it touched.
      const toCenterX = W / 2 - p.x;
      const toCenterY = H / 2 - p.y;
      const baseAngle = Math.atan2(toCenterY, toCenterX);
      // Spread ±70° around the inward direction
      const angle = baseAngle + (Math.random() - 0.5) * 2.44;
      const newSpd = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      p.body.setVelocity(Math.cos(angle) * newSpd, Math.sin(angle) * newSpd);
    }
  }

  // ── Main update loop ──────────────────────────────────────────────────────
  function update() {
    const now        = Date.now();
    const recoveryMs = 3000 + ((100 - input.recoveryRate) * 120); // 3 s – 15 s

    // ── Bounds + speed enforcement (runs every frame) ─────────────────────
    // Manually clamps position and redirects particles that touched a wall
    // or stalled. This is more reliable than setCollideWorldBounds for fast
    // particles that might skip past the boundary between frames.
    for (const p of allPeople.getChildren()) constrainToBounds(p);

    // ── Illness resolution: recovery or death ─────────────────────────────
    for (const p of infected.getChildren().slice()) {
      if (!infectionTimers.has(p)) continue;
      if (now - infectionTimers.get(p) < recoveryMs) continue;

      infectionTimers.delete(p);
      infected.remove(p);

      if (input.zombieMode) {
        // "Death" = reanimate; rejoin infected as zombie
        p.setTexture('p_zombie');
        p.isImmune = false;
        infected.add(p);
        infectionTimers.set(p, now + recoveryMs * 2);
        randomVelocity(p, MIN_SPEED + 12);

      } else if (Math.random() * 100 < input.deathRate) {
        deceased.add(p);
        p.setTexture('p_dead');
        p.setTint(0xffffff);
        p.body.setVelocity(0, 0);
        p.body.setBounce(0);
        p.isDead = true;
        liveStats.totalDeaths++;

      } else {
        recovered.add(p);
        p.setTexture('p_recovered');
        p.setTint(0xffffff);
        p.isImmune       = true;
        p.isAsymptomatic = false;
        recoveryTimers.set(p, now);
      }
    }

    // ── Waning immunity: recovered → susceptible again ────────────────────
    if (input.waningImmunity) {
      for (const p of recovered.getChildren().slice()) {
        if (!recoveryTimers.has(p)) continue;
        if (now - recoveryTimers.get(p) < WANING_MS) continue;
        recoveryTimers.delete(p);
        recovered.remove(p);
        p.setTexture('p_healthy');
        p.setTint(0xffffff);
        p.isImmune = false;
        healthy.add(p);
      }
    }

    // ── Quarantine: slow healthy movement when infection % is high ────────
    const activeTotal = healthy.children.size + infected.children.size + recovered.children.size;
    const infPct      = activeTotal > 0 ? (infected.children.size / activeTotal) * 100 : 0;

    if (infPct >= input.quarantineThreshold) {
      for (const p of healthy.getChildren()) {
        const spd = Math.hypot(p.body.velocity.x, p.body.velocity.y);
        if (spd > 20) p.body.setVelocity(p.body.velocity.x * 0.97, p.body.velocity.y * 0.97);
      }
    }

    // ── Day tick + R₀ estimate ────────────────────────────────────────────
    if (now - lastDayTick >= DAY_MS) {
      lastDayTick = now;
      liveStats.day++;

      const curInf = infected.children.size;
      if (curInf > liveStats.peakInfected) liveStats.peakInfected = curInf;

      if (prevInfected > 0) {
        const sample = newInfections / prevInfected;
        const prev   = parseFloat(liveStats.r0) || 0;
        liveStats.r0 = (prev * 0.6 + sample * 2 * 0.4).toFixed(2);
      }
      prevInfected  = curInf;
      newInfections = 0;

      updateStatsDisplay();
    }

    // ── Graph capture ─────────────────────────────────────────────────────
    if (now - lastCapture >= CAPTURE_MS) {
      lastCapture = now;
      graphData.healthy.push(healthy.children.size);
      graphData.infected.push(infected.children.size);
      graphData.dead.push(deceased.children.size);
      graphData.recovered.push(recovered.children.size);
      renderGraph();

      const el = document.getElementById('statInfected');
      if (el) el.textContent = infected.children.size;
    }
  }

  // ── Infection overlap callback ────────────────────────────────────────────
  function onContact(iP, hP) {
    if (hP.isImmune || hP._processing) return;
    hP._processing = true;

    let rate = input.infectionRate - input.peoplePrecaution * 3;

    // Asymptomatic carriers spread at 60% the rate of symptomatic ones
    if (iP.isAsymptomatic) rate *= 0.6;

    const activeTotal = healthy.children.size + infected.children.size + recovered.children.size;
    const infPct      = activeTotal > 0 ? (infected.children.size / activeTotal) * 100 : 0;
    if (infPct >= input.quarantineThreshold) rate *= 0.4;

    if (rate > 0 && Math.random() * 100 < rate) {
      healthy.remove(hP);
      infect(hP);
    } else {
      hP._processing = false;
    }
  }
}

// ── Stats DOM update ─────────────────────────────────────────────────────────
function updateStatsDisplay() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('statDay',    liveStats.day);
  set('statPeak',   liveStats.peakInfected);
  set('statDeaths', liveStats.totalDeaths);
  set('statR0',     liveStats.r0);
}
