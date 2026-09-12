import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, PlayerState, ClientInput, CharacterClass, AttackEvent, DamagePopupEvent } from './types.js';

export interface DamageIndicator {
  id: string;
  angle: number;
  timestamp: number;
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
  isRolling: boolean;
  isZoomed: boolean;
  isTargetLocked?: boolean;
}

export const liveInput: LiveInput = {
  x: 0,
  y: 1,
  z: 0,
  ry: 0,
  pitch: 0.25,
  aimTarget: { x: 0, y: 1.4, z: -50 },
  moveX: 0,
  moveY: 0,
  isShooting: false,
  isHealing: false,
  useAbility: false,
  isRolling: false,
  isZoomed: false,
  isTargetLocked: false,
};

export const attackStatus = {
  isTargetLocked: false,
};

interface StoreState {
  socket: Socket | null;
  gameState: GameState | null;
  myId: string | null;
  input: ClientInput;
  showHitMarker: boolean;
  showDamageFlash: boolean;
  damageIndicators: DamageIndicator[];
  spectateTargetId: string | null;
  connect: (mode: 'casual' | 'ranked' | 'password' | 'team' | 'bot', password?: string, characterClass?: CharacterClass) => void;
  setInput: (input: Partial<ClientInput>) => void;
  sendInput: () => void;
  respawn: () => void;
  leaveGame: () => void;
  setSpectateTargetId: (id: string | null) => void;
  cycleSpectate: (direction: 1 | -1) => void;
}

export const useGameStore = create<StoreState>((set, get) => ({
  socket: null,
  gameState: null,
  myId: null,
  showHitMarker: false,
  showDamageFlash: false,
  damageIndicators: [],
  spectateTargetId: null,
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
  connect: (mode, password, characterClass = 'melee') => {
    if (get().socket) {
      get().socket?.disconnect();
    }

    let profile = JSON.parse(localStorage.getItem('poly_profile') || 'null');
    if (!profile) {
      profile = { wins: 0, streak: 0, rankPoints: 0, rating: null };
      localStorage.setItem('poly_profile', JSON.stringify(profile));
    }
    const rating = profile.rating || profile.rankPoints;

    const serverUrl = import.meta.env.VITE_SERVER_URL || undefined;
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('join', { mode, password, characterClass, rating });
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

    socket.on('stateUpdate', (state: Partial<GameState>) => {
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
            mergedPlayers[pid] = {
              ...(prev.gameState.players[pid] || {}),
              ...state.players[pid],
            };
          }
          // Remove players that left
          for (const pid in prev.gameState.players) {
            if (!(pid in state.players)) {
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
      set({ showHitMarker: true });
      setTimeout(() => set({ showHitMarker: false }), 200);
    });

    socket.on('playerAttacked', (event: AttackEvent) => {
      triggerAttackEvent(event);
    });

    socket.on('damageDealt', (event: DamagePopupEvent) => {
      triggerDamagePopup(event);
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
  leaveGame: () => {
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
    // Only update zustand if shooting/ability/healing/rolling/zoomed changes to avoid 60fps re-render thrashing
    if (newInput.isShooting !== undefined || newInput.isHealing !== undefined || newInput.useAbility !== undefined || newInput.isRolling !== undefined || newInput.isZoomed !== undefined) {
      set((state) => ({ input: { ...state.input, ...newInput } }));
    }
  },
  sendInput: () => {
    const { socket } = get();
    if (socket && socket.connected) {
      socket.emit('input', {
        x: Math.round(liveInput.x * 10) / 10,
        y: Math.round(liveInput.y * 10) / 10,
        z: Math.round(liveInput.z * 10) / 10,
        ry: Math.round(liveInput.ry * 100) / 100,
        pitch: Math.round(liveInput.pitch * 100) / 100,
        aimTarget: liveInput.aimTarget ? {
          x: Math.round(liveInput.aimTarget.x * 10) / 10,
          y: Math.round(liveInput.aimTarget.y * 10) / 10,
          z: Math.round(liveInput.aimTarget.z * 10) / 10,
        } : undefined,
        moveX: Math.round(liveInput.moveX * 10) / 10,
        moveY: Math.round(liveInput.moveY * 10) / 10,
        isShooting: liveInput.isShooting,
        isHealing: liveInput.isHealing,
        useAbility: liveInput.useAbility,
        isRolling: liveInput.isRolling,
      });
    }
  },
}));
