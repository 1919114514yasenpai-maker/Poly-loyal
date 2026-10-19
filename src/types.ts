export type CharacterClass = 'melee' | 'tank' | 'scout' | 'sword' | 'wizard' | 'sniper' | 'lance';

export interface ClassStats {
  maxHp: number;
  speed: number;
  damage: number;
  cooldown: number;
  color: string;
}

export const CLASS_STATS: Record<CharacterClass, ClassStats> = {
  melee: { maxHp: 100, speed: 0.15, damage: 15, cooldown: 450, color: '#3b82f6' }, // blue, bomb blaster (12 * 1.25 = 15)
  tank: { maxHp: 150, speed: 0.11, damage: 11, cooldown: 750, color: '#eab308' }, // yellow, heavy cannon (22 * 0.5 = 11)
  scout: { maxHp: 35, speed: 0.28, damage: 7.5, cooldown: 250, color: '#10b981' }, // green, rapid SMG (5 * 1.5 = 7.5)
  sword: { maxHp: 90, speed: 0.18, damage: 30, cooldown: 550, color: '#ef4444' }, // red, melee blade (24 * 1.25 = 30)
  wizard: { maxHp: 80, speed: 0.14, damage: 22, cooldown: 700, color: '#a855f7' }, // purple, balanced fire magic (30 at Lv3)
  sniper: { maxHp: 60, speed: 0.16, damage: 20, cooldown: 5000, color: '#0284c7' }, // tactical blue, distance scaling 20-70, 5.0s cooldown (5s/発)
  lance: { maxHp: 100, speed: 0.17, damage: 28, cooldown: 500, color: '#f59e0b' }, // amber, long vertical thrust reach, 28 max dmg
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
    durationMs: 3000, // 3 seconds duration
    cooldownMs: 10000, // 10s cooldown
  },
  tank: {
    name: 'Fortress Shield',
    jpName: '要塞シールド',
    icon: '🛡️',
    description: '被ダメージを50%軽減する防壁を展開',
    durationMs: 6000, // 6s duration
    cooldownMs: 12000, // 12s cooldown
  },
  scout: {
    name: 'Jetpack',
    jpName: 'ジェットパック',
    icon: '🚀',
    description: 'ジャンプボタンで高度調整可能な飛行パック',
    durationMs: 8000,
    cooldownMs: 10000,
  },
  wizard: {
    name: 'Thunder Storm',
    jpName: '雷神ストーム',
    icon: '⚡',
    description: '広範囲に雷雲を展開し毎秒12ダメージ',
    durationMs: 3500,
    cooldownMs: 12000,
  },
  sniper: {
    name: 'Ghost Stealth',
    jpName: '光学迷彩ステルス',
    icon: '👁️‍🗨️',
    description: '10秒間マップと敵から完全不可視化',
    durationMs: 10000,
    cooldownMs: 15000,
  },
  lance: {
    name: 'Spear Charge',
    jpName: '超高速突進',
    icon: '🔱',
    description: '前方へ猛突進し直撃敵に30ダメージ',
    durationMs: 600,
    cooldownMs: 8000,
  },
};

