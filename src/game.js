// Minimal Phaser 3 setup for Lane Zero prototype
const config = {
  type: Phaser.AUTO,
  width: 420,
  height: 760,
  parent: 'game-container',
  backgroundColor: '#081018',
  scene: { preload, create, update },
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  }
};

const game = new Phaser.Game(config);

let player, currentLane = 0; // 0 = left, 1 = right
let lanes = [120, 300];
let bullets, enemies, barricadeHealth = 100, hud;
let scrap = 0;

// Weapon / power-up state
let magazineSize = 12;
let ammo = magazineSize;
let isReloading = false;
let reloadTime = 1400; // ms
let cryoAvailable = 1;
let autocannons = [null, null]; // one per lane when deployed
let ricochetActive = false;
let ricochetTimer = null;

// Spitter sludge state per lane
let sludge = [false, false];

function preload() {
  // No external images — textures will be generated on the canvas in create().
}

function createTextures(scene) {
  // helper to create simple primitive textures
  const g = scene.add.graphics();

  // Player: small rounded rectangle
  g.clear();
  g.fillStyle(0xeeeeee, 1);
  g.fillRoundedRect(0, 0, 40, 40, 6);
  g.generateTexture('player', 40, 40);

  // Bullet: small circle
  g.clear();
  g.fillStyle(0xffffaa, 1);
  g.fillCircle(6, 6, 6);
  g.generateTexture('bullet', 12, 12);

  // Shambler/Sprinter: small grey circle
  g.clear();
  g.fillStyle(0x99cc99, 1);
  g.fillCircle(14, 14, 14);
  g.generateTexture('shambler', 28, 28);

  // Sprinter uses same base with different tint in code
  g.clear();
  g.fillStyle(0xaadd88, 1);
  g.fillCircle(12, 12, 12);
  g.generateTexture('sprinter', 24, 24);

  // Brute: bigger circle
  g.clear();
  g.fillStyle(0x885555, 1);
  g.fillCircle(22, 22, 22);
  g.generateTexture('brute', 44, 44);

  // Spitter: purple-ish small circle
  g.clear();
  g.fillStyle(0xff99cc, 1);
  g.fillCircle(14, 14, 14);
  g.generateTexture('spitter', 28, 28);

  // Drop: glowing circle
  g.clear();
  g.fillStyle(0xa0ff66, 1);
  g.fillCircle(10, 10, 10);
  g.generateTexture('drop', 20, 20);

  g.destroy();
}

function create() {
  this.cameras.main.setBackgroundColor('#0b0f14');

  // Create programmatic textures used for sprites (no external images)
  createTextures(this);

  // Lanes
  this.add.rectangle(210, 380, 400, 760, 0x071016).setAlpha(0.0);

  // Player
  player = this.add.image(lanes[currentLane], 660, 'player').setScale(0.6);

  // Debug label to confirm scene running
  this.add.text(12, 720, 'Lane Zero — Running', { fontSize: 12, color: '#88ff88' });

  bullets = this.physics.add.group();
  enemies = this.physics.add.group();

  // Simple enemy spawner
  this.time.addEvent({ delay: 1200, loop: true, callback: () => spawnEnemy(this) });

  // Simple input: tap to shoot, swipe to switch
  this.input.on('pointerup', pointer => {
    if (pointer.downTime && pointer.upTime && Math.abs(pointer.upX - pointer.downX) > 40) return; // treated as swipe
    shoot(this);
  });

  this.input.on('pointerdown', pointer => this._down = { x: pointer.x, y: pointer.y, t: this.time.now });
  this.input.on('pointerup', pointer => {
    if (!this._down) return;
    const dx = pointer.x - this._down.x;
    const minSwipe = 40;
    if (Math.abs(dx) > minSwipe) {
      if (dx < 0) switchLane(this, 0); else switchLane(this, 1);
    }
    this._down = null;
  });

  // Collisions: bullets hit enemies
  this.physics.add.overlap(bullets, enemies, (b,e) => {
    // Apply damage
    const dmg = 25;
    if (e.getData('hp')) e.setData('hp', e.getData('hp')-dmg);
    if (e.getData('hp')<=0) { onEnemyKilled(this,e); }
    // If bullet ricochet is not active, destroy bullet on first hit
    if (!b.getData('ricochet')) {
      b.destroy();
    }
  });
  this.physics.add.overlap(enemies, player, (e,p) => {});

  // HUD
  hud = this.add.text(12,12, 'Barricade: 100\nScrap: 0\nWave: 1', { color:'#fff', fontSize:16 });

  // Wire HTML buttons
  const ammoEl = document.getElementById('hud-ammo');
  const healthEl = document.getElementById('hud-health');
  const scrapEl = document.getElementById('hud-scrap');
  const reloadBtn = document.getElementById('reload-btn');
  const cryoBtn = document.getElementById('cryo-btn');

  ammoEl.innerText = ammo;
  healthEl.innerText = barricadeHealth;
  scrapEl.innerText = scrap;

  reloadBtn.addEventListener('click', ()=>{ if (!isReloading && ammo < magazineSize) manualReload(this, ammoEl); });
  cryoBtn.addEventListener('click', ()=>{ if (cryoAvailable>0) triggerCryo(this); });
}

