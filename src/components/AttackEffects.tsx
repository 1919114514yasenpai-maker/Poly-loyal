import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3, Quaternion } from 'three';
import { onAttackEvent, onDamageDealt, useGameStore } from '../store';
import { AttackEvent, DamagePopupEvent, CharacterClass } from '../types';

interface BulletInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  distTraveled: number;
  maxDist: number;
  color: string;
  emissive: string;
  size: number;
  charClass: CharacterClass;
  quat: Quaternion;
}

interface SlashArcInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  createdAt: number;
  duration: number;
}

interface SparkParticle {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface DamagePopupInstance {
  id: string;
  x: number;
  y: number;
  z: number;
  amount: number;
  isSword: boolean;
  createdAt: number;
}

export function AttackEffects() {
  const bulletsRef = useRef<BulletInstance[]>([]);
  const slashArcsRef = useRef<SlashArcInstance[]>([]);
  const sparksRef = useRef<SparkParticle[]>([]);
  const [activePopups, setActivePopups] = useState<DamagePopupInstance[]>([]);

  // Force re-render for visual elements that need state sync
  const [, setFrameTick] = useState(0);

  // Subscribe to Attack Events (from local prediction and remote socket events)
  useEffect(() => {
    const unsubAttack = onAttackEvent((evt: AttackEvent) => {
      if (evt.isSword) {
        // Spawn sword slash arc
        slashArcsRef.current.push({
          id: evt.id,
          x: evt.x,
          y: evt.y,
          z: evt.z,
          ry: evt.ry,
          createdAt: performance.now() / 1000,
          duration: 0.28,
        });

        // If it hit someone, spawn intense red slash sparks at hit location
        if (evt.hitPosition) {
          spawnSparks(evt.hitPosition.x, evt.hitPosition.y, evt.hitPosition.z, '#ef4444', 12, 18);
        }
      } else {
        // Spawn Bullet Projectile straight towards the 3D focal aim point
        const speed = 150; // units per sec

        let dirX = -Math.sin(evt.ry);
        let dirY = 0;
        let dirZ = -Math.cos(evt.ry);

        if (evt.dirX !== undefined && evt.dirY !== undefined && evt.dirZ !== undefined) {
          dirX = evt.dirX;
          dirY = evt.dirY;
          dirZ = evt.dirZ;
        } else if (evt.targetPos) {
          const dx = evt.targetPos.x - evt.x;
          const dy = evt.targetPos.y - evt.y;
          const dz = evt.targetPos.z - evt.z;
          const len = Math.hypot(dx, dy, dz) || 1;
          dirX = dx / len;
          dirY = dy / len;
          dirZ = dz / len;
        }

        // Bullet alignment rotation towards 3D flight direction
        const rotQuat = new Quaternion();
        const lookDir = new Vector3(dirX, dirY, dirZ).normalize();
        const up = new Vector3(0, 1, 0);
        rotQuat.setFromUnitVectors(up, lookDir);

        let color = '#f59e0b';
        let emissive = '#fbbf24';
        let size = 0.16;

        if (evt.characterClass === 'tank') {
          color = '#eab308';
          emissive = '#fef08a';
          size = 0.24;
        } else if (evt.characterClass === 'scout') {
          color = '#10b981';
          emissive = '#6ee7b7';
          size = 0.14;
        }

        bulletsRef.current.push({
          id: evt.id,
          x: evt.x + dirX * 0.8,
          y: evt.y + dirY * 0.8,
          z: evt.z + dirZ * 0.8,
          vx: dirX * speed,
          vy: dirY * speed,
          vz: dirZ * speed,
          distTraveled: 0,
          maxDist: 85,
          color,
          emissive,
          size,
          charClass: evt.characterClass,
          quat: rotQuat,
        });

        // Muzzle spark
        spawnSparks(evt.x + dirX * 0.8, evt.y + dirY * 0.8, evt.z + dirZ * 0.8, emissive, 4, 10);
      }
    });

    const unsubDamage = onDamageDealt((evt: DamagePopupEvent) => {
      const now = performance.now() / 1000;
      setActivePopups((prev) => [
        ...prev.slice(-15), // keep up to 15 active popups
        {
          id: evt.id,
          x: evt.x + (Math.random() - 0.5) * 0.5,
          y: evt.y + 0.4,
          z: evt.z + (Math.random() - 0.5) * 0.5,
          amount: evt.amount,
          isSword: evt.isSword,
          createdAt: now,
        },
      ]);

      // Spark burst at hit position
      spawnSparks(evt.x, evt.y, evt.z, evt.isSword ? '#ef4444' : '#fbbf24', 8, 14);
    });

    return () => {
      unsubAttack();
      unsubDamage();
    };
  }, []);

  const spawnSparks = (
    x: number,
    y: number,
    z: number,
    color: string,
    count: number,
    speed: number
  ) => {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const spd = (0.5 + Math.random() * 0.5) * speed;
      sparksRef.current.push({
        id: Math.random().toString(36).substring(2),
        x,
        y,
        z,
        vx: Math.sin(phi) * Math.cos(theta) * spd,
        vy: Math.abs(Math.cos(phi)) * spd * 0.8 + 2,
        vz: Math.sin(phi) * Math.sin(theta) * spd,
        color,
        life: 0,
        maxLife: 0.25 + Math.random() * 0.15,
        size: 0.08 + Math.random() * 0.06,
      });
    }
  };

