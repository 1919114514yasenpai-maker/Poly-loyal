import React, { useRef, useEffect } from 'react';
import { useGameStore, liveInput, triggerAttackEvent } from '../store';
import { CLASS_STATS, getGroundHeight, getNearbyObstaclesClient, CharacterClass } from '../types';
import { setThreeCameraForProjection } from './DamagePopupsOverlay';
import { playShootSound, playHitSound, playRollSound } from '../utils/audio';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  MathUtils,
  CapsuleGeometry,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  PlaneGeometry,
  RingGeometry,
  ConeGeometry,
  DodecahedronGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
} from 'three';

const TICK_RATE = 1 / 20; // 20 times per second

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// STATIC SINGLETON GEOMETRIES & MATERIALS FOR LOCAL PLAYER
// ----------------------------------------------------------------------------
const localBodyGeo = new CapsuleGeometry(0.5, 1, 4, 8);
const localVisorGeo = new BoxGeometry(0.6, 0.2, 0.2);
const localVisorMat = new MeshStandardMaterial({ color: '#111827', roughness: 0.2 });

const localBodyMats: Record<string, MeshStandardMaterial> = {
  '#ef4444': new MeshStandardMaterial({ color: '#ef4444', roughness: 0.4, metalness: 0.2 }),
  '#3b82f6': new MeshStandardMaterial({ color: '#3b82f6', roughness: 0.4, metalness: 0.2 }),
  '#eab308': new MeshStandardMaterial({ color: '#eab308', roughness: 0.4, metalness: 0.2 }),
  '#f59e0b': new MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4, metalness: 0.2 }),
  '#10b981': new MeshStandardMaterial({ color: '#10b981', roughness: 0.4, metalness: 0.2 }),
  '#38bdf8': new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.4, metalness: 0.2 }),
  '#a855f7': new MeshStandardMaterial({ color: '#a855f7', roughness: 0.4, metalness: 0.2 }),
  '#0284c7': new MeshStandardMaterial({ color: '#0284c7', roughness: 0.4, metalness: 0.2 }),
};
const defaultLocalBodyMat = localBodyMats['#ef4444'];

const localGliderWingGeo = new BoxGeometry(3.2, 0.08, 1.4);
const localGliderWingMats: Record<string, MeshStandardMaterial> = {
  '#ef4444': new MeshStandardMaterial({ color: '#ef4444', roughness: 0.3, metalness: 0.4 }),
  '#3b82f6': new MeshStandardMaterial({ color: '#3b82f6', roughness: 0.3, metalness: 0.4 }),
  '#eab308': new MeshStandardMaterial({ color: '#eab308', roughness: 0.3, metalness: 0.4 }),
  '#f59e0b': new MeshStandardMaterial({ color: '#f59e0b', roughness: 0.3, metalness: 0.4 }),
  '#10b981': new MeshStandardMaterial({ color: '#10b981', roughness: 0.3, metalness: 0.4 }),
  '#38bdf8': new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.3, metalness: 0.4 }),
  '#a855f7': new MeshStandardMaterial({ color: '#a855f7', roughness: 0.3, metalness: 0.4 }),
  '#0284c7': new MeshStandardMaterial({ color: '#0284c7', roughness: 0.3, metalness: 0.4 }),
};
const defaultLocalGliderWingMat = localGliderWingMats['#ef4444'];

const localGliderTipGeo = new BoxGeometry(0.6, 0.06, 1.3);
const localGliderTipMat = new MeshStandardMaterial({ color: '#0f172a' });
const localGliderStrutGeo = new CylinderGeometry(0.04, 0.04, 1.2, 6);
const localGliderStrutMat = new MeshStandardMaterial({ color: '#334155', metalness: 0.8 });
const localGliderBarGeo = new CylinderGeometry(0.04, 0.04, 1.0, 6);
const localGliderBarMat = new MeshStandardMaterial({ color: '#f59e0b' });
const localGliderJetGeo = new CylinderGeometry(0.08, 0.08, 0.3, 6);
const localGliderJetMat = new MeshStandardMaterial({ color: '#1e293b' });

const localSwordHiltGeo = new CylinderGeometry(0.04, 0.04, 0.35, 6);
const localSwordHiltMat = new MeshStandardMaterial({ color: '#0f172a', roughness: 0.6 });
const localSwordGuardGeo = new CylinderGeometry(0.14, 0.14, 0.03, 8);
const localSwordGuardMat = new MeshStandardMaterial({ color: '#f59e0b', metalness: 0.8, roughness: 0.3 });
const localSwordBladeGeo = new BoxGeometry(0.05, 1.7, 0.02);
const localSwordBladeMat = new MeshStandardMaterial({ color: '#f1f5f9', metalness: 0.9, roughness: 0.1 });
const localSwordEdgeGeo = new BoxGeometry(0.015, 1.72, 0.025);
const localSwordEdgeMat = new MeshBasicMaterial({ color: '#ef4444' });

const localGunBodyGeo = new BoxGeometry(0.14, 0.22, 0.55);
const localGunBodyMat = new MeshStandardMaterial({ color: '#1e293b', metalness: 0.5, roughness: 0.4 });
const localGunBarrelGeo = new CylinderGeometry(0.05, 0.05, 0.45, 6);
const localGunBarrelMat = new MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 });
const localGunAccentGeo = new BoxGeometry(0.08, 0.04, 0.35);

const localGunAccentMats: Record<string, MeshBasicMaterial> = {
  '#ef4444': new MeshBasicMaterial({ color: '#ef4444' }),
  '#3b82f6': new MeshBasicMaterial({ color: '#3b82f6' }),
  '#eab308': new MeshBasicMaterial({ color: '#eab308' }),
  '#f59e0b': new MeshBasicMaterial({ color: '#f59e0b' }),
  '#10b981': new MeshBasicMaterial({ color: '#10b981' }),
  '#38bdf8': new MeshBasicMaterial({ color: '#38bdf8' }),
  '#a855f7': new MeshBasicMaterial({ color: '#a855f7' }),
  '#0284c7': new MeshBasicMaterial({ color: '#0284c7' }),
};
const defaultLocalGunAccentMat = localGunAccentMats['#ef4444'];

// Wizard Staff
const localStaffShaftGeo = new CylinderGeometry(0.035, 0.035, 1.4, 6);
const localStaffShaftMat = new MeshStandardMaterial({ color: '#4a044e', roughness: 0.5 });
const localStaffHeadGeo = new DodecahedronGeometry(0.16);
const localStaffHeadMat = new MeshStandardMaterial({ color: '#f97316', emissive: '#ea580c', emissiveIntensity: 1.2 });

// Sniper Rifle
const localSniperBodyGeo = new BoxGeometry(0.12, 0.18, 0.85);
const localSniperBarrelGeo = new CylinderGeometry(0.03, 0.03, 1.1, 8);
const localSniperScopeGeo = new CylinderGeometry(0.06, 0.06, 0.35, 8);
const localSniperScopeMat = new MeshStandardMaterial({ color: '#0284c7', metalness: 0.8, roughness: 0.2 });

