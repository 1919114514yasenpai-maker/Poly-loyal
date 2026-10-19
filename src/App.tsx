import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { useGameStore } from './store';
import { Map } from './components/Map';
import { Players } from './components/Players';
import { LocalPlayer } from './components/LocalPlayer';
import { BattleBus } from './components/BattleBus';
import { AttackEffects } from './components/AttackEffects';
import { DamagePopupsOverlay } from './components/DamagePopupsOverlay';
import { MobileControls } from './components/MobileControls';
import { EliminatedModal, SpectateHUD } from './components/EliminatedModal';
import { FirebaseAccount } from './components/FirebaseAccount';
import { FriendsModal } from './components/FriendsModal';
import { LagMonitorModal } from './components/LagMonitorModal';
import { ReviewModal } from './components/ReviewModal';
import { CollectionModal } from './components/CollectionModal';
import { SeasonModal } from './components/SeasonModal';
import { P2PInviteModal } from './components/P2PInviteModal';
import { P2PStatusBadge } from './components/P2PStatusBadge';
import { auth, updateUserStats, saveUserCosmeticsAndCoins, UserProfileData } from './firebase';
import { CharacterClass } from './types';
import { RotateCcw, LogOut, Trophy, Flame, Sparkles, Users, UserPlus, Zap, Activity, Copy, Check, Share2, ExternalLink, Palette, Calendar, AlertTriangle } from 'lucide-react';
import { getRankTier, RANK_CONFIGS, getCurrentMonthlySeason, calculateStrictRatingChange, calculateSeasonSoftReset } from './utils/rankUtils';
import { getApiUrl } from './utils/apiConfig';