function update(time, delta) {
  player.x = Phaser.Math.Linear(player.x, lanes[currentLane], 0.5);

  // Move enemies and handle reaching barricade
  enemies.getChildren().forEach(e => {
    if (e.getData('frozen')) return; // frozen in place
    e.y += e.getData('speed') * delta/16;
    if (e.y > 720) {
      barricadeHealth -= e.getData('damage') || 5;
      e.destroy();
      if (barricadeHealth <= 0) gameOver(this);
    }
  });

  // Autocannons: automated firing per-deployed lane
  autocannons.forEach((c, laneIdx)=>{
    if (c && this.time.now > c.nextShot) {
      const b = bullets.create(lanes[laneIdx], 620, 'bullet').setScale(0.45).setTint(0xffddaa);
      this.physics.world.enable(b);
      b.body.velocity.y = -700;
      c.nextShot = this.time.now + (1000 / c.rate);
    }
  });

  // Update HUD elements wired to DOM
  const ammoEl = document.getElementById('hud-ammo');
  const healthEl = document.getElementById('hud-health');
  const scrapEl = document.getElementById('hud-scrap');
  if (ammoEl) ammoEl.innerText = ammo + (isReloading ? ' (R)' : '');
  if (healthEl) healthEl.innerText = Math.max(0, Math.floor(barricadeHealth));
  if (scrapEl) scrapEl.innerText = scrap;

  // Clean up bullets and enemies off-screen
  bullets.getChildren().forEach(b=>{ if (b.y < -50) b.destroy(); });
  enemies.getChildren().forEach(e=>{ if (e.y > 820) e.destroy(); });
}

function switchLane(scene, lane) {
  currentLane = lane;
  // small feedback
  scene.tweens.add({ targets: player, y: 660-6, duration: 80, yoyo:true });
}

function shoot(scene) {
  if (isReloading) return;
  if (ammo <= 0) {
    // trigger auto reload
    startReload(scene);
    return;
  }
  ammo -= 1;

  const x = lanes[currentLane];
  const b = bullets.create(x, 620, 'bullet').setScale(0.5);
  scene.physics.world.enable(b);
  b.body.velocity.y = -600;

  // ricochet behaviour: we simulate by allowing the bullet to pass and hit multiple enemies in same lane
  if (ricochetActive) {
    b.setData('ricochet', true);
  }

  if (ammo <= 0) startReload(scene);
}