// Lance
const localLanceShaftGeo = new CylinderGeometry(0.04, 0.04, 2.4, 6);
const localLanceShaftMat = new MeshStandardMaterial({ color: '#78350f', roughness: 0.6 });
const localLanceTipGeo = new ConeGeometry(0.14, 0.65, 8);
const localLanceTipMat = new MeshStandardMaterial({ color: '#f59e0b', metalness: 0.9, roughness: 0.2, emissive: '#b45309', emissiveIntensity: 0.4 });
const localLanceGuardGeo = new CylinderGeometry(0.24, 0.24, 0.06, 8);
const localLanceGuardMat = new MeshStandardMaterial({ color: '#d97706', metalness: 0.8 });

// Lance thrust indicator
const lanceAreaGeo = new PlaneGeometry(2.5, 18);
const lanceAreaMat = new MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.15, side: 2 });

// Hitbox indicators
const swordAreaGeo = new RingGeometry(0.4, 15, 24, 1, -Math.PI / 3, (2 * Math.PI) / 3);
const swordAreaMat = new MeshBasicMaterial({ color: '#f87171', transparent: true, opacity: 0.12, depthWrite: false, side: 2 });
const swordEdgeArcGeo = new RingGeometry(14.6, 15.0, 24, 1, -Math.PI / 3, (2 * Math.PI) / 3);
const swordEdgeArcMat = new MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.55, depthWrite: false, side: 2 });

const shieldGeo = new SphereGeometry(1.5, 8, 8);
const shieldMat = new MeshStandardMaterial({ color: '#fbbf24', transparent: true, opacity: 0.3, emissive: '#fbbf24', emissiveIntensity: 0.5 });
const invulnGeo = new CylinderGeometry(1, 1, 2.5, 8);
const invulnMat = new MeshStandardMaterial({ color: '#ef4444', transparent: true, opacity: 0.4, emissive: '#ef4444', emissiveIntensity: 1 });
const healGeo = new CylinderGeometry(0.8, 0.8, 2, 8);
const healMat = new MeshStandardMaterial({ color: '#22c55e', transparent: true, opacity: 0.3, emissive: '#22c55e', emissiveIntensity: 0.8 });

