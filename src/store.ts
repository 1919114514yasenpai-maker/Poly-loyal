import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, PlayerState, ClientInput, CharacterClass, AttackEvent, DamagePopupEvent } from './types.js';
import { playHitSound, playShootSound, playEliminationSound } from './utils/audio';

import { p2pManager, P2PState, P2PSignal } from './utils/p2pConnection';
import { getServerUrl, failoverToNextBackend } from './utils/apiConfig';

export interface DamageIndicator {
  id: string;
  angle: number;
  timestamp: number;
}

export interface P2PInviteNotification {
  inviterUid: string;
  inviterName: string;
  p2pRoomId: string;
  inviterSocketId?: string;
}

type AttackListener = (event: AttackEvent) => void;
type DamageListener = (event: DamagePopupEvent) => void;

const attackListeners = new Set<AttackListener>();
const damageListeners = new Set<DamageListener>();

export const onAttackEvent = (cb: AttackListener) => {
  attackListeners.add(cb);
  return () => { attackListeners.delete(cb); };
};

export const triggerAttackEvent = (event: AttackEvent) => {
  attackListeners.forEach(cb => cb(event));
};

export const onDamageDealt = (cb: DamageListener) => {
  damageListeners.add(cb);
  return () => { damageListeners.delete(cb); };
};

export const triggerDamagePopup = (event: DamagePopupEvent) => {
  damageListeners.forEach(cb => cb(event));
};

export interface LiveInput {
  x: number;
  y: number;
  z: number;
  ry: number;
  pitch: number;
  aimTarget?: { x: number; y: number; z: number };
  moveX: number;
  moveY: number;
  isShooting: boolean;
  isHealing: boolean;
  useAbility: boolean;
  useAbility2?: boolean;
  useSubWeapon?: boolean;
  isRolling: boolean;
  isClimbing?: boolean;
  isZoomed: boolean;
  jumpFromBus?: boolean;
  toggleGlider?: boolean;
  isTargetLocked?: boolean;
}

export const liveInput: LiveInput = {
  x: 0,
  y: 1,
  z: 0,
  ry: 0,
  pitch: 0.0,
  aimTarget: { x: 0, y: 1.4, z: -50 },
  moveX: 0,
  moveY: 0,
  isShooting: false,
  isHealing: false,
  useAbility: false,
  useAbility2: false,
  useSubWeapon: false,
  isRolling: false,
  isClimbing: false,
  isZoomed: false,
  jumpFromBus: false,
  toggleGlider: false,
  isTargetLocked: false,
};

export const attackStatus = {
  isTargetLocked: false,
};

let lastSentInput: {
  x: number;
  y: number;
  z: number;
  ry: number;
  pitch: number;
} | null = null;
let lastSentTime = 0;

interface StoreState {
  socket: Socket | null;
  gameState: GameState | null;
  myId: string | null;
  input: ClientInput;
  showHitMarker: boolean;
  showDamageFlash: boolean;
  damageIndicators: DamageIndicator[];
  spectateTargetId: string | null;
  localLastRollTime: number;
  localLastAbilityTime: number;
  localLastAbility2Time: number;
  localLastHealTime: number;

  // P2P & Social fields
  hasStarted: boolean;
  setHasStarted: (val: boolean) => void;
  handlePeerDirectInput: (peerId: string, peerInput: any) => void;
  p2pState: P2PState;
  p2pPing: number;
  incomingP2PInvite: P2PInviteNotification | null;
  p2pNotice: string | null;

  // Network & Lag Measurement fields
  latencyMs: number;
  jitterMs: number;
  fps: number;
  pingHistory: number[];
  isMeasuringLag: boolean;

  // First-Person Mode state
  isFirstPerson: boolean;
  toggleFirstPerson: () => void;
  setFirstPerson: (val: boolean) => void;

  measurePing: () => Promise<number>;
  runFullLagDiagnostic: () => Promise<{ avgPing: number; minPing: number; maxPing: number; jitter: number }>;
  setFps: (fps: number) => void;