// Isolated Matchmaking Lobby UI - updates its own countdown without re-rendering App/Canvas
const MatchLobbyBanner = React.memo(function MatchLobbyBanner() {
  const isWaiting = useGameStore((s) => s.gameState?.status === 'waiting');
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const roomId = useGameStore((s) => s.gameState?.roomId);
  const playerCount = useGameStore((s) => s.gameState ? Object.keys(s.gameState.players).length : 0);
  const totalOnline = useGameStore((s) => s.gameState?.totalOnlineCount || 1);
  const matchTimer = useGameStore((s) => s.gameState ? Math.ceil(s.gameState.matchTimer) : 0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isWaiting) return null;

  const isP2P = gameMode === 'p2p_duel';

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyInviteUrl = () => {
    if (roomId) {
      const url = `${window.location.origin}${window.location.pathname}?p2p=${encodeURIComponent(roomId)}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="absolute top-4 sm:top-8 left-0 right-0 flex justify-center pointer-events-none z-30 px-4">
      <div className="bg-slate-900/95 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-3xl font-bold border-2 border-yellow-400/60 shadow-[0_0_35px_rgba(250,204,21,0.4)] backdrop-blur-xl flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 text-[10px] sm:text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>オンライン: {totalOnline}人</span>
          </div>
          <span className="text-xs sm:text-sm font-black text-yellow-300 uppercase tracking-widest flex items-center gap-1">
            {isP2P ? '⚡ P2P 1v1 DUEL LOBBY' : `${gameMode?.toUpperCase()} MATCH LOBBY`}
            {(gameMode === 'password' || isP2P) && ` • ROOM: ${roomId}`}
          </span>
        </div>
        
        {isP2P && playerCount < 2 ? (
          <div className="flex flex-col items-center gap-2 my-1 text-center">
            <div className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-2">
              <span className="animate-spin text-lg">⏳</span>
              <span>対戦相手の入室を待機中... (1/2人)</span>
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap justify-center">
              <span>コード: <strong className="font-mono text-yellow-400 text-sm select-all">{roomId}</strong></span>
              <button
                type="button"
                onClick={copyRoomCode}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs rounded-lg border border-amber-500/40 cursor-pointer font-bold transition-all flex items-center gap-1"
              >
                {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedCode ? 'コピー完了' : 'コードをコピー'}</span>
              </button>
              <button
                type="button"
                onClick={copyInviteUrl}
                className="px-2.5 py-1 bg-indigo-600/40 hover:bg-indigo-600/60 text-indigo-200 text-xs rounded-lg border border-indigo-400/40 cursor-pointer font-bold transition-all flex items-center gap-1"
              >
                {copiedLink ? <Check size={12} className="text-emerald-400" /> : <Share2 size={12} />}
                <span>{copiedLink ? 'URLコピー完了' : '招待URLをコピー'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-3">
              <span className="text-sm sm:text-base text-slate-300 font-bold">
                👥 部屋人数: <strong className="text-white font-mono">{playerCount}</strong> 人
              </span>
              <span className="text-slate-500 font-light">|</span>
              <span className="text-base sm:text-xl font-black text-amber-300 flex items-center gap-1">
                ⏳ 開始まで: <span className="font-mono text-xl sm:text-2xl text-yellow-400 underline decoration-yellow-500/50">{matchTimer}秒</span>
              </span>
            </div>
            {(gameMode === 'ranked' || gameMode === 'ranked_duo' || gameMode === 'ranked_trio') && playerCount <= 1 && (
              <div className="flex items-center gap-2 mt-1 bg-amber-500/15 border border-amber-500/40 px-3 py-1 rounded-xl text-center">
                <span className="text-[11px] text-amber-300 font-bold">
                  ⚠️ 部屋人数が1人の場合はレート変動なしで終了します
                </span>
                <button
                  type="button"
                  onClick={() => useGameStore.getState().endSinglePlayerMatch()}
                  className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black rounded-lg cursor-pointer transition-all shadow active:scale-95"
                >
                  即時終了 (変動なし)
                </button>
              </div>
            )}
          </div>
        )}
        <div className="text-[10px] sm:text-xs text-sky-300/90 font-medium">
          {isP2P ? '⚡ 2人揃うと即座に1v1タイマンデュエルがスタートします！' : '⚡ バトルバス発進準備中... まもなく降下開始！'}
        </div>
      </div>
    </div>
  );
});

// Isolated End Match UI - updates without re-rendering Canvas
const EndMatchModal = React.memo(function EndMatchModal({ 
  onPlayAgain, 
  onReturnToLobby 
}: { 
  onPlayAgain: () => void; 
  onReturnToLobby: () => void; 
}) {
  const isEnded = useGameStore((s) => s.gameState?.status === 'ended');
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const winner = useGameStore((s) => s.gameState?.winner);
  const myId = useGameStore((s) => s.myId);
  const noRatingChange = useGameStore((s) => (s.gameState as any)?.noRatingChange);
  const playerCount = useGameStore((s) => Object.keys(s.gameState?.players || {}).length);
  const isSinglePlayerRoom = (gameMode === 'ranked' || gameMode === 'ranked_duo' || gameMode === 'ranked_trio') && (playerCount <= 1 || !!noRatingChange);
  const myPlayerTeam = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? (p as any).team : null;
  });
  const myPlayerScore = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? p.score : 0;
  });
  const matchTimer = useGameStore((s) => s.gameState ? Math.ceil(s.gameState.matchTimer) : 0);

  if (!isEnded) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md text-white pointer-events-auto p-4 select-none touch-none">
      <div className="w-full max-w-md bg-slate-900/95 border-2 border-yellow-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(234,179,8,0.25)] text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/50 flex items-center justify-center text-yellow-400 mb-3 shadow-[0_0_20px_rgba(234,179,8,0.4)]">
          {isSinglePlayerRoom ? (
            <AlertTriangle size={36} className="text-amber-400 animate-pulse" />
          ) : (
            <Trophy size={36} className="animate-bounce" />
          )}
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-yellow-400 mb-1 drop-shadow tracking-wider">
          {isSinglePlayerRoom
            ? 'MATCH ENDED'
            : gameMode === 'team'
            ? winner === myPlayerTeam
              ? 'TEAM VICTORY!'
              : 'DEFEAT'
            : winner === myId
            ? 'VICTORY ROYALE!'
            : 'MATCH OVER'}
        </h1>
        
        <p className="text-slate-400 text-sm font-semibold mb-4">
          {isSinglePlayerRoom
            ? '部屋の人数が1人のため、レート変動なしで終了しました'
            : gameMode === 'team'
            ? winner === myPlayerTeam
              ? `自陣（${myPlayerTeam === 'red' ? '赤チーム' : '青チーム'}）が見事勝利しました！`
              : `${winner === 'red' ? '赤チーム' : '青チーム'}の勝利となりました。`
            : winner === myId
            ? '見事最後まで生き残りました！'
            : '試合が終了しました'}
        </p>

        {isSinglePlayerRoom && (
          <div className="w-full mb-5 bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border-2 border-amber-500/50 rounded-2xl p-3 text-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <div className="text-sm font-black text-amber-300 flex items-center justify-center gap-1.5">
              <span>⚠️</span>
              <span>部屋の人数が1人のため レート変動なし (±0 RP)</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-1 font-medium">
              ランク戦は2人以上のプレイヤーが揃った場合のみレート計算が行われます。
            </div>
          </div>
        )}

        <div className="bg-slate-800/80 w-full rounded-2xl p-4 mb-6 border border-white/5 flex justify-around items-center">
          <div>
            <div className="text-[11px] text-slate-400 font-bold uppercase">スコア</div>
            <div className="text-2xl font-black text-amber-300">{myPlayerScore || 0}</div>
          </div>
          <div className="border-l border-white/10 h-8" />
          <div>
            <div className="text-[11px] text-slate-400 font-bold uppercase">次の試合</div>
            <div className="text-2xl font-black text-blue-400">{matchTimer}秒</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 active:scale-98 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-yellow-400/30 flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw size={22} className="stroke-[2.5]" />
            <span>次マッチに参戦</span>
          </button>

          <button
            type="button"
            onClick={onReturnToLobby}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold text-base rounded-2xl border border-white/10 flex items-center justify-center gap-2 transition-all"
          >
            <LogOut size={18} />
            <span>ロビーに戻る</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default function App() {
  const connect = useGameStore((s) => s.connect);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const myId = useGameStore((s) => s.myId);
  const hasGameState = useGameStore((s) => !!s.gameState);
  const status = useGameStore((s) => s.gameState?.status);
  const roomId = useGameStore((s) => s.gameState?.roomId);
  const winner = useGameStore((s) => s.gameState?.winner);
  const gameMode = useGameStore((s) => s.gameState?.mode);
  const myPlayerIsDead = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? p.isDead : false;
  });
  const myPlayerTeam = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? (p as any).team : null;
  });
  const myPlayerScore = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? p.score : 0;
  });

  const isEnded = status === 'ended';

  const socket = useGameStore((s) => s.socket);
  const registerP2PUser = useGameStore((s) => s.registerP2PUser);
  const incomingP2PInvite = useGameStore((s) => s.incomingP2PInvite);
  const p2pNotice = useGameStore((s) => s.p2pNotice);
  const clearP2PNotice = useGameStore((s) => s.clearP2PNotice);

  const hasStarted = useGameStore((s) => s.hasStarted);
  const setHasStarted = useGameStore((s) => s.setHasStarted);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [isLagModalOpen, setIsLagModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [lobbyOnlineCount, setLobbyOnlineCount] = useState<number>(1);
  const [mode, setMode] = useState<'casual'|'ranked'|'ranked_duo'|'ranked_trio'|'password'|'team'|'bot'|'p2p_duel'>('ranked');
  const [password, setPassword] = useState('');
  const [charClass, setCharClass] = useState<CharacterClass>('melee');
  const [botCount, setBotCount] = useState(15);
  const [teamChoice, setTeamChoice] = useState<'auto' | 'red' | 'blue'>('auto');
  const [teamMatchType, setTeamMatchType] = useState<'pvp' | 'bot'>('pvp');
  const [lastProcessedMatch, setLastProcessedMatch] = useState<string | null>(null);
  const [cloudProfile, setCloudProfile] = useState<UserProfileData | null>(null);

  // User Equipped Cosmetics
  const [equippedCosmetics, setEquippedCosmetics] = useState<{
    skin: string;
    title: string;
    badge: string;
    emote: string;
  }>(() => ({
    skin: localStorage.getItem('poly_equipped_skin') || 'default',
    title: localStorage.getItem('poly_equipped_title') || 'rookie',
    badge: localStorage.getItem('poly_equipped_badge') || 'first_blood',
    emote: localStorage.getItem('poly_equipped_emote') || 'victory_cheer',
  }));

  // Dedicated P2P 1v1 state
  const [p2pSubTab, setP2pSubTab] = useState<'create' | 'join'>('create');
  const [p2pRoomInput, setP2pRoomInput] = useState('');
  const [p2pGeneratedRoom, setP2pGeneratedRoom] = useState(() => 'P2P-' + Math.random().toString(36).substring(2, 6).toUpperCase());
  const [urlP2pRoom, setUrlP2pRoom] = useState<string | null>(null);
  const [copiedP2pCode, setCopiedP2pCode] = useState(false);
  const [copiedP2pUrl, setCopiedP2pUrl] = useState(false);

  // Check URL query parameters for direct P2P link (e.g. ?p2p=P2P-ABCD)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const p2pParam = params.get('p2p') || params.get('room');
      if (p2pParam) {
        const clean = p2pParam.trim().toUpperCase();
        setUrlP2pRoom(clean);
        setP2pRoomInput(clean);
        setMode('p2p_duel');
        setP2pSubTab('join');
      }
    } catch {}
  }, []);

  // Monthly season auto-check
  useEffect(() => {
    const season = getCurrentMonthlySeason();
    const storedSeason = localStorage.getItem('poly_current_season');
    if (storedSeason && storedSeason !== season.seasonId) {
      // Month changed! Reset local stats
      const localProfile = JSON.parse(localStorage.getItem('poly_profile') || 'null');
      if (localProfile) {
        const softReset = (pts: number) => pts <= 1000 ? pts : Math.max(1000, Math.round(1000 + (pts - 1000) * 0.5));
        localProfile.rankPoints = softReset(localProfile.rankPoints || 0);
        localProfile.soloRankPoints = softReset(localProfile.soloRankPoints || localProfile.rankPoints || 0);
        localProfile.duoRankPoints = softReset(localProfile.duoRankPoints || 0);
        localProfile.trioRankPoints = softReset(localProfile.trioRankPoints || 0);
        localStorage.setItem('poly_profile', JSON.stringify(localProfile));
      }
    }
    localStorage.setItem('poly_current_season', season.seasonId);
  }, []);

  // Register user UID for P2P direct matching upon login
  useEffect(() => {
    if (cloudProfile?.userId) {
      registerP2PUser(cloudProfile.userId);
      if (cloudProfile.equippedSkin) {
        setEquippedCosmetics({
          skin: cloudProfile.equippedSkin || 'default',
          title: cloudProfile.equippedTitle || 'rookie',
          badge: cloudProfile.equippedBadge || 'first_blood',
          emote: cloudProfile.equippedEmote || 'victory_cheer',
        });
      }
    }
  }, [cloudProfile, registerP2PUser]);

  // Poll online player count while in lobby
  useEffect(() => {
    if (hasStarted) return;
    const fetchOnlineCount = async () => {
      try {
        const res = await fetch(getApiUrl('/api/online-count'));
        if (res.ok) {
          const data = await res.json();
          if (typeof data.count === 'number') {
            setLobbyOnlineCount(data.count);
          }
        }
      } catch {
        // ignore network hiccups
      }
    };
    fetchOnlineCount();
    const timer = setInterval(fetchOnlineCount, 3000);
    return () => clearInterval(timer);
  }, [hasStarted]);

  const [profile, setProfile] = useState(() => {
    const p = localStorage.getItem('poly_profile');
    if (p) return JSON.parse(p);
    return { wins: 0, streak: 0, rankPoints: 0, soloRankPoints: 0, duoRankPoints: 0, trioRankPoints: 0, rating: null };
  });

  // Synchronize cloud profile into active profile state
  useEffect(() => {
    if (cloudProfile) {
      setProfile((prev: any) => ({
        ...prev,
        wins: cloudProfile.totalWins || 0,
        rankPoints: cloudProfile.rankPoints || 0,
        soloRankPoints: cloudProfile.soloRankPoints ?? cloudProfile.rankPoints ?? 0,
        duoRankPoints: cloudProfile.duoRankPoints ?? 0,
        trioRankPoints: cloudProfile.trioRankPoints ?? 0,
        rating: cloudProfile.rating && cloudProfile.rating >= 2000 ? cloudProfile.rating : null,
      }));
    }
  }, [cloudProfile]);

  const userCoins = cloudProfile?.coins ?? (profile as any)?.coins ?? 500;
  const userUnlockedSkins = cloudProfile?.unlockedSkins ?? (profile as any)?.unlockedSkins ?? ['default'];
  const userUnlockedTitles = cloudProfile?.unlockedTitles ?? (profile as any)?.unlockedTitles ?? ['rookie'];
  const userUnlockedBadges = cloudProfile?.unlockedBadges ?? (profile as any)?.unlockedBadges ?? ['first_blood'];
  const userUnlockedEmotes = cloudProfile?.unlockedEmotes ?? (profile as any)?.unlockedEmotes ?? ['victory_cheer'];

  const handleEquipSkin = (skinId: string) => {
    setEquippedCosmetics((prev) => ({ ...prev, skin: skinId }));
    localStorage.setItem('poly_equipped_skin', skinId);
    if (cloudProfile && auth.currentUser) {
      saveUserCosmeticsAndCoins(auth.currentUser.uid, { equippedSkin: skinId });
      setCloudProfile({ ...cloudProfile, equippedSkin: skinId });
    }
  };

  const handleEquipTitle = (titleId: string) => {
    setEquippedCosmetics((prev) => ({ ...prev, title: titleId }));
    localStorage.setItem('poly_equipped_title', titleId);
    if (cloudProfile && auth.currentUser) {
      saveUserCosmeticsAndCoins(auth.currentUser.uid, { equippedTitle: titleId });
      setCloudProfile({ ...cloudProfile, equippedTitle: titleId });
    }
  };

  const handleEquipBadge = (badgeId: string) => {
    setEquippedCosmetics((prev) => ({ ...prev, badge: badgeId }));
    localStorage.setItem('poly_equipped_badge', badgeId);
    if (cloudProfile && auth.currentUser) {
      saveUserCosmeticsAndCoins(auth.currentUser.uid, { equippedBadge: badgeId });
      setCloudProfile({ ...cloudProfile, equippedBadge: badgeId });
    }
  };

  const handleEquipEmote = (emoteId: string) => {
    setEquippedCosmetics((prev) => ({ ...prev, emote: emoteId }));
    localStorage.setItem('poly_equipped_emote', emoteId);
    if (cloudProfile && auth.currentUser) {
      saveUserCosmeticsAndCoins(auth.currentUser.uid, { equippedEmote: emoteId });
      setCloudProfile({ ...cloudProfile, equippedEmote: emoteId });
    }
  };

  const handleUnlockItem = (type: 'skin' | 'title' | 'badge' | 'emote', id: string, cost: number): boolean => {
    const curCoins = cloudProfile?.coins ?? (profile as any)?.coins ?? 500;
    if (curCoins < cost) return false;
    const newCoins = curCoins - cost;

    const propMap = {
      skin: 'unlockedSkins',
      title: 'unlockedTitles',
      badge: 'unlockedBadges',
      emote: 'unlockedEmotes',
    } as const;
    const key = propMap[type];
    const prevArr = (cloudProfile?.[key] as string[]) || (profile as any)?.[key] || [];
    const newArr = [...new Set([...prevArr, id])];

    const updatedProfile = {
      ...profile,
      coins: newCoins,
      [key]: newArr,
    };
    setProfile(updatedProfile);
    localStorage.setItem('poly_profile', JSON.stringify(updatedProfile));

    if (cloudProfile && auth.currentUser) {
      saveUserCosmeticsAndCoins(auth.currentUser.uid, {
        coins: newCoins,
        [key]: newArr,
      });
      setCloudProfile({
        ...cloudProfile,
        coins: newCoins,
        [key]: newArr,
      });
    }
    return true;
  };

  const handleAddCoins = (amount: number) => {
    const curCoins = cloudProfile?.coins ?? (profile as any)?.coins ?? 500;
    const newCoins = curCoins + amount;
    const updatedProfile = { ...profile, coins: newCoins };
    setProfile(updatedProfile);
    localStorage.setItem('poly_profile', JSON.stringify(updatedProfile));
    if (cloudProfile && auth.currentUser) {
      saveUserCosmeticsAndCoins(auth.currentUser.uid, { coins: newCoins });
      setCloudProfile({ ...cloudProfile, coins: newCoins });
    }
  };

  const processMatchRatingResult = (forcedPlacement?: number, forcedIsWin?: boolean) => {
    if (!roomId || roomId === lastProcessedMatch) return;
    setLastProcessedMatch(roomId);

    const currentGameState = useGameStore.getState().gameState;
    const isRankedMode = gameMode === 'ranked' || gameMode === 'ranked_duo' || gameMode === 'ranked_trio';
    const totalCombatants = Object.keys(currentGameState?.players || {}).length;
    const isSinglePlayerRoom = isRankedMode && (totalCombatants <= 1 || !!(currentGameState as any)?.noRatingChange);

    const isWin = isSinglePlayerRoom ? false : (forcedIsWin !== undefined ? forcedIsWin : (winner === myId || (myPlayerTeam && winner === myPlayerTeam)));
    const myScore = myPlayerScore || 0;

    const otherAliveCount = Object.values(currentGameState?.players || {}).filter(p => !p.isDead && p.id !== myId).length;
    const finalPlacement = forcedPlacement !== undefined ? forcedPlacement : (isWin ? 1 : Math.max(2, otherAliveCount + 1));

    let targetPts = 0;
    if (gameMode === 'ranked_duo') {
      targetPts = cloudProfile?.duoRankPoints ?? profile.duoRankPoints ?? 0;
    } else if (gameMode === 'ranked_trio') {
      targetPts = cloudProfile?.trioRankPoints ?? profile.trioRankPoints ?? 0;
    } else {
      targetPts = cloudProfile?.soloRankPoints ?? cloudProfile?.rankPoints ?? profile.soloRankPoints ?? profile.rankPoints ?? 0;
    }

    let newWins = cloudProfile?.totalWins ?? profile.wins ?? 0;
    let newStreak = profile.streak || 0;
    let ratingChange = 0;

    if (isSinglePlayerRoom) {
      // 部屋の人数が1人の場合はレート変動なし (0 RP)
      ratingChange = 0;
    } else if (isRankedMode) {
      newWins += (isWin ? 1 : 0);
      newStreak = isWin ? ((profile.streak || 0) + 1) : 0;
      const calcRes = calculateStrictRatingChange(
        gameMode || 'ranked',
        targetPts,
        finalPlacement,
        myScore,
        totalCombatants
      );
      ratingChange = calcRes.ratingChange;
    } else {
      newWins += (isWin ? 1 : 0);
      newStreak = isWin ? ((profile.streak || 0) + 1) : 0;
    }

    const newTargetPts = Math.max(0, targetPts + ratingChange);
    const earnedCoins = isSinglePlayerRoom ? 0 : (isWin ? 60 + myScore * 10 : Math.max(10, myScore * 10));

    const newProfile = {
      ...profile,
      wins: newWins,
      streak: newStreak,
      rankPoints: gameMode === 'ranked' ? newTargetPts : profile.rankPoints,
      soloRankPoints: gameMode === 'ranked' ? newTargetPts : (profile.soloRankPoints || 0),
      duoRankPoints: gameMode === 'ranked_duo' ? newTargetPts : (profile.duoRankPoints || 0),
      trioRankPoints: gameMode === 'ranked_trio' ? newTargetPts : (profile.trioRankPoints || 0),
    };

    setProfile(newProfile);
    localStorage.setItem('poly_profile', JSON.stringify(newProfile));

    // Optimistically update cloudProfile state so UI updates immediately!
    if (cloudProfile) {
      setCloudProfile({
        ...cloudProfile,
        rankPoints: gameMode === 'ranked' ? newTargetPts : (cloudProfile.rankPoints || 0),
        soloRankPoints: gameMode === 'ranked' ? newTargetPts : (cloudProfile.soloRankPoints || 0),
        duoRankPoints: gameMode === 'ranked_duo' ? newTargetPts : (cloudProfile.duoRankPoints || 0),
        trioRankPoints: gameMode === 'ranked_trio' ? newTargetPts : (cloudProfile.trioRankPoints || 0),
        totalWins: newWins,
        totalMatches: isSinglePlayerRoom ? (cloudProfile.totalMatches || 0) : ((cloudProfile.totalMatches || 0) + 1),
        coins: (cloudProfile.coins || 0) + earnedCoins,
      });
    }

    // Sync stats & earned coins to Firebase Firestore if logged in (only when not single-player abort)
    if (auth.currentUser && !isSinglePlayerRoom) {
      const deaths = isWin ? 0 : 1;
      updateUserStats(
        auth.currentUser.uid,
        isWin,
        myScore,
        deaths,
        charClass,
        ratingChange,
        newTargetPts,
        gameMode || 'casual',
        myScore,
        finalPlacement,
        earnedCoins
      ).then((freshProfile) => {
        if (freshProfile) {
          setCloudProfile(freshProfile);
        }
      }).catch((err) => console.error('Error syncing match to Firebase:', err));
    }
  };

  const handleReturnToLobby = () => {
    // If during ranked match or if dead, calculate rating before leaving
    const isRankedMode = gameMode === 'ranked' || gameMode === 'ranked_duo' || gameMode === 'ranked_trio';
    if (isRankedMode && roomId && roomId !== lastProcessedMatch) {
      const currentGameState = useGameStore.getState().gameState;
      const totalCombatants = Object.keys(currentGameState?.players || {}).length;
      const isSinglePlayer = totalCombatants <= 1 || !!(currentGameState as any)?.noRatingChange;
      if (isSinglePlayer) {
        processMatchRatingResult(1, false);
      } else {
        const otherAliveCount = Object.values(currentGameState?.players || {}).filter(p => !p.isDead && p.id !== myId).length;
        const finalPlacement = isEnded ? (winner === myId ? 1 : 2) : Math.max(2, otherAliveCount + 1);
        processMatchRatingResult(finalPlacement, isEnded ? (winner === myId) : false);
      }
    }
    leaveGame();
    setHasStarted(false);
  };

  const handlePlayAgain = () => {
    const isRankedMode = gameMode === 'ranked' || gameMode === 'ranked_duo' || gameMode === 'ranked_trio';
    if (isRankedMode && roomId && roomId !== lastProcessedMatch) {
      const currentGameState = useGameStore.getState().gameState;
      const totalCombatants = Object.keys(currentGameState?.players || {}).length;
      const isSinglePlayer = totalCombatants <= 1 || !!(currentGameState as any)?.noRatingChange;
      if (isSinglePlayer) {
        processMatchRatingResult(1, false);
      } else {
        const otherAliveCount = Object.values(currentGameState?.players || {}).filter(p => !p.isDead && p.id !== myId).length;
        const finalPlacement = isEnded ? (winner === myId ? 1 : 2) : Math.max(2, otherAliveCount + 1);
        processMatchRatingResult(finalPlacement, isEnded ? (winner === myId) : false);
      }
    }
    leaveGame();
    setTimeout(() => {
      const resolvedName = cloudProfile?.displayName || (profile as any)?.displayName || '';
      const duelRoom = mode === 'p2p_duel' ? (p2pSubTab === 'create' ? p2pGeneratedRoom : (p2pRoomInput.trim() || p2pGeneratedRoom)) : undefined;
      connect(mode, password, charClass, botCount, teamChoice, teamMatchType, resolvedName, duelRoom, equippedCosmetics);
      setHasStarted(true);
    }, 120);
  };

  // Process Match End logic - Strict Multi-Mode Rating calculation
  useEffect(() => {
    if (status === 'ended' && roomId && roomId !== lastProcessedMatch) {
      processMatchRatingResult();
    }
  }, [status, roomId, winner, gameMode, lastProcessedMatch]);

  // Determine active rating points based on selected menu mode
  const getDisplayPointsForMode = () => {
    if (mode === 'ranked_duo') return cloudProfile?.duoRankPoints ?? profile.duoRankPoints ?? 0;
    if (mode === 'ranked_trio') return cloudProfile?.trioRankPoints ?? profile.trioRankPoints ?? 0;
    return cloudProfile?.soloRankPoints ?? cloudProfile?.rankPoints ?? profile.soloRankPoints ?? profile.rankPoints ?? 0;
  };

  const activePoints = getDisplayPointsForMode();
  const currentTier = getRankTier(activePoints, null);
  const tierConfig = RANK_CONFIGS[currentTier];
  const currentSeason = getCurrentMonthlySeason();

  const handleJoin = (targetP2pRoom?: string | React.MouseEvent) => {
    const resolvedName = cloudProfile?.displayName || (profile as any)?.displayName || '';
    const specifiedP2p = typeof targetP2pRoom === 'string' ? targetP2pRoom : undefined;
    const duelRoom = specifiedP2p || (mode === 'p2p_duel' ? (p2pSubTab === 'create' ? p2pGeneratedRoom : (p2pRoomInput.trim() || p2pGeneratedRoom)) : undefined);
    connect(mode, password, charClass, botCount, teamChoice, teamMatchType, resolvedName, duelRoom, equippedCosmetics);
    setHasStarted(true);
  };

  if (!hasStarted) {
    return (
      <div className="allow-scroll flex flex-col items-center justify-start sm:justify-center w-full h-full min-h-screen overflow-y-auto bg-slate-900 text-white font-sans select-none px-4 py-8 text-center pb-24 absolute inset-0">
        <h1 className="text-4xl sm:text-6xl font-black mb-0.5 sm:mb-1 text-blue-400 drop-shadow-lg tracking-wider">
          POLY LOYALE
        </h1>
        <div className="text-[11px] sm:text-xs font-bold text-blue-300/70 mb-2 sm:mb-3 tracking-wide">
          Poly Royale 3D Battle Arena • 競技シーズン & コレクション
        </div>
        
        {/* Lobby Rank, Season & Feature Header */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-4 sm:mb-5">
          {/* Lobby Rank Aura Pill */}
          <div
            className="text-sm sm:text-base font-black px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border flex items-center justify-center gap-2 shadow-lg backdrop-blur-md transition-all animate-rank-pulse"
            style={{
              backgroundColor: `${tierConfig.primaryColor}18`,
              borderColor: `${tierConfig.primaryColor}88`,
              color: tierConfig.primaryColor,
              boxShadow: `0 0 20px ${tierConfig.primaryColor}44`,
            }}
          >
            <span className="text-base">{tierConfig.badgeEmoji}</span>
            <span>
              Rank: <strong>{tierConfig.tier}</strong> ({tierConfig.labelJa})
            </span>
            <span className="opacity-40">•</span>
            <span className="text-slate-300 font-bold">RP: {activePoints}</span>
          </div>

          {/* Monthly Season Status Button */}
          <button
            onClick={() => setIsSeasonModalOpen(true)}
            className="bg-indigo-900/80 border border-indigo-400/50 hover:bg-indigo-800/90 text-indigo-200 text-xs sm:text-sm font-extrabold px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md hover:scale-105 transition-all cursor-pointer"
            title="月間シーズン情報・レートリセット日程"
          >
            <Calendar size={15} className="text-indigo-400" />
            <span>📅 {currentSeason.seasonName}</span>
          </button>

          {/* Collection Binder & Locker Button */}
          <button
            onClick={() => setIsCollectionOpen(true)}
            className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-black px-4 sm:px-5 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 shadow-[0_0_20px_rgba(217,70,239,0.35)] hover:scale-105 transition-all cursor-pointer border border-pink-300/40"
            title="スキン・称号・バッジ・エモートのコレクション binder"
          >
            <Palette size={15} className="text-pink-300" />
            <span>🎨 コレクション・ガチャ</span>
          </button>

          {/* Online Players Indicator */}
          <div className="bg-slate-800/90 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-black px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <Users size={14} className="text-emerald-400" />
            <span>オンライン中: <strong className="text-white font-mono text-xs sm:text-sm font-black">{lobbyOnlineCount}</strong> 人</span>
          </div>

          {/* Lag Diagnostic Button */}
          <button
            onClick={() => setIsLagModalOpen(true)}
            className="bg-slate-800/90 border border-amber-500/40 hover:bg-slate-700/90 text-amber-300 text-xs sm:text-sm font-extrabold px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md hover:scale-105 transition-all cursor-pointer"
            title="通信応答速度・ラグを測定"
          >
            <Activity size={15} className="text-amber-400" />
            <span>📡 ラグ測定</span>
          </button>

          {/* Reviews Button */}
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="bg-slate-800/90 border border-yellow-500/50 hover:bg-slate-700/90 text-yellow-300 text-xs sm:text-sm font-extrabold px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md hover:scale-105 transition-all cursor-pointer"
            title="みんなの評価・レビュー・ご意見投稿"
          >
            <Sparkles size={15} className="text-yellow-400 fill-yellow-400" />
            <span>⭐ 評価・レビュー</span>
          </button>

          {/* Friends Button */}
          <button
            onClick={() => setIsFriendsOpen(true)}
            className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 text-xs sm:text-sm font-extrabold px-4 sm:px-5 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-105 transition-all cursor-pointer"
          >
            <Zap size={15} className="text-slate-950 fill-slate-950" />
            <span>フレンド & P2P 1v1</span>
          </button>
        </div>

        <FirebaseAccount onUserLoaded={setCloudProfile} />
        
        {/* Mode Selector Buttons */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-2 max-w-4xl">
          {/* Ranked Solo */}
          <button 
            onClick={() => setMode('ranked')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-black text-sm sm:text-base transition-all shadow-lg flex items-center gap-1.5 ${
              mode === 'ranked' ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white ring-2 ring-orange-300 scale-105 shadow-orange-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🏆</span> ランク Solo (1人)
          </button>

          {/* Ranked Duo */}
          <button 
            onClick={() => setMode('ranked_duo')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-black text-sm sm:text-base transition-all shadow-lg flex items-center gap-1.5 ${
              mode === 'ranked_duo' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white ring-2 ring-sky-300 scale-105 shadow-sky-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>👥</span> ランク Duo (2人ペア)
          </button>

          {/* Ranked Trio */}
          <button 
            onClick={() => setMode('ranked_trio')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-black text-sm sm:text-base transition-all shadow-lg flex items-center gap-1.5 ${
              mode === 'ranked_trio' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white ring-2 ring-emerald-300 scale-105 shadow-emerald-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🔱</span> ランク Trio (3人トリオ)
          </button>

          <button 
            onClick={() => setMode('p2p_duel')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-black text-sm sm:text-base transition-all shadow-lg flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
              mode === 'p2p_duel' 
                ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 ring-2 ring-amber-300 scale-105 shadow-amber-500/30' 
                : 'bg-slate-800 text-amber-300 border border-amber-500/40 hover:bg-slate-700'
            }`}
          >
            <Zap size={18} className="fill-current text-slate-950" />
            <span>⚡ P2P 1v1</span>
          </button>
          
          <button 
            onClick={() => setMode('bot')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all ${
              mode === 'bot' 
                ? 'bg-purple-600 text-white ring-2 ring-purple-300 scale-105' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>🤖</span> Bot戦 (AI)
          </button>
          
          <button 
            onClick={() => setMode('casual')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-colors ${
              mode === 'casual' ? 'bg-blue-600 text-white ring-2 ring-blue-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Casual
          </button>
          
          <button 
            onClick={() => setMode('team')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-colors ${
              mode === 'team' ? 'bg-teal-600 text-white ring-2 ring-teal-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Team
          </button>
          
          <button 
            onClick={() => setMode('password')} 
            className={`px-3.5 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-colors ${
              mode === 'password' ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Password
          </button>
        </div>

        {/* Mode subtitle explanation */}
        <div className="text-[11px] sm:text-xs text-slate-300 font-medium mb-3 sm:mb-4 min-h-4 flex items-center justify-center">
          {mode === 'ranked' && '🏆 【ソロランク】1人実力勝負！厳しいレート査定と月間シーズン制'}
          {mode === 'ranked_duo' && '👥 【ペアランク】2人1組スクワッド戦（1人参加時は自動ペア結成）！専用レート独立'}
          {mode === 'ranked_trio' && '🔱 【トリオランク】3人1組スクワッド戦（1人参加時は自動トリオ結成）！専用レート独立'}
          {mode === 'p2p_duel' && '⚡ 超低遅延 WebRTCダイレクト通信！タイマン1v1デュエル'}
          {mode === 'bot' && `🤖 待ち時間なし！${botCount}体の自律型AI Botとバトルロイヤル`}
          {mode === 'casual' && '⚔️ オンラインの他プレイヤーと通常マッチング（レート変動なし）'}
          {mode === 'team' && '🛡️ 赤チーム vs 青チームの陣営対抗戦（1ライフ制）'}
          {mode === 'password' && '🔒 合言葉を設定してフレンド同士でプライベート対戦'}
        </div>

        {/* Direct P2P Room Link Detected Toast Banner */}
        {urlP2pRoom && (
          <div className="mb-4 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-2 border-amber-400/80 rounded-2xl p-4 w-full max-w-md flex flex-col items-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.3)] animate-pulse">
            <div className="text-amber-300 text-sm font-black flex items-center gap-1.5">
              <Zap size={18} className="text-yellow-400 fill-yellow-400" />
              <span>P2P 1v1 招待リンクを検出しました！</span>
            </div>
            <div className="text-xs text-slate-300">
              対象ルーム: <strong className="text-yellow-300 font-mono text-base">{urlP2pRoom}</strong>
            </div>
            <button
              type="button"
              onClick={() => handleJoin(urlP2pRoom)}
              className="mt-1 px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>⚔️ この部屋に今すぐ参戦！</span>
            </button>
          </div>
        )}

        {mode === 'p2p_duel' && (
          <div className="mb-4 bg-slate-800/95 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 w-full max-w-lg flex flex-col items-center gap-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between w-full border-b border-amber-500/20 pb-3 flex-wrap gap-2">
              <div className="text-left">
                <div className="text-base font-black text-white flex items-center gap-2">
                  <Zap size={20} className="text-amber-400 fill-amber-400" />
                  <span>P2P 1v1 タイマン対戦</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    WebRTC Direct
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  プレイヤー同士を直接繋ぐ超低遅延通信（相手と2人きりでバトル）
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFriendsOpen(true)}
                className="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Users size={14} />
                <span>フレンド招待</span>
              </button>
            </div>

            {/* Sub-tabs: Host create or Guest join */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={() => setP2pSubTab('create')}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  p2pSubTab === 'create'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 ring-2 ring-amber-300 shadow-md scale-102'
                    : 'bg-slate-900/80 text-slate-300 hover:bg-slate-700/80'
                }`}
              >
                <span>👑 部屋を作る (ホスト)</span>
              </button>
              <button
                type="button"
                onClick={() => setP2pSubTab('join')}
                className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  p2pSubTab === 'join'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 ring-2 ring-amber-300 shadow-md scale-102'
                    : 'bg-slate-900/80 text-slate-300 hover:bg-slate-700/80'
                }`}
              >
                <span>🚪 コードで参加 (ゲスト)</span>
              </button>
            </div>

            {p2pSubTab === 'create' ? (
              <div className="w-full space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/20 text-left">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-slate-300">発行されたルームコード:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setP2pGeneratedRoom('P2P-' + Math.random().toString(36).substring(2, 6).toUpperCase());
                    }}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer"
                  >
                    🔄 新しいコードを再生成
                  </button>
                </div>
                
                <div className="flex items-center justify-between bg-slate-900 border-2 border-amber-400/60 rounded-xl px-4 py-2.5 flex-wrap gap-2">
                  <span className="text-2xl font-black font-mono tracking-widest text-amber-300 select-all">
                    {p2pGeneratedRoom}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(p2pGeneratedRoom);
                        setCopiedP2pCode(true);
                        setTimeout(() => setCopiedP2pCode(false), 2000);
                      }}
                      className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/40 cursor-pointer flex items-center gap-1"
                    >
                      {copiedP2pCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copiedP2pCode ? 'コピー済' : 'コードコピー'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}${window.location.pathname}?p2p=${encodeURIComponent(p2pGeneratedRoom)}`;
                        navigator.clipboard.writeText(url);
                        setCopiedP2pUrl(true);
                        setTimeout(() => setCopiedP2pUrl(false), 2000);
                      }}
                      className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-lg text-xs font-bold border border-indigo-400/40 cursor-pointer flex items-center gap-1"
                    >
                      {copiedP2pUrl ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
                      <span>{copiedP2pUrl ? 'URLコピー済' : '招待URL'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 flex-wrap gap-1">
                  <span>友達にコードや招待リンクを伝えて、参加してもらいましょう！</span>
                  <a
                    href={`https://everychat-Waseda.web.app/?text=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?p2p=${p2pGeneratedRoom}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-300 hover:text-indigo-200 font-bold underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>💬 everychatで募集</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-amber-500/20 text-left">
                <label className="block text-xs font-bold text-slate-300">
                  対戦相手から教えてもらった「ルームコード」またはURLを入力:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={p2pRoomInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.includes('p2p=')) {
                        try {
                          const u = new URL(val);
                          const p = u.searchParams.get('p2p');
                          if (p) {
                            setP2pRoomInput(p.toUpperCase());
                            return;
                          }
                        } catch {}
                      }
                      setP2pRoomInput(val.toUpperCase());
                    }}
                    placeholder="例: P2P-AB12"
                    className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-yellow-300 tracking-wider focus:outline-none focus:ring-1 focus:ring-amber-400 text-center uppercase"
                  />
                  {p2pRoomInput && (
                    <button
                      type="button"
                      onClick={() => setP2pRoomInput('')}
                      className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs cursor-pointer"
                    >
                      クリア
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  招待URL全体を貼り付けても自動でコードを抽出します。
                </p>
              </div>
            )}
          </div>
        )}

        {mode === 'bot' && (
          <div className="mb-4 bg-slate-800/90 border border-purple-500/40 rounded-2xl p-3 sm:p-4 w-full max-w-md flex flex-col items-center gap-2.5 shadow-xl">
            <div className="flex items-center justify-between w-full text-xs sm:text-sm font-bold">
              <span className="text-purple-300">👥 BOT 対戦人数:</span>
              <span className="text-base sm:text-lg font-black text-amber-300 bg-purple-950/80 px-3 py-0.5 rounded-lg border border-purple-400/40">
                {botCount} 体 (計 {botCount + 1}人)
              </span>
            </div>
            
            <input
              type="range"
              min="1"
              max="99"
              value={botCount}
              onChange={(e) => setBotCount(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
            />

            <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between">
              {[15, 30, 60, 99].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setBotCount(count)}
                  className={`flex-1 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-all ${
                    botCount === count
                      ? 'bg-purple-600 text-white shadow-md ring-1 ring-purple-300'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {count === 99 ? '🔥 99体(100人)' : `${count}体`}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'team' && (
          <div className="mb-4 bg-slate-800/90 border border-teal-500/40 rounded-2xl p-3 sm:p-4 w-full max-w-md flex flex-col items-center gap-3 shadow-xl">
            {/* Match Type: Online PvP or Bot Solo */}
            <div className="w-full text-left">
              <div className="text-xs sm:text-sm font-bold text-teal-300 mb-1.5 flex items-center justify-between">
                <span>⚔️ 対戦モード:</span>
                <span className="text-[10px] text-slate-400 font-normal">対人マッチまたはAI練習</span>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setTeamMatchType('pvp')}
                  className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${
                    teamMatchType === 'pvp'
                      ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white ring-2 ring-emerald-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>👥</span> オンラインPvP対戦
                </button>
                <button
                  type="button"
                  onClick={() => setTeamMatchType('bot')}
                  className={`py-2 px-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 ${
                    teamMatchType === 'bot'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white ring-2 ring-purple-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>🤖</span> Bot練習戦 (Solo)
                </button>
              </div>
            </div>

            <div className="w-full text-left pt-2 border-t border-white/10">
              <div className="text-xs sm:text-sm font-bold text-teal-300 mb-1.5 flex items-center justify-between">
                <span>🛡️ 所属チーム選択:</span>
                <span className="text-[10px] text-slate-400 font-normal">自動またはお好みの陣営を選択</span>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setTeamChoice('auto')}
                  className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    teamChoice === 'auto'
                      ? 'bg-teal-600 text-white ring-2 ring-teal-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  🎲 自動均等
                </button>
                <button
                  type="button"
                  onClick={() => setTeamChoice('red')}
                  className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    teamChoice === 'red'
                      ? 'bg-red-600 text-white ring-2 ring-red-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-red-300 hover:bg-slate-700'
                  }`}
                >
                  🔴 赤チーム
                </button>
                <button
                  type="button"
                  onClick={() => setTeamChoice('blue')}
                  className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-black transition-all ${
                    teamChoice === 'blue'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300 shadow-md scale-102'
                      : 'bg-slate-700/80 text-blue-300 hover:bg-slate-700'
                  }`}
                >
                  🔵 青チーム
                </button>
              </div>
            </div>

            <div className="w-full pt-2 border-t border-white/10">
              <div className="flex items-center justify-between w-full text-xs sm:text-sm font-bold mb-1.5">
                <span className="text-teal-300">
                  {teamMatchType === 'pvp' ? '👥 チーム補充Bot数:' : '👥 参戦Bot数 (練習):'}
                </span>
                <span className="text-sm sm:text-base font-black text-amber-300 bg-teal-950/80 px-2.5 py-0.5 rounded-lg border border-teal-400/40">
                  {botCount} 体 ({Math.ceil((botCount + 1) / 2)} vs {Math.floor((botCount + 1) / 2)})
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between">
                {[10, 20, 40, 60].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setBotCount(count)}
                    className={`flex-1 py-1 rounded-lg text-[10px] sm:text-xs font-black transition-all ${
                      botCount === count
                        ? 'bg-teal-600 text-white shadow-md ring-1 ring-teal-300'
                        : 'bg-slate-700/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {count}体
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {mode === 'password' && (
          <input 
            type="text" 
            placeholder="Enter Room Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-black font-bold text-base sm:text-lg text-center w-60 sm:w-64 focus:outline-none focus:ring-4 focus:ring-purple-500"
          />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 justify-center gap-2 sm:gap-3 mb-4 sm:mb-8 w-full max-w-5xl">
          <button onClick={() => setCharClass('melee')} className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl font-bold transition-all text-left ${charClass === 'melee' ? 'bg-blue-600 text-white border-2 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-sm sm:text-base font-black mb-0.5">近接兵 (Assault)</div>
            <div className="text-[10px] sm:text-xs opacity-80">Balanced (100 HP)</div>
            <div className="text-[9px] text-blue-200 mt-0.5 sm:mt-1 font-semibold">💣 爆弾投擲</div>
          </button>
          <button onClick={() => setCharClass('sword')} className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl font-bold transition-all text-left ${charClass === 'sword' ? 'bg-red-600 text-white border-2 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.6)]' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-sm sm:text-base font-black mb-0.5">剣豪 (Blade)</div>
            <div className="text-[10px] sm:text-xs opacity-80">Melee (90 HP)</div>
            <div className="text-[9px] text-red-200 mt-0.5 sm:mt-1 font-semibold">⚔️ 無敵ダッシュ</div>
          </button>
          <button onClick={() => setCharClass('tank')} className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl font-bold transition-all text-left ${charClass === 'tank' ? 'bg-yellow-600 text-white border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.6)]' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-sm sm:text-base font-black mb-0.5">重装兵 (Tank)</div>
            <div className="text-[10px] sm:text-xs opacity-80">Heavy (150 HP)</div>
            <div className="text-[9px] text-yellow-200 mt-0.5 sm:mt-1 font-semibold">🛡️ 防御シールド</div>
          </button>
          <button onClick={() => setCharClass('scout')} className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl font-bold transition-all text-left ${charClass === 'scout' ? 'bg-green-600 text-white border-2 border-green-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-sm sm:text-base font-black mb-0.5">奇襲兵 (Scout)</div>
            <div className="text-[10px] sm:text-xs opacity-80">Fast (35 HP)</div>
            <div className="text-[9px] text-green-200 mt-0.5 sm:mt-1 font-semibold">🚀 ジェット飛行</div>
          </button>
          <button onClick={() => setCharClass('wizard')} className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl font-bold transition-all text-left ${charClass === 'wizard' ? 'bg-purple-600 text-white border-2 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-sm sm:text-base font-black mb-0.5">魔導士 (Wizard)</div>
            <div className="text-[10px] sm:text-xs opacity-80">Magic (80 HP)</div>
            <div className="text-[9px] text-purple-200 mt-0.5 sm:mt-1 font-semibold">⚡ 雷神ストーム</div>
          </button>
          <button onClick={() => setCharClass('sniper')} className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl font-bold transition-all text-left ${charClass === 'sniper' ? 'bg-sky-600 text-white border-2 border-sky-400 shadow-[0_0_12px_rgba(2,132,199,0.6)]' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-sm sm:text-base font-black mb-0.5">狙撃手 (Sniper)</div>
            <div className="text-[10px] sm:text-xs opacity-80">Snipe (60 HP)</div>
            <div className="text-[9px] text-sky-200 mt-0.5 sm:mt-1 font-semibold">👁️‍🗨️ 完全ステルス</div>
          </button>
          <button onClick={() => setCharClass('lance')} className={`px-2.5 sm:px-3 py-2 sm:py-3 rounded-xl font-bold transition-all text-left ${charClass === 'lance' ? 'bg-amber-600 text-white border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'bg-slate-800 text-slate-400 border-2 border-transparent hover:bg-slate-700'}`}>
            <div className="text-sm sm:text-base font-black mb-0.5">槍騎兵 (Lancer)</div>
            <div className="text-[10px] sm:text-xs opacity-80">Spear (100 HP)</div>
            <div className="text-[9px] text-amber-200 mt-0.5 sm:mt-1 font-semibold">🔱 超高速突進</div>
          </button>
        </div>

        <button 
          onClick={handleJoin}
          className="w-full max-w-xs sm:w-auto px-8 sm:px-12 py-3 sm:py-4 bg-yellow-400 text-black font-black text-2xl sm:text-3xl rounded-xl hover:bg-yellow-300 active:scale-95 transition-all shadow-xl mb-4"
        >
          JOIN GAME
        </button>

        {/* P2P System Notice Toast */}
        {p2pNotice && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900/95 border-2 border-amber-500 text-amber-300 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] text-sm font-bold flex items-center space-x-3 backdrop-blur-md animate-bounce">
            <span>{p2pNotice}</span>
            <button
              onClick={clearP2PNotice}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Friends & Social Management Modal */}
        <FriendsModal
          isOpen={isFriendsOpen}
          onClose={() => setIsFriendsOpen(false)}
          currentUserProfile={cloudProfile}
        />

        {/* Real-time P2P 1v1 Invitation Popup */}
        <P2PInviteModal
          invite={incomingP2PInvite}
          selectedClass={charClass}
        />

        {/* Lag & Network Diagnostic Modal */}
        <LagMonitorModal
          isOpen={isLagModalOpen}
          onClose={() => setIsLagModalOpen(false)}
        />

        {/* Reviews & Feedback Modal */}
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          defaultAuthorName={cloudProfile?.displayName}
        />

        {/* Collection & Locker Showcase Modal */}
        <CollectionModal
          isOpen={isCollectionOpen}
          onClose={() => setIsCollectionOpen(false)}
          coins={userCoins}
          unlockedSkins={userUnlockedSkins}
          unlockedTitles={userUnlockedTitles}
          unlockedBadges={userUnlockedBadges}
          unlockedEmotes={userUnlockedEmotes}
          equippedSkin={equippedCosmetics.skin}
          equippedTitle={equippedCosmetics.title}
          equippedBadge={equippedCosmetics.badge}
          equippedEmote={equippedCosmetics.emote}
          onEquipSkin={handleEquipSkin}
          onEquipTitle={handleEquipTitle}
          onEquipBadge={handleEquipBadge}
          onEquipEmote={handleEquipEmote}
          onUnlockItem={handleUnlockItem}
          onAddCoins={handleAddCoins}
        />

        {/* Monthly Season Info Modal */}
        <SeasonModal
          isOpen={isSeasonModalOpen}
          onClose={() => setIsSeasonModalOpen(false)}
          soloPoints={cloudProfile?.soloRankPoints ?? cloudProfile?.rankPoints ?? profile.soloRankPoints ?? profile.rankPoints ?? 0}
          duoPoints={cloudProfile?.duoRankPoints ?? profile.duoRankPoints ?? 0}
          trioPoints={cloudProfile?.trioRankPoints ?? profile.trioRankPoints ?? 0}
          seasonHistory={cloudProfile?.seasonHistory || []}
        />
      </div>
    );
  }

  if (!myId || !hasGameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans touch-none select-none p-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-2xl sm:text-3xl font-bold animate-pulse text-blue-400 mb-2">Connecting to Server...</h1>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">マッチサーバーに接続しています</p>
        <button
          type="button"
          onClick={handleReturnToLobby}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold border border-white/10 transition-all cursor-pointer"
        >
          キャンセルしてロビーへ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 touch-none select-none">
      <Canvas 
        shadows
        dpr={[1, 2]} 
        camera={{ fov: 75 }} 
        gl={{ powerPreference: 'high-performance', antialias: true, depth: true, stencil: false }}
      >
        {/* Realistic Sky & Atmospheric Exponential Distance Fog */}
        <Sky sunPosition={[120, 30, 80]} distance={450000} inclination={0.5} azimuth={0.25} />
        <fogExp2 attach="fog" args={['#0f172a', 0.007]} />

        {/* 3-Point Tactical Studio Lighting */}
        <ambientLight intensity={0.45} />
        <directionalLight 
          position={[60, 90, 40]} 
          intensity={1.8} 
          castShadow 
          shadow-mapSize-width={2048} 
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={220}
          shadow-camera-left={-70}
          shadow-camera-right={70}
          shadow-camera-top={70}
          shadow-camera-bottom={-70}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-40, 50, -40]} intensity={0.8} color="#38bdf8" />
        <hemisphereLight args={['#38bdf8', '#0f172a', 0.65]} />

        <Map />
        <BattleBus />
        <Players />
        <LocalPlayer />
        <AttackEffects />
      </Canvas>

      <DamagePopupsOverlay />
      <MobileControls onReturnToLobby={handleReturnToLobby} />

      {/* P2P Status Badge in HUD */}
      <div className="absolute top-4 left-4 z-40 pointer-events-auto">
        <P2PStatusBadge onOpenLagModal={() => setIsLagModalOpen(true)} />
      </div>

      {/* P2P Realtime System Notice Toast */}
      {p2pNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-slate-900/95 border-2 border-amber-500 text-amber-300 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.4)] text-sm font-bold flex items-center space-x-3 backdrop-blur-md animate-bounce">
          <span>{p2pNotice}</span>
          <button
            onClick={clearP2PNotice}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Matchmaking Lobby UI - Prominent Countdown & Readiness Banner */}
      <MatchLobbyBanner />

      {/* End Match UI */}
      <EndMatchModal onPlayAgain={handlePlayAgain} onReturnToLobby={handleReturnToLobby} />

      {/* Elimination Modal & Spectate HUD (when eliminated during playing) */}
      {!isEnded && myPlayerIsDead && (
        <>
          <EliminatedModal onReturnToLobby={handleReturnToLobby} onPlayAgain={handlePlayAgain} />
          <SpectateHUD onReturnToLobby={handleReturnToLobby} />
        </>
      )}

      {/* Friends & Social Management Modal */}
      <FriendsModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        currentUserProfile={cloudProfile}
      />

      {/* Real-time P2P 1v1 Invitation Popup */}
      <P2PInviteModal
        invite={incomingP2PInvite}
        selectedClass={charClass}
      />

      {/* Lag & Network Diagnostic Modal */}
      <LagMonitorModal
        isOpen={isLagModalOpen}
        onClose={() => setIsLagModalOpen(false)}
      />

      {/* Reviews & Feedback Modal */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        defaultAuthorName={cloudProfile?.displayName}
      />

      {/* Collection & Locker Showcase Modal */}
      <CollectionModal
        isOpen={isCollectionOpen}
        onClose={() => setIsCollectionOpen(false)}
        coins={userCoins}
        unlockedSkins={userUnlockedSkins}
        unlockedTitles={userUnlockedTitles}
        unlockedBadges={userUnlockedBadges}
        unlockedEmotes={userUnlockedEmotes}
        equippedSkin={equippedCosmetics.skin}
        equippedTitle={equippedCosmetics.title}
        equippedBadge={equippedCosmetics.badge}
        equippedEmote={equippedCosmetics.emote}
        onEquipSkin={handleEquipSkin}
        onEquipTitle={handleEquipTitle}
        onEquipBadge={handleEquipBadge}
        onEquipEmote={handleEquipEmote}
        onUnlockItem={handleUnlockItem}
        onAddCoins={handleAddCoins}
      />

      {/* Monthly Season Info Modal */}
      <SeasonModal
        isOpen={isSeasonModalOpen}
        onClose={() => setIsSeasonModalOpen(false)}
        soloPoints={cloudProfile?.soloRankPoints ?? cloudProfile?.rankPoints ?? profile.soloRankPoints ?? profile.rankPoints ?? 0}
        duoPoints={cloudProfile?.duoRankPoints ?? profile.duoRankPoints ?? 0}
        trioPoints={cloudProfile?.trioRankPoints ?? profile.trioRankPoints ?? 0}
        seasonHistory={cloudProfile?.seasonHistory || []}
      />
    </div>
  );
}