export function LocalPlayer() {
  const myId = useGameStore((s) => s.myId);
  const sendInput = useGameStore((s) => s.sendInput);
  const isFirstPerson = useGameStore((s) => s.isFirstPerson);
  
  const playerRef = useRef<Group>(null);
  const innerMeshRef = useRef<Group>(null);
  const bodyGroupRef = useRef<Group>(null);
  const weaponRef = useRef<Group>(null);
  const gliderRef = useRef<Group>(null);
  const aimIndicatorRef = useRef<Group>(null);
  const shieldRef = useRef<Mesh>(null);
  const invulnRef = useRef<Mesh>(null);
  const healRef = useRef<Mesh>(null);

  const { camera } = useThree();
  const lastSend = useRef(0);
  const lastLocalShoot = useRef(0);
  const attackAnimTime = useRef(-10);
  const rollStartTime = useRef(-10);
  const rollDir = useRef({ x: 0, z: -1 });
  const fallVelocity = useRef(0);
  const autoDeployedRef = useRef(false);
  const flightAltitude = useRef<number | null>(null);

  // Smooth camera state
  const camPos = useRef(new Vector3(0, 5, 10));
  const lookTarget = useRef(new Vector3(0, 1.5, 0));
  const camWorldDir = useRef(new Vector3());

  // Static visual metadata - only changes when player respawns or changes class
  const staticMeta = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? `${p.color}_${p.characterClass}` : 'blue_melee';
  });
  const [color, characterClass] = (staticMeta || 'blue_melee').split('_') as [string, CharacterClass];

  const isDead = useGameStore((s) => {
    const p = s.myId && s.gameState ? s.gameState.players[s.myId] : null;
    return p ? p.isDead : true;
  });

  const spectateTargetId = useGameStore((s) => s.spectateTargetId);
  const setFps = useGameStore((s) => s.setFps);
  const frameCountRef = React.useRef(0);
  const lastFpsCalcRef = React.useRef(performance.now());

  useFrame((state, delta) => {
    // Measure FPS
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastFpsCalcRef.current >= 1000) {
      const calcFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsCalcRef.current));
      setFps(calcFps);
      frameCountRef.current = 0;
      lastFpsCalcRef.current = now;
    }

    setThreeCameraForProjection(state.camera);
    const gameState = useGameStore.getState().gameState;
    const myPlayerFull = myId && gameState ? gameState.players[myId] : null;

    const dt = Math.min(delta, 0.1);
    const nowTime = state.clock.elapsedTime;

    // If dead and spectating another player, smoothly follow target
    if (!myPlayerFull || myPlayerFull.isDead) {
      if (spectateTargetId && gameState?.players[spectateTargetId]) {
        const target = gameState.players[spectateTargetId];
        const camFollowSpeed = 1 - Math.exp(-14 * dt);
        const idealCamX = target.x + Math.sin(target.ry) * 9;
        const idealCamY = target.y + 4;
        const idealCamZ = target.z + Math.cos(target.ry) * 9;

        camPos.current.x = MathUtils.lerp(camPos.current.x, idealCamX, camFollowSpeed);
        camPos.current.y = MathUtils.lerp(camPos.current.y, idealCamY, camFollowSpeed);
        camPos.current.z = MathUtils.lerp(camPos.current.z, idealCamZ, camFollowSpeed);

        lookTarget.current.x = MathUtils.lerp(lookTarget.current.x, target.x, camFollowSpeed);
        lookTarget.current.y = MathUtils.lerp(lookTarget.current.y, target.y + 1.4, camFollowSpeed);
        lookTarget.current.z = MathUtils.lerp(lookTarget.current.z, target.z, camFollowSpeed);

        camera.position.copy(camPos.current);
        camera.lookAt(lookTarget.current);
      }
      return;
    }

    if (!playerRef.current) return;

    const yaw = liveInput.ry;
    // Expanded vertical pitch range: -1.28 rad (looking high up ~74 deg) to +1.15 rad (looking down ~66 deg)
    const pitch = Math.max(-1.28, Math.min(1.15, liveInput.pitch ?? 0.0));

    // Rotate player root mesh to face look direction (yaw)
    playerRef.current.rotation.y = yaw;

    // If inside Battle Bus, follow the bus path cinematics and allow jumping
    if (myPlayerFull.inBus && gameState?.battleBus) {
      const bus = gameState.battleBus;
      const busDx = bus.endX - bus.startX;
      const busDz = bus.endZ - bus.startZ;
      const busAngle = Math.atan2(busDx, busDz);

      // Smooth camera follow without stutter
      const camFollowSpeed = 1 - Math.exp(-10 * dt);
      const idealCamX = bus.currentX - Math.sin(busAngle) * 28;
      const idealCamY = bus.currentY + 12;
      const idealCamZ = bus.currentZ - Math.cos(busAngle) * 28;

      camPos.current.x = MathUtils.lerp(camPos.current.x, idealCamX, camFollowSpeed);
      camPos.current.y = MathUtils.lerp(camPos.current.y, idealCamY, camFollowSpeed);
      camPos.current.z = MathUtils.lerp(camPos.current.z, idealCamZ, camFollowSpeed);

      lookTarget.current.x = MathUtils.lerp(lookTarget.current.x, bus.currentX + Math.sin(busAngle) * 15, camFollowSpeed);
      lookTarget.current.y = MathUtils.lerp(lookTarget.current.y, bus.currentY - 2, camFollowSpeed);
      lookTarget.current.z = MathUtils.lerp(lookTarget.current.z, bus.currentZ + Math.cos(busAngle) * 15, camFollowSpeed);

      camera.position.copy(camPos.current);
      camera.lookAt(lookTarget.current);

      playerRef.current.position.set(bus.currentX, bus.currentY, bus.currentZ);
      liveInput.x = bus.currentX;
      liveInput.y = bus.currentY;
      liveInput.z = bus.currentZ;

      if (nowTime - lastSend.current > TICK_RATE) {
        lastSend.current = nowTime;
        sendInput();
      }
      return;
    }

    // --- SKYDIVING & GLIDER FLIGHT SIMULATION ---
    if (myPlayerFull.isSkydiving || myPlayerFull.isGliding) {
      const isGliding = !!myPlayerFull.isGliding;
      const forwardSpeed = isGliding ? 26 : 18;
      const fallSpeed = isGliding ? 12 : 38;

      // Pitch and Yaw steering
      const joyX = liveInput.moveX;
      const joyY = liveInput.moveY;
      
      let moveDirX = -Math.sin(yaw);
      let moveDirZ = -Math.cos(yaw);

      if (Math.abs(joyX) > 0.01 || Math.abs(joyY) > 0.01) {
        moveDirX = Math.sin(yaw) * joyY + Math.cos(yaw) * joyX;
        moveDirZ = Math.cos(yaw) * joyY - Math.sin(yaw) * joyX;
        const mag = Math.hypot(moveDirX, moveDirZ);
        if (mag > 0.01) {
          moveDirX /= mag;
          moveDirZ /= mag;
        }
      }

      let testX = playerRef.current.position.x + moveDirX * forwardSpeed * dt;
      let testZ = playerRef.current.position.z + moveDirZ * forwardSpeed * dt;
      let testY = playerRef.current.position.y - fallSpeed * dt;

      // Check building wall collisions during airborne gliding/skydiving so player bounces/slides down alongside walls
      if (gameState?.obstacles) {
        const PLAYER_RADIUS = 0.9;
        const nearbyObs = getNearbyObstaclesClient(testX, testZ, 12, gameState.obstacles);
        for (let i = 0; i < nearbyObs.length; i++) {
          const obs = nearbyObs[i];
          if (obs.type === 'ramp') continue;
          // Only collide if building roof is taller than player's feet
          if (obs.height > testY - 0.5) {
            const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
            const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
            const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
            const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

            if (testX > obsMinX && testX < obsMaxX && testZ > obsMinZ && testZ < obsMaxZ) {
              if (Math.abs(playerRef.current.position.x - obs.x) > obs.width / 2 + PLAYER_RADIUS) {
                testX = playerRef.current.position.x;
              }
              if (Math.abs(playerRef.current.position.z - obs.z) > obs.depth / 2 + PLAYER_RADIUS) {
                testZ = playerRef.current.position.z;
              }
            }
          }
        }
      }

      playerRef.current.position.x = MathUtils.clamp(testX, -195, 195);
      playerRef.current.position.z = MathUtils.clamp(testZ, -195, 195);
      playerRef.current.position.y = testY;

      // Pass current Y to getGroundHeight so buildings above player's altitude are ignored
      const groundH = gameState?.obstacles ? getGroundHeight(playerRef.current.position.x, playerRef.current.position.z, gameState.obstacles, playerRef.current.position.y) : 0;
      
      // Auto-deploy glider ONCE near ground if skydiving
      if (myPlayerFull.inBus || playerRef.current.position.y <= groundH + 1.2) {
        autoDeployedRef.current = false;
      }
      if (!autoDeployedRef.current && myPlayerFull.isSkydiving && playerRef.current.position.y < groundH + 12) {
        autoDeployedRef.current = true;
        liveInput.toggleGlider = true;
      }

      // Smooth landing check - prevent falling below terrain
      if (playerRef.current.position.y <= groundH + 1.0) {
        playerRef.current.position.y = groundH + 1.0;
        fallVelocity.current = 0;
        liveInput.x = playerRef.current.position.x;
        liveInput.y = groundH + 1.0;
        liveInput.z = playerRef.current.position.z;
        sendInput();
      }

      // Tilt body forwards when skydiving
      if (innerMeshRef.current) {
        innerMeshRef.current.rotation.x = isGliding ? 0.2 : 1.1;
      }
    } else {
      // --- NORMAL GROUND COMBAT MOVEMENT ---
    // Movement calculation
    const joyX = liveInput.moveX;
    const joyY = liveInput.moveY;

    let mx = 0;
    let mz = 0;

    if (Math.abs(joyX) > 0.01 || Math.abs(joyY) > 0.01) {
      mx = Math.sin(yaw) * joyY + Math.cos(yaw) * joyX;
      mz = Math.cos(yaw) * joyY - Math.sin(yaw) * joyX;

      const mag = Math.hypot(mx, mz);
      if (mag > 1) {
        mx /= mag;
        mz /= mag;
      }
    }

    // --- DODGE ROLL MECHANIC ---
    const timeSinceRoll = nowTime - rollStartTime.current;
    const isRolling = timeSinceRoll < 0.35;

    if (liveInput.isRolling && timeSinceRoll > 1.8 && !liveInput.isClimbing) {
      rollStartTime.current = nowTime;
      playRollSound();
      // Determine roll direction: current moving direction or forward facing
      if (Math.hypot(mx, mz) > 0.1) {
        const mag = Math.hypot(mx, mz);
        rollDir.current = { x: mx / mag, z: mz / mag };
      } else {
        rollDir.current = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      }
    }

    // Base speed
    let baseSpeed = 15;
    if (myPlayerFull.characterClass === 'scout') baseSpeed = 22;
    else if (myPlayerFull.characterClass === 'tank') baseSpeed = 10;
    else if (myPlayerFull.characterClass === 'sword') {
      baseSpeed = 16;
      if (myPlayerFull.isInvulnerable) baseSpeed *= 1.8; // Blade Barrier dash boost
    } else if (myPlayerFull.characterClass === 'wizard') baseSpeed = 13;
    else if (myPlayerFull.characterClass === 'sniper') baseSpeed = 16;
    else if (myPlayerFull.characterClass === 'lance') baseSpeed = 17;

    if (isRolling) {
      baseSpeed *= 2.4; // 240% speed boost during dodge roll
    }

    const moveVectorX = isRolling ? rollDir.current.x : mx;
    const moveVectorZ = isRolling ? rollDir.current.z : mz;

    const PLAYER_RADIUS = 0.9;
    const currentX = playerRef.current.position.x;
    const currentY = playerRef.current.position.y;
    const currentZ = playerRef.current.position.z;
    const currentFootY = currentY - 1.0;

    // Strict step-up limit: 0.35m during roll so roll NEVER climbs or skips walls; 0.65m for normal stairs
    const stepUpLimit = isRolling ? 0.35 : 0.65;

    // Wall climbing check (rolling closely into a wall immediately cancels roll and initiates climb)
    let isClimbing = false;
    let climbTargetTopY = 0;
    const isPushing = Math.hypot(mx, mz) > 0.1 || isRolling;

    if (!myPlayerFull.isFlying && !myPlayerFull.inBus && !myPlayerFull.isDead && isPushing && gameState?.obstacles) {
      const nearbyObs = getNearbyObstaclesClient(currentX, currentZ, 3.5, gameState.obstacles);
      for (let i = 0; i < nearbyObs.length; i++) {
        const obs = nearbyObs[i];
        if (obs.type === 'ramp') continue;
        if (obs.height > currentFootY + 0.6) {
          const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
          const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
          const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
          const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

          // Check if player is right against this wall surface
          const isNearWall = currentX >= obsMinX - 0.4 && currentX <= obsMaxX + 0.4 &&
                             currentZ >= obsMinZ - 0.4 && currentZ <= obsMaxZ + 0.4;
          if (isNearWall) {
            isClimbing = true;
            climbTargetTopY = obs.height + 1.0;
            // Roll is canceled immediately upon contacting wall
            if (isRolling) {
              rollStartTime.current = 0;
            }
            break;
          }
        }
      }
    }
    liveInput.isClimbing = isClimbing;

    // 3D Somersault flip animation during roll or leaning into wall when climbing
    if (innerMeshRef.current) {
      if (isRolling) {
        const rollProgress = timeSinceRoll / 0.35;
        innerMeshRef.current.rotation.x = -rollProgress * Math.PI * 2;
      } else if (isClimbing) {
        innerMeshRef.current.rotation.x = MathUtils.lerp(innerMeshRef.current.rotation.x, -0.35, 1 - Math.exp(-20 * dt));
      } else {
        innerMeshRef.current.rotation.x = MathUtils.lerp(innerMeshRef.current.rotation.x, 0, 1 - Math.exp(-20 * dt));
      }
    }

    // 1. Move along X axis and slide smoothly along obstacles
    let moveX = moveVectorX * baseSpeed * dt;
    let testX = currentX + moveX;

    if (gameState?.obstacles && Math.abs(moveX) > 0.0001) {
      const targetGroundX = getGroundHeight(testX, currentZ, gameState.obstacles);
      const nearbyObs = getNearbyObstaclesClient(testX, currentZ, 12, gameState.obstacles);
      for (let i = 0; i < nearbyObs.length; i++) {
        const obs = nearbyObs[i];
        if (obs.type === 'ramp') continue;

        // If target ground height climbs onto this obstacle or if foot is already at/near top
        if (targetGroundX >= obs.height - 0.2 || currentFootY >= obs.height - stepUpLimit) {
          continue;
        }

        // Fast proximity rejection
        if (Math.abs(testX - obs.x) > (obs.width / 2 + PLAYER_RADIUS + 2) || Math.abs(currentZ - obs.z) > (obs.depth / 2 + PLAYER_RADIUS + 2)) {
          continue;
        }

        const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
        const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
        const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
        const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

        if (testX > obsMinX && testX < obsMaxX && currentZ > obsMinZ && currentZ < obsMaxZ) {
          // If moving outward away from obstacle (stepping off cliff/ledge), allow smooth descent
          if (moveX > 0 && currentX >= obs.x + obs.width / 2) {
            continue;
          }
          if (moveX < 0 && currentX <= obs.x - obs.width / 2) {
            continue;
          }

          // Slide along wall by stopping X movement
          if (moveX > 0) {
            testX = obsMinX;
          } else {
            testX = obsMaxX;
          }
        }
      }
    }

    // 2. Move along Z axis and slide smoothly along obstacles
    let moveZ = moveVectorZ * baseSpeed * dt;
    let testZ = currentZ + moveZ;

    if (gameState?.obstacles && Math.abs(moveZ) > 0.0001) {
      const targetGroundZ = getGroundHeight(testX, testZ, gameState.obstacles);
      const nearbyObs = getNearbyObstaclesClient(testX, testZ, 12, gameState.obstacles);
      for (let i = 0; i < nearbyObs.length; i++) {
        const obs = nearbyObs[i];
        if (obs.type === 'ramp') continue;

        // If target ground height climbs onto this obstacle or if foot is already at/near top
        if (targetGroundZ >= obs.height - 0.2 || currentFootY >= obs.height - stepUpLimit) {
          continue;
        }

        if (Math.abs(testX - obs.x) > (obs.width / 2 + PLAYER_RADIUS + 2) || Math.abs(testZ - obs.z) > (obs.depth / 2 + PLAYER_RADIUS + 2)) {
          continue;
        }

        const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
        const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
        const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
        const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

        if (testX > obsMinX && testX < obsMaxX && testZ > obsMinZ && testZ < obsMaxZ) {
          // If moving outward away from obstacle (stepping off cliff/ledge), allow smooth descent
          if (moveZ > 0 && currentZ >= obs.z + obs.depth / 2) {
            continue;
          }
          if (moveZ < 0 && currentZ <= obs.z - obs.depth / 2) {
            continue;
          }

          // Slide along wall by stopping Z movement
          if (moveZ > 0) {
            testZ = obsMinZ;
          } else {
            testZ = obsMaxZ;
          }
        }
      }
    }

    // 3. Safety anti-stuck de-penetration pass
    if (gameState?.obstacles) {
      const targetGroundFinal = getGroundHeight(testX, testZ, gameState.obstacles);
      for (const obs of Object.values(gameState.obstacles)) {
        if (obs.type === 'ramp') continue;
        if (targetGroundFinal >= obs.height - 0.2 || currentFootY >= obs.height - stepUpLimit) continue;

        const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
        const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
        const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
        const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

        if (testX > obsMinX && testX < obsMaxX && testZ > obsMinZ && testZ < obsMaxZ) {
          const distLeft = testX - obsMinX;
          const distRight = obsMaxX - testX;
          const distTop = testZ - obsMinZ;
          const distBottom = obsMaxZ - testZ;
          const min = Math.min(distLeft, distRight, distTop, distBottom);

          if (min === distLeft) testX = obsMinX;
          else if (min === distRight) testX = obsMaxX;
          else if (min === distTop) testZ = obsMinZ;
          else if (min === distBottom) testZ = obsMaxZ;
        }
      }
    }

    // Bounds check
    playerRef.current.position.x = MathUtils.clamp(testX, -195, 195);
    playerRef.current.position.z = MathUtils.clamp(testZ, -195, 195);

    // Dynamic ground and slope response with smooth step-up
    const groundH = gameState?.obstacles ? getGroundHeight(playerRef.current.position.x, playerRef.current.position.z, gameState.obstacles) : 0;
    
    // Scout Jetpack flight altitude (ascends up to groundH + 45m with Space/Jump)
    let targetY = groundH + 1;
    if (myPlayerFull.isFlying) {
      const maxFlightY = groundH + 45;
      const minFlightY = groundH + 3.5;
      const cruiseY = groundH + 22;

      if (flightAltitude.current === null) {
        flightAltitude.current = Math.max(playerRef.current.position.y, cruiseY);
      }

      // If holding jump (Space on PC or mobile jump), ascend swiftly!
      if (liveInput.isRolling) {
        flightAltitude.current = Math.min(maxFlightY, flightAltitude.current + 22 * dt);
      } else {
        // Slow gentle descent down to cruise / hover altitude
        flightAltitude.current = Math.max(minFlightY, flightAltitude.current - 6 * dt);
      }
      targetY = flightAltitude.current;
    } else {
      flightAltitude.current = null;
    }

    if (isClimbing) {
      fallVelocity.current = 0;
      // Climbing upward speed: 7.5 m/s
      playerRef.current.position.y += 7.5 * dt;
      if (playerRef.current.position.y >= climbTargetTopY) {
        playerRef.current.position.y = climbTargetTopY;
        liveInput.isClimbing = false;
      }
    } else if (myPlayerFull.isFlying) {
      playerRef.current.position.y = MathUtils.lerp(playerRef.current.position.y, targetY, 1 - Math.exp(-14 * dt));
      fallVelocity.current = 0;
    } else if (playerRef.current.position.y < targetY) {
      // Smoothly and swiftly walk up ramps, stairs, and rooftop seams
      playerRef.current.position.y = MathUtils.lerp(playerRef.current.position.y, targetY, 1 - Math.exp(-35 * dt));
      if (Math.abs(playerRef.current.position.y - targetY) < 0.05) {
        playerRef.current.position.y = targetY;
      }
      fallVelocity.current = 0;
    } else if (Math.abs(playerRef.current.position.y - targetY) < 0.1) {
      playerRef.current.position.y = targetY;
      fallVelocity.current = 0;
    } else {
      // Smooth, solid gravity fall when stepping off high ledges / cliffs (no stuttering)
      fallVelocity.current -= 45 * dt;
      playerRef.current.position.y += fallVelocity.current * dt;
      if (playerRef.current.position.y <= targetY) {
        playerRef.current.position.y = targetY;
        fallVelocity.current = 0;
      }
    }
  }

    // Update live input coordinates directly
    liveInput.x = playerRef.current.position.x;
    liveInput.y = playerRef.current.position.y;
    liveInput.z = playerRef.current.position.z;

    const px = playerRef.current.position.x;
    const py = playerRef.current.position.y;
    const pz = playerRef.current.position.z;

    // --- CAMERA CALCULATION (SUPPORTING TPS AND FPS FIRST-PERSON MODES) ---
    const isZoomed = liveInput.isZoomed;
    const curIsFirstPerson = useGameStore.getState().isFirstPerson;
    const isFPSMode = curIsFirstPerson && !myPlayerFull.inBus;

    // Toggle character body visibility in FPS mode (hide local body so eye camera isn't inside own geometry)
    if (bodyGroupRef.current) {
      bodyGroupRef.current.visible = !isFPSMode;
    }

    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    // Forward unit direction from yaw and pitch
    const fwdX = -Math.sin(yaw) * cosPitch;
    const fwdY = -sinPitch;
    const fwdZ = -Math.cos(yaw) * cosPitch;

    // Target FOV: In FPS mode wider FOV (82) or tight zoom (26-34)
    const targetFov = isFPSMode
      ? (isZoomed ? (myPlayerFull.characterClass === 'scout' ? 26 : 34) : 82)
      : (isZoomed ? (myPlayerFull.characterClass === 'scout' ? 32 : 38) : 75);

    const fovLerp = 1 - Math.exp(-16 * dt);
    const pCam = camera as any;
    if (pCam.fov !== undefined) {
      if (Math.abs(pCam.fov - targetFov) > 0.05) {
        pCam.fov = MathUtils.lerp(pCam.fov, targetFov, fovLerp);
        pCam.updateProjectionMatrix();
      } else if (pCam.fov !== targetFov) {
        pCam.fov = targetFov;
        pCam.updateProjectionMatrix();
      }
    }

    let camX: number, camY: number, camZ: number;

    if (isFPSMode) {
      // 1st Person FPS: Camera is positioned directly at eye level inside character head
      const eyeHeight = 1.55;
      const forwardOffset = 0.10;
      camX = px + fwdX * forwardOffset;
      camY = py + eyeHeight + fwdY * 0.05;
      camZ = pz + fwdZ * forwardOffset;
    } else {
      // 3rd Person TPS: Standard shoulder-cam follow
      const baseCamDist = isZoomed ? 4.5 : 8.0;
      const baseCamHeight = isZoomed ? 1.7 : 2.0;
      const shoulderOffset = isZoomed ? 0.65 : 0.45;
      const offX = Math.cos(yaw) * shoulderOffset;
      const offZ = -Math.sin(yaw) * shoulderOffset;

      camX = px - fwdX * baseCamDist + offX;
      camY = Math.max(py + 0.4, py + baseCamHeight - fwdY * (baseCamDist * 0.4));
      camZ = pz - fwdZ * baseCamDist + offZ;
    }

    // Direct look target straight down optical axis (80m ahead)
    const lookDistance = 80.0;
    const targetLookX = camX + fwdX * lookDistance;
    const targetLookY = camY + fwdY * lookDistance;
    const targetLookZ = camZ + fwdZ * lookDistance;

    camera.position.set(camX, camY, camZ);
    camera.lookAt(targetLookX, targetLookY, targetLookZ);

    // Exact 3D ray through screen center (Crosshair direction / 画面中心レティクル視線)
    camera.getWorldDirection(camWorldDir.current);
    const normAimX = camWorldDir.current.x;
    const normAimY = camWorldDir.current.y;
    const normAimZ = camWorldDir.current.z;

    // --- ACCURATE RETICLE RAYCAST (敵・障害物へのクロスヘア交差判定) ---
    let closestT = 80.0; // Default focal distance straight down reticle line into distance
    let rayHitEnemy = false;

    // 1. Raycast against all other alive players/bots
    if (gameState?.players) {
      for (const otherId in gameState.players) {
        if (otherId === myId) continue;
        const other = gameState.players[otherId];
        if (other.isDead) continue;

        // Player capsule/sphere center in world space (y is the exact center of the capsule)
        const targetCenterX = other.x;
        const targetCenterY = (other.y || 1); // fixed parallax issue
        const targetCenterZ = other.z;

        // Vector from camera to target
        const vcx = targetCenterX - camX;
        const vcy = targetCenterY - camY;
        const vcz = targetCenterZ - camZ;

        // Project onto camera aim ray
        const t = vcx * normAimX + vcy * normAimY + vcz * normAimZ;
        if (t > 1.2 && t < closestT + 5.0) {
          // Closest point on ray to target
          const rayPointX = camX + normAimX * t;
          const rayPointY = camY + normAimY * t;
          const rayPointZ = camZ + normAimZ * t;

          // Capsule Hitbox Check:
          // Player model height is 2.0m: clamps rayPointY along the spine from feet (targetCenterY - 1.1) to head (targetCenterY + 1.2)
          // This guarantees that aiming anywhere on the body (head, torso, legs, feet) registers a hit!
          const clampedSpineY = Math.max(targetCenterY - 1.1, Math.min(targetCenterY + 1.2, rayPointY));
          const distToCapsule = Math.hypot(targetCenterX - rayPointX, clampedSpineY - rayPointY, targetCenterZ - rayPointZ);
          const TARGET_HIT_RADIUS = 1.35; // Generous hit radius covering body width, shoulders & limbs

          if (distToCapsule <= TARGET_HIT_RADIUS) {
            const hitT = Math.max(1.0, t - Math.sqrt(Math.max(0, TARGET_HIT_RADIUS * TARGET_HIT_RADIUS - distToCapsule * distToCapsule)));
            if (hitT < closestT) {
              closestT = hitT;
              rayHitEnemy = true;
            }
          }
        }
      }
    }

    // 2. Raycast against obstacles if no enemy was hit closer
    if (!rayHitEnemy && gameState?.obstacles) {
      for (const obs of Object.values(gameState.obstacles)) {
        if (obs.type === 'ramp') continue;
        const halfW = obs.width / 2;
        const halfD = obs.depth / 2;
        const minX = obs.x - halfW;
        const maxX = obs.x + halfW;
        const minY = 0;
        const maxY = obs.height;
        const minZ = obs.z - halfD;
        const maxZ = obs.z + halfD;

        // Fast 3D AABB Slab intersection
        let t1x = (minX - camX) / (normAimX || 1e-6);
        let t2x = (maxX - camX) / (normAimX || 1e-6);
        let t1y = (minY - camY) / (normAimY || 1e-6);
        let t2y = (maxY - camY) / (normAimY || 1e-6);
        let t1z = (minZ - camZ) / (normAimZ || 1e-6);
        let t2z = (maxZ - camZ) / (normAimZ || 1e-6);

        let tmin = Math.max(Math.max(Math.min(t1x, t2x), Math.min(t1y, t2y)), Math.min(t1z, t2z));
        let tmax = Math.min(Math.min(Math.max(t1x, t2x), Math.max(t1y, t2y)), Math.max(t1z, t2z));

        if (tmax >= Math.max(0, tmin) && tmin > 1.0 && tmin < closestT) {
          closestT = tmin;
        }
      }
    }

    // 3D Focal Aim Target in world space (where the crosshair is exactly aimed at - no ground bending!)
    const focalX = camX + normAimX * closestT;
    const focalY = camY + normAimY * closestT;
    const focalZ = camZ + normAimZ * closestT;

    liveInput.aimTarget = { x: focalX, y: focalY, z: focalZ };
    liveInput.pitch = pitch;
    liveInput.isTargetLocked = rayHitEnemy;

    // Gun muzzle spawn point (weapon position at chest/hand level)
    const muzzleX = px - Math.sin(yaw) * 0.45 + Math.cos(yaw) * 0.35;
    const muzzleY = py + 1.0; // Matched visually with gun mesh height
    const muzzleZ = pz - Math.cos(yaw) * 0.45 - Math.sin(yaw) * 0.35;

    // Direct trajectory from muzzle straight towards the 3D 焦点 (crosshair focal point):
    const bVecX = focalX - muzzleX;
    const bVecY = focalY - muzzleY;
    const bVecZ = focalZ - muzzleZ;
    const bVecLen = Math.hypot(bVecX, bVecY, bVecZ) || 1;
    const bulletDirX = bVecX / bVecLen;
    const bulletDirY = bVecY / bVecLen;
    const bulletDirZ = bVecZ / bVecLen;

    // --- INSTANT CLIENT ATTACK TRIGGER & PREDICTION ---
    const stats = CLASS_STATS[myPlayerFull.characterClass];
    const isSword = myPlayerFull.characterClass === 'sword';
    const isLance = myPlayerFull.characterClass === 'lance';
    const isMelee = isSword || isLance;
    const cooldownSec = myPlayerFull.characterClass === 'sniper' 
      ? 5.0 
      : Math.max(50, stats.cooldown - myPlayerFull.weaponLevel * 30) / 1000;

    if (liveInput.isShooting && state.clock.elapsedTime - lastLocalShoot.current > cooldownSec) {
      lastLocalShoot.current = state.clock.elapsedTime;
      attackAnimTime.current = state.clock.elapsedTime;

      playShootSound(myPlayerFull.characterClass, true);

      // Instantly trigger attack visual effect locally straight to the 焦点 (focal crosshair point)
      if (rayHitEnemy) {
        playHitSound();
        useGameStore.setState({ showHitMarker: true });
        setTimeout(() => useGameStore.setState({ showHitMarker: false }), 150);
      }
      triggerAttackEvent({
        id: 'local_' + Math.random().toString(36).substring(2),
        attackerId: myPlayerFull.id,
        characterClass: myPlayerFull.characterClass,
        x: isMelee ? px : muzzleX,
        y: isMelee ? py + 0.6 : muzzleY,
        z: isMelee ? pz : muzzleZ,
        ry: yaw,
        dirX: bulletDirX,
        dirY: bulletDirY,
        dirZ: bulletDirZ,
        targetPos: { x: focalX, y: focalY, z: focalZ },
        weaponLevel: myPlayerFull.weaponLevel,
        isSword: isMelee,
      });
    }

    const isWizard = myPlayerFull.characterClass === 'wizard';

    // --- WEAPON SWING & RECOIL ANIMATION ---
    if (weaponRef.current) {
      const timeSinceAttack = state.clock.elapsedTime - attackAnimTime.current;
      const wLerp = 1 - Math.exp(-18 * dt);

      if (isFPSMode) {
        // First Person Mode: Align weapon to FPS HUD position in lower right / ADS center
        const targetWx = isZoomed ? 0.06 : 0.28;
        const targetWy = isZoomed ? 0.42 + sinPitch * 0.15 : 0.28 + sinPitch * 0.15;
        const targetWz = isZoomed ? -0.32 : -0.42;

        weaponRef.current.position.x = MathUtils.lerp(weaponRef.current.position.x, targetWx, wLerp);
        weaponRef.current.position.y = MathUtils.lerp(weaponRef.current.position.y, targetWy, wLerp);

        if (isSword) {
          if (timeSinceAttack < 0.22) {
            const progress = timeSinceAttack / 0.22;
            const slashAngle = Math.sin(progress * Math.PI);
            weaponRef.current.rotation.x = -0.5 - slashAngle * 1.8;
            weaponRef.current.rotation.y = 0.4 + slashAngle * 1.4;
            weaponRef.current.position.z = targetWz - slashAngle * 0.4;
          } else {
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, -0.3, wLerp);
            weaponRef.current.rotation.y = MathUtils.lerp(weaponRef.current.rotation.y, 0.2, wLerp);
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, targetWz, wLerp);
          }
        } else if (isLance) {
          // Lance: Powerful forward joust lunging & drill rotation
          if (timeSinceAttack < 0.24) {
            const thrustProgress = timeSinceAttack / 0.24;
            const thrust = Math.sin(thrustProgress * Math.PI) * 1.3;
            weaponRef.current.position.z = targetWz - thrust;
            weaponRef.current.rotation.x = -Math.PI / 2 + 0.12 - thrust * 0.25;
            weaponRef.current.rotation.z = thrust * 1.6;
          } else {
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, targetWz, wLerp);
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, -Math.PI / 2 + 0.1, wLerp);
            weaponRef.current.rotation.z = MathUtils.lerp(weaponRef.current.rotation.z, 0, wLerp);
          }
        } else if (isWizard) {
          // Wizard: Mystical overhead staff waving & forward spellcast arc
          if (timeSinceAttack < 0.28) {
            const castProgress = timeSinceAttack / 0.28;
            const wave = Math.sin(castProgress * Math.PI);
            weaponRef.current.rotation.x = -0.3 - wave * 1.4;
            weaponRef.current.rotation.y = 0.2 - wave * 0.8;
            weaponRef.current.position.y = targetWy + wave * 0.22;
            weaponRef.current.position.z = targetWz - wave * 0.35;
          } else {
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, -0.2, wLerp);
            weaponRef.current.rotation.y = MathUtils.lerp(weaponRef.current.rotation.y, 0.1, wLerp);
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, targetWz, wLerp);
          }
        } else {
          if (timeSinceAttack < 0.12) {
            const kick = Math.sin((timeSinceAttack / 0.12) * Math.PI) * 0.12;
            weaponRef.current.position.z = targetWz + kick;
            weaponRef.current.rotation.x = -kick * 1.0;
          } else {
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, targetWz, wLerp);
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, 0, wLerp);
          }
        }
      } else {
        // Third Person Mode: Standard weapon offset inside body group
        weaponRef.current.position.x = MathUtils.lerp(weaponRef.current.position.x, 0.45, wLerp);
        weaponRef.current.position.y = MathUtils.lerp(weaponRef.current.position.y, 0.1, wLerp);

        if (isSword) {
          if (timeSinceAttack < 0.22) {
            const progress = timeSinceAttack / 0.22;
            const slashAngle = Math.sin(progress * Math.PI);
            weaponRef.current.rotation.x = -0.5 - slashAngle * 1.8;
            weaponRef.current.rotation.y = 0.4 + slashAngle * 1.4;
            weaponRef.current.position.z = -0.4 - slashAngle * 0.5;
          } else {
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, -0.4, wLerp);
            weaponRef.current.rotation.y = MathUtils.lerp(weaponRef.current.rotation.y, 0.2, wLerp);
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, -0.3, wLerp);
          }
        } else if (isLance) {
          // Lance: Powerful forward joust lunging & drill rotation
          if (timeSinceAttack < 0.24) {
            const thrustProgress = timeSinceAttack / 0.24;
            const thrust = Math.sin(thrustProgress * Math.PI) * 1.2;
            weaponRef.current.position.z = -0.4 - thrust;
            weaponRef.current.rotation.x = -Math.PI / 2 + 0.1 - thrust * 0.2;
            weaponRef.current.rotation.z = thrust * 1.4;
          } else {
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, -0.4, wLerp);
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, -Math.PI / 2 + 0.1, wLerp);
            weaponRef.current.rotation.z = MathUtils.lerp(weaponRef.current.rotation.z, 0, wLerp);
          }
        } else if (isWizard) {
          // Wizard: Mystical overhead staff waving & forward spellcast arc
          if (timeSinceAttack < 0.28) {
            const castProgress = timeSinceAttack / 0.28;
            const wave = Math.sin(castProgress * Math.PI);
            weaponRef.current.rotation.x = -0.3 - wave * 1.5;
            weaponRef.current.rotation.y = 0.2 - wave * 0.7;
            weaponRef.current.position.y = 0.1 + wave * 0.3;
            weaponRef.current.position.z = -0.2 - wave * 0.45;
          } else {
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, -0.2, wLerp);
            weaponRef.current.rotation.y = MathUtils.lerp(weaponRef.current.rotation.y, 0.1, wLerp);
            weaponRef.current.position.y = MathUtils.lerp(weaponRef.current.position.y, 0.1, wLerp);
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, -0.2, wLerp);
          }
        } else {
          if (timeSinceAttack < 0.12) {
            const kick = Math.sin((timeSinceAttack / 0.12) * Math.PI) * 0.18;
            weaponRef.current.position.z = -0.4 + kick;
            weaponRef.current.rotation.x = -kick * 1.2;
          } else {
            weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, -0.4, wLerp);
            weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, 0, wLerp);
          }
        }
      }
    }

    // Dynamic visibility controls directly on refs (0 React re-renders)
    if (playerRef.current) {
      playerRef.current.visible = !myPlayerFull.isDead && !myPlayerFull.inBus;
    }
    if (gliderRef.current) {
      gliderRef.current.visible = !myPlayerFull.isDead && !myPlayerFull.inBus && !!myPlayerFull.isGliding;
    }
    const showCombat = !myPlayerFull.isDead && !myPlayerFull.inBus && !myPlayerFull.isGliding && !myPlayerFull.isSkydiving;
    if (weaponRef.current) {
      weaponRef.current.visible = showCombat;
    }
    if (aimIndicatorRef.current) {
      aimIndicatorRef.current.visible = showCombat;
    }
    if (shieldRef.current) {
      shieldRef.current.visible = !myPlayerFull.isDead && !myPlayerFull.inBus && !!myPlayerFull.hasShield;
    }
    if (invulnRef.current) {
      invulnRef.current.visible = !myPlayerFull.isDead && !myPlayerFull.inBus && !!myPlayerFull.isInvulnerable;
    }
    if (healRef.current) {
      healRef.current.visible = !myPlayerFull.isDead && !myPlayerFull.inBus && !!myPlayerFull.isHealing;
    }

    // Network tick: send to server at 20Hz
    if (state.clock.elapsedTime - lastSend.current > TICK_RATE) {
      sendInput();
      lastSend.current = state.clock.elapsedTime;
    }
  });

  // Track initialization and respawn
  const initializedRef = useRef(false);
  const wasDeadRef = useRef(false);

  useEffect(() => {
    const gameState = useGameStore.getState().gameState;
    const myId = useGameStore.getState().myId;
    const myPlayer = myId && gameState ? gameState.players[myId] : null;

    if (!myPlayer) return;

    if (!initializedRef.current && playerRef.current) {
      playerRef.current.position.set(myPlayer.x, myPlayer.y, myPlayer.z);
      liveInput.x = myPlayer.x;
      liveInput.y = myPlayer.y;
      liveInput.z = myPlayer.z;
      initializedRef.current = true;
    }

    // If just respawned from death, snap to respawn coordinate
    if (wasDeadRef.current && !isDead && playerRef.current) {
      playerRef.current.position.set(myPlayer.x, myPlayer.y, myPlayer.z);
      liveInput.x = myPlayer.x;
      liveInput.y = myPlayer.y;
      liveInput.z = myPlayer.z;
    }
    wasDeadRef.current = !!isDead;
  }, [isDead]);

  if (isDead) return null;

  const isSwordClass = characterClass === 'sword';
  const bodyMat = localBodyMats[color] || defaultLocalBodyMat;
  const gliderWingMat = localGliderWingMats[color] || defaultLocalGliderWingMat;
  const weaponAccentMat = localGunAccentMats[color] || defaultLocalGunAccentMat;

  return (
    <group ref={playerRef}>
      {/* Somersault Flipping Inner Body Group */}
      <group ref={innerMeshRef}>
        {/* Body & Visor (hidden in 1st person FPS mode) */}
        <group ref={bodyGroupRef}>
          <mesh geometry={localBodyGeo} material={bodyMat} position={[0, 0, 0]} castShadow receiveShadow />
          <mesh geometry={localVisorGeo} material={localVisorMat} position={[0, 0.5, -0.4]} castShadow />
        </group>

        {/* --- 3D DEPLOYED TACTICAL HANG GLIDER --- */}
        <group ref={gliderRef} position={[0, 1.6, -0.2]} visible={false}>
          <mesh geometry={localGliderWingGeo} material={gliderWingMat} />
          <mesh geometry={localGliderTipGeo} material={localGliderTipMat} position={[1.7, 0.2, 0]} rotation={[0, 0, -0.3]} />
          <mesh geometry={localGliderTipGeo} material={localGliderTipMat} position={[-1.7, 0.2, 0]} rotation={[0, 0, 0.3]} />
          <mesh geometry={localGliderStrutGeo} material={localGliderStrutMat} position={[0, -0.6, 0]} />
          <mesh geometry={localGliderBarGeo} material={localGliderBarMat} position={[0, -1.0, 0]} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={localGliderJetGeo} material={localGliderJetMat} position={[0.9, -0.1, 0.7]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={localGliderJetGeo} material={localGliderJetMat} position={[-0.9, -0.1, 0.7]} rotation={[Math.PI / 2, 0, 0]} />
        </group>

        {/* --- VISIBLE 3D WEAPONS --- */}
        <group ref={weaponRef} position={[0.45, 0.1, -0.3]}>
          {isSwordClass ? (
            // Sleek Katana Blade Model
            <group rotation={[-0.4, 0.2, -0.2]}>
              <mesh geometry={localSwordHiltGeo} material={localSwordHiltMat} position={[0, -0.3, 0]} />
              <mesh geometry={localSwordGuardGeo} material={localSwordGuardMat} position={[0, -0.1, 0]} />
              <mesh geometry={localSwordBladeGeo} material={localSwordBladeMat} position={[0, 0.8, 0]} />
              <mesh geometry={localSwordEdgeGeo} material={localSwordEdgeMat} position={[0.03, 0.8, 0]} />
            </group>
          ) : characterClass === 'lance' ? (
            // Long Jousting Lance Model
            <group rotation={[-Math.PI / 2 + 0.1, 0, 0]} position={[0, 0, -0.4]}>
              <mesh geometry={localLanceShaftGeo} material={localLanceShaftMat} position={[0, 0.5, 0]} />
              <mesh geometry={localLanceGuardGeo} material={localLanceGuardMat} position={[0, -0.2, 0]} />
              <mesh geometry={localLanceTipGeo} material={localLanceTipMat} position={[0, 1.8, 0]} />
            </group>
          ) : characterClass === 'wizard' ? (
            // Mystical Staff with Glowing Flame Crystal
            <group rotation={[-0.2, 0.1, 0]} position={[0, 0.1, -0.1]}>
              <mesh geometry={localStaffShaftGeo} material={localStaffShaftMat} position={[0, 0.2, 0]} />
              <mesh geometry={localStaffHeadGeo} material={localStaffHeadMat} position={[0, 0.95, 0]} />
            </group>
          ) : characterClass === 'sniper' ? (
            // Tactical Long-Range Sniper Rifle with Scope
            <group position={[0, 0, 0]}>
              <mesh geometry={localSniperBodyGeo} material={localGunBodyMat} position={[0, 0, 0]} />
              <mesh geometry={localSniperBarrelGeo} material={localGunBarrelMat} position={[0, 0.04, -0.7]} rotation={[Math.PI / 2, 0, 0]} />
              <mesh geometry={localSniperScopeGeo} material={localSniperScopeMat} position={[0, 0.16, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
            </group>
          ) : (
            // Sci-Fi Blaster / Cannon Model
            <group position={[0, 0, 0]}>
              <mesh geometry={localGunBodyGeo} material={localGunBodyMat} position={[0, 0, 0]} />
              <mesh geometry={localGunBarrelGeo} material={localGunBarrelMat} position={[0, 0.04, -0.45]} rotation={[Math.PI / 2, 0, 0]} />
              <mesh geometry={localGunAccentGeo} material={weaponAccentMat} position={[0, 0.12, -0.05]} />
            </group>
          )}
        </group>
      </group>

      {/* --- ATTACK HITBOX & RANGE INDICATOR --- */}
      <group ref={aimIndicatorRef}>
        {isSwordClass && (
          // SWORD ATTACK CONE (Exact 15m Range & 120° Arc on Ground)
          <group position={[0, -0.98, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
            <mesh geometry={swordAreaGeo} material={swordAreaMat} />
            <mesh geometry={swordEdgeArcGeo} material={swordEdgeArcMat} position={[0, 0, 0.01]} />
          </group>
        )}
        {characterClass === 'lance' && (
          // LANCE THRUST LINE (18m Reach forward on Ground)
          <group position={[0, -0.98, -9]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh geometry={lanceAreaGeo} material={lanceAreaMat} />
          </group>
        )}
      </group>

      {/* Tank Shield Visual */}
      <mesh ref={shieldRef} geometry={shieldGeo} material={shieldMat} position={[0, 0, 0]} visible={false} />

      {/* Sword Invulnerability Dash Visual */}
      <mesh ref={invulnRef} geometry={invulnGeo} material={invulnMat} position={[0, 0, 0]} visible={false} />
      
      {/* Healing Visual */}
      <mesh ref={healRef} geometry={healGeo} material={healMat} position={[0, 0, 0]} visible={false} />
    </group>
  );
}