export const CLASS_ABILITY2: Partial<Record<CharacterClass, ClassAbilityInfo>> = {
  scout: {
    name: 'Proximity Mine',
    jpName: 'センサー地雷',
    icon: '🧨',
    description: '100ダメージを与える地雷を設置',
    durationMs: 0,
    cooldownMs: 6000,
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
  isDestructible?: boolean;
  hp?: number;
  maxHp?: number;
}

export type ItemType = 'heal' | 'weapon' | 'speed' | 'power' | 'smoke' | 'stun' | 'shadow';

export interface ItemState {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  z: number;
}

export interface SmokeCloudState {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  createdAt: number;
  expiresAt: number;
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
  ry?: number;
  rz?: number;
  createdAt: number;
  exploded: boolean;
  isMine?: boolean;
  bombType?: 'bomb' | 'smoke' | 'stun' | 'shadow';
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
  squadId?: string;
  squadName?: string;
  squadColor?: string;
  
  // Shooting & Healing
  lastShootTime: number;
  heals: number;
  isHealing: boolean;
  healProgress: number; // 0 to 1
  weaponLevel: number;
  
  // Abilities
  lastAbilityTime: number;
  lastAbility2Time?: number;
  isFlying: boolean;
  isInvulnerable: boolean;
  hasShield: boolean;

  // Subweapons & Consumable Buffs (from map pickups)
  subWeapon?: ItemType | null;
  speedBuffUntil?: number; // +60% speed for 15s
  powerBuffUntil?: number; // +50% attack power for 15s
  shadowStealthUntil?: number; // 15s invisibility until attack/damage
  isShadowStealth?: boolean;
  isBlindedUntil?: number; // stun grenade flashbang effect
  blindIntensity?: number;
  
  // Rolling / Dodge & Wall Climbing
  isRolling?: boolean;
  lastRollTime?: number;
  lastDamagedTime?: number;
  isClimbing?: boolean;
  isStealth?: boolean;
  isCharging?: boolean;
  
  // Ranked & Season
  rating: number;
  rankName: string;
  rankedTeamMode?: 'solo' | 'duo' | 'trio';
  equippedSkin?: string;
  equippedTitle?: string;
  equippedBadge?: string;
  equippedEmote?: string;
  activeEmote?: { id: string; name: string; icon: string; startedAt: number } | null;

  // Battle Bus Drop & Gliding
  inBus?: boolean;
  isSkydiving?: boolean;
  isGliding?: boolean;
}

export type RankedTeamSize = 'solo' | 'duo' | 'trio';

export interface RankModeStats {
  rankPoints: number;
  rating: number | null;
  wins: number;
  matches: number;
  kills: number;
  streak: number;
}

export interface SeasonInfo {
  seasonId: string; // e.g. "2026-09"
  seasonName: string; // e.g. "2026年9月シーズン"
  startsAt: string;
  endsAt: string; // 1st of next month 00:00:00
  daysRemaining: number;
  hoursRemaining: number;
}

export interface SeasonHistoryRecord {
  seasonId: string;
  seasonName: string;
  soloFinalRank: string;
  soloFinalPoints: number;
  duoFinalRank: string;
  duoFinalPoints: number;
  trioFinalRank: string;
  trioFinalPoints: number;
  totalWins: number;
  coinsReward: number;
  completedAt: string;
}

export interface SkinItem {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
  price: number;
  colorHex: string;
  glowHex: string;
  previewGradient: string;
}

export interface TitleItem {
  id: string;
  title: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockCondition: string;
  price: number;
}

export interface BadgeItem {
  id: string;
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
  price: number;
}

export interface EmoteItem {
  id: string;
  name: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  description: string;
  animationType: 'jump_spin' | 'wave' | 'salute' | 'heart_float' | 'fire_burst' | 'cheer';
  price: number;
}

export interface BattleBusState {
  active: boolean;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  currentX: number;
  currentY: number;
  currentZ: number;
  progress: number; // 0.0 to 1.0
  duration: number; // in seconds
  timeLeft: number;
}

export interface GameState {
  roomId: string;
  mode: 'casual' | 'ranked' | 'ranked_duo' | 'ranked_trio' | 'password' | 'team' | 'bot' | 'p2p_duel';
  rankedTeamMode?: RankedTeamSize;
  password?: string;
  players: Record<string, PlayerState>;
  items: Record<string, ItemState>;
  bombs: Record<string, BombState>;
  smokeClouds?: Record<string, SmokeCloudState>;
  obstacles: Record<string, Obstacle>;
  status: 'waiting' | 'playing' | 'ended';
  matchTimer: number;
  winner: string | null;
  battleBus?: BattleBusState;
  totalOnlineCount?: number;
  teamScores?: { red: number; blue: number };
  noRatingChange?: boolean;
  endReason?: 'single_player' | string;
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
  useAbility2?: boolean; // Trigger second ability (e.g., Scout Mine)
  useSubWeapon?: boolean; // Trigger equipped consumable/sub-weapon (Smoke, Stun, Shadow, Power, Speed)
  isRolling?: boolean; // Trigger dodge roll
  isClimbing?: boolean; // Wall climbing
  isZoomed?: boolean; // Aim zoom / ADS
  jumpFromBus?: boolean; // Jump out of Battle Bus
  toggleGlider?: boolean; // Toggle glider while skydiving
  triggerEmote?: string; // Trigger emote ID
}

// ----------------------------------------------------------------------------
// RANK TIER & STRICT COMPETITIVE RATING CALCULATOR
// ----------------------------------------------------------------------------
export interface RankTierInfo {
  name: string;
  jpName: string;
  icon: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  badgeBg: string;
  matchEntryFee: number; // Tougher loss/entry penalty at higher ranks
}

export const RANK_TIERS: RankTierInfo[] = [
  { name: 'Beginner', jpName: 'ビギナー', icon: '🔰', minPoints: 0, maxPoints: 199, color: '#94a3b8', badgeBg: 'bg-slate-700', matchEntryFee: 0 },
  { name: 'Bronze', jpName: 'ブロンズ', icon: '🥉', minPoints: 200, maxPoints: 399, color: '#cd7f32', badgeBg: 'bg-amber-900', matchEntryFee: 2 },
  { name: 'Silver', jpName: 'シルバー', icon: '🥈', minPoints: 400, maxPoints: 699, color: '#e2e8f0', badgeBg: 'bg-slate-500', matchEntryFee: 4 },
  { name: 'Gold', jpName: 'ゴールド', icon: '🥇', minPoints: 700, maxPoints: 1099, color: '#eab308', badgeBg: 'bg-yellow-600', matchEntryFee: 7 },
  { name: 'Platinum', jpName: 'プラチナ', icon: '💠', minPoints: 1100, maxPoints: 1599, color: '#06b6d4', badgeBg: 'bg-cyan-600', matchEntryFee: 11 },
  { name: 'Diamond', jpName: 'ダイヤモンド', icon: '💎', minPoints: 1600, maxPoints: 2199, color: '#38bdf8', badgeBg: 'bg-sky-500', matchEntryFee: 16 },
  { name: 'Master', jpName: 'マスター', icon: '👑', minPoints: 2200, maxPoints: 2899, color: '#a855f7', badgeBg: 'bg-purple-600', matchEntryFee: 22 },
  { name: 'Legend', jpName: '神域 (Legend)', icon: '⚡', minPoints: 2900, maxPoints: 99999, color: '#f43f5e', badgeBg: 'bg-rose-600', matchEntryFee: 28 },
];

export function getRankTier(points: number, rating?: number | null): RankTierInfo {
  const effPoints = rating !== undefined && rating !== null && rating >= 2900 ? rating : points;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (effPoints >= RANK_TIERS[i].minPoints) {
      return RANK_TIERS[i];
    }
  }
  return RANK_TIERS[0];
}