function spawnEnemy(scene) {
  const laneIdx = Phaser.Math.Between(0,1);
  const x = lanes[laneIdx];
  const types = ['shambler','sprinter','brute','spitter','drop'];
  const type = Phaser.Utils.Array.GetRandom(types);
  const e = scene.physics.add.image(x, -40, type).setScale(0.7);
  e.setData('type', type);
  switch(type) {
    case 'shambler': e.setData('speed', 30); e.setData('hp', 25); e.setData('damage', 5); break;
    case 'sprinter': e.setData('speed', 60); e.setData('hp', 15); e.setData('damage', 6); break;
    case 'brute': e.setData('speed', 18); e.setData('hp', 120); e.setData('damage', 20); break;
    case 'spitter': e.setData('speed', 20); e.setData('hp', 20); e.setData('damage', 4);
      // when spitter dies it will create sludge; visually we tint it
      e.setTint(0xff99cc);
      break;
    case 'drop': e.setData('speed', 30); e.setData('hp', 10); e.setData('damage', 3); e.setTint(0xA0FF66); break;
  }
  enemies.add(e);
}

function onEnemyKilled(scene, enemy) {
  scrap += 1;
  const type = enemy.getData('type');
  if (type === 'drop') {
    // spawn a basic power-up that moves down
    const pu = scene.add.circle(enemy.x, enemy.y, 10, 0xffff66);
    scene.tweens.add({ targets: pu, y: 700, duration: 2000, onComplete: ()=>{ 
      // if the player is in the same lane when it reaches the barricade, auto-collect
      const laneIdx = (enemy.x > 210) ? 1 : 0;
      if (currentLane === laneIdx) {
        // deploy autocannon as the core drop for demo
        deployAutocannon(scene, laneIdx);
      }
      pu.destroy();
    } });
  }
  // If the enemy was a spitter, spawn a sludge puddle when it dies
  if (type === 'spitter') {
    const laneIdx = (enemy.x > 210) ? 1 : 0;
    const puddle = scene.add.rectangle(lanes[laneIdx], 700, 140, 24, 0x336699, 0.8);
    sludge[laneIdx] = true;
    scene.time.delayedCall(6000, ()=>{ sludge[laneIdx]=false; puddle.destroy(); });
  }
  enemy.destroy();
}

function manualReload(scene, ammoEl) {
  startReload(scene);
}

function startReload(scene) {
  if (isReloading) return;
  isReloading = true;
  const base = reloadTime;
  // sludge in lane increases reload time for player if in that lane
  const laneSludge = sludge[currentLane] ? 1.4 : 1.0;
  scene.time.delayedCall(base * laneSludge, ()=>{ ammo = magazineSize; isReloading = false; });
}

function triggerCryo(scene) {
  if (cryoAvailable <= 0) return;
  cryoAvailable -= 1;
  // freeze all enemies in current lane for 5s
  const laneX = lanes[currentLane];
  enemies.getChildren().forEach(e=>{
    if (Math.abs(e.x - laneX) < 10) {
      e.setData('frozen', true);
      e.setTint(0x99ddff);
    }
  });
  scene.time.delayedCall(5000, ()=>{
    enemies.getChildren().forEach(e=>{ if (e.getData('frozen')) { e.setData('frozen', false); e.clearTint(); } });
  });
}

function deployAutocannon(scene, laneIdx) {
  // Deploy autocannon for 15s
  autocannons[laneIdx] = { rate: 6, nextShot: scene.time.now + 100, expires: scene.time.now + 15000 };
  scene.time.delayedCall(15000, ()=>{ autocannons[laneIdx] = null; });
}

function activateRicochet(scene, duration=10000) {
  ricochetActive = true;
  if (ricochetTimer) ricochetTimer.remove(false);
  ricochetTimer = scene.time.delayedCall(duration, ()=>{ ricochetActive = false; ricochetTimer = null; });
}

function gameOver(scene) {
  scene.add.text(70, 340, 'GAME OVER', { fontSize: 36, color:'#ff6666' });
  scene.scene.pause();
}