  // High-performance Frame Loop
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = performance.now() / 1000;

    // 1. Update Bullets & check obstacle collision
    const obstacles = useGameStore.getState().gameState?.obstacles;
    const activeBullets: BulletInstance[] = [];

    for (let i = 0; i < bulletsRef.current.length; i++) {
      const b = bulletsRef.current[i];
      const prevX = b.x;
      const prevZ = b.z;
      const stepDist = Math.hypot(b.vx * dt, b.vz * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.distTraveled += stepDist;

      // Check collision with obstacles (incorporating 3D height so shots above walls fly cleanly)
      let hitWall = false;
      if (obstacles) {
        for (const obs of Object.values(obstacles)) {
          if (obs.type === 'ramp') continue;
          const minX = obs.x - obs.width / 2;
          const maxX = obs.x + obs.width / 2;
          const minZ = obs.z - obs.depth / 2;
          const maxZ = obs.z + obs.depth / 2;
          if (b.x >= minX && b.x <= maxX && b.z >= minZ && b.z <= maxZ) {
            if (b.y <= obs.height && b.y >= 0) {
              hitWall = true;
              break;
            }
          }
        }
      }

      if (hitWall) {
        // Bullet hit a wall: spawn sparks on the wall surface
        spawnSparks(b.x, b.y, b.z, b.emissive || '#fbbf24', 6, 12);
      } else if (b.distTraveled < b.maxDist) {
        activeBullets.push(b);
      } else {
        // Bullet expired at max range
        spawnSparks(b.x, b.y, b.z, b.color, 4, 8);
      }
    }
    bulletsRef.current = activeBullets;

    // 2. Update Slash Arcs
    slashArcsRef.current = slashArcsRef.current.filter((s) => now - s.createdAt < s.duration);

    // 3. Update Sparks
    const activeSparks: SparkParticle[] = [];
    for (let i = 0; i < sparksRef.current.length; i++) {
      const s = sparksRef.current[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= 22 * dt; // gravity
      if (s.life < s.maxLife && s.y >= 0) {
        activeSparks.push(s);
      }
    }
    sparksRef.current = activeSparks;

    // 4. Clean old damage popups
    setActivePopups((prev) => {
      const filtered = prev.filter((p) => now - p.createdAt < 0.85);
      return filtered.length !== prev.length ? filtered : prev;
    });

    setFrameTick((t) => (t + 1) % 60);
  });

  const nowTime = performance.now() / 1000;