// ----------------------------------------------------------------------------
// MONTHLY SEASON HELPERS (Reset at 00:00 on the 1st of every month)
// ----------------------------------------------------------------------------
export function getCurrentSeasonInfo(): SeasonInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const seasonId = `${year}-${String(month + 1).padStart(2, '0')}`;
  const seasonName = `${year}年${month + 1}月シーズン`;

  const startsAt = new Date(year, month, 1, 0, 0, 0).toISOString();
  // 1st day of next month at 00:00:00
  const nextMonthDate = new Date(year, month + 1, 1, 0, 0, 0);
  const endsAt = nextMonthDate.toISOString();

  const diffMs = Math.max(0, nextMonthDate.getTime() - now.getTime());
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return {
    seasonId,
    seasonName,
    startsAt,
    endsAt,
    daysRemaining,
    hoursRemaining,
  };
}

// ----------------------------------------------------------------------------
// COLLECTION / LOCKER CATALOGUE
// ----------------------------------------------------------------------------
export const SKIN_CATALOGUE: SkinItem[] = [
  { id: 'default', name: 'オリジナル (Classic)', rarity: 'common', description: '標準のポリゴンヒーロースーツ', price: 0, colorHex: '#3b82f6', glowHex: '#60a5fa', previewGradient: 'from-blue-600 to-indigo-700' },
  { id: 'crimson_samurai', name: '紅蓮の侍 (Crimson Samurai)', rarity: 'rare', description: '烈火の如き刃を秘めた深紅の甲冑スーツ', price: 300, colorHex: '#dc2626', glowHex: '#f87171', previewGradient: 'from-red-600 to-rose-900' },
  { id: 'cyber_neon', name: 'サイバーネオン (Cyber Neon)', rarity: 'rare', description: '電脳都市の蛍光ネオンサイバースーツ', price: 400, colorHex: '#06b6d4', glowHex: '#ec4899', previewGradient: 'from-cyan-400 to-fuchsia-500' },
  { id: 'emerald_dragon', name: '翡翠の飛龍 (Emerald Dragon)', rarity: 'rare', description: '猛毒と風を操る翠玉の鱗装束', price: 450, colorHex: '#10b981', glowHex: '#34d399', previewGradient: 'from-emerald-500 to-teal-800' },
  { id: 'void_obsidian', name: '漆黒の虚空 (Void Obsidian)', rarity: 'epic', description: '光を吸収する黒曜石の暗黒装甲', price: 800, colorHex: '#1e1b4b', glowHex: '#a855f7', previewGradient: 'from-slate-950 via-purple-950 to-indigo-900' },
  { id: 'sakura_ninja', name: '桜花の影武者 (Sakura Ninja)', rarity: 'epic', description: '舞い散る花弁を纏った優雅な白桜スーツ', price: 850, colorHex: '#f472b6', glowHex: '#fbcfe8', previewGradient: 'from-pink-400 via-rose-300 to-white' },
  { id: 'solar_flare', name: '太陽フレア (Solar Flare)', rarity: 'epic', description: '恒星の中心核の如き灼熱のエネルギー', price: 900, colorHex: '#ea580c', glowHex: '#fdba74', previewGradient: 'from-orange-500 via-amber-500 to-yellow-300' },
  { id: 'abyssal_deep', name: '深淵の幽鬼 (Abyssal Spectre)', rarity: 'epic', description: '海底深くに沈む古代遺物の蒼碧スーツ', price: 950, colorHex: '#0284c7', glowHex: '#38bdf8', previewGradient: 'from-sky-600 via-blue-900 to-cyan-950' },
  { id: 'golden_champ', name: '黄金の覇者 (Golden Sovereign)', rarity: 'legendary', description: '頂点に立つ者だけに許される純金に輝くオーラスーツ', price: 1500, colorHex: '#eab308', glowHex: '#fef08a', previewGradient: 'from-amber-300 via-yellow-400 to-amber-600' },
  { id: 'frost_knight', name: '絶対零度の騎士 (Frost Warden)', rarity: 'legendary', description: '極寒の氷晶を宿したブリザードアーマー', price: 1600, colorHex: '#38bdf8', glowHex: '#e0f2fe', previewGradient: 'from-sky-300 via-blue-500 to-cyan-200' },
  { id: 'celestial_god', name: '天上の創世神 (Celestial God)', rarity: 'legendary', description: '星々の輝きを一身に集めた神話級の神衣', price: 2500, colorHex: '#8b5cf6', glowHex: '#f472b6', previewGradient: 'from-violet-500 via-fuchsia-400 to-amber-300' },
  { id: 'rainbow_prism', name: '虹光のプリズム (Rainbow Prism)', rarity: 'legendary', description: '七色に輝くプリズム光線を放つ究極のスキン', price: 3000, colorHex: '#ec4899', glowHex: '#38bdf8', previewGradient: 'from-rose-500 via-yellow-400 via-emerald-400 to-sky-500' },
];

