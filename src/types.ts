export type CharacterClass = 'melee' | 'tank' | 'scout' | 'sword';

export interface ClassStats {
  maxHp: number;
  speed: number;
  damage: number;
  cooldown: number;
  color: string;
}

export const CLASS_STATS: Record<CharacterClass, ClassStats> = {
  melee: { maxHp: 125, speed: 0.15, damage: 12, cooldown: 450, color: '#3b82f6' }, // blue, bomb blaster
  tank: { maxHp: 190, speed: 0.11, damage: 22, cooldown: 750, color: '#eab308' }, // yellow, heavy cannon
  scout: { maxHp: 85, speed: 0.28, damage: 5, cooldown: 250, color: '#10b981' }, // green, rapid SMG (balanced DPS)
  sword: { maxHp: 130, speed: 0.18, damage: 24, cooldown: 550, color: '#ef4444' }, // red, melee blade
};

export interface ClassAbilityInfo {
  name: string;
  jpName: string;
  icon: string;
  description: string;
  durationMs: number; // 0 for instant bombs, or active duration
  cooldownMs: number;
}

export const CLASS_ABILITIES: Record<CharacterClass, ClassAbilityInfo> = {
  melee: {
    name: 'Mega Bomb',
    jpName: '高爆裂ボム',
    icon: '💣',
    description: '前方へ大ダメージの時限爆弾を投擲',
    durationMs: 0,
    cooldownMs: 5000, // 5s cooldown (faster bomb rotation)
  },
  sword: {
    name: 'Blade Barrier',
    jpName: '無敵ブレード結界',
    icon: '⚔️',
    description: '弾丸完全無効化＆超高速ダッシュ',
    durationMs: 3000, // Reduced to 3 seconds for balance
    cooldownMs: 10000, // 10s cooldown
  },
  tank: {
    name: 'Fortress Shield',
    jpName: '要塞シールド',
    icon: '🛡️',
    description: '被ダメージを50%軽減する防壁を展開',
    durationMs: 6000, // reduced to 6s
    cooldownMs: 12000, // 12s cooldown
  },
  scout: {
    name: 'Sky Glide',
    jpName: '高高度スカイ飛行',
    icon: '🕊️',
    description: '上空15mへ飛翔し敵の地上攻撃を回避',
    durationMs: 8000, // increased to 8 seconds!
    cooldownMs: 10000, // 10s total cooldown
  },
};

export interface Obstacle {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  type?: 'building' | 'bunker' | 'crate' | 'pillar' | 'wall' | 'monolith' | 'ramp';
  rampDir?: 'nx' | 'px' | 'nz' | 'pz';
  color?: string;
}

export interface ItemState {
  id: string;
  type: 'heal' | 'weapon';
  x: number;
  y: number;
  z: number;
}

export interface BombState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  rx?: number;
  rz?: number;
  createdAt: number;
  exploded: boolean;
}

export interface PlayerState {
  id: string;
  name?: string;
  isBot?: boolean;
  characterClass: CharacterClass;
  x: number;
  y: number;
  z: number;
  ry: number; // Rotation Y
  health: number;
  maxHealth: number;
  isDead: boolean;
  score: number;
  color: string;
  team?: 'red' | 'blue';
  
  // Shooting & Healing
  lastShootTime: number;
  heals: number;
  isHealing: boolean;
  healProgress: number; // 0 to 1
  weaponLevel: number;
  
  // Abilities
  lastAbilityTime: number;
  isFlying: boolean;
  isInvulnerable: boolean;
  hasShield: boolean;
  
  // Rolling / Dodge
  isRolling?: boolean;
  lastRollTime?: number;
  lastDamagedTime?: number;
  
  // Ranked
  rating: number;
  rankName: string;
}

export interface GameState {
  roomId: string;
  mode: 'casual' | 'ranked' | 'password' | 'team' | 'bot';
  password?: string;
  players: Record<string, PlayerState>;
  items: Record<string, ItemState>;
  bombs: Record<string, BombState>;
  obstacles: Record<string, Obstacle>;
  status: 'waiting' | 'playing' | 'ended';
  matchTimer: number;
  winner: string | null;
}

export interface ClientInput {
  x: number;
  y: number;
  z: number;
  ry: number;
  pitch?: number;
  aimTarget?: { x: number; y: number; z: number };
  moveX: number;
  moveY: number;
  isShooting: boolean;
  isHealing: boolean; // Held down
  useAbility: boolean; // Trigger ability
  isRolling?: boolean; // Trigger dodge roll
  isZoomed?: boolean; // Aim zoom / ADS
}

export interface AttackEvent {
  id: string;
  attackerId: string;
  characterClass: CharacterClass;
  x: number;
  y: number;
  z: number;
  ry: number;
  dirX?: number;
  dirY?: number;
  dirZ?: number;
  targetPos?: { x: number; y: number; z: number } | null;
  weaponLevel: number;
  isSword: boolean;
  hitTargetId?: string | null;
  hitPosition?: { x: number; y: number; z: number } | null;
}

export interface DamagePopupEvent {
  id: string;
  targetId: string;
  x: number;
  y: number;
  z: number;
  amount: number;
  isSword: boolean;
}

export function getGroundHeight(x: number, z: number, obstacles: Record<string, Obstacle>): number {
  let maxH = 0;
  if (!obstacles) return maxH;

  for (const id in obstacles) {
    const obs = obstacles[id];
    if (obs.type === 'ramp' && obs.rampDir) {
      // Allow a small margin on ramps to eliminate seam gaps at top/bottom transitions
      const margin = 0.6;
      const minX = obs.x - obs.width / 2 - margin;
      const maxX = obs.x + obs.width / 2 + margin;
      const minZ = obs.z - obs.depth / 2 - margin;
      const maxZ = obs.z + obs.depth / 2 + margin;

      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
        const localX = x - (obs.x - obs.width / 2);
        const localZ = z - (obs.z - obs.depth / 2);
        let p = 0;
        if (obs.rampDir === 'px') p = localX / obs.width;
        else if (obs.rampDir === 'nx') p = 1 - (localX / obs.width);
        else if (obs.rampDir === 'pz') p = localZ / obs.depth;
        else if (obs.rampDir === 'nz') p = 1 - (localZ / obs.depth);
        
        // Clamp p between 0 and 1 so extending slightly onto the connected surface stays flat at full height
        p = Math.max(0, Math.min(1, p));
        const h = p * obs.height;
        if (h > maxH) maxH = h;
      }
    } else {
      if (x >= obs.x - obs.width / 2 && x <= obs.x + obs.width / 2 && z >= obs.z - obs.depth / 2 && z <= obs.z + obs.depth / 2) {
        if (obs.height > maxH) maxH = obs.height;
      }
    }
  }
  return maxH;
}
