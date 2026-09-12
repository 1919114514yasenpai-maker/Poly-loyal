import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useGameStore, liveInput } from '../store';
import { Target, PlusCircle, Zap, Wind, ZoomIn, LogOut, X, AlertTriangle } from 'lucide-react';
import { CLASS_ABILITIES } from '../types';
import { Minimap } from './Minimap';

function playHitChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignore if browser audio policy blocks
  }
}

export function MobileControls() {
  const setInput = useGameStore((s) => s.setInput);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const myId = useGameStore((s) => s.myId);
  const gameState = useGameStore((s) => s.gameState);
  const showHitMarker = useGameStore((s) => s.showHitMarker);
  const showDamageFlash = useGameStore((s) => s.showDamageFlash);
  const damageIndicators = useGameStore((s) => s.damageIndicators || []);

  // Play audio chime when a hit lands
  useEffect(() => {
    if (showHitMarker) {
      playHitChime();
    }
  }, [showHitMarker]);

  const myPlayer = myId && gameState ? gameState.players[myId] : null;

  // Floating joystick state
  const leftZoneRef = useRef<HTMLDivElement>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const restingBaseRef = useRef<HTMLDivElement>(null);
  const joystickPointerId = useRef<number | null>(null);
  const joystickOrigin = useRef<{ x: number; y: number } | null>(null);

  // Look state
  const rightZoneRef = useRef<HTMLDivElement>(null);
  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Button active visual states
  const [isShootingActive, setIsShootingActive] = useState(false);
  const [isHealingActive, setIsHealingActive] = useState(false);
  const [isAbilityActive, setIsAbilityActive] = useState(false);
  const [isRollingActive, setIsRollingActive] = useState(false);
  const [isZoomedLocal, setIsZoomedLocal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Sync zoom state
  const toggleZoom = useCallback(() => {
    setIsZoomedLocal(prev => {
      const next = !prev;
      liveInput.isZoomed = next;
      setInput({ isZoomed: next });
      return next;
    });
  }, [setInput]);

  // Real-time clock for smooth ability cooldown / duration meters
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Ability state calculations
  const charClass = myPlayer?.characterClass || 'melee';
  const abilityInfo = CLASS_ABILITIES[charClass] || CLASS_ABILITIES.melee;
  const lastAbilityTime = myPlayer?.lastAbilityTime || 0;
  const elapsedSinceAbility = currentTime - lastAbilityTime;
  const cooldownMs = abilityInfo.cooldownMs;
  const durationMs = abilityInfo.durationMs;

  const isBuffActive = durationMs > 0 && elapsedSinceAbility < durationMs && !myPlayer?.isDead;
  const remainingBuffSec = durationMs > 0 ? Math.max(0, (durationMs - elapsedSinceAbility) / 1000) : 0;
  const buffRatio = durationMs > 0 ? Math.max(0, 1 - (elapsedSinceAbility / durationMs)) : 0;

  // Do not charge while the ability is actively in use
  // Cooldown only starts ticking after the buff duration has ended
  let chargeRatio = 0;
  let remainingCdSec = 0;
  
  if (isBuffActive) {
    chargeRatio = 0;
    remainingCdSec = cooldownMs / 1000;
  } else {
    const elapsedSinceFinish = Math.max(0, elapsedSinceAbility - durationMs);
    chargeRatio = Math.min(1, Math.max(0, elapsedSinceFinish / cooldownMs));
    remainingCdSec = Math.max(0, (cooldownMs - elapsedSinceFinish) / 1000);
  }
  
  const isAbilityReady = chargeRatio >= 1;
  const chargePercent = Math.floor(chargeRatio * 100);

  // Dodge Roll state calculations (1.8s cooldown)
  const lastRollTime = myPlayer?.lastRollTime || 0;
  const rollCooldownMs = 1800;
  const elapsedSinceRoll = currentTime - lastRollTime;
  const isRollReady = elapsedSinceRoll >= rollCooldownMs;
  const remainingRollCdSec = Math.max(0, (rollCooldownMs - elapsedSinceRoll) / 1000);
  const rollChargeRatio = Math.min(1, Math.max(0, elapsedSinceRoll / rollCooldownMs));

  // Unified Joystick Reset Function
  const resetJoystick = useCallback(() => {
    joystickPointerId.current = null;
    joystickOrigin.current = null;
    liveInput.moveX = 0;
    liveInput.moveY = 0;

    if (joyBaseRef.current) {
      joyBaseRef.current.style.display = 'none';
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    if (restingBaseRef.current) {
      restingBaseRef.current.style.opacity = '1';
    }
  }, []);

  // Reset look pointer
  const resetLook = useCallback(() => {
    lookPointerId.current = null;
  }, []);

  // Global window listeners to prevent joystick or buttons getting stuck
  useEffect(() => {
    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (e.pointerId === joystickPointerId.current) {
        resetJoystick();
      }
      if (e.pointerId === lookPointerId.current) {
        resetLook();
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        resetJoystick();
        resetLook();
        if (liveInput.isShooting || liveInput.isHealing || liveInput.useAbility) {
          liveInput.isShooting = false;
          liveInput.isHealing = false;
          liveInput.useAbility = false;
          setIsShootingActive(false);
          setIsHealingActive(false);
          setIsAbilityActive(false);
          setInput({ isShooting: false, isHealing: false, useAbility: false });
        }
      }
    };

    const handleGlobalBlur = () => {
      resetJoystick();
      resetLook();
      liveInput.isShooting = false;
      liveInput.isHealing = false;
      liveInput.useAbility = false;
      setIsShootingActive(false);
      setIsHealingActive(false);
      setIsAbilityActive(false);
      setInput({ isShooting: false, isHealing: false, useAbility: false });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleGlobalBlur();
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);
    window.addEventListener('blur', handleGlobalBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const watchdog = setInterval(() => {
      if (joystickPointerId.current === null && (liveInput.moveX !== 0 || liveInput.moveY !== 0)) {
        liveInput.moveX = 0;
        liveInput.moveY = 0;
      }
    }, 100);

    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
      window.removeEventListener('blur', handleGlobalBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(watchdog);
    };
  }, [resetJoystick, resetLook, setInput]);

  // Reset controls when dead or game not active
  useEffect(() => {
    if (!myPlayer || myPlayer.isDead || gameState?.status !== 'playing') {
      resetJoystick();
      resetLook();
      setIsZoomedLocal(false);
      liveInput.isZoomed = false;
      setInput({ isZoomed: false });
    }
  }, [myPlayer?.isDead, gameState?.status, resetJoystick, resetLook, setInput]);

  // Keyboard controls support (WASD + Arrows + Space + Shift + E + Z/V for Zoom + Esc for Leave)
  useEffect(() => {
    const keys = new Set<string>();

    const updateFromKeys = () => {
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;

      if (joystickPointerId.current === null) {
        liveInput.moveX = x;
        liveInput.moveY = y;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setShowLeaveModal(prev => !prev);
        return;
      }

      keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        updateFromKeys();
      }
      if (e.code === 'Space' || e.code === 'KeyQ' || e.code === 'KeyC') {
        liveInput.isRolling = true;
        setInput({ isRolling: true });
        setIsRollingActive(true);
      }
      if (e.code === 'KeyZ' || e.code === 'KeyV') {
        toggleZoom();
      }
      if (e.code === 'KeyJ' || e.code === 'KeyX' || e.code === 'Enter') {
        liveInput.isShooting = true;
        setInput({ isShooting: true });
        setIsShootingActive(true);
      }
      if (e.code === 'KeyE' || e.code === 'KeyF') {
        liveInput.isHealing = true;
        setInput({ isHealing: true });
        setIsHealingActive(true);
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyR') {
        liveInput.useAbility = true;
        setInput({ useAbility: true });
        setIsAbilityActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        updateFromKeys();
      }
      if (e.code === 'Space' || e.code === 'KeyQ' || e.code === 'KeyC') {
        liveInput.isRolling = false;
        setInput({ isRolling: false });
        setIsRollingActive(false);
      }
      if (e.code === 'KeyJ' || e.code === 'KeyX' || e.code === 'Enter') {
        liveInput.isShooting = false;
        setInput({ isShooting: false });
        setIsShootingActive(false);
      }
      if (e.code === 'KeyE' || e.code === 'KeyF') {
        liveInput.isHealing = false;
        setInput({ isHealing: false });
        setIsHealingActive(false);
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyR') {
        liveInput.useAbility = false;
        setInput({ useAbility: false });
        setIsAbilityActive(false);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toggleZoom();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [setInput, toggleZoom]);

  // Floating Joystick Handlers (Direct DOM transform with auto-recovery)
  const handleJoyPointerDown = useCallback((e: React.PointerEvent) => {
    // If a previous pointer was stuck or another finger touched, clean up previous state
    if (joystickPointerId.current !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(joystickPointerId.current);
      } catch {
        // ignore
      }
      resetJoystick();
    }

    joystickPointerId.current = e.pointerId;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = e.clientX - rect.left;
    const touchY = e.clientY - rect.top;

    joystickOrigin.current = { x: touchX, y: touchY };
    liveInput.moveX = 0;
    liveInput.moveY = 0;

    if (joyBaseRef.current) {
      joyBaseRef.current.style.display = 'block';
      joyBaseRef.current.style.left = `${touchX}px`;
      joyBaseRef.current.style.top = `${touchY}px`;
    }
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
    if (restingBaseRef.current) {
      restingBaseRef.current.style.opacity = '0.2';
    }
  }, [resetJoystick]);

  const handleJoyPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== joystickPointerId.current || !joystickOrigin.current) return;

    // Safety: if mouse was used and no buttons are pressed, release
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      resetJoystick();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const dx = currentX - joystickOrigin.current.x;
    const dy = currentY - joystickOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 55;

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0px)`;
    }

    // Apply deadzone and smooth linear response curve
    const deadzone = 4;
    if (dist < deadzone) {
      liveInput.moveX = 0;
      liveInput.moveY = 0;
    } else {
      const normalizedDist = Math.min(1, (dist - deadzone) / (maxRadius - deadzone));
      const angle = Math.atan2(dy, dx);
      // Normalized movement vector: -1 to 1
      liveInput.moveX = Math.cos(angle) * normalizedDist;
      liveInput.moveY = Math.sin(angle) * normalizedDist;
    }
  }, [resetJoystick]);

  const handleJoyPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId === joystickPointerId.current || joystickPointerId.current !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      resetJoystick();
    }
  }, [resetJoystick]);

  // Camera Look Touch Handlers (Smooth, Responsive Aiming with auto-recovery)
  const handleLookPointerDown = useCallback((e: React.PointerEvent) => {
    if (lookPointerId.current !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(lookPointerId.current);
      } catch {
        // ignore
      }
      lookPointerId.current = null;
    }

    lookPointerId.current = e.pointerId;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // fallback
    }
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleLookPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerId !== lookPointerId.current) return;

    if (e.pointerType === 'mouse' && e.buttons === 0) {
      resetLook();
      return;
    }

    const dx = e.clientX - lastLookPos.current.x;
    const dy = e.clientY - lastLookPos.current.y;

    // Direct, ultra-smooth sensitivity
    const SENSITIVITY_X = 0.0055;
    const SENSITIVITY_Y = 0.0045;

    liveInput.ry -= dx * SENSITIVITY_X;

    // Pitch control (vertical look clamped between -1.28 and 1.15 rad / approx -74 deg to +66 deg)
    const currentPitch = liveInput.pitch ?? 0.15;
    liveInput.pitch = Math.max(-1.28, Math.min(1.15, currentPitch + dy * SENSITIVITY_Y));

    lastLookPos.current = { x: e.clientX, y: e.clientY };
  }, [resetLook]);

  const handleLookPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerId === lookPointerId.current || lookPointerId.current !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      resetLook();
    }
  }, [resetLook]);

  if (!myPlayer || myPlayer.isDead || gameState?.status !== 'playing') return null;

  return (
    <div className="absolute inset-0 z-10 touch-none select-none pointer-events-none overflow-hidden font-sans">
      
      {/* Damage Flash Overlay */}
      {showDamageFlash && (
        <div className="absolute inset-0 bg-red-600/35 pointer-events-none transition-opacity duration-100 z-50 mix-blend-multiply" />
      )}

      {/* Directional Damage Indicators */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 overflow-hidden">
        {damageIndicators.filter(d => Date.now() - d.timestamp < 2000).map(d => {
          const relAngle = d.angle + (liveInput.ry || myPlayer.ry);
          return (
            <div key={d.id} className="absolute w-[280px] h-[280px] pointer-events-none" style={{ transform: `rotate(${relAngle}rad)` }}>
               <div className="absolute top-0 left-1/2 w-32 h-6 -ml-16 bg-gradient-to-b from-red-500 to-transparent rounded-full opacity-90 shadow-[0_0_12px_rgba(239,68,68,0.8)]" />
            </div>
          );
        })}
      </div>

      {/* ADS Zoom Sniper Overlay (Tactical Scope & Distance Reticles) */}
      {isZoomedLocal && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          {/* Peripheral Scope Vignette */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, transparent 35%, rgba(10, 15, 30, 0.45) 75%, rgba(5, 8, 18, 0.85) 100%)'
            }}
          />
          
          {/* Precision Scope Reticle Crosshairs */}
          <div className="relative w-[340px] h-[340px] rounded-full border border-cyan-400/40 flex items-center justify-center">
            {/* Compass / Range Ticks */}
            <div className="absolute inset-0 rounded-full border border-cyan-400/20 scale-90" />
            <div className="absolute top-4 text-[9px] font-mono font-bold text-cyan-300 tracking-widest bg-slate-950/60 px-1.5 py-0.5 rounded">
              ADS ZOOM 2.5X
            </div>
            
            {/* Horizontal Subdivisions */}
            <div className="absolute w-full h-[1px] bg-cyan-400/30">
              <div className="absolute left-12 top-[-3px] h-2 w-[1px] bg-cyan-300/60" />
              <div className="absolute left-24 top-[-2px] h-1.5 w-[1px] bg-cyan-300/60" />
              <div className="absolute right-24 top-[-2px] h-1.5 w-[1px] bg-cyan-300/60" />
              <div className="absolute right-12 top-[-3px] h-2 w-[1px] bg-cyan-300/60" />
            </div>

            {/* Vertical Elevation Ticks */}
            <div className="absolute h-full w-[1px] bg-cyan-400/30">
              <div className="absolute top-14 left-[-4px] w-2.5 h-[1px] bg-cyan-300/60" />
              <div className="absolute top-24 left-[-3px] w-2 h-[1px] bg-cyan-300/60" />
              <div className="absolute bottom-24 left-[-3px] w-2 h-[1px] bg-cyan-300/60" />
              <div className="absolute bottom-14 left-[-4px] w-2.5 h-[1px] bg-cyan-300/60" />
            </div>

            {/* Tactical Corner Brackets */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-cyan-400" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-cyan-400" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-cyan-400" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-cyan-400" />
          </div>
        </div>
      )}

      {/* Precision Crosshair & Hit Marker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
        <div className="relative flex items-center justify-center">
          {/* Precise Center Dot */}
          <div className={`w-2 h-2 rounded-full transition-all duration-75 shadow-[0_0_6px_rgba(0,0,0,0.9)] border ${
            liveInput.isTargetLocked 
              ? 'bg-red-500 ring-4 ring-red-500/50 scale-125 border-red-200 shadow-[0_0_10px_rgba(239,68,68,0.9)]'
              : isZoomedLocal 
                ? 'bg-cyan-300 ring-2 ring-cyan-400/60 border-cyan-100' 
                : 'bg-white border-slate-900/60'
          }`} />

          {/* Tactical Crosshair Cross-hairs (4 Cardinal Ticks with Center Gap) */}
          <div className={`absolute w-8 h-8 pointer-events-none flex items-center justify-center transition-transform duration-75 ${
            liveInput.isTargetLocked ? 'scale-110' : ''
          }`}>
            {/* Top */}
            <div className={`absolute -top-3 w-0.5 h-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Bottom */}
            <div className={`absolute -bottom-3 w-0.5 h-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Left */}
            <div className={`absolute -left-3 h-0.5 w-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Right */}
            <div className={`absolute -right-3 h-0.5 w-2.5 shadow-[0_0_3px_rgba(0,0,0,0.8)] rounded-full transition-colors duration-75 ${
              liveInput.isTargetLocked ? 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.8)]' : isZoomedLocal ? 'bg-cyan-300' : 'bg-white/90'
            }`} />
            {/* Outer Subtle Ring */}
            <div className={`w-6 h-6 rounded-full border transition-all duration-75 ${
              liveInput.isTargetLocked 
                ? 'border-red-500/80 scale-125 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                : isZoomedLocal 
                  ? 'border-cyan-400/50' 
                  : 'border-white/20'
            }`} />
          </div>

          {/* High-Impact Hit Marker (X shape + burst ring) */}
          {showHitMarker && (
            <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in-75 duration-75">
              <div className="absolute w-8 h-1 bg-red-500 -rotate-45 shadow-[0_0_10px_rgba(239,68,68,1)] rounded-full border border-white" />
              <div className="absolute w-8 h-1 bg-red-500 rotate-45 shadow-[0_0_10px_rgba(239,68,68,1)] rounded-full border border-white" />
              <div className="absolute w-12 h-12 rounded-full border-2 border-red-400 animate-ping" />
            </div>
          )}
        </div>
      </div>

      {/* Top HUD - Optimized for mobile & notch displays */}
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex justify-between items-start text-white pointer-events-auto z-40">
        
        {/* Left Side: HP + Leave Match Button */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="bg-slate-900/85 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400">HP</span>
              <span className="text-sm sm:text-xl font-black">{Math.ceil(myPlayer.health)} / {myPlayer.maxHealth || 100}</span>
            </div>
            <div className="w-24 sm:w-36 h-2 sm:h-2.5 bg-slate-800 rounded-full mt-1 overflow-hidden border border-white/10">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-150" 
                style={{ width: `${Math.max(0, Math.min(100, (myPlayer.health / (myPlayer.maxHealth || 100)) * 100))}%` }} 
              />
            </div>
          </div>

          {/* Leave Match Mid-Game Button (途中でマッチを抜ける) */}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="bg-slate-900/85 hover:bg-red-950/80 active:scale-95 text-slate-300 hover:text-red-300 px-2.5 sm:px-3 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 hover:border-red-500/40 shadow-lg transition-all flex items-center gap-1 cursor-pointer"
            title="マッチから退出 (Leave Match)"
          >
            <LogOut size={14} className="text-red-400 sm:w-4 sm:h-4" />
            <span className="text-[10px] sm:text-xs font-bold tracking-tight">退出</span>
          </button>
        </div>

        {/* Right Side: Weapon Lv & Score */}
        <div className="bg-slate-900/85 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl backdrop-blur-md border border-white/10 shadow-lg flex gap-3 sm:gap-5 items-center">
          <div className="text-center border-r border-white/15 pr-2.5 sm:pr-5">
            <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">Weapon</div>
            <div className="font-black text-sm sm:text-lg text-amber-400">Lv {myPlayer.weaponLevel}</div>
          </div>
          <div className="text-right">
            <div className="font-black text-amber-300 text-xs sm:text-base">Score: {myPlayer.score}</div>
            <div className="text-[10px] sm:text-xs text-slate-300 font-semibold">Alive: {Object.values(gameState.players).filter(p => !p.isDead).length}</div>
          </div>
        </div>
      </div>

      {/* Leave Match Confirmation Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} className="text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-white">マッチから退出しますか？</h3>
            </div>
            
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              途中で退出するとロビーに戻ります。現在の試合スコアと生存状態はリセットされます。
            </p>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition-all active:scale-95 cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  leaveGame();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-black transition-all active:scale-95 shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer"
              >
                <LogOut size={16} />
                退出してロビーに戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimap */}
      <div className="absolute top-24 right-4 z-20 pointer-events-auto shadow-2xl">
        <Minimap />
      </div>

      {/* LEFT HALF SCREEN: Dynamic Floating Movement Joystick */}
      <div 
        ref={leftZoneRef}
        className="absolute top-0 left-0 bottom-0 w-1/2 pointer-events-auto touch-none select-none"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        onPointerDown={handleJoyPointerDown}
        onPointerMove={handleJoyPointerMove}
        onPointerUp={handleJoyPointerUp}
        onPointerCancel={handleJoyPointerUp}
        onLostPointerCapture={resetJoystick}
      >
        {/* Floating Active Joystick (positioned and transformed via refs) */}
        <div 
          ref={joyBaseRef}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none will-change-transform z-30"
          style={{ display: 'none' }}
        >
          {/* Base Ring */}
          <div className="w-32 h-32 rounded-full bg-slate-900/40 border-2 border-white/50 backdrop-blur-sm flex items-center justify-center shadow-2xl">
            {/* Inner Active Knob */}
            <div 
              ref={knobRef}
              className="w-14 h-14 rounded-full bg-white/90 border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.8)] will-change-transform"
            />
          </div>
        </div>

        {/* Subtle resting guide base at bottom-left */}
        <div 
          ref={restingBaseRef} 
          className="absolute bottom-10 left-10 pointer-events-none transition-opacity duration-150"
        >
          <div className="w-28 h-28 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <div className="w-10 h-10 rounded-full bg-white/30 border border-white/40" />
          </div>
          <div className="text-[11px] text-white/50 text-center mt-1 font-bold tracking-wider">TOUCH TO MOVE</div>
        </div>
      </div>

      {/* RIGHT HALF SCREEN: Smooth Camera Drag & Aiming */}
      <div 
        ref={rightZoneRef}
        className="absolute top-0 right-0 bottom-0 w-1/2 pointer-events-auto touch-none select-none"
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
        onLostPointerCapture={resetLook}
      />

      {/* ACTION BUTTONS (Bottom Right) */}
      <div className="absolute bottom-4 sm:bottom-8 right-3 sm:right-8 flex flex-col items-end gap-2 sm:gap-3 pointer-events-auto z-30">
        
        {/* Real-time Ability Charge & Status Tactical HUD */}
        <div className="bg-slate-900/90 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl border border-white/15 shadow-2xl flex flex-col gap-1 min-w-[150px] sm:min-w-[190px] pointer-events-none select-none">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm">{abilityInfo.icon}</span>
              <span className="text-[10px] sm:text-xs font-black text-white tracking-tight">{abilityInfo.jpName}</span>
            </div>
            <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
              isBuffActive
                ? 'bg-amber-500/90 text-slate-950 font-black animate-pulse'
                : isAbilityReady
                ? 'bg-emerald-500 text-slate-950 font-black'
                : 'bg-purple-950/80 text-purple-300 border border-purple-500/40'
            }`}>
              {isBuffActive
                ? `発動中 ${remainingBuffSec.toFixed(1)}s`
                : isAbilityReady
                ? 'READY 100%'
                : `${chargePercent}%`}
            </span>
          </div>

          {/* Real-time Charge Gauge Bar */}
          <div className="w-full h-1.5 sm:h-2 bg-slate-950/90 rounded-full overflow-hidden border border-white/10 relative">
            {isBuffActive ? (
              // Active buff remaining meter (depleting)
              <div 
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300 rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(245,158,11,0.9)]"
                style={{ width: `${Math.max(0, Math.min(100, buffRatio * 100))}%` }}
              />
            ) : (
              // Cooldown charge meter (filling)
              <div 
                className={`h-full rounded-full transition-all duration-75 ${
                  isAbilityReady 
                    ? 'bg-gradient-to-r from-purple-400 via-pink-400 to-emerald-400 shadow-[0_0_10px_rgba(168,85,247,0.9)]'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-500'
                }`}
                style={{ width: `${chargePercent}%` }}
              />
            )}
          </div>
          <div className="flex justify-between items-center text-[8px] sm:text-[9px] text-slate-400 font-semibold px-0.5">
            <span>{isBuffActive ? '効果時間' : 'チャージ'}</span>
            <span className="font-mono text-slate-200">
              {isBuffActive
                ? `${remainingBuffSec.toFixed(1)}s`
                : isAbilityReady
                ? 'READY [E]'
                : `${remainingCdSec.toFixed(1)}s`}
            </span>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex gap-1.5 sm:gap-3 items-end">
          {/* Ability Button with Radial Progress Ring */}
          <div className="relative flex items-center justify-center">
            {/* SVG Circular Progress Ring */}
            <svg className="w-16 h-16 sm:w-20 sm:h-20 -rotate-90 pointer-events-none drop-shadow-lg" viewBox="0 0 76 76">
              {/* Background Track */}
              <circle
                cx="38"
                cy="38"
                r="32"
                className="stroke-slate-950/80"
                strokeWidth="5"
                fill="none"
              />
              {/* Progress Stroke */}
              <circle
                cx="38"
                cy="38"
                r="32"
                className={`transition-all duration-75 ${
                  isBuffActive
                    ? 'stroke-amber-400 shadow-[0_0_12px_rgba(251,191,36,1)]'
                    : isAbilityReady
                    ? 'stroke-purple-400'
                    : 'stroke-indigo-500'
                }`}
                strokeWidth="5"
                strokeDasharray={201.06}
                strokeDashoffset={
                  isBuffActive
                    ? 201.06 * (1 - buffRatio)
                    : 201.06 * (1 - chargeRatio)
                }
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <button 
              type="button"
              disabled={!isAbilityReady && !isBuffActive}
              className={`absolute w-13 h-13 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all active:scale-95 ${
                isBuffActive
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-4 ring-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.9)] animate-pulse'
                  : isAbilityReady
                  ? isAbilityActive
                    ? 'bg-purple-600 scale-95 ring-4 ring-purple-400/80 shadow-[0_0_20px_rgba(168,85,247,0.9)]'
                    : 'bg-gradient-to-br from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] cursor-pointer'
                  : 'bg-slate-800/90 text-slate-400 cursor-not-allowed opacity-80'
              }`}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (isAbilityReady) {
                  liveInput.useAbility = true;
                  setInput({ useAbility: true });
                  setIsAbilityActive(true);
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                liveInput.useAbility = false;
                setInput({ useAbility: false });
                setIsAbilityActive(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                liveInput.useAbility = false;
                setInput({ useAbility: false });
                setIsAbilityActive(false);
              }}
            >
              {isBuffActive ? (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-lg sm:text-xl animate-bounce">{abilityInfo.icon}</span>
                  <span className="text-[8px] sm:text-[9px] font-black text-slate-950 bg-amber-300 px-1 rounded tracking-tighter">
                    {remainingBuffSec.toFixed(1)}s
                  </span>
                </div>
              ) : isAbilityReady ? (
                <div className="flex flex-col items-center justify-center">
                  <Zap size={18} className="text-purple-100 drop-shadow sm:w-5 sm:h-5" />
                  <span className="text-[8px] sm:text-[10px] font-black tracking-wider uppercase text-purple-100">READY</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <span className="text-sm sm:text-base opacity-75">{abilityInfo.icon}</span>
                  <span className="text-[9px] sm:text-[10px] font-mono font-black text-purple-300">
                    {remainingCdSec.toFixed(1)}s
                  </span>
                </div>
              )}
            </button>

            {/* Charge percentage floating mini-badge */}
            <div className={`absolute -top-1 -right-1 text-[8px] sm:text-[9px] font-black px-1 sm:px-1.5 py-0.5 rounded-full border shadow-md ${
              isBuffActive
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : isAbilityReady
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 animate-bounce'
                : 'bg-slate-900 text-purple-300 border-purple-400/50'
            }`}>
              {isBuffActive ? 'ACTIVE' : isAbilityReady ? '100%' : `${chargePercent}%`}
            </div>
          </div>

          {/* Dodge Roll Button (ローリング / 回避) */}
          <div className="relative flex items-center justify-center">
            {/* SVG Circular Progress Ring */}
            <svg className="w-14 h-14 sm:w-18 sm:h-18 -rotate-90 pointer-events-none drop-shadow-md" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r="28" className="stroke-slate-950/80" strokeWidth="4" fill="none" />
              <circle
                cx="34"
                cy="34"
                r="28"
                className={`transition-all duration-75 ${
                  isRollReady ? 'stroke-cyan-400' : 'stroke-slate-600'
                }`}
                strokeWidth="4"
                strokeDasharray={175.93}
                strokeDashoffset={175.93 * (1 - rollChargeRatio)}
                strokeLinecap="round"
                fill="none"
              />
            </svg>

            <button
              type="button"
              disabled={!isRollReady}
              className={`absolute w-11 h-11 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all border-2 border-cyan-400/50 active:scale-95 ${
                isRollReady
                  ? isRollingActive
                    ? 'bg-cyan-600 scale-95 ring-4 ring-cyan-400/80 shadow-[0_0_18px_rgba(6,182,212,0.9)]'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.6)] cursor-pointer'
                  : 'bg-slate-800/85 text-slate-500 cursor-not-allowed opacity-75'
              }`}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (isRollReady) {
                  liveInput.isRolling = true;
                  setInput({ isRolling: true });
                  setIsRollingActive(true);
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                liveInput.isRolling = false;
                setInput({ isRolling: false });
                setIsRollingActive(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                liveInput.isRolling = false;
                setInput({ isRolling: false });
                setIsRollingActive(false);
              }}
            >
              <Wind size={16} className="text-cyan-100 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[9px] font-black tracking-tight uppercase mt-0.5">
                {isRollReady ? 'ROLL' : `${remainingRollCdSec.toFixed(1)}s`}
              </span>
            </button>
            <div className="absolute -bottom-2 text-[7px] sm:text-[8px] font-black bg-slate-900/90 text-cyan-300 px-1 rounded border border-cyan-500/40 pointer-events-none">
              Space
            </div>
          </div>

          {/* Heal Button */}
          <div className="relative">
            <button 
              type="button"
              className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all border-2 border-emerald-300/40 active:scale-95 cursor-pointer ${
                myPlayer.heals > 0 
                  ? isHealingActive 
                    ? 'bg-emerald-600 scale-95 ring-4 ring-emerald-400/50' 
                    : 'bg-emerald-500/85 hover:bg-emerald-600'
                  : 'bg-slate-700/60 opacity-40 cursor-not-allowed'
              }`}
              disabled={myPlayer.heals <= 0}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (myPlayer.heals > 0) {
                  liveInput.isHealing = true;
                  setInput({ isHealing: true });
                  setIsHealingActive(true);
                }
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                liveInput.isHealing = false;
                setInput({ isHealing: false });
                setIsHealingActive(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                liveInput.isHealing = false;
                setInput({ isHealing: false });
                setIsHealingActive(false);
              }}
            >
              <PlusCircle size={16} className="text-emerald-100 sm:w-4 sm:h-4" />
              <span className="text-[8px] sm:text-[9px] font-black tracking-tighter uppercase">Heal</span>
            </button>
            {myPlayer.heals > 0 && (
              <div className="absolute -top-1 -right-1 bg-slate-900 text-emerald-400 text-[10px] sm:text-xs font-black w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-emerald-400 shadow-md">
                {myPlayer.heals}
              </div>
            )}
          </div>

          {/* Aim Zoom Button (エイムの拡大ボタン / ADS) */}
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-all border-2 active:scale-95 cursor-pointer ${
                isZoomedLocal
                  ? 'bg-cyan-500 border-cyan-200 ring-4 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.9)] scale-95'
                  : 'bg-slate-800/90 hover:bg-slate-700/90 border-cyan-400/50 text-cyan-100'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleZoom();
              }}
            >
              <ZoomIn size={16} className={isZoomedLocal ? 'text-slate-950 font-black sm:w-5 sm:h-5' : 'text-cyan-300 sm:w-5 sm:h-5'} />
              <span className={`text-[8px] sm:text-[9px] font-black tracking-tighter uppercase mt-0.5 ${
                isZoomedLocal ? 'text-slate-950' : 'text-cyan-200'
              }`}>
                {isZoomedLocal ? 'ZOOM' : 'ADS'}
              </span>
            </button>
            <div className="absolute -bottom-2 text-[7px] sm:text-[8px] font-black bg-slate-900/90 text-cyan-300 px-1 rounded border border-cyan-500/40 pointer-events-none">
              Zoom
            </div>
          </div>

          {/* Shoot Button (Enlarged High-Impact Fire Button / 射撃ボタン) */}
          <button 
            type="button"
            className={`w-18 h-18 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all border-3 border-red-300/60 active:scale-95 cursor-pointer select-none ${
              isShootingActive 
                ? 'bg-red-600 scale-95 ring-6 ring-red-400/80 shadow-[0_0_35px_rgba(239,68,68,0.95)]' 
                : 'bg-gradient-to-br from-red-500 to-rose-700 hover:from-red-400 hover:to-rose-600 shadow-[0_0_20px_rgba(239,68,68,0.7)]'
            }`}
            onPointerDown={(e) => {
              e.stopPropagation();
              liveInput.isShooting = true;
              setInput({ isShooting: true });
              setIsShootingActive(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              liveInput.isShooting = false;
              setInput({ isShooting: false });
              setIsShootingActive(false);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              liveInput.isShooting = false;
              setInput({ isShooting: false });
              setIsShootingActive(false);
            }}
          >
            <Target size={32} className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:w-11 sm:h-11" />
            <span className="text-[10px] sm:text-[12px] font-black tracking-widest uppercase mt-0.5 drop-shadow">FIRE</span>
          </button>
        </div>

      </div>

    </div>
  );
}