export const TITLE_CATALOGUE: TitleItem[] = [
  { id: 'rookie', title: '初陣の戦士', rarity: 'common', unlockCondition: '初期から所持', price: 0 },
  { id: 'first_win', title: '初勝利の証', rarity: 'common', unlockCondition: '通算1勝達成', price: 150 },
  { id: 'solo_wolf', title: '孤高の一匹狼 (Solo Master)', rarity: 'rare', unlockCondition: 'ソロランクで勝利または購入', price: 300 },
  { id: 'duo_bond', title: '双璧の絆 (Pair Master)', rarity: 'rare', unlockCondition: 'ペアランクで勝利または購入', price: 300 },
  { id: 'trio_trinity', title: '三位一体 (Trio Master)', rarity: 'rare', unlockCondition: 'トリオランクで勝利または購入', price: 300 },
  { id: 'sword_master', title: '孤高の剣聖', rarity: 'rare', unlockCondition: '剣豪で5勝または購入', price: 350 },
  { id: 'sniper_ace', title: '神域の狙撃手', rarity: 'rare', unlockCondition: '狙撃手で5勝または購入', price: 350 },
  { id: 'fortress', title: '不沈の要塞', rarity: 'rare', unlockCondition: '重装兵で5勝または購入', price: 350 },
  { id: 'sky_reaper', title: '蒼穹の奇襲者', rarity: 'rare', unlockCondition: '奇襲兵で5勝または購入', price: 350 },
  { id: 'archmage', title: '真理の大魔導', rarity: 'rare', unlockCondition: '魔導士で5勝または購入', price: 350 },
  { id: 'dragon_piercer', title: '龍穿の戦槍', rarity: 'rare', unlockCondition: '槍騎兵で5勝または購入', price: 350 },
  { id: 'wall_ninja', title: '疾風の壁走り', rarity: 'rare', unlockCondition: '壁登りからの撃破', price: 400 },
  { id: 'win_streak_king', title: '不敗の連勝王', rarity: 'epic', unlockCondition: '3連勝達成または購入', price: 600 },
  { id: 'ranked_slayer', title: '歴戦の猛者', rarity: 'epic', unlockCondition: '通算30キル達成', price: 600 },
  { id: 'season_challenger', title: '月間ランカー', rarity: 'epic', unlockCondition: 'プラチナランク到達', price: 800 },
  { id: 'master_collector', title: '至高の蒐集王 (Collector)', rarity: 'epic', unlockCondition: 'コレクション50%達成', price: 1000 },
  { id: 'season_conqueror', title: 'シーズン覇王', rarity: 'legendary', unlockCondition: 'ダイヤモンドランク到達', price: 1500 },
  { id: 'legend_god', title: '神速の絶対神', rarity: 'legendary', unlockCondition: 'マスターランク以上到達', price: 2200 },
  { id: 'immortal_king', title: '不滅の覇王', rarity: 'legendary', unlockCondition: '通算100勝達成', price: 3000 },
];

