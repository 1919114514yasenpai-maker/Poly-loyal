import React, { useRef, useEffect } from 'react';
import { useGameStore, liveInput, triggerAttackEvent } from '../store';
import { CLASS_STATS, getGroundHeight } from '../types';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, Group, MathUtils } from 'three';

const TICK_RATE = 1 / 20; // 20 times per second

export function LocalPlayer() {
  const myId = useGameStore((s) => s.myId);
  const gameState = useGameStore((s) => s.gameState);
  const sendInput = useGameStore((s) => s.sendInput);
  
  const playerRef = useRef<Group>(null);
  const innerMeshRef = useRef<Group>(null);
  const weaponRef = useRef<Group>(null);
  const { camera } = useThree();
  const lastSend = useRef(0);
  const lastLocalShoot = useRef(0);
  const attackAnimTime = useRef(-10);
  const rollStartTime = useRef(-10);
  const rollDir = useRef({ x: 0, z: -1 });

  // Smooth camera state
  const camPos = useRef(new Vector3(0, 5, 10));
  const lookTarget = useRef(new Vector3(0, 1.5, 0));
  const camWorldDir = useRef(new Vector3());

  const myPlayer = myId && gameState ? gameState.players[myId] : null;
  const spectateTargetId = useGameStore((s) => s.spectateTargetId);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);

    // If dead and spectating another player, smoothly follow target
    if (!myPlayer || myPlayer.isDead) {
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
    const pitch = Math.max(-1.28, Math.min(1.15, liveInput.pitch ?? 0.15));

    // Rotate player root mesh to face look direction (yaw)
    playerRef.current.rotation.y = yaw;

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
    const nowTime = state.clock.elapsedTime;
    const timeSinceRoll = nowTime - rollStartTime.current;
    const isRolling = timeSinceRoll < 0.35;

    if (liveInput.isRolling && timeSinceRoll > 1.8) {
      rollStartTime.current = nowTime;
      // Determine roll direction: current moving direction or forward facing
      if (Math.hypot(mx, mz) > 0.1) {
        const mag = Math.hypot(mx, mz);
        rollDir.current = { x: mx / mag, z: mz / mag };
      } else {
        rollDir.current = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      }
    }

    // Base speed
    let baseSpeed = myPlayer.characterClass === 'scout' ? 22 : myPlayer.characterClass === 'tank' ? 10 : 15;
    if (isRolling) {
      baseSpeed *= 2.4; // 240% speed boost during dodge roll
    }

    const moveVectorX = isRolling ? rollDir.current.x : mx;
    const moveVectorZ = isRolling ? rollDir.current.z : mz;

    // 3D Somersault flip animation during roll
    if (innerMeshRef.current) {
      if (isRolling) {
        const rollProgress = timeSinceRoll / 0.35;
        innerMeshRef.current.rotation.x = -rollProgress * Math.PI * 2;
      } else {
        innerMeshRef.current.rotation.x = MathUtils.lerp(innerMeshRef.current.rotation.x, 0, 1 - Math.exp(-20 * dt));
      }
    }

    const PLAYER_RADIUS = 0.9;
    const currentX = playerRef.current.position.x;
    const currentZ = playerRef.current.position.z;
    const currentGroundH = gameState?.obstacles ? getGroundHeight(currentX, currentZ, gameState.obstacles) : 0;
    const currentEffectiveY = Math.max(playerRef.current.position.y, currentGroundH + 1);

    // 1. Move along X axis and slide smoothly along obstacles
    let moveX = moveVectorX * baseSpeed * dt;
    let testX = currentX + moveX;

    if (gameState?.obstacles && Math.abs(moveX) > 0.0001) {
      for (const obs of Object.values(gameState.obstacles)) {
        if (obs.type === 'ramp') continue;

        // Fast proximity rejection
        if (Math.abs(testX - obs.x) > (obs.width / 2 + PLAYER_RADIUS + 2) || Math.abs(currentZ - obs.z) > (obs.depth / 2 + PLAYER_RADIUS + 2)) {
          continue;
        }

        const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
        const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
        const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
        const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

        if (testX > obsMinX && testX < obsMaxX && currentZ > obsMinZ && currentZ < obsMaxZ) {
          // Walkable check: player is walking onto obstacle from a ramp/high ground
          const destGroundH = getGroundHeight(testX, currentZ, gameState.obstacles);
          if (currentEffectiveY >= obs.height - 0.6 || destGroundH >= obs.height - 0.6 || currentGroundH >= obs.height - 0.6) {
            continue; // Walkable surface!
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
      for (const obs of Object.values(gameState.obstacles)) {
        if (obs.type === 'ramp') continue;

        if (Math.abs(testX - obs.x) > (obs.width / 2 + PLAYER_RADIUS + 2) || Math.abs(testZ - obs.z) > (obs.depth / 2 + PLAYER_RADIUS + 2)) {
          continue;
        }

        const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
        const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
        const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
        const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

        if (testX > obsMinX && testX < obsMaxX && testZ > obsMinZ && testZ < obsMaxZ) {
          const destGroundH = getGroundHeight(testX, testZ, gameState.obstacles);
          if (currentEffectiveY >= obs.height - 0.6 || destGroundH >= obs.height - 0.6 || currentGroundH >= obs.height - 0.6) {
            continue; // Walkable surface!
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

    // 3. Safety anti-stuck de-penetration pass (handles unexpected wedging)
    if (gameState?.obstacles) {
      for (const obs of Object.values(gameState.obstacles)) {
        if (obs.type === 'ramp') continue;

        const obsMinX = obs.x - obs.width / 2 - PLAYER_RADIUS;
        const obsMaxX = obs.x + obs.width / 2 + PLAYER_RADIUS;
        const obsMinZ = obs.z - obs.depth / 2 - PLAYER_RADIUS;
        const obsMaxZ = obs.z + obs.depth / 2 + PLAYER_RADIUS;

        if (testX > obsMinX && testX < obsMaxX && testZ > obsMinZ && testZ < obsMaxZ) {
          const destGroundH = getGroundHeight(testX, testZ, gameState.obstacles);
          if (currentEffectiveY >= obs.height - 0.6 || destGroundH >= obs.height - 0.6) {
            continue;
          }

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

    // Dynamic ground and slope response
    const groundH = gameState?.obstacles ? getGroundHeight(playerRef.current.position.x, playerRef.current.position.z, gameState.obstacles) : 0;
    const targetY = myPlayer.isFlying ? groundH + 12 : groundH + 1;

    if (!myPlayer.isFlying && playerRef.current.position.y < targetY) {
      // Ascending ramp/slope: snap immediately so player's feet stay on top of the ramp surface with zero sinking
      playerRef.current.position.y = targetY;
    } else {
      // Descending/gravity fall
      playerRef.current.position.y = MathUtils.lerp(playerRef.current.position.y, targetY, 1 - Math.exp(-22 * dt));
    }

    // Update live input coordinates directly
    liveInput.x = playerRef.current.position.x;
    liveInput.y = playerRef.current.position.y;
    liveInput.z = playerRef.current.position.z;

    const px = playerRef.current.position.x;
    const py = playerRef.current.position.y;
    const pz = playerRef.current.position.z;

    // --- DIRECT, ULTRA-SMOOTH THIRD-PERSON CAMERA & 3D FOCAL RAY ---
    const isZoomed = liveInput.isZoomed;
    const targetFov = isZoomed ? (myPlayer.characterClass === 'scout' ? 32 : 38) : 75;
    const fovLerp = 1 - Math.exp(-16 * dt);
    
    // Typecast PerspectiveCamera for FOV manipulation
    const pCam = camera as any;
    if (pCam.fov !== undefined && Math.abs(pCam.fov - targetFov) > 0.1) {
      pCam.fov = MathUtils.lerp(pCam.fov, targetFov, fovLerp);
      pCam.updateProjectionMatrix();
    }

    const baseCamDist = isZoomed ? 4.8 : 9.0;
    const baseCamHeight = isZoomed ? 2.3 : 3.2;

    const hDist = baseCamDist * Math.cos(pitch);
    const vDist = baseCamDist * Math.sin(pitch) + baseCamHeight;

    // Tactical shoulder offset when zoomed
    const shoulderOffset = isZoomed ? 0.65 : 0;
    const offX = Math.cos(yaw) * shoulderOffset;
    const offZ = -Math.sin(yaw) * shoulderOffset;

    const camX = px + Math.sin(yaw) * hDist + offX;
    const camY = Math.max(py + 0.4, py + vDist);
    const camZ = pz + Math.cos(yaw) * hDist + offZ;

    // Focus target dynamically angles with pitch so player can look high into the sky and directly hit high platforms/flying enemies
    const lookDistance = 40.0;
    const targetLookX = px - Math.sin(yaw) * Math.cos(-pitch) * lookDistance;
    const targetLookY = py + 1.2 + Math.sin(-pitch) * lookDistance;
    const targetLookZ = pz - Math.cos(yaw) * Math.cos(-pitch) * lookDistance;

    camera.position.set(camX, camY, camZ);
    camera.lookAt(targetLookX, targetLookY, targetLookZ);

    // Exact 3D ray through screen center (Crosshair / 焦点)
    camera.getWorldDirection(camWorldDir.current);
    const normAimX = camWorldDir.current.x;
    const normAimY = camWorldDir.current.y;
    const normAimZ = camWorldDir.current.z;

    // 3D Focal Aim Target in world space (where the crosshair is aimed at)
    const focusDistance = 80.0;
    const focalX = camX + normAimX * focusDistance;
    const focalY = camY + normAimY * focusDistance;
    const focalZ = camZ + normAimZ * focusDistance;

    liveInput.aimTarget = { x: focalX, y: focalY, z: focalZ };
    liveInput.pitch = pitch;

    // Gun muzzle spawn point (weapon position)
    const muzzleX = px - Math.sin(yaw) * 0.5 + Math.cos(yaw) * 0.4;
    const muzzleY = py + 1.0;
    const muzzleZ = pz - Math.cos(yaw) * 0.5 - Math.sin(yaw) * 0.4;

    // Direct trajectory from muzzle straight towards the 3D 焦点 (focal point):
    const bVecX = focalX - muzzleX;
    const bVecY = focalY - muzzleY;
    const bVecZ = focalZ - muzzleZ;
    const bVecLen = Math.hypot(bVecX, bVecY, bVecZ) || 1;
    const bulletDirX = bVecX / bVecLen;
    const bulletDirY = bVecY / bVecLen;
    const bulletDirZ = bVecZ / bVecLen;

    // --- INSTANT CLIENT ATTACK TRIGGER & PREDICTION ---
    const stats = CLASS_STATS[myPlayer.characterClass];
    const isSword = myPlayer.characterClass === 'sword';
    const cooldownSec = Math.max(50, stats.cooldown - myPlayer.weaponLevel * 30) / 1000;

    if (liveInput.isShooting && !myPlayer.isFlying && state.clock.elapsedTime - lastLocalShoot.current > cooldownSec) {
      lastLocalShoot.current = state.clock.elapsedTime;
      attackAnimTime.current = state.clock.elapsedTime;

      // Instantly trigger attack visual effect locally straight to the 焦点 (focal crosshair point)
      triggerAttackEvent({
        id: 'local_' + Math.random().toString(36).substring(2),
        attackerId: myPlayer.id,
        characterClass: myPlayer.characterClass,
        x: isSword ? px : muzzleX,
        y: isSword ? py + 0.6 : muzzleY,
        z: isSword ? pz : muzzleZ,
        ry: yaw,
        dirX: bulletDirX,
        dirY: bulletDirY,
        dirZ: bulletDirZ,
        targetPos: { x: focalX, y: focalY, z: focalZ },
        weaponLevel: myPlayer.weaponLevel,
        isSword,
      });
    }

    // --- WEAPON SWING & RECOIL ANIMATION ---
    if (weaponRef.current) {
      const timeSinceAttack = state.clock.elapsedTime - attackAnimTime.current;
      if (isSword) {
        // Sword slash sweeping rotation
        if (timeSinceAttack < 0.22) {
          const progress = timeSinceAttack / 0.22;
          const slashAngle = Math.sin(progress * Math.PI);
          weaponRef.current.rotation.x = -0.5 - slashAngle * 1.8;
          weaponRef.current.rotation.y = 0.4 + slashAngle * 1.4;
          weaponRef.current.position.z = -0.4 - slashAngle * 0.5;
        } else {
          // Idle stance
          weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, -0.4, 1 - Math.exp(-15 * dt));
          weaponRef.current.rotation.y = MathUtils.lerp(weaponRef.current.rotation.y, 0.2, 1 - Math.exp(-15 * dt));
          weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, -0.3, 1 - Math.exp(-15 * dt));
        }
      } else {
        // Gun recoil kickback
        if (timeSinceAttack < 0.12) {
          const kick = Math.sin((timeSinceAttack / 0.12) * Math.PI) * 0.18;
          weaponRef.current.position.z = -0.4 + kick;
          weaponRef.current.rotation.x = -kick * 1.2;
        } else {
          weaponRef.current.position.z = MathUtils.lerp(weaponRef.current.position.z, -0.4, 1 - Math.exp(-15 * dt));
          weaponRef.current.rotation.x = MathUtils.lerp(weaponRef.current.rotation.x, 0, 1 - Math.exp(-15 * dt));
        }
      }
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
    if (!myPlayer) return;

    if (!initializedRef.current && playerRef.current) {
      playerRef.current.position.set(myPlayer.x, myPlayer.y, myPlayer.z);
      liveInput.x = myPlayer.x;
      liveInput.y = myPlayer.y;
      liveInput.z = myPlayer.z;
      initializedRef.current = true;
    }

    // If just respawned from death, snap to respawn coordinate
    if (wasDeadRef.current && !myPlayer.isDead && playerRef.current) {
      playerRef.current.position.set(myPlayer.x, myPlayer.y, myPlayer.z);
      liveInput.x = myPlayer.x;
      liveInput.y = myPlayer.y;
      liveInput.z = myPlayer.z;
    }

    wasDeadRef.current = !!myPlayer.isDead;
  }, [myPlayer?.isDead]);

  if (!myPlayer || myPlayer.isDead) return null;

  const isSwordClass = myPlayer.characterClass === 'sword';

  return (
    <group ref={playerRef}>
      {/* Somersault Flipping Inner Body Group */}
      <group ref={innerMeshRef}>
        {/* Body */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.5, 1, 4, 8]} />
          <meshStandardMaterial color={myPlayer.color} roughness={0.4} metalness={0.2} />
        </mesh>
        
        {/* Eyes / Visor indicator */}
        <mesh position={[0, 0.5, -0.4]} castShadow>
          <boxGeometry args={[0.6, 0.2, 0.2]} />
          <meshStandardMaterial color="#111827" roughness={0.2} />
        </mesh>

        {/* --- VISIBLE 3D WEAPONS --- */}
        <group ref={weaponRef} position={[0.45, 0.1, -0.3]}>
          {isSwordClass ? (
            // Sleek Katana Blade Model
            <group rotation={[-0.4, 0.2, -0.2]}>
              {/* Grip / Hilt */}
              <mesh position={[0, -0.3, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.35, 8]} />
                <meshStandardMaterial color="#0f172a" roughness={0.6} />
              </mesh>
              {/* Gold Tsuba / Guard */}
              <mesh position={[0, -0.1, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.03, 12]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.3} />
              </mesh>
              {/* Steel Blade */}
              <mesh position={[0, 0.8, 0]}>
                <boxGeometry args={[0.05, 1.7, 0.02]} />
                <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.1} />
              </mesh>
              {/* Glowing Razor Sharp Cutting Edge */}
              <mesh position={[0.03, 0.8, 0]}>
                <boxGeometry args={[0.015, 1.72, 0.025]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </group>
          ) : (
            // Sci-Fi Blaster / Rifle Model
            <group position={[0, 0, 0]}>
              {/* Receiver / Main Body */}
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.14, 0.22, 0.55]} />
                <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
              </mesh>
              {/* Weapon Barrel */}
              <mesh position={[0, 0.04, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.45, 8]} />
                <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Glowing Energy Strip / Power Cell */}
              <mesh position={[0, 0.12, -0.05]}>
                <boxGeometry args={[0.08, 0.04, 0.35]} />
                <meshBasicMaterial color={myPlayer.color} />
              </mesh>
            </group>
          )}
        </group>
      </group>

      {/* --- HIGH-VISIBILITY ATTACK HITBOX & RANGE INDICATOR --- */}
      {isSwordClass ? (
        // SWORD ATTACK CONE (Exact 15m Range & 120° Arc on Ground)
        <group position={[0, -0.98, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          {/* Shaded Area */}
          <mesh>
            <ringGeometry args={[0.4, 15, 36, 1, -Math.PI / 3, (2 * Math.PI) / 3]} />
            <meshBasicMaterial 
              color="#f87171" 
              transparent 
              opacity={0.12} 
              depthWrite={false}
              side={2}
            />
          </mesh>
          {/* Glowing Outer Arc Boundary */}
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[14.6, 15.0, 36, 1, -Math.PI / 3, (2 * Math.PI) / 3]} />
            <meshBasicMaterial 
              color="#ef4444" 
              transparent 
              opacity={0.55} 
              depthWrite={false}
              side={2}
            />
          </mesh>
          {/* Subtle Radial Boundary Rays */}
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[0.4, 14.8, 1, 1, -Math.PI / 3, 0.015]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.35} depthWrite={false} side={2} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <ringGeometry args={[0.4, 14.8, 1, 1, Math.PI / 3 - 0.015, 0.015]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.35} depthWrite={false} side={2} />
          </mesh>
        </group>
      ) : (
        // GUN LASER SIGHT & RANGE BEAM (80m Straight Target Line on Ground)
        <group position={[0, -0.98, 0]}>
          <mesh position={[0, 0, -40]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.12, 80]} />
            <meshBasicMaterial 
              color="#38bdf8" 
              transparent 
              opacity={0.3} 
              depthWrite={false}
              side={2}
            />
          </mesh>
          {/* Max range terminal indicator ring at 80m */}
          <mesh position={[0, 0.01, -80]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.5, 1.8, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.45} depthWrite={false} side={2} />
          </mesh>
        </group>
      )}

      {/* Tank Shield Visual */}
      {myPlayer.hasShield && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} emissive="#fbbf24" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Sword Invulnerability Dash Visual */}
      {myPlayer.isInvulnerable && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[1, 1, 2.5, 16]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.4} emissive="#ef4444" emissiveIntensity={1} />
        </mesh>
      )}
      
      {/* Healing Visual */}
      {myPlayer.isHealing && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 2, 16]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.3} emissive="#22c55e" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}
