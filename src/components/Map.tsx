import React, { memo } from 'react';
import { useGameStore } from '../store';
import { Environment } from '@react-three/drei';
import { Obstacle } from '../types';

// Memoized static obstacles component: only re-renders if obstacles dictionary reference changes
const StaticObstacles = memo(function StaticObstacles({ obstacles }: { obstacles?: Record<string, Obstacle> }) {
  if (!obstacles) return null;

  return (
    <>
      {Object.values(obstacles).map((obs) => {
        const isCrate = obs.type === 'crate';
        const isWall = obs.type === 'wall';
        const isPillar = obs.type === 'pillar';
        const isBuilding = obs.type === 'building';
        const isBunker = obs.type === 'bunker';
        const baseColor = obs.color || (isCrate ? '#d97706' : isWall ? '#64748b' : isPillar ? '#0f172a' : isBuilding ? '#334155' : isBunker ? '#1e293b' : '#475569');

        if (obs.type === 'ramp') {
          const lenX = obs.width;
          const lenZ = obs.depth;
          const h = obs.height;
          let rx = 0;
          let rz = 0;
          let rampLength = lenZ;
          let rampWidth = lenX;

          if (obs.rampDir === 'px') {
            rampLength = Math.hypot(lenX, h);
            rampWidth = lenZ;
            rz = Math.atan2(h, lenX);
          } else if (obs.rampDir === 'nx') {
            rampLength = Math.hypot(lenX, h);
            rampWidth = lenZ;
            rz = -Math.atan2(h, lenX);
          } else if (obs.rampDir === 'pz') {
            rampLength = Math.hypot(lenZ, h);
            rampWidth = lenX;
            rx = -Math.atan2(h, lenZ);
          } else if (obs.rampDir === 'nz') {
            rampLength = Math.hypot(lenZ, h);
            rampWidth = lenX;
            rx = Math.atan2(h, lenZ);
          }

          return (
            <group key={obs.id} position={[obs.x, h / 2, obs.z]}>
              <mesh castShadow receiveShadow rotation={[rx, 0, rz]}>
                <boxGeometry args={[obs.rampDir === 'px' || obs.rampDir === 'nx' ? rampLength : rampWidth, 0.4, obs.rampDir === 'pz' || obs.rampDir === 'nz' ? rampLength : rampWidth]} />
                <meshStandardMaterial color={baseColor} roughness={0.7} metalness={0.2} />
              </mesh>
            </group>
          );
        }

        return (
          <group key={obs.id} position={[obs.x, obs.height / 2, obs.z]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[obs.width, obs.height, obs.depth]} />
              <meshStandardMaterial 
                color={baseColor} 
                roughness={isCrate ? 0.8 : 0.5} 
                metalness={isBuilding || isPillar ? 0.35 : 0.15} 
              />
            </mesh>

            {/* Accent Roof Trim for Buildings and Bunkers */}
            {(isBuilding || isBunker) && (
              <mesh position={[0, obs.height / 2 + 0.15, 0]}>
                <boxGeometry args={[obs.width * 1.02, 0.3, obs.depth * 1.02]} />
                <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.2} roughness={0.4} metalness={0.8} />
              </mesh>
            )}

            {/* Industrial cross-brace or rim for crates */}
            {isCrate && (
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[obs.width * 1.01, obs.height * 0.1, obs.depth * 1.01]} />
                <meshStandardMaterial color="#78350f" roughness={0.9} />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}, (prev, next) => {
  return prev.obstacles === next.obstacles;
});

export function Map() {
  const gameState = useGameStore((s) => s.gameState);
  if (!gameState) return null;

  return (
    <group>
      <Environment preset="city" />
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#334155" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Grid Floor Overlay for Arena Vibe */}
      <gridHelper args={[400, 40, '#64748b', '#475569']} position={[0, 0.05, 0]} />

      {/* Memoized Static Obstacles */}
      <StaticObstacles obstacles={gameState.obstacles} />

      {/* Items */}
      {Object.values(gameState.items || {}).map(item => (
        <group key={item.id} position={[item.x, item.y, item.z]}>
          <mesh castShadow>
            <boxGeometry args={[1.6, 1.6, 1.6]} />
            <meshStandardMaterial 
              color={item.type === 'heal' ? '#10b981' : '#f59e0b'} 
              emissive={item.type === 'heal' ? '#059669' : '#d97706'} 
              emissiveIntensity={0.8} 
              roughness={0.2}
              metalness={0.5}
            />
          </mesh>
        </group>
      ))}

      {/* Hand Grenades (手榴弾) */}
      {gameState.bombs && Object.values(gameState.bombs).map(bomb => {
        const age = (Date.now() - bomb.createdAt) / 1000;
        const isNearDetonation = age > 2.0;
        const blinkRate = isNearDetonation ? 25 : 8;
        const isBlinkOn = Math.sin(Date.now() * 0.001 * blinkRate) > 0;

        if (bomb.exploded) {
          // Detonation Blast Fireball & Shockwave Ring
          return (
            <group key={bomb.id} position={[bomb.x, Math.max(0.5, bomb.y), bomb.z]}>
              {/* Expanding Fireball */}
              <mesh>
                <sphereGeometry args={[4.2, 16, 16]} />
                <meshBasicMaterial color="#f97316" transparent opacity={0.85} />
              </mesh>
              {/* White-hot Core */}
              <mesh>
                <sphereGeometry args={[2.5, 12, 12]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {/* Ground Shockwave Ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
                <ringGeometry args={[1, 7.5, 24]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.6} side={2} />
              </mesh>
            </group>
          );
        }

        return (
          <group 
            key={bomb.id} 
            position={[bomb.x, Math.max(0.35, bomb.y), bomb.z]} 
            rotation={[bomb.rx || 0.4, 0, bomb.rz || 0.2]}
            scale={[1.1, 1.1, 1.1]}
          >
            {/* Main Ribbed Pineapple Body */}
            <mesh castShadow position={[0, 0.4, 0]}>
              <cylinderGeometry args={[0.55, 0.6, 1.1, 12]} />
              <meshStandardMaterial color="#2d3725" roughness={0.7} metalness={0.4} />
            </mesh>

            {/* Segmented Grenade Rib Rings */}
            <mesh position={[0, 0.4, 0]}>
              <torusGeometry args={[0.58, 0.08, 8, 16]} />
              <meshStandardMaterial color="#1a2215" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <torusGeometry args={[0.56, 0.07, 8, 16]} />
              <meshStandardMaterial color="#1a2215" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <torusGeometry args={[0.56, 0.07, 8, 16]} />
              <meshStandardMaterial color="#1a2215" roughness={0.8} />
            </mesh>

            {/* Metal Fuse Collar & Striker Neck */}
            <mesh position={[0, 1.05, 0]}>
              <cylinderGeometry args={[0.22, 0.35, 0.35, 10]} />
              <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Safety Fly-Off Lever (Spoon) */}
            <mesh position={[0.25, 0.65, 0]} rotation={[0, 0, -0.15]}>
              <boxGeometry args={[0.08, 0.95, 0.22]} />
              <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.7} />
            </mesh>

            {/* Safety Pull Ring */}
            <mesh position={[-0.26, 1.05, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.16, 0.035, 6, 12]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.9} />
            </mesh>

            {/* Blinking Fuse LED / Thermal Spark Tip */}
            <mesh position={[0, 1.25, 0]}>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshStandardMaterial 
                color={isBlinkOn ? "#ef4444" : "#7f1d1d"} 
                emissive={isBlinkOn ? "#ef4444" : "#000000"} 
                emissiveIntensity={isBlinkOn ? 3.0 : 0} 
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
