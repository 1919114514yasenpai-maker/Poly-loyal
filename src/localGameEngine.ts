import { 
  GameState, 
  PlayerState, 
  Obstacle, 
  ItemState, 
  BombState,
  CharacterClass, 
  CLASS_STATS, 
  CLASS_ABILITIES, 
  AttackEvent, 
  DamagePopupEvent, 
  getGroundHeight 
} from './types.js';

export const MAP_SIZE = 400;

interface SpatialObstacle extends Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  halfW: number;
  halfD: number;
}

const BOT_NAMES = [
  'Alpha', 'Shadow', 'Phoenix', 'Titan', 'Viper', 'CyberBlade', 'Striker', 'Nova', 'Vortex', 'Zero',
  'Ghost', 'Reaper', 'Valkyrie', 'Apex', 'Blitz', 'Ronin', 'Phantom', 'Bullet', 'Goliath', 'Razor',
  'Falcon', 'Spectre', 'Havoc', 'Rogue', 'Venom', 'Eclipse', 'Thunder', 'Storm', 'Aero', 'Saber',
  'Nyx', 'Kage'
];

export function generateObstacles(): Record<string, Obstacle> {
  const obs: Record<string, Obstacle> = {};
  let count = 0;

  const addObs = (
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    type: 'crate' | 'wall' | 'monolith' | 'building' | 'bunker' | 'pillar',
    color: string
  ) => {
    const id = `obs_${count++}`;
    obs[id] = { id, x, z, width, depth, height, type, color };
  };

  const addRamp = (
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    rampDir: 'px' | 'nx' | 'pz' | 'nz',
    color: string
  ) => {
    const id = `ramp_${count++}`;
    obs[id] = { id, x, z, width, depth, height, type: 'ramp', color, rampDir };
  };

  // 1. CENTRAL CITADEL FORTRESS
  addObs(0, -18, 28, 4, 7, 'wall', '#1e293b');
  addObs(0, 18, 28, 4, 7, 'wall', '#1e293b');
  addObs(-18, 0, 4, 28, 7, 'wall', '#1e293b');
  addObs(18, 0, 4, 28, 7, 'wall', '#1e293b');

  addObs(-18, -18, 6, 6, 12, 'monolith', '#0f172a');
  addObs(18, -18, 6, 6, 12, 'monolith', '#0f172a');
  addObs(-18, 18, 6, 6, 12, 'monolith', '#0f172a');
  addObs(18, 18, 6, 6, 12, 'monolith', '#0f172a');

  addObs(0, 0, 8, 8, 4, 'crate', '#d97706');
  addObs(0, 0, 4, 4, 18, 'pillar', '#7c3aed');

  addRamp(0, -25.5, 8, 13, 7, 'pz', '#475569');
  addRamp(0, 25.5, 8, 13, 7, 'nz', '#475569');
  addRamp(-25.5, 0, 13, 8, 7, 'px', '#475569');
  addRamp(25.5, 0, 13, 8, 7, 'nx', '#475569');

  addRamp(0, -10.5, 8, 13, 7, 'nz', '#475569');
  addRamp(0, 10.5, 8, 13, 7, 'pz', '#475569');
  addRamp(-10.5, 0, 13, 8, 7, 'nx', '#475569');
  addRamp(10.5, 0, 13, 8, 7, 'px', '#475569');

  // 2. QUADRANT PLATFORMS
  const platforms = [
    { px: -70, pz: -70, rampDirs: ['px', 'pz'] as const },
    { px: 70, pz: -70, rampDirs: ['nx', 'pz'] as const },
    { px: -70, pz: 70, rampDirs: ['px', 'nz'] as const },
    { px: 70, pz: 70, rampDirs: ['nx', 'nz'] as const },
  ];
  platforms.forEach(({ px, pz, rampDirs }) => {
    addObs(px, pz, 22, 22, 8, 'building', '#334155');
    rampDirs.forEach(dir => {
      if (dir === 'px') addRamp(px - 16, pz, 12, 10, 8, 'px', '#64748b');
      if (dir === 'nx') addRamp(px + 16, pz, 12, 10, 8, 'nx', '#64748b');
      if (dir === 'pz') addRamp(px, pz - 16, 10, 12, 8, 'pz', '#64748b');
      if (dir === 'nz') addRamp(px, pz + 16, 10, 12, 8, 'nz', '#64748b');
    });
  });

  // 3. INNER RING PILLARS & SUPPLY STACKS
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const px = Math.cos(angle) * 44;
    const pz = Math.sin(angle) * 44;
    addObs(px, pz, 5, 5, 16, 'pillar', '#0f172a');
    addObs(px + Math.sin(angle) * 6, pz - Math.cos(angle) * 6, 4, 4, 4, 'crate', '#d97706');
  }

  // 4. QUADRANTS
  const quadrantCenters = [
    { qx: -130, qz: -130, theme: '#3b4252' },
    { qx: 130, qz: -130, theme: '#434c5e' },
    { qx: -130, qz: 130, theme: '#4c566a' },
    { qx: 130, qz: 130, theme: '#2e3440' },
  ];
  quadrantCenters.forEach(({ qx, qz, theme }) => {
    addObs(qx - 10, qz - 10, 18, 16, 26, 'building', theme);
    addObs(qx + 16, qz + 16, 16, 18, 22, 'building', theme);
    addObs(qx - 28, qz - 18, 12, 10, 10, 'bunker', '#1e293b');
    addObs(qx + 28, qz + 18, 10, 12, 10, 'bunker', '#1e293b');
    addObs(qx - 36, qz + 16, 16, 3, 5, 'wall', '#64748b');
    addObs(qx + 36, qz - 16, 16, 3, 5, 'wall', '#64748b');
    addObs(qx - 18, qz + 14, 5, 8, 4, 'crate', '#b45309');
    addObs(qx + 14, qz - 18, 8, 5, 4, 'crate', '#0284c7');
    addObs(qx - 38, qz - 38, 6, 6, 24, 'pillar', '#0f172a');
    addObs(qx + 38, qz + 38, 6, 6, 24, 'pillar', '#0f172a');
  });

  // 5. CHECKPOINTS
  const checkpoints = [{ x: 0, z: -55 }, { x: 0, z: 55 }, { x: -55, z: 0 }, { x: 55, z: 0 }];
  checkpoints.forEach(cp => {
    addObs(cp.x - 7, cp.z, 5, 6, 8, 'bunker', '#334155');
    addObs(cp.x + 7, cp.z, 5, 6, 8, 'bunker', '#334155');
    addObs(cp.x - 12, cp.z, 3, 8, 5, 'wall', '#64748b');
    addObs(cp.x + 12, cp.z, 3, 8, 5, 'wall', '#64748b');
  });

  // 6. WAREHOUSES
  const warehouseDistricts = [{ wx: 0, wz: -105 }, { wx: 0, wz: 105 }, { wx: -105, wz: 0 }, { wx: 105, wz: 0 }];
  warehouseDistricts.forEach(({ wx, wz }) => {
    addObs(wx - 14, wz, 14, 20, 12, 'building', '#334155');
    addObs(wx + 14, wz, 14, 20, 12, 'building', '#334155');
    addObs(wx - 6, wz - 12, 4, 4, 4, 'crate', '#d97706');
    addObs(wx + 6, wz + 12, 4, 4, 4, 'crate', '#0284c7');
  });

  // 7. CONTAINER YARDS
  const containerYards = [{ cx: -45, cz: 45 }, { cx: 45, cz: -45 }];
  containerYards.forEach(({ cx, cz }) => {
    const offsets = [-12, 12];
    offsets.forEach(ox => {
      offsets.forEach(oz => {
        addObs(cx + ox, cz + oz, 5, 10, 4.5, 'crate', '#d97706');
      });
    });
  });

  // 8. SCATTERED COVER
  const colors = ['#b45309', '#d97706', '#0284c7', '#059669', '#7c3aed', '#64748b'];
  let placedCount = 0;
  for (let attempt = 0; attempt < 900 && placedCount < 140; attempt++) {
    const rx = (Math.random() - 0.5) * 340;
    const rz = (Math.random() - 0.5) * 340;
    if (Math.hypot(rx, rz) < 32) continue;

    const typeRoll = Math.random();
    let width = 4, depth = 4, height = 4, type: 'monolith' | 'wall' | 'crate' | 'bunker' = 'crate';
    let col = colors[Math.floor(Math.random() * colors.length)];

    if (typeRoll < 0.25) {
      type = 'monolith'; width = 4; depth = 4; height = 12; col = '#475569';
    } else if (typeRoll < 0.6) {
      type = 'wall'; const horiz = Math.random() > 0.5; width = horiz ? 8 : 3; depth = horiz ? 3 : 8; height = 4; col = '#64748b';
    } else if (typeRoll < 0.85) {
      type = 'crate'; width = 4; depth = 4; height = 4;
    } else {
      type = 'bunker'; width = 8; depth = 8; height = 7; col = '#1e293b';
    }

    const CLEARANCE = 3.5;
    let safe = true;
    for (const existing of Object.values(obs)) {
      const minX = existing.x - existing.width / 2 - width / 2 - CLEARANCE;
      const maxX = existing.x + existing.width / 2 + width / 2 + CLEARANCE;
      const minZ = existing.z - existing.depth / 2 - depth / 2 - CLEARANCE;
      const maxZ = existing.z + existing.depth / 2 + depth / 2 + CLEARANCE;
      if (rx >= minX && rx <= maxX && rz >= minZ && rz <= maxZ) {
        safe = false;
        break;
      }
    }

    if (safe) {
      addObs(rx, rz, width, depth, height, type, col);
      placedCount++;
    }
  }

  // 9. BASTIONS
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    const px = Math.cos(angle) * 180;
    const pz = Math.sin(angle) * 180;
    addObs(px, pz, 10, 10, 24, 'pillar', '#0f172a');
    addObs(px * 0.94, pz * 0.94, 5, 5, 4, 'crate', '#d97706');
  }

  return obs;
}