export const BADGE_CATALOGUE: BadgeItem[] = [
  { id: 'first_blood', name: '初陣の血', icon: '⚔️', rarity: 'common', description: '初めて敵を撃破した証', price: 0 },
  { id: 'victory_royale', name: '栄光の覇者', icon: '👑', rarity: 'rare', description: 'バトルロイヤルで勝利した証', price: 200 },
  { id: 'pair_champion', name: 'ペア王者', icon: '👥', rarity: 'rare', description: 'ペアランクマッチで1位を獲得した証', price: 250 },
  { id: 'trio_champion', name: 'トリオ王者', icon: '🛡️', rarity: 'rare', description: 'トリオランクマッチで1位を獲得した証', price: 250 },
  { id: 'triple_kill', name: 'トリプルキラー', icon: '💥', rarity: 'rare', description: '1試合で3キル以上達成', price: 350 },
  { id: 'climbing_assassin', name: '壁登りの暗殺者', icon: '🧗', rarity: 'rare', description: '壁登りを駆使して奇襲した証', price: 350 },
  { id: 'gold_glory', name: '黄金の栄光', icon: '🏆', rarity: 'rare', description: 'ゴールドランク到達', price: 400 },
  { id: 'diamond_climber', name: 'ダイヤの輝き', icon: '💎', rarity: 'epic', description: 'ダイヤモンドランク到達', price: 700 },
  { id: 'master_elite', name: 'マスターエリート', icon: '🔥', rarity: 'legendary', description: 'マスター以上の頂点に立った証', price: 1200 },
  { id: 'god_crown', name: 'ゴッドクラウン', icon: '👑', rarity: 'legendary', description: 'ゴッドランクに君臨した絶対的覇者の証', price: 2000 },
  { id: 'veteran_50', name: '百戦錬磨', icon: '🎖️', rarity: 'epic', description: '50試合以上参戦したベテラン', price: 500 },
  { id: 'season_pass_1', name: 'シーズン1トロフィー', icon: '🌌', rarity: 'epic', description: '月間シーズン完走の記念トロフィー', price: 800 },
];