  return (
    <group>
      {/* 1. RENDER BULLETS (Tracer Capsules with Glowing Trail) */}
      {bulletsRef.current.map((b) => (
        <group key={b.id} position={[b.x, b.y, b.z]} quaternion={b.quat}>
          {/* Main glowing projectile capsule */}
          <mesh>
            <cylinderGeometry args={[b.size * 0.7, b.size * 0.7, 1.8, 6]} />
            <meshBasicMaterial color={b.emissive} />
          </mesh>
          {/* Bright halo tip */}
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[b.size * 1.3, 8, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Radiant outer glow sheath */}
          <mesh>
            <cylinderGeometry args={[b.size * 1.8, b.size * 0.4, 2.6, 6]} />
            <meshBasicMaterial color={b.color} transparent opacity={0.45} />
          </mesh>
        </group>
      ))}

      {/* 2. RENDER SWORD SLASH ARCS (Dynamic Expanding Crimson Slash Waves) */}
      {slashArcsRef.current.map((s) => {
        const progress = Math.min(1, Math.max(0, (nowTime - s.createdAt) / s.duration));
        // Expand radius from 50% to 110% of attack range
        const scale = 0.5 + progress * 0.65;
        const opacity = Math.max(0, (1 - progress) * 0.95);
        // Advance slightly forward in direction of swing
        const forwardDist = 1.0 + progress * 2.5;
        const fx = -Math.sin(s.ry) * forwardDist;
        const fz = -Math.cos(s.ry) * forwardDist;

        return (
          <group key={s.id} position={[s.x + fx, s.y + 0.2, s.z + fz]} rotation={[0, s.ry, 0]} scale={[scale, 1, scale]}>
            {/* Primary Crimson Slash Wave */}
            <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0, 0]}>
              <ringGeometry args={[3, 14, 36, 1, -Math.PI / 3, (2 * Math.PI) / 3]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={opacity} depthWrite={false} side={2} />
            </mesh>

            {/* Inner White-Hot Sharp Cutting Edge */}
            <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.05, 0]}>
              <ringGeometry args={[11.5, 14, 36, 1, -Math.PI / 3.2, (2 * Math.PI) / 3.2]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 1.1} depthWrite={false} side={2} />
            </mesh>

            {/* Trailing Energy Shockwave Arc */}
            <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, -0.05, 0]}>
              <ringGeometry args={[1.5, 9, 24, 1, -Math.PI / 4, Math.PI / 2]} />
              <meshBasicMaterial color="#f43f5e" transparent opacity={opacity * 0.5} depthWrite={false} side={2} />
            </mesh>
          </group>
        );
      })}

      {/* 3. RENDER IMPACT SPARKS */}
      {sparksRef.current.map((sp) => {
        const remaining = Math.max(0, 1 - sp.life / sp.maxLife);
        return (
          <mesh key={sp.id} position={[sp.x, sp.y, sp.z]} scale={[remaining, remaining, remaining]}>
            <boxGeometry args={[sp.size, sp.size, sp.size]} />
            <meshBasicMaterial color={sp.color} transparent opacity={remaining} />
          </mesh>
        );
      })}

      {/* 4. RENDER 3D FLOATING DAMAGE NUMBERS */}
      {activePopups.map((popup) => {
        const age = nowTime - popup.createdAt;
        const yOffset = age * 2.8; // float upward smoothly
        const opacity = Math.max(0, 1 - age / 0.85);
        const scale = Math.min(1.2, 0.7 + age * 2.0);

        return (
          <Html
            key={popup.id}
            position={[popup.x, popup.y + yOffset, popup.z]}
            center
            distanceFactor={18}
            style={{
              transition: 'opacity 0.1s linear',
              opacity,
              transform: `scale(${scale})`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <div
              className={`font-black text-2xl px-2.5 py-0.5 rounded-lg border flex items-center gap-1 shadow-lg whitespace-nowrap ${
                popup.isSword
                  ? 'bg-red-600/90 text-white border-red-300 shadow-red-500/50'
                  : 'bg-amber-500/90 text-black border-yellow-200 shadow-amber-400/50'
              }`}
            >
              <span className="text-base">{popup.isSword ? '⚔️' : '💥'}</span>
              <span>-{popup.amount}</span>
            </div>
          </Html>
        );
      })}
    </group>
  );
}