function findSafeSpawnPosition(obstacles: Record<string, Obstacle>, mapSize: number): { x: number, z: number } {
  const range = mapSize * 0.70;
  for (let attempt = 0; attempt < 150; attempt++) {
    const candidateX = (Math.random() - 0.5) * range;
    const candidateZ = (Math.random() - 0.5) * range;
    if (Math.hypot(candidateX, candidateZ) < 32) continue;

    if (obstacles) {
      if (getGroundHeight(candidateX, candidateZ, obstacles) > 0.1) continue;
      let collides = false;
      for (const obs of Object.values(obstacles)) {
        if (obs.type === 'ramp') continue;
        if (candidateX >= obs.x - obs.width / 2 - 4 && candidateX <= obs.x + obs.width / 2 + 4 &&
            candidateZ >= obs.z - obs.depth / 2 - 4 && candidateZ <= obs.z + obs.depth / 2 + 4) {
          collides = true;
          break;
        }
      }
      if (collides) continue;
    }
    return { x: candidateX, z: candidateZ };
  }
  return { x: 30, z: 30 };
}

export function generateItems(obstacles: Record<string, Obstacle>): Record<string, ItemState> {
  const items: Record<string, ItemState> = {};
  let count = 0;

  for (let i = 0; i < 40; i++) {
    const pos = findSafeSpawnPosition(obstacles, MAP_SIZE);
    const id = `item_${count++}`;
    items[id] = { id, x: pos.x, y: 0.5, z: pos.z, type: 'heal' };
  }

  for (let i = 0; i < 30; i++) {
    const pos = findSafeSpawnPosition(obstacles, MAP_SIZE);
    const id = `item_${count++}`;
    items[id] = { id, x: pos.x, y: 0.5, z: pos.z, type: 'weapon' };
  }

  return items;
}

