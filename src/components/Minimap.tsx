import React, { useState, useEffect } from 'react';
import { useGameStore, liveInput } from '../store';

const RADAR_RANGE = 75; // Visible radius in game meters around the player

export function Minimap() {
  const gameState = useGameStore((s) => s.gameState);
  const myId = useGameStore((s) => s.myId);

  // 60FPS tick to follow local player position & orientation smoothly
  const [, setTick] = useState(0);
  useEffect(() => {
    let animId: number;
    const update = () => {
      setTick((t) => (t + 1) % 10000);
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  if (!gameState || !myId) return null;

  const myPlayer = gameState.players[myId];
  if (!myPlayer) return null;

  // Use fast local predicted position or synced position
  const px = liveInput.x !== undefined && liveInput.x !== 0 ? liveInput.x : myPlayer.x;
  const pz = liveInput.z !== undefined && liveInput.z !== 0 ? liveInput.z : myPlayer.z;
  const pry = liveInput.ry !== undefined ? liveInput.ry : myPlayer.ry;

  // Helper to convert relative world offset (dx, dz) to percentage position on radar (0% to 100%)
  const toRadarPercent = (worldX: number, worldZ: number) => {
    const dx = worldX - px;
    const dz = worldZ - pz;
    const percentX = 50 + (dx / RADAR_RANGE) * 50;
    const percentY = 50 + (dz / RADAR_RANGE) * 50;
    return { percentX, percentY, dx, dz, dist: Math.hypot(dx, dz) };
  };

  return (
    <div className="w-40 h-40 bg-slate-950/90 border-2 border-cyan-500/40 rounded-full overflow-hidden relative backdrop-blur-md pointer-events-none shadow-[0_0_20px_rgba(6,182,212,0.25)] select-none">
      
      {/* Radar Background & Grid Rings */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#0f172a_0%,#020617_100%)]" />

      {/* Concentric Distance Circles (25m, 50m, 75m) */}
      <div className="absolute inset-[33%] rounded-full border border-cyan-500/15" />
      <div className="absolute inset-[16%] rounded-full border border-cyan-500/20" />
      <div className="absolute inset-[1px] rounded-full border border-cyan-400/30" />

      {/* Radar Crosshairs */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-cyan-500/15 -translate-x-1/2" />
      <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-cyan-500/15 -translate-y-1/2" />

      {/* Compass Cardinal Points */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-black text-cyan-400 tracking-tighter">N</div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-500">S</div>
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-500">W</div>
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-500">E</div>

      {/* Sweeping Radar Scanner Line */}
      <div className="absolute inset-0 origin-center animate-[spin_4s_linear_infinite] pointer-events-none">
        <div className="w-1/2 h-1/2 bg-gradient-to-br from-cyan-500/20 to-transparent origin-bottom-right rounded-tl-full" />
      </div>

      {/* World Map Boundary Lines (if near the 400x400 map edges: -200 to +200) */}
      {px + RADAR_RANGE > 200 && (
        <div 
          className="absolute top-0 bottom-0 w-1 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          style={{ left: `${50 + ((200 - px) / RADAR_RANGE) * 50}%` }}
        />
      )}
      {px - RADAR_RANGE < -200 && (
        <div 
          className="absolute top-0 bottom-0 w-1 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          style={{ left: `${50 + ((-200 - px) / RADAR_RANGE) * 50}%` }}
        />
      )}
      {pz + RADAR_RANGE > 200 && (
        <div 
          className="absolute left-0 right-0 h-1 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          style={{ top: `${50 + ((200 - pz) / RADAR_RANGE) * 50}%` }}
        />
      )}
      {pz - RADAR_RANGE < -200 && (
        <div 
          className="absolute left-0 right-0 h-1 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          style={{ top: `${50 + ((-200 - pz) / RADAR_RANGE) * 50}%` }}
        />
      )}

      {/* Obstacles (Rendered relative to player center) */}
      {gameState.obstacles && Object.values(gameState.obstacles).map((obs) => {
        const { percentX, percentY, dist } = toRadarPercent(obs.x, obs.z);
        // Only render obstacles in or near the radar field of view
        const maxBound = Math.max(obs.width, obs.depth);
        if (dist > RADAR_RANGE + maxBound) return null;

        const isCrate = obs.type === 'crate';
        const isBuilding = obs.type === 'building' || obs.type === 'bunker';
        const colorClass = isCrate ? 'bg-amber-500/80' : isBuilding ? 'bg-slate-300/85' : 'bg-slate-500/70';

        return (
          <div
            key={obs.id}
            className={`absolute ${colorClass} -translate-x-1/2 -translate-y-1/2 rounded-[1px] border border-black/30`}
            style={{
              left: `${percentX}%`,
              top: `${percentY}%`,
              width: `${Math.max(2, (obs.width / (RADAR_RANGE * 2)) * 100)}%`,
              height: `${Math.max(2, (obs.depth / (RADAR_RANGE * 2)) * 100)}%`,
            }}
          />
        );
      })}

      {/* Ground Items (Heals & Weapons) */}
      {Object.values(gameState.items || {}).map((item) => {
        const { percentX, percentY, dist } = toRadarPercent(item.x, item.z);
        if (dist > RADAR_RANGE) return null;

        return (
          <div
            key={item.id}
            className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-sm ${
              item.type === 'heal' 
                ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,1)] ring-1 ring-emerald-200' 
                : 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,1)] ring-1 ring-amber-200'
            }`}
            style={{
              left: `${percentX}%`,
              top: `${percentY}%`,
            }}
          />
        );
      })}

      {/* Active Bombs */}
      {Object.values(gameState.bombs || {}).map((bomb) => {
        if (bomb.exploded) return null;
        const { percentX, percentY, dist } = toRadarPercent(bomb.x, bomb.z);
        if (dist > RADAR_RANGE) return null;

        return (
          <div
            key={bomb.id}
            className="absolute w-3 h-3 bg-red-600 rounded-full -translate-x-1/2 -translate-y-1/2 animate-ping shadow-[0_0_8px_rgba(220,38,38,1)] border border-white"
            style={{
              left: `${percentX}%`,
              top: `${percentY}%`,
            }}
          />
        );
      })}

      {/* Enemies & Opponents - Approximate Tactical Radar Sonar Pings */}
      {Object.values(gameState.players).map((p) => {
        if (p.id === myId || p.isDead) return null;
        const isTeamMate = gameState.mode === 'team' && p.team === myPlayer.team;

        // Approximate position (fuzzy / sector-quantized by ~10-12m to prevent exact wallhack pinpointing)
        const approxResolution = 12; // 12 meters sector approximation
        const approxX = Math.round(p.x / approxResolution) * approxResolution;
        const approxZ = Math.round(p.z / approxResolution) * approxResolution;

        const { percentX, percentY, dist } = toRadarPercent(approxX, approxZ);

        // Inside Radar Range: Soft pulsing radar cloud / acoustic wave blip
        if (dist <= RADAR_RANGE) {
          return (
            <div
              key={p.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10 pointer-events-none"
              style={{
                left: `${percentX}%`,
                top: `${percentY}%`,
              }}
            >
              {/* Expanding soft radar ripple */}
              <div
                className={`absolute w-7 h-7 rounded-full animate-ping opacity-60 ${
                  isTeamMate ? 'border border-cyan-400/60 bg-cyan-400/20' : 'border border-red-500/60 bg-red-500/25'
                }`}
              />
              {/* Soft hazy acoustic blip (approximate zone) */}
              <div
                className={`w-5 h-5 rounded-full blur-[1.5px] transition-all duration-300 ${
                  isTeamMate
                    ? 'bg-gradient-to-r from-cyan-400/80 to-blue-500/80 shadow-[0_0_10px_rgba(34,211,238,0.8)]'
                    : 'bg-gradient-to-r from-red-500/85 to-amber-500/85 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse'
                }`}
              />
              {/* Soft glowing core */}
              <div
                className={`absolute w-2 h-2 rounded-full ${
                  isTeamMate ? 'bg-cyan-200' : 'bg-red-200'
                }`}
              />
            </div>
          );
        }

        // Distant Presence (Up to 110m): Faint peripheral warning glow
        if (dist <= 110) {
          const dx = approxX - px;
          const dz = approxZ - pz;
          const angle = Math.atan2(dz, dx);
          const edgeRadius = 45; // on radar rim
          const edgeX = 50 + Math.cos(angle) * edgeRadius;
          const edgeY = 50 + Math.sin(angle) * edgeRadius;

          return (
            <div
              key={`edge_${p.id}`}
              className="absolute w-3 h-3 bg-red-500/70 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[1px] animate-pulse"
              style={{
                left: `${edgeX}%`,
                top: `${edgeY}%`,
              }}
            />
          );
        }

        return null;
      })}

      {/* --- LOCAL PLAYER (LOCKED EXACTLY IN THE CENTER: 50%, 50%) --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center">
        
        {/* Forward Vision Cone / Field of View Arc */}
        <div 
          className="absolute w-24 h-24 origin-center pointer-events-none"
          style={{ transform: `rotate(${-pry}rad)` }}
        >
          <div 
            className="w-full h-full"
            style={{
              background: 'conic-gradient(from 150deg at 50% 50%, transparent 0deg, rgba(6,182,212,0.25) 30deg, transparent 60deg)',
              clipPath: 'polygon(50% 50%, 25% 0%, 75% 0%)'
            }}
          />
        </div>

        {/* Pulsing Ripple Ping around player */}
        <div className="absolute w-6 h-6 rounded-full border border-cyan-400/40 animate-ping" />

        {/* Center Player Dot & Arrow Pointer */}
        <div className="relative w-3.5 h-3.5 bg-cyan-400 rounded-full border-2 border-white shadow-[0_0_10px_rgba(6,182,212,1)] flex items-center justify-center">
          {/* Aim Direction Needle */}
          <div
            className="absolute top-1/2 left-1/2 w-0.5 h-4 bg-white shadow-sm origin-bottom rounded-full -translate-x-1/2"
            style={{
              transform: `translate(-50%, -100%) rotate(${-pry}rad)`,
            }}
          />
        </div>
      </div>

      {/* Radar HUD Range Label */}
      <div className="absolute bottom-1 right-2 text-[8px] font-mono font-bold text-cyan-400/80 tracking-tighter">
        75m
      </div>
    </div>
  );
}