  connect: (
    mode: 'casual' | 'ranked' | 'ranked_duo' | 'ranked_trio' | 'password' | 'team' | 'bot' | 'p2p_duel',
    password?: string,
    characterClass?: CharacterClass,
    botCount?: number,
    team?: 'red' | 'blue' | 'auto',
    teamMatchType?: 'pvp' | 'bot',
    playerName?: string,
    p2pRoomId?: string,
    equippedCosmetics?: { skin?: string; title?: string; badge?: string; emote?: string }
  ) => void;
  setInput: (input: Partial<ClientInput>) => void;
  sendInput: () => void;
  respawn: () => void;
  leaveGame: () => void;
  endSinglePlayerMatch: () => void;
  setSpectateTargetId: (id: string | null) => void;
  cycleSpectate: (direction: 1 | -1) => void;

  // P2P Action handlers
  registerP2PUser: (userId: string) => void;
  sendP2PInvite: (targetUid: string, inviterName: string, inviterUid: string) => string;
  acceptP2PInvite: (invite: P2PInviteNotification, characterClass?: CharacterClass) => void;
  declineP2PInvite: (invite: P2PInviteNotification, declinerName: string) => void;
  clearP2PNotice: () => void;
}

function calculateJitter(history: number[]): number {
  if (history.length < 2) return 0;
  let diffSum = 0;
  for (let i = 1; i < history.length; i++) {
    diffSum += Math.abs(history[i] - history[i - 1]);
  }
  return Math.round(diffSum / (history.length - 1));
}

let abilityBurstPackets = 0;
let ability2BurstPackets = 0;