export interface LocalGameEngineEvents {
  onInit: (id: string, state: GameState) => void;
  onStateUpdate: (state: Partial<GameState>) => void;
  onHitConfirmed: () => void;
  onPlayerAttacked: (event: AttackEvent) => void;
  onDamageDealt: (event: DamagePopupEvent) => void;
  onTookDamage: (attackerPos: { attackerX: number; attackerZ: number }) => void;
  onRespawned: (pos: { x: number; y: number; z: number }) => void;
}

export class LocalGameEngine {
  public state: GameState;
  public myId: string;
  private intervalId: number | null = null;
  private events: LocalGameEngineEvents;
  private lastTime: number = Date.now();
  private obstaclesMap: Record<string, SpatialObstacle> = {};

  constructor(characterClass: CharacterClass = 'melee', events: LocalGameEngineEvents) {
    this.events = events;
    this.myId = 'player_offline';

    const obstacles = generateObstacles();
    for (const [id, obs] of Object.entries(obstacles)) {
      this.obstaclesMap[id] = {
        ...obs,
        minX: obs.x - obs.width / 2,
        maxX: obs.x + obs.width / 2,
        minZ: obs.z - obs.depth / 2,
        maxZ: obs.z + obs.depth / 2,
        halfW: obs.width / 2,
        halfD: obs.depth / 2,
      };
    }

    const items = generateItems(obstacles);
    const mySpawn = findSafeSpawnPosition(obstacles, MAP_SIZE);
    const myStats = CLASS_STATS[characterClass];

    const players: Record<string, PlayerState> = {
      [this.myId]: {
        id: this.myId,
        name: 'You (Offline)',
        x: mySpawn.x,
        y: 1.0,
        z: mySpawn.z,
        ry: 0,
        characterClass,
        health: myStats.maxHp,
        maxHealth: myStats.maxHp,
        isDead: false,
        score: 0,
        color: myStats.color,
        lastShootTime: 0,
        heals: 3,
        isHealing: false,
        healProgress: 0,
        weaponLevel: 1,
        lastAbilityTime: 0,
        isFlying: false,
        isInvulnerable: false,
        hasShield: false,
        rating: 1200,
        rankName: 'Platinum II',
      }
    };

    // Spawn 15 local AI Bots
    const classes: CharacterClass[] = ['melee', 'sword', 'tank', 'scout'];
    const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 15; i++) {
      const botId = `bot_${i + 1}`;
      const botClass = classes[Math.floor(Math.random() * classes.length)];
      const botStats = CLASS_STATS[botClass];
      const botSpawn = findSafeSpawnPosition(obstacles, MAP_SIZE);

      players[botId] = {
        id: botId,
        name: `Bot ${shuffledNames[i % shuffledNames.length]}`,
        x: botSpawn.x,
        y: 1.0,
        z: botSpawn.z,
        ry: Math.random() * Math.PI * 2,
        characterClass: botClass,
        health: botStats.maxHp,
        maxHealth: botStats.maxHp,
        isDead: false,
        score: 0,
        isBot: true,
        color: botStats.color,
        lastShootTime: 0,
        heals: 2,
        isHealing: false,
        healProgress: 0,
        weaponLevel: Math.random() < 0.3 ? 2 : 1,
        lastAbilityTime: 0,
        isFlying: false,
        isInvulnerable: false,
        hasShield: false,
        rating: 1000 + Math.floor(Math.random() * 500),
        rankName: 'Gold I',
      };
    }

