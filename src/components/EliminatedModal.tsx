import React from 'react';
import { useGameStore } from '../store';
import { RotateCcw, Eye, LogOut, Trophy, Target, Shield, Zap } from 'lucide-react';
import { CharacterClass } from '../types';

interface EliminatedModalProps {
  onReturnToLobby: () => void;
  onPlayAgain: () => void;
}

const CLASS_NAMES: Record<CharacterClass, string> = {
  melee: '近接兵 (Assault)',
  sword: '剣豪 (Blade)',
  tank: '重装兵 (Tank)',
  scout: '奇襲兵 (Scout)',
};

export function EliminatedModal({ onReturnToLobby, onPlayAgain }: EliminatedModalProps) {
  const myId = useGameStore((s) => s.myId);
  const gameState = useGameStore((s) => s.gameState);
  const spectateTargetId = useGameStore((s) => s.spectateTargetId);
  const setSpectateTargetId = useGameStore((s) => s.setSpectateTargetId);
  const respawn = useGameStore((s) => s.respawn);

  if (!gameState || !myId) return null;
  const myPlayer = gameState.players[myId];
  if (!myPlayer || !myPlayer.isDead) return null;

  // If currently in active spectate mode, show the minimal spectate HUD instead
  if (spectateTargetId) {
    return null;
  }

  const otherAlive = Object.values(gameState.players).filter((p) => !p.isDead && p.id !== myId);
  const canSpectate = otherAlive.length > 0;

  const handleSpectateClick = () => {
    if (canSpectate) {
      setSpectateTargetId(otherAlive[0].id);
    }
  };

  const handleRespawnClick = () => {
    if (gameState.status === 'playing') {
      respawn();
    } else {
      onPlayAgain();
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md pointer-events-auto p-4 select-none touch-none font-sans">
      <div className="w-full max-w-md bg-slate-900/95 border-2 border-red-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(239,68,68,0.3)] text-white text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* Skull / Defeat Badge */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 mb-3 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
          <Target size={36} className="animate-pulse" />
        </div>

        {/* Title */}
        <h2 className="text-4xl md:text-5xl font-black text-red-500 tracking-wider mb-1 drop-shadow">
          ELIMINATED
        </h2>
        <p className="text-slate-400 text-sm font-semibold mb-6">撃破されました</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-white/5 flex flex-col items-center">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">スコア / 撃破数</span>
            <span className="text-2xl font-black text-amber-400 flex items-center gap-1.5">
              <Trophy size={18} className="text-amber-400" />
              {myPlayer.score}
            </span>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3 border border-white/5 flex flex-col items-center">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">生存プレイヤー</span>
            <span className="text-2xl font-black text-emerald-400">
              {otherAlive.length} 人
            </span>
          </div>
        </div>

        {/* Class Info */}
        <div className="text-xs text-slate-400 mb-6 bg-slate-800/50 px-4 py-2 rounded-full border border-white/5">
          使用兵科: <span className="font-bold text-slate-200">{CLASS_NAMES[myPlayer.characterClass] || myPlayer.characterClass}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full">
          {/* Main Action: Respawn / Play Again */}
          <button
            type="button"
            onClick={handleRespawnClick}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-lg rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw size={22} className="stroke-[2.5]" />
            <span>{gameState.status === 'playing' ? '再出撃 (リスポーン)' : 'もう一度プレイ'}</span>
          </button>

          {/* Secondary Action: Spectate (if players alive) */}
          {canSpectate && (
            <button
              type="button"
              onClick={handleSpectateClick}
              className="w-full py-3.5 bg-blue-600/80 hover:bg-blue-600 active:scale-98 text-white font-bold text-base rounded-2xl border border-blue-400/30 shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <Eye size={20} />
              <span>生存者を観戦する</span>
            </button>
          )}

          {/* Tertiary Action: Return to Lobby */}
          <button
            type="button"
            onClick={onReturnToLobby}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-300 font-bold text-base rounded-2xl border border-white/10 flex items-center justify-center gap-2 transition-all mt-1"
          >
            <LogOut size={18} />
            <span>ロビーに戻る</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export function SpectateHUD({ onReturnToLobby }: { onReturnToLobby: () => void }) {
  const myId = useGameStore((s) => s.myId);
  const gameState = useGameStore((s) => s.gameState);
  const spectateTargetId = useGameStore((s) => s.spectateTargetId);
  const setSpectateTargetId = useGameStore((s) => s.setSpectateTargetId);
  const cycleSpectate = useGameStore((s) => s.cycleSpectate);
  const respawn = useGameStore((s) => s.respawn);

  if (!spectateTargetId || !gameState || !myId) return null;

  const targetPlayer = gameState.players[spectateTargetId];
  const otherAlive = Object.values(gameState.players).filter((p) => !p.isDead && p.id !== myId);

  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-between p-4 font-sans select-none">
      {/* Top Banner */}
      <div className="flex justify-between items-center w-full pointer-events-auto">
        <div className="bg-slate-900/90 border border-white/15 px-5 py-2.5 rounded-2xl backdrop-blur-md text-white shadow-xl flex items-center gap-3">
          <Eye size={20} className="text-blue-400 animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">観戦モード (SPECTATING)</div>
            <div className="text-sm font-black text-amber-300">
              {targetPlayer ? (CLASS_NAMES[targetPlayer.characterClass] || 'Player') : 'Looking for player...'}
            </div>
          </div>
          {targetPlayer && (
            <div className="ml-3 pl-3 border-l border-white/15 text-xs text-slate-300 font-semibold">
              HP: {Math.ceil(targetPlayer.health)} | Score: {targetPlayer.score}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onReturnToLobby}
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 px-4 py-2.5 rounded-2xl border border-white/15 font-bold text-sm shadow-xl flex items-center gap-2 transition-all active:scale-95"
        >
          <LogOut size={16} />
          <span>ロビー</span>
        </button>
      </div>

      {/* Bottom Switcher Controls */}
      <div className="flex justify-center items-center gap-3 w-full pointer-events-auto mb-6">
        <button
          type="button"
          onClick={() => cycleSpectate(-1)}
          disabled={otherAlive.length <= 1}
          className="bg-slate-900/90 hover:bg-slate-800 disabled:opacity-30 text-white font-black px-5 py-3 rounded-2xl border border-white/15 shadow-xl active:scale-95 transition-all text-sm"
        >
          ◀ 前のプレイヤー
        </button>

        <button
          type="button"
          onClick={() => respawn()}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-2xl shadow-xl shadow-emerald-500/30 active:scale-95 transition-all flex items-center gap-2 text-sm"
        >
          <RotateCcw size={18} />
          <span>再出撃</span>
        </button>

        <button
          type="button"
          onClick={() => cycleSpectate(1)}
          disabled={otherAlive.length <= 1}
          className="bg-slate-900/90 hover:bg-slate-800 disabled:opacity-30 text-white font-black px-5 py-3 rounded-2xl border border-white/15 shadow-xl active:scale-95 transition-all text-sm"
        >
          次のプレイヤー ▶
        </button>
      </div>
    </div>
  );
}