export const useGameStore = create<StoreState>((set, get) => ({
  socket: null,
  gameState: null,
  myId: null,
  hasStarted: false,
  setHasStarted: (hasStarted: boolean) => set({ hasStarted }),
  showHitMarker: false,
  showDamageFlash: false,
  damageIndicators: [],
  spectateTargetId: null,
  localLastRollTime: 0,
  localLastAbilityTime: 0,
  localLastAbility2Time: 0,
  localLastHealTime: 0,
  p2pState: 'idle',
  p2pPing: 0,
  incomingP2PInvite: null,
  p2pNotice: null,

  handlePeerDirectInput: (peerId: string, peerInput: any) => {
    set((prev) => {
      if (!prev.gameState || !prev.gameState.players[peerId]) return {};
      const curr = prev.gameState.players[peerId];
      return {
        gameState: {
          ...prev.gameState,
          players: {
            ...prev.gameState.players,
            [peerId]: {
              ...curr,
              x: typeof peerInput.x === 'number' ? peerInput.x : curr.x,
              y: typeof peerInput.y === 'number' ? peerInput.y : curr.y,
              z: typeof peerInput.z === 'number' ? peerInput.z : curr.z,
              ry: typeof peerInput.ry === 'number' ? peerInput.ry : curr.ry,
              isRolling: peerInput.isRolling !== undefined ? peerInput.isRolling : curr.isRolling,
              isShooting: peerInput.isShooting !== undefined ? peerInput.isShooting : (curr as any).isShooting,
            }
          }
        }
      };
    });
  },

  latencyMs: 0,
  jitterMs: 0,
  fps: 60,
  pingHistory: [],
  isMeasuringLag: false,

  isFirstPerson: localStorage.getItem('poly_first_person') === 'true',
  toggleFirstPerson: () => set((state) => {
    const next = !state.isFirstPerson;
    localStorage.setItem('poly_first_person', next ? 'true' : 'false');
    return { isFirstPerson: next };
  }),
  setFirstPerson: (val: boolean) => {
    localStorage.setItem('poly_first_person', val ? 'true' : 'false');
    set({ isFirstPerson: val });
  },

  setFps: (fps: number) => set({ fps }),

  measurePing: async () => {
    const { p2pState, p2pPing, pingHistory } = get();
    if (p2pState === 'connected' && p2pPing > 0) {
      const newHistory = [...pingHistory.slice(-29), p2pPing];
      const jitter = calculateJitter(newHistory);
      set({ latencyMs: p2pPing, pingHistory: newHistory, jitterMs: jitter });
      return p2pPing;
    }

    let activeSocket = get().socket;
    if (!activeSocket || !activeSocket.connected) {
      const serverUrl = getServerUrl();
      activeSocket = io(serverUrl, { transports: ['websocket', 'polling'] });
      set({ socket: activeSocket });
      await new Promise<void>((resolve) => {
        if (!activeSocket) return resolve();
        activeSocket.on('connect', () => resolve());
        setTimeout(resolve, 1500);
      });
    }

    if (!activeSocket || !activeSocket.connected) {
      return 0;
    }

    const start = performance.now();
    return new Promise<number>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(0);
      }, 3000);

      activeSocket.emit('ping_check', Date.now(), () => {
        clearTimeout(timeout);
        const rtt = Math.round(performance.now() - start);
        const newHistory = [...get().pingHistory.slice(-29), rtt];
        const jitter = calculateJitter(newHistory);
        set({ latencyMs: rtt, pingHistory: newHistory, jitterMs: jitter });
        resolve(rtt);
      });
    });
  },

  runFullLagDiagnostic: async () => {
    set({ isMeasuringLag: true });
    const samples: number[] = [];
    for (let i = 0; i < 8; i++) {
      const p = await get().measurePing();
      if (p > 0) samples.push(p);
      await new Promise((r) => setTimeout(r, 180));
    }
    set({ isMeasuringLag: false });

    if (samples.length === 0) {
      return { avgPing: 0, minPing: 0, maxPing: 0, jitter: 0 };
    }
    const avgPing = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    const minPing = Math.min(...samples);
    const maxPing = Math.max(...samples);
    const jitter = calculateJitter(samples);
    return { avgPing, minPing, maxPing, jitter };
  },
  input: {
    x: 0,
    y: 1,
    z: 0,
    ry: 0,
    moveX: 0,
    moveY: 0,
    isShooting: false,
    isHealing: false,
    useAbility: false,
    isRolling: false,
    isZoomed: false,
  },
  connect: (mode, password, characterClass = 'melee', botCount, team, teamMatchType = 'pvp', playerName, p2pRoomId, equippedCosmetics) => {
    set({
      hasStarted: true,
      localLastAbilityTime: 0,
      localLastAbility2Time: 0,
      localLastRollTime: 0,
      localLastHealTime: 0,
    });
    if (get().socket) {
      get().socket?.disconnect();
    }

    let profile = JSON.parse(localStorage.getItem('poly_profile') || 'null');
    if (!profile) {
      profile = { wins: 0, streak: 0, rankPoints: 0, rating: null };
      localStorage.setItem('poly_profile', JSON.stringify(profile));
    }
    
    // Choose mode-specific rating
    let rating = profile.rankPoints || 0;
    if (mode === 'ranked_duo') {
      rating = profile.duoRankPoints || profile.rankPoints || 0;
    } else if (mode === 'ranked_trio') {
      rating = profile.trioRankPoints || profile.rankPoints || 0;
    } else if (mode === 'ranked') {
      rating = profile.soloRankPoints || profile.rankPoints || 0;
    }

    const resolvedPlayerName = playerName || profile.displayName || localStorage.getItem('poly_player_name') || '';
    const cosmetics = equippedCosmetics || {
      skin: localStorage.getItem('poly_equipped_skin') || 'default',
      title: localStorage.getItem('poly_equipped_title') || 'rookie',
      badge: localStorage.getItem('poly_equipped_badge') || 'first_blood',
      emote: localStorage.getItem('poly_equipped_emote') || 'victory_cheer',
    };

    // Clean up any existing socket before opening a new one
    const prevSocket = get().socket;
    if (prevSocket) {
      try {
        prevSocket.removeAllListeners();
        prevSocket.disconnect();
      } catch {}
    }

    const serverUrl = getServerUrl();
    const socket = io(serverUrl || undefined, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 8000,
    });

    let failoverTriggered = false;
    let failoverTimer: any = null;

    // Failover timer: only active for external endpoints (like Render on web.app)
    if (serverUrl && (serverUrl.includes('onrender.com') || window.location.hostname.includes('web.app'))) {
      failoverTimer = setTimeout(() => {
        if (!socket.connected && !failoverTriggered) {
          failoverTriggered = true;
          const nextUrl = failoverToNextBackend(serverUrl);
          console.warn(`[Connection Timeout] Switching external backend to: ${nextUrl}`);
          try {
            socket.removeAllListeners();
            socket.disconnect();
          } catch {}
          setTimeout(() => {
            get().connect(mode, password, characterClass, botCount, team, teamMatchType, playerName, p2pRoomId, equippedCosmetics);
          }, 400);
        }
      }, 7000);
    }

    socket.on('connect_error', (err) => {
      console.warn(`[Socket Connect Note] ${err?.message || err}. Socket.io will retry or fallback transports.`);
    });

    socket.on('connect', () => {
      if (failoverTimer) clearTimeout(failoverTimer);
      console.log('Connected to server:', serverUrl || 'same-origin');
      const currentUserUid = localStorage.getItem('poly_user_uid');
      if (currentUserUid) {
        socket.emit('p2p_register_user', { userId: currentUserUid });
      }

      socket.emit('join', {
        mode,
        password,
        characterClass,
        rating,
        botCount,
        team,
        teamMatchType,
        playerName: resolvedPlayerName,
        p2pRoomId,
        equippedSkin: cosmetics.skin,
        equippedTitle: cosmetics.title,
        equippedBadge: cosmetics.badge,
        equippedEmote: cosmetics.emote,
      });
    });

    // P2P Event Listeners
    socket.on('p2p_invite_received', (data: P2PInviteNotification) => {
      set({ incomingP2PInvite: data });
    });

    socket.on('p2p_accepted', ({ p2pRoomId, acceptorName }: { p2pRoomId: string; acceptorName: string }) => {
      set({ p2pNotice: `⚔️ ${acceptorName || 'フレンド'} が1v1 P2P対戦に参加しました！`, hasStarted: true });
      // Host connects to the p2p_duel room
      get().connect('p2p_duel', undefined, characterClass, 0, undefined, 'pvp', resolvedPlayerName, p2pRoomId);
    });

    socket.on('p2p_peers_ready', ({ hostId, guestId, roomId }: { hostId: string; guestId: string; roomId: string }) => {
      const myId = get().myId || socket.id;
      set({ p2pNotice: '⚡ 対戦相手と接続中... 超低遅延 P2P WebRTCリンク確立中', hasStarted: true });

      if (myId === hostId) {
        p2pManager.initAsHost(
          (signal) => {
            socket.emit('p2p_signal', { targetSocketId: guestId, roomId, signal });
          },
          (p2pData) => {
            if (p2pData?.type === 'peer_input' && p2pData.input) {
              get().handlePeerDirectInput(guestId, p2pData.input);
            }
          },
          (p2pState, pingMs) => {
            set({ p2pState, p2pPing: pingMs });
            if (p2pState === 'connected') {
              set({ p2pNotice: `⚡ P2P Direct接続完了！超低遅延: ${pingMs}ms` });
            }
          }
        );
      } else {
        p2pManager.initAsGuest(
          (signal) => {
            socket.emit('p2p_signal', { targetSocketId: hostId, roomId, signal });
          },
          (p2pData) => {
            if (p2pData?.type === 'peer_input' && p2pData.input) {
              get().handlePeerDirectInput(hostId, p2pData.input);
            }
          },
          (p2pState, pingMs) => {
            set({ p2pState, p2pPing: pingMs });
            if (p2pState === 'connected') {
              set({ p2pNotice: `⚡ P2P Direct接続完了！超低遅延: ${pingMs}ms` });
            }
          }
        );
      }
    });

    socket.on('p2p_declined', ({ declinerName }: { declinerName: string }) => {
      set({ p2pNotice: `❌ ${declinerName || 'フレンド'} は1v1 P2P対戦の招待を辞退しました` });
    });

    socket.on('p2p_signal_received', ({ signal }: { senderSocketId: string; signal: P2PSignal }) => {
      p2pManager.handleIncomingSignal(signal);
    });

    socket.on('p2p_invite_sent', ({ success, reason }: { success: boolean; reason?: string }) => {
      if (!success && reason) {
        set({ p2pNotice: `⚠️ 招待の送信に失敗: ${reason}` });
      }
    });

    socket.on('init', ({ id, state }: { id: string, state: GameState }) => {
      set({ myId: id, gameState: state, spectateTargetId: null });
      // Initialize local position
      const myPlayer = state.players[id];
      if (myPlayer) {
        liveInput.x = myPlayer.x;
        liveInput.y = myPlayer.y;
        liveInput.z = myPlayer.z;
        liveInput.ry = myPlayer.ry;
        set((prev) => ({
          input: {
            ...prev.input,
            x: myPlayer.x,
            y: myPlayer.y,
            z: myPlayer.z,
            ry: myPlayer.ry,
          }
        }));
      }
    });

    socket.on('respawned', ({ x, y, z }: { x: number, y: number, z: number }) => {
      liveInput.x = x;
      liveInput.y = y;
      liveInput.z = z;
      set({ spectateTargetId: null });
    });

    socket.on('tookDamage', ({ attackerX, attackerZ }) => {
      const { myId, gameState } = get();
      if (!myId || !gameState) return;
      const myPlayer = gameState.players[myId];
      if (!myPlayer) return;

      const dx = attackerX - myPlayer.x;
      const dz = attackerZ - myPlayer.z;
      const angle = Math.atan2(dx, -dz);
      
      const id = Math.random().toString();
      set(state => ({
        damageIndicators: [...state.damageIndicators, { id, angle, timestamp: Date.now() }],
        showDamageFlash: true
      }));
      setTimeout(() => set({ showDamageFlash: false }), 300);
    });

    socket.on('abilityConfirmed', ({ lastAbilityTime }: { characterClass: string; lastAbilityTime: number }) => {
      set({ localLastAbilityTime: lastAbilityTime });
    });

    socket.on('abilityRejected', ({ lastAbilityTime }: { characterClass: string; remainingMs: number; lastAbilityTime?: number }) => {
      if (lastAbilityTime !== undefined) {
        set({ localLastAbilityTime: lastAbilityTime });
      }
    });

    socket.on('stateUpdate', (state: Partial<GameState> & { activePlayerIds?: string[] }) => {
      const { myId, spectateTargetId } = get();
      // If dead and spectating a player that died, auto-cycle
      if (spectateTargetId && state.players && state.players[spectateTargetId]?.isDead) {
        const otherAlive = Object.values(state.players).filter(p => !p.isDead && p.id !== myId);
        set({ spectateTargetId: otherAlive.length > 0 ? otherAlive[0].id : null });
      }
      set(prev => {
        if (!prev.gameState) return { gameState: state as GameState };

        // Seamlessly merge incoming player delta updates with existing player metadata
        let mergedPlayers = prev.gameState.players;
        if (state.players) {
          mergedPlayers = { ...prev.gameState.players };
          for (const pid in state.players) {
            const inc = state.players[pid];
            if (myId && pid === myId && inc.score !== undefined) {
              const oldScore = prev.gameState.players[myId]?.score || 0;
              if (inc.score > oldScore) {
                playEliminationSound();
              }
            }
            mergedPlayers[pid] = {
              ...(prev.gameState.players[pid] || {}),
              ...inc,
              isRolling: !!inc.isRolling,
              isClimbing: !!inc.isClimbing,
              isStealth: !!inc.isStealth,
              isCharging: !!inc.isCharging,
              isFlying: !!inc.isFlying,
              hasShield: !!inc.hasShield,
              isInvulnerable: !!inc.isInvulnerable,
              isHealing: !!inc.isHealing,
              inBus: !!inc.inBus,
              isSkydiving: !!inc.isSkydiving,
              isGliding: !!inc.isGliding,
            };
          }
        }

        // Remove players no longer active in the room
        if (state.activePlayerIds) {
          const activeSet = new Set(state.activePlayerIds);
          for (const pid in mergedPlayers) {
            if (!activeSet.has(pid)) {
              delete mergedPlayers[pid];
            }
          }
        }

        return {
          gameState: {
            ...prev.gameState,
            ...state,
            players: mergedPlayers,
            items: state.items !== undefined ? state.items : prev.gameState.items,
            bombs: state.bombs !== undefined ? state.bombs : prev.gameState.bombs,
            obstacles: state.obstacles || prev.gameState.obstacles,
          }
        };
      });
    });

    socket.on('hitConfirmed', () => {
      playHitSound();
      set({ showHitMarker: true });
      setTimeout(() => set({ showHitMarker: false }), 150);
    });

    socket.on('playerAttacked', (event: AttackEvent) => {
      triggerAttackEvent(event);
      const myId = get().myId;
      if (myId && event.attackerId !== myId) {
        const myP = get().gameState?.players[myId];
        if (myP && !myP.inBus) {
          const dist = Math.hypot(event.x - myP.x, event.z - myP.z);
          if (dist <= 50) {
            playShootSound(event.characterClass, false, dist);
          }
        }
      }
    });

    socket.on('damageDealt', (event: DamagePopupEvent) => {
      triggerDamagePopup(event);
      const myId = get().myId;
      if (myId && event.attackerId === myId) {
        playHitSound();
      }
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      set({ myId: null });
    });

    set({ socket, spectateTargetId: null });
  },
  respawn: () => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('respawn');
      set({ spectateTargetId: null });
    }
  },
  endSinglePlayerMatch: () => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('endSinglePlayerMatch');
    }
  },
  leaveGame: () => {
    p2pManager.cleanup();
    const { socket } = get();
    if (socket) {
      socket.emit('leaveRoom');
      socket.disconnect();
    }
    liveInput.moveX = 0;
    liveInput.moveY = 0;
    liveInput.isShooting = false;
    liveInput.isHealing = false;
    liveInput.useAbility = false;
    liveInput.isRolling = false;
    liveInput.isZoomed = false;
    set({
      socket: null,
      gameState: null,
      myId: null,
      hasStarted: false,
      p2pState: 'idle',
      p2pPing: 0,
      spectateTargetId: null,
      damageIndicators: [],
      showDamageFlash: false,
      showHitMarker: false,
    });
  },
  setSpectateTargetId: (id) => {
    set({ spectateTargetId: id });
  },
  cycleSpectate: (direction) => {
    const { gameState, myId, spectateTargetId } = get();
    if (!gameState) return;
    const alivePlayers = Object.values(gameState.players).filter(p => !p.isDead && p.id !== myId);
    if (alivePlayers.length === 0) {
      set({ spectateTargetId: null });
      return;
    }
    const currentIndex = alivePlayers.findIndex(p => p.id === spectateTargetId);
    if (currentIndex === -1) {
      set({ spectateTargetId: alivePlayers[0].id });
    } else {
      const nextIndex = (currentIndex + direction + alivePlayers.length) % alivePlayers.length;
      set({ spectateTargetId: alivePlayers[nextIndex].id });
    }
  },
  setInput: (newInput) => {
    Object.assign(liveInput, newInput);
    
    const now = Date.now();
    const timeUpdates: Partial<StoreState> = {};
    if (newInput.isRolling) timeUpdates.localLastRollTime = now;
    if (newInput.useAbility) {
      abilityBurstPackets = 4;
      timeUpdates.localLastAbilityTime = now;
    }
    if (newInput.useAbility2) {
      ability2BurstPackets = 4;
      timeUpdates.localLastAbility2Time = now;
    }
    if (newInput.isHealing) timeUpdates.localLastHealTime = now;

    // Only update zustand if shooting/ability/healing/rolling/zoomed changes to avoid 60fps re-render thrashing
    if (newInput.isShooting !== undefined || newInput.isHealing !== undefined || newInput.useAbility !== undefined || newInput.useAbility2 !== undefined || newInput.isRolling !== undefined || newInput.isZoomed !== undefined || Object.keys(timeUpdates).length > 0) {
      set((state) => ({ 
        input: { ...state.input, ...newInput },
        ...timeUpdates
      }));
    }
  },
  sendInput: () => {
    const { socket } = get();
    if (!socket || !socket.connected) return;

    const sendingAbility = !!(liveInput.useAbility || abilityBurstPackets > 0);
    if (abilityBurstPackets > 0) abilityBurstPackets--;
    const sendingAbility2 = !!(liveInput.useAbility2 || ability2BurstPackets > 0);
    if (ability2BurstPackets > 0) ability2BurstPackets--;

    const roundedX = Math.round(liveInput.x * 10) / 10;
    const roundedY = Math.round(liveInput.y * 10) / 10;
    const roundedZ = Math.round(liveInput.z * 10) / 10;
    const roundedRy = Math.round(liveInput.ry * 100) / 100;
    const roundedPitch = Math.round(liveInput.pitch * 100) / 100;
    const isAction = !!(liveInput.isShooting || liveInput.isHealing || sendingAbility || sendingAbility2 || liveInput.isRolling || liveInput.jumpFromBus || liveInput.toggleGlider);

    const now = performance.now();
    const isOneShotAction = !!(sendingAbility || sendingAbility2 || liveInput.jumpFromBus || liveInput.toggleGlider || liveInput.isShooting);
    if (now - lastSentTime < 33 && !isOneShotAction) return;
    // Adaptive send: only send if action occurred, moved/rotated, or 350ms heartbeat elapsed
    if (!isAction && lastSentInput && (now - lastSentTime < 350)) {
      const dx = Math.abs(roundedX - lastSentInput.x);
      const dz = Math.abs(roundedZ - lastSentInput.z);
      const dry = Math.abs(roundedRy - lastSentInput.ry);
      const dpitch = Math.abs(roundedPitch - lastSentInput.pitch);
      if (dx < 0.05 && dz < 0.05 && dry < 0.03 && dpitch < 0.05) {
        return; // Skip identical static packet to save upstream bandwidth
      }
    }

    lastSentTime = now;
    lastSentInput = {
      x: roundedX,
      y: roundedY,
      z: roundedZ,
      ry: roundedRy,
      pitch: roundedPitch,
    };

    socket.emit('input', {
      x: roundedX,
      y: roundedY,
      z: roundedZ,
      ry: roundedRy,
      pitch: roundedPitch,
      aimTarget: liveInput.aimTarget ? {
        x: Math.round(liveInput.aimTarget.x * 10) / 10,
        y: Math.round(liveInput.aimTarget.y * 10) / 10,
        z: Math.round(liveInput.aimTarget.z * 10) / 10,
      } : undefined,
      moveX: Math.round(liveInput.moveX * 10) / 10,
      moveY: Math.round(liveInput.moveY * 10) / 10,
      isShooting: liveInput.isShooting,
      isHealing: liveInput.isHealing,
      useAbility: sendingAbility,
      useAbility2: sendingAbility2,
      useSubWeapon: liveInput.useSubWeapon,
      isRolling: liveInput.isRolling,
      isClimbing: liveInput.isClimbing,
      jumpFromBus: liveInput.jumpFromBus,
      toggleGlider: liveInput.toggleGlider,
    });

    // If WebRTC DataChannel is connected, send direct P2P packet for ultra-low latency peer synchronization
    if (p2pManager.getState() === 'connected') {
      p2pManager.send({
        type: 'peer_input',
        input: {
          x: roundedX,
          y: roundedY,
          z: roundedZ,
          ry: roundedRy,
          pitch: roundedPitch,
          isShooting: liveInput.isShooting,
          isRolling: liveInput.isRolling,
        },
      });
    }

    // One-shot triggers must reset after transmission
    if (liveInput.toggleGlider) {
      liveInput.toggleGlider = false;
    }
    if (liveInput.jumpFromBus) {
      liveInput.jumpFromBus = false;
    }
  },

  registerP2PUser: (userId: string) => {
    localStorage.setItem('poly_user_uid', userId);
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('p2p_register_user', { userId });
    }
  },

  sendP2PInvite: (targetUid: string, inviterName: string, inviterUid: string) => {
    const p2pRoomId = `P2P-${inviterUid.slice(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('p2p_invite', {
        targetUid,
        inviterName,
        inviterUid,
        p2pRoomId,
      });
      set({ p2pNotice: '⚡ P2P対戦招待を送信しました...' });
    } else {
      // Auto-connect socket if offline
      get().connect('p2p_duel', undefined, 'melee', 0, undefined, 'pvp', inviterName, p2pRoomId);
      setTimeout(() => {
        get().socket?.emit('p2p_invite', { targetUid, inviterName, inviterUid, p2pRoomId });
        set({ p2pNotice: '⚡ P2P対戦招待を送信しました...' });
      }, 500);
    }
    return p2pRoomId;
  },

  acceptP2PInvite: (invite: P2PInviteNotification, characterClass = 'melee') => {
    const { socket } = get();
    const myProfile = JSON.parse(localStorage.getItem('poly_profile') || '{}');
    const myName = myProfile.displayName || localStorage.getItem('poly_player_name') || 'Player';
    const myUid = localStorage.getItem('poly_user_uid') || '';

    if (socket && socket.connected) {
      socket.emit('p2p_accept', {
        inviterUid: invite.inviterUid,
        p2pRoomId: invite.p2pRoomId,
        acceptorUid: myUid,
        acceptorName: myName,
      });
    }

    set({ incomingP2PInvite: null, hasStarted: true });

    // Join room as Guest - p2p_peers_ready will negotiate WebRTC automatically
    get().connect('p2p_duel', undefined, characterClass, 0, undefined, 'pvp', myName, invite.p2pRoomId);
  },

  declineP2PInvite: (invite: P2PInviteNotification, declinerName: string) => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('p2p_decline', {
        inviterUid: invite.inviterUid,
        p2pRoomId: invite.p2pRoomId,
        declinerName,
      });
    }
    set({ incomingP2PInvite: null });
  },

  clearP2PNotice: () => set({ p2pNotice: null }),
}));