    this.state = {
      roomId: 'offline_bot_room',
      status: 'playing',
      players,
      obstacles,
      items,
      bombs: {},
      matchTimer: 240,
      mode: 'bot',
      winner: null,
    };

    this.events.onInit(this.myId, this.state);
    this.startLoop();
  }

  private startLoop() {
    this.lastTime = Date.now();
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 1000 / 30);
  }

  public stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public respawn() {
    const player = this.state.players[this.myId];
    if (!player) return;

    const stats = CLASS_STATS[player.characterClass];
    const safePos = findSafeSpawnPosition(this.state.obstacles, MAP_SIZE);
    player.isDead = false;
    player.health = stats.maxHp;
    player.x = safePos.x;
    player.y = 1.0;
    player.z = safePos.z;
    player.isFlying = false;
    player.isInvulnerable = false;
    player.hasShield = false;
    player.healProgress = 0;
    player.isHealing = false;

    this.events.onRespawned({ x: safePos.x, y: 1.0, z: safePos.z });
    this.events.onStateUpdate({ players: this.state.players, status: 'playing' });
  }

  public processInput(input: {
    x: number;
    y: number;
    z: number;
    ry: number;
    pitch?: number;
    aimTarget?: { x: number; y: number; z: number };
    moveX: number;
    moveY: number;
    isShooting: boolean;
    isHealing: boolean;
    useAbility: boolean;
    isRolling?: boolean;
  }) {
    const player = this.state.players[this.myId];
    if (!player || player.isDead) return;

    player.x = input.x;
    player.y = input.y;
    player.z = input.z;
    player.ry = input.ry;
    player.isRolling = input.isRolling;

    const now = Date.now();
    const stats = CLASS_STATS[player.characterClass];

    // Healing
    if (input.isHealing && !input.isShooting) {
      player.isHealing = true;
      if (!player.lastDamagedTime || now - player.lastDamagedTime > 3000) {
        player.healProgress = (player.healProgress || 0) + 0.05;
        if (player.healProgress >= 1.0) {
          player.health = Math.min(player.maxHealth, player.health + 25);
          player.healProgress = 0;
        }
      }
    } else {
      player.isHealing = false;
      player.healProgress = 0;
    }

    // Ability
    if (input.useAbility && now - player.lastAbilityTime > CLASS_ABILITIES[player.characterClass].cooldownMs) {
      player.lastAbilityTime = now;
      if (player.characterClass === 'melee') {
        const bombId = `bomb_${Date.now()}_${Math.random()}`;
        const bState: BombState = {
          id: bombId,
          ownerId: this.myId,
          x: player.x,
          y: (player.y || 1) + 1.0,
          z: player.z,
          createdAt: now,
          exploded: false,
        };
        this.state.bombs[bombId] = bState;
        this.events.onPlayerAttacked({
          id: `atk_${Date.now()}`,
          attackerId: this.myId,
          characterClass: player.characterClass,
          x: player.x,
          y: player.y,
          z: player.z,
          ry: player.ry,
          targetPos: input.aimTarget,
          weaponLevel: player.weaponLevel,
          isSword: false,
        });
      } else if (player.characterClass === 'sword') {
        player.isInvulnerable = true;
        setTimeout(() => { player.isInvulnerable = false; }, 3000);
      } else if (player.characterClass === 'tank') {
        player.hasShield = true;
        setTimeout(() => { player.hasShield = false; }, 6000);
      } else if (player.characterClass === 'scout') {
        player.isFlying = true;
        setTimeout(() => { player.isFlying = false; }, 8000);
      }
    }

    // Shooting / Attacking
    if (input.isShooting && now - player.lastShootTime > stats.cooldown) {
      player.lastShootTime = now;
      player.healProgress = 0;

      const isMeleeClass = player.characterClass === 'sword';
      this.events.onPlayerAttacked({
        id: `atk_${Date.now()}`,
        attackerId: this.myId,
        characterClass: player.characterClass,
        x: player.x,
        y: player.y,
        z: player.z,
        ry: player.ry,
        targetPos: input.aimTarget,
        weaponLevel: player.weaponLevel,
        isSword: isMeleeClass,
      });

      const px = player.x;
      const py = player.y || 1.0;
      const pz = player.z;
      const range = isMeleeClass ? 4.5 : 85.0;

      let dirX = -Math.sin(player.ry);
      let dirY = 0;
      let dirZ = -Math.cos(player.ry);

      if (input.aimTarget) {
        const adx = input.aimTarget.x - px;
        const ady = input.aimTarget.y - (py + 1.0);
        const adz = input.aimTarget.z - pz;
        const alen = Math.hypot(adx, ady, adz);
        if (alen > 0.001) {
          dirX = adx / alen;
          dirY = ady / alen;
          dirZ = adz / alen;
        }
      }

      let hitRegistered = false;

      for (const targetId in this.state.players) {
        if (targetId === this.myId) continue;
        const target = this.state.players[targetId];
        if (target.isDead) continue;

        const tx = target.x;
        const ty = target.y || 1.0;
        const tz = target.z;

        const dx = tx - px;
        const dy = ty - py;
        const dz = tz - pz;
        const dist = Math.hypot(dx, dy, dz);

        if (dist <= range) {
          let isHit = false;
          if (isMeleeClass) {
            const angle = Math.atan2(dx, -dz);
            const diff = Math.abs(angle - player.ry);
            const normalizedDiff = Math.min(diff, Math.PI * 2 - diff);
            if (normalizedDiff < 0.95) isHit = true;
          } else {
            const dot3D = (dx * dirX + dy * dirY + dz * dirZ) / dist;
            const t = Math.max(0, dx * dirX + dirY * dy + dz * dirZ);
            const closestX = px + dirX * t;
            const closestY = py + dirY * t;
            const closestZ = pz + dirZ * t;
            const rayDist = Math.hypot(tx - closestX, ty - closestY, tz - closestZ);

            let directAimMatch = false;
            if (input.aimTarget) {
              const distToAimTarget = Math.hypot(tx - input.aimTarget.x, ty - input.aimTarget.y, tz - input.aimTarget.z);
              if (distToAimTarget <= 2.6) directAimMatch = true;
            }

            if (directAimMatch || dot3D >= 0.84 || rayDist <= 2.8) {
              if (!this.isLineBlocked(px, py + 1.0, pz, tx, ty + 1.0, tz)) {
                isHit = true;
              }
            }
          }

          if (isHit && !target.isInvulnerable) {
            hitRegistered = true;
            const isCrit = Math.random() < 0.18;
            let dmg = stats.damage * (player.weaponLevel === 2 ? 1.35 : 1.0);
            if (isCrit) dmg *= 1.5;
            if (target.hasShield) dmg *= 0.4;
            dmg = Math.round(dmg);

            target.health = Math.max(0, target.health - dmg);
            target.lastDamagedTime = now;

            this.events.onDamageDealt({
              id: `dmg_${Date.now()}`,
              targetId: target.id,
              amount: dmg,
              isSword: isMeleeClass,
              x: tx,
              y: ty + 1.5,
              z: tz,
            });

            if (target.health <= 0) {
              target.health = 0;
              target.isDead = true;
              player.score += 100;
            }
          }
        }
      }

      if (hitRegistered) {
        this.events.onHitConfirmed();
      }
    }
  }

  private isLineBlocked(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): boolean {
    const minX = Math.min(x1, x2) - 1;
    const maxX = Math.max(x1, x2) + 1;
    const minZ = Math.min(z1, z2) - 1;
    const maxZ = Math.max(z1, z2) + 1;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;

    for (const obs of Object.values(this.obstaclesMap)) {
      if (obs.type === 'ramp') continue;
      if (maxX < obs.minX || minX > obs.maxX || maxZ < obs.minZ || minZ > obs.maxZ) continue;
      if (Math.min(y1, y2) >= obs.height - 0.1) continue;

      let tmin = 0, tmax = 1;
      if (Math.abs(dx) > 1e-6) {
        const t1 = (obs.minX - x1) / dx;
        const t2 = (obs.maxX - x1) / dx;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      }
      if (Math.abs(dy) > 1e-6) {
        const t1 = (0 - y1) / dy;
        const t2 = (obs.height - y1) / dy;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      }
      if (Math.abs(dz) > 1e-6) {
        const t1 = (obs.minZ - z1) / dz;
        const t2 = (obs.maxZ - z1) / dz;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      }
      if (tmin < tmax && tmin < 0.95 && tmax > 0.05) {
        return true;
      }
    }
    return false;
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.state.status !== 'playing') {
      this.events.onStateUpdate(this.state);
      return;
    }

    this.state.matchTimer = Math.max(0, this.state.matchTimer - dt);

    const aliveList = Object.values(this.state.players).filter(p => !p.isDead);

    // Check Victory
    const myPlayer = this.state.players[this.myId];
    if (myPlayer && !myPlayer.isDead && aliveList.length === 1) {
      this.state.status = 'ended';
      this.state.winner = this.myId;
    } else if (aliveList.length === 0) {
      this.state.status = 'ended';
    }

    // Update Bots AI
    for (const bot of aliveList) {
      if (!bot.isBot) continue;

      const botStats = CLASS_STATS[bot.characterClass];

      // Find nearest living target
      let nearestTarget: PlayerState | null = null;
      let nearestDist = Infinity;

      for (const target of aliveList) {
        if (target.id === bot.id) continue;
        const dist = Math.hypot(target.x - bot.x, target.z - bot.z);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestTarget = target;
        }
      }

      if (nearestTarget) {
        const dx = nearestTarget.x - bot.x;
        const dz = nearestTarget.z - bot.z;
        const dist = Math.hypot(dx, dz);
        const angle = Math.atan2(dx, -dz);
        bot.ry = angle;

        const isMelee = bot.characterClass === 'sword';
        const attackRange = isMelee ? 3.5 : 28.0;

        if (dist > attackRange * 0.7) {
          const moveDirX = dx / (dist || 1);
          const moveDirZ = dz / (dist || 1);
          bot.x += moveDirX * botStats.speed * 12.0 * dt;
          bot.z += moveDirZ * botStats.speed * 12.0 * dt;
        }

        // Bot Attack
        if (dist <= attackRange && now - bot.lastShootTime > botStats.cooldown + 250) {
          bot.lastShootTime = now;

          this.events.onPlayerAttacked({
            id: `atk_bot_${Date.now()}`,
            attackerId: bot.id,
            characterClass: bot.characterClass,
            x: bot.x,
            y: bot.y,
            z: bot.z,
            ry: bot.ry,
            weaponLevel: bot.weaponLevel,
            isSword: isMelee,
          });

          // Check hit against target
          if (!nearestTarget.isInvulnerable) {
            const hasLos = !this.isLineBlocked(bot.x, (bot.y || 1) + 1.0, bot.z, nearestTarget.x, (nearestTarget.y || 1) + 1.0, nearestTarget.z);
            if (hasLos) {
              let dmg = botStats.damage;
              if (nearestTarget.hasShield) dmg *= 0.4;
              dmg = Math.round(dmg);

              nearestTarget.health = Math.max(0, nearestTarget.health - dmg);
              nearestTarget.lastDamagedTime = now;

              this.events.onDamageDealt({
                id: `dmg_bot_${Date.now()}`,
                targetId: nearestTarget.id,
                amount: dmg,
                isSword: isMelee,
                x: nearestTarget.x,
                y: (nearestTarget.y || 1) + 1.5,
                z: nearestTarget.z,
              });

              if (nearestTarget.id === this.myId) {
                this.events.onTookDamage({ attackerX: bot.x, attackerZ: bot.z });
              }

              if (nearestTarget.health <= 0) {
                nearestTarget.health = 0;
                nearestTarget.isDead = true;
              }
            }
          }
        }
      }

      bot.y = getGroundHeight(bot.x, bot.z, this.state.obstacles) + 1.0;
    }

    // Item Pickups for player
    if (myPlayer && !myPlayer.isDead) {
      for (const itemId in this.state.items) {
        const item = this.state.items[itemId];
        const dist = Math.hypot(item.x - myPlayer.x, item.z - myPlayer.z);
        if (dist < 2.0) {
          if (item.type === 'heal' && myPlayer.health < myPlayer.maxHealth) {
            myPlayer.health = Math.min(myPlayer.maxHealth, myPlayer.health + 40);
            delete this.state.items[itemId];
          } else if (item.type === 'weapon' && myPlayer.weaponLevel === 1) {
            myPlayer.weaponLevel = 2;
            delete this.state.items[itemId];
          }
        }
      }
    }

    this.events.onStateUpdate(this.state);
  }
}