export const EMOTE_CATALOGUE: EmoteItem[] = [
  { id: 'victory_cheer', name: '歓喜の雄叫び', icon: '🎉', rarity: 'common', description: '両手を掲げて勝利を祝う', animationType: 'cheer', price: 0 },
  { id: 'gg_badge', name: 'グッドゲーム', icon: '🤝', rarity: 'common', description: '対戦相手を讃える握手', animationType: 'wave', price: 150 },
  { id: 'salute', name: '栄誉の敬礼', icon: '🫡', rarity: 'rare', description: '規律正しき敬礼ポーズ', animationType: 'salute', price: 300 },
  { id: 'heart_love', name: '感謝のハート', icon: '💖', rarity: 'rare', description: '頭上にハートを浮かべて感謝', animationType: 'heart_float', price: 400 },
  { id: 'breakdance', name: 'ブレイクスピン', icon: '🕺', rarity: 'epic', description: 'アクロバティックに空中一回転スピン', animationType: 'jump_spin', price: 800 },
  { id: 'fire_aura', name: '闘気覚醒', icon: '🔥', rarity: 'legendary', description: '全身から炎の闘気オーラを噴出', animationType: 'fire_burst', price: 1200 },
];

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
  range?: number;
  targetPos?: { x: number; y: number; z: number } | null;
  weaponLevel: number;
  isSword: boolean;
  hitTargetId?: string | null;
  hitPosition?: { x: number; y: number; z: number } | null;
}

export interface DamagePopupEvent {
  id: string;
  targetId: string;
  attackerId?: string;
  x: number;
  y: number;
  z: number;
  amount: number;
  isSword: boolean;
}

const CELL_SIZE = 20;
const spatialGridWeakMap = new WeakMap<Record<string, Obstacle>, Map<string, Obstacle[]>>();

function getGridMap(obstacles: Record<string, Obstacle>): Map<string, Obstacle[]> {
  let grid = spatialGridWeakMap.get(obstacles);
  if (!grid) {
    grid = new Map<string, Obstacle[]>();
    for (const id in obstacles) {
      const obs = obstacles[id];
      const margin = obs.type === 'ramp' ? 1.5 : 0.5;
      const minCX = Math.floor((obs.x - obs.width / 2 - margin) / CELL_SIZE);
      const maxCX = Math.floor((obs.x + obs.width / 2 + margin) / CELL_SIZE);
      const minCZ = Math.floor((obs.z - obs.depth / 2 - margin) / CELL_SIZE);
      const maxCZ = Math.floor((obs.z + obs.depth / 2 + margin) / CELL_SIZE);

      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const key = `${cx},${cz}`;
          let list = grid.get(key);
          if (!list) {
            list = [];
            grid.set(key, list);
          }
          list.push(obs);
        }
      }
    }
    spatialGridWeakMap.set(obstacles, grid);
  }
  return grid;
}

export function getGroundHeight(x: number, z: number, obstacles: Record<string, Obstacle>, currentY?: number): number {
  let maxH = 0;
  if (!obstacles) return maxH;

  const grid = getGridMap(obstacles);
  const cx = Math.floor(x / CELL_SIZE);
  const cz = Math.floor(z / CELL_SIZE);

  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(`${cx + dx},${cz + dz}`);
      if (!list) continue;

      for (let i = 0; i < list.length; i++) {
        const obs = list[i];
        if (obs.type === 'ramp' && obs.rampDir) {
          const margin = 0.8;
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
            p = Math.max(0, Math.min(1, p));
            const h = p * obs.height;
            if (currentY === undefined || h <= currentY + 1.2) {
              if (h > maxH) maxH = h;
            }
          }
        } else {
          if (x >= obs.x - obs.width / 2 && x <= obs.x + obs.width / 2 && z >= obs.z - obs.depth / 2 && z <= obs.z + obs.depth / 2) {
            // When currentY is provided (airborne / skydiving / gliding check),
            // only count the building top as ground surface if the player is AT or ABOVE its roof level!
            if (currentY === undefined || obs.height <= currentY + 1.0) {
              if (obs.height > maxH) maxH = obs.height;
            }
          }
        }
      }
    }
  }
  return maxH;
}

export function getNearbyObstaclesClient(
  x: number,
  z: number,
  radius: number,
  obstacles: Record<string, Obstacle>
): Obstacle[] {
  if (!obstacles) return [];
  const grid = getGridMap(obstacles);
  const minCx = Math.floor((x - radius) / CELL_SIZE);
  const maxCx = Math.floor((x + radius) / CELL_SIZE);
  const minCz = Math.floor((z - radius) / CELL_SIZE);
  const maxCz = Math.floor((z + radius) / CELL_SIZE);

  const result: Obstacle[] = [];
  const visited = new Set<string>();

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      const list = grid.get(`${cx},${cz}`);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const obs = list[i];
        if (!visited.has(obs.id)) {
          visited.add(obs.id);
          result.push(obs);
        }
      }
    }
  }
  return result;
}
