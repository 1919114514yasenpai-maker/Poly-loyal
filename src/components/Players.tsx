import React, { useRef } from 'react';
import { useGameStore } from '../store';
import { useFrame } from '@react-three/fiber';
import { PlayerState } from '../types';
import { Vector3, Group } from 'three';

// Normalize angle difference to [-PI, PI] to prevent 360-degree flip spins
function lerpAngle(current: number, target: number, t: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

function RemotePlayer({ player }: { player: PlayerState }) {
  const ref = useRef<Group>(null);
  const innerRef = useRef<Group>(null);
  const targetPos = useRef(new Vector3(player.x, player.y, player.z));
  const initialized = useRef(false);

  // Update target ref when player state updates
  targetPos.current.set(player.x, player.y, player.z);

  // Smooth frame interpolation
  useFrame((state, delta) => {
    if (ref.current) {
      if (!initialized.current) {
        ref.current.position.copy(targetPos.current);
        ref.current.rotation.y = player.ry;
        initialized.current = true;
        return;
      }
      const dt = Math.min(delta, 0.1);
      const lerpFactor = 1 - Math.exp(-18 * dt);
      ref.current.position.lerp(targetPos.current, lerpFactor);
      ref.current.rotation.y = lerpAngle(ref.current.rotation.y, player.ry, lerpFactor);

      if (innerRef.current) {
        if (player.isRolling) {
          innerRef.current.rotation.x += dt * 18;
        } else {
          innerRef.current.rotation.x = 0;
        }
      }
    }
  });

  if (player.isDead) return null;

  return (
    <group ref={ref}>
      {/* Inner Flipping Group for Somersault Roll */}
      <group ref={innerRef}>
        {/* Body */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <capsuleGeometry args={[0.5, 1, 4, 8]} />
          <meshStandardMaterial color={player.color} roughness={0.4} metalness={0.2} />
        </mesh>
        
        {/* Eyes / Visor indicator */}
        <mesh position={[0, 0.5, -0.4]} castShadow>
          <boxGeometry args={[0.6, 0.2, 0.2]} />
          <meshStandardMaterial color="#111827" roughness={0.2} />
        </mesh>

        {/* 3D Weapon Model */}
        <group position={[0.45, 0.1, -0.3]}>
          {player.characterClass === 'sword' ? (
            <group rotation={[-0.4, 0.2, -0.2]}>
              <mesh position={[0, -0.3, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.35, 8]} />
                <meshStandardMaterial color="#0f172a" roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.1, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.03, 12]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.8, 0]}>
                <boxGeometry args={[0.05, 1.7, 0.02]} />
                <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[0.03, 0.8, 0]}>
                <boxGeometry args={[0.015, 1.72, 0.025]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </group>
          ) : (
            <group position={[0, 0, 0]}>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.14, 0.22, 0.55]} />
                <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.04, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.45, 8]} />
                <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.12, -0.05]}>
                <boxGeometry args={[0.08, 0.04, 0.35]} />
                <meshBasicMaterial color={player.color} />
              </mesh>
            </group>
          )}
        </group>
      </group>

      {/* Dodge Roll Slipstream Effect */}
      {player.isRolling && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.9, 0.9, 2.2, 16]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} wireframe />
        </mesh>
      )}

      {/* Tank Shield Visual */}
      {player.hasShield && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshStandardMaterial color="#fbbf24" transparent opacity={0.3} emissive="#fbbf24" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Sword Invulnerability Dash Visual */}
      {player.isInvulnerable && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[1, 1, 2.5, 16]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.4} emissive="#ef4444" emissiveIntensity={1} />
        </mesh>
      )}
      
      {/* Healing Visual */}
      {player.isHealing && (
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 2, 16]} />
          <meshStandardMaterial color="#22c55e" transparent opacity={0.3} emissive="#22c55e" emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  );
}

export function Players() {
  const gameState = useGameStore((s) => s.gameState);
  const myId = useGameStore((s) => s.myId);

  if (!gameState) return null;

  return (
    <>
      {Object.values(gameState.players).map((p) => {
        if (p.id === myId) return null;
        return <RemotePlayer key={p.id} player={p} />;
      })}
    </>
  );
}
