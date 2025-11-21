import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sky, OrbitControls, Sparkles, Cloud } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CharacterData } from '../App';
import { generateChunkData, ChunkData, CHUNK_SIZE } from '../utils/worldGen';
import { Minimap } from './Minimap';
import { Sun, Moon, CloudRain, Snowflake, Wind, Leaf, Clock, Play, Pause, Zap } from 'lucide-react';

interface GameWorldProps {
  character: CharacterData;
}

type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
type Weather = 'Clear' | 'Rain' | 'Snow';

// --- 3D BLOCK CHARACTER UTILS ---

interface UVMap {
    uMin: number; uMax: number;
    vMin: number; vMax: number;
}

const BoxWithUV: React.FC<{
  position?: [number, number, number];
  args: [number, number, number]; 
  texture: THREE.Texture | null;
  uvs: { front: UVMap, back: UVMap, side: UVMap, top: UVMap, bottom: UVMap };
}> = ({ position, args, texture, uvs }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    
    const geo = meshRef.current.geometry;
    const uvAttribute = geo.attributes.uv;
    
    const mapFace = (faceIndex: number, map: UVMap, flipX = false) => {
        const offset = faceIndex * 4;
        const u0 = flipX ? map.uMax : map.uMin;
        const u1 = flipX ? map.uMin : map.uMax;
        const v0 = map.vMin;
        const v1 = map.vMax;
        
        uvAttribute.setXY(offset + 0, u0, v1); // TL
        uvAttribute.setXY(offset + 1, u1, v1); // TR
        uvAttribute.setXY(offset + 2, u0, v0); // BL
        uvAttribute.setXY(offset + 3, u1, v0); // BR
    };

    // Front (4), Back (5), Right (0), Left (1), Top (2), Bottom (3)
    mapFace(4, uvs.front);
    mapFace(5, uvs.back); 
    mapFace(0, uvs.side);
    mapFace(1, uvs.side);
    mapFace(2, uvs.top);
    mapFace(3, uvs.bottom);

    uvAttribute.needsUpdate = true;
  }, [texture, uvs]);

  return (
    <mesh ref={meshRef} position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial map={texture} roughness={0.6} metalness={0.2} />
    </mesh>
  );
};

const BlockyCharacter: React.FC<{ 
  textureUrl: string; 
  isMoving: boolean;
}> = ({ textureUrl, isMoving }) => {
  const group = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  
  // Refs for hierarchical animation
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  
  const armLRef = useRef<THREE.Group>(null);      // Shoulder Pivot
  const lowerArmLRef = useRef<THREE.Group>(null); // Elbow Pivot
  
  const armRRef = useRef<THREE.Group>(null);
  const lowerArmRRef = useRef<THREE.Group>(null);
  
  const legLRef = useRef<THREE.Group>(null);      // Hip Pivot
  const lowerLegLRef = useRef<THREE.Group>(null); // Knee Pivot
  
  const legRRef = useRef<THREE.Group>(null);
  const lowerLegRRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(textureUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      // High Quality Filtering for less pixelated look
      tex.minFilter = THREE.LinearMipMapLinearFilter; 
      tex.magFilter = THREE.LinearFilter; 
      tex.generateMipmaps = true;
      tex.anisotropy = 16;
      setTexture(tex);
    });
  }, [textureUrl]);

  useFrame((state) => {
     if (!group.current) return;
     const t = state.clock.elapsedTime;
     const speed = 12; 
     
     const isWalk = isMoving;
     const bounce = isWalk ? Math.abs(Math.sin(t * speed * 2)) * 0.05 : Math.sin(t) * 0.01;
     const bodyTilt = isWalk ? Math.sin(t * speed) * 0.02 : 0;

     // Head Animation
     if (headRef.current) {
         headRef.current.rotation.y = Math.sin(t * 0.3) * 0.05;
         headRef.current.rotation.z = Math.sin(t * 0.1) * 0.02;
         headRef.current.position.y = 1.55 + bounce;
     }
     
     // Body Animation
     if (bodyRef.current) {
         bodyRef.current.rotation.z = bodyTilt;
         bodyRef.current.rotation.y = Math.sin(t * speed) * 0.05; // Counter twist
         bodyRef.current.position.y = 0.85 + bounce;
     }

     const limbRange = 0.8; // Increased swing range
     
     // --- ARMS ---
     // Left Arm
     if (armLRef.current) {
         const rot = isWalk ? Math.sin(t * speed) * limbRange : Math.sin(t) * 0.05;
         armLRef.current.rotation.x = -rot;
         armLRef.current.rotation.z = 0.1; // Slight A-pose
         armLRef.current.position.y = 1.4 + bounce;
         
         // Elbow Bend (Natural curl when swinging forward)
         if (lowerArmLRef.current) {
            const bend = isWalk ? Math.max(0, Math.sin(t * speed)) * 0.5 : 0.1;
            lowerArmLRef.current.rotation.x = -bend; 
         }
     }
     
     // Right Arm
     if (armRRef.current) {
         const rot = isWalk ? Math.sin(t * speed + Math.PI) * limbRange : -Math.sin(t) * 0.05;
         armRRef.current.rotation.x = -rot;
         armRRef.current.rotation.z = -0.1;
         armRRef.current.position.y = 1.4 + bounce;

         // Elbow Bend
         if (lowerArmRRef.current) {
            const bend = isWalk ? Math.max(0, Math.sin(t * speed + Math.PI)) * 0.5 : 0.1;
            lowerArmRRef.current.rotation.x = -bend;
         }
     }

     // --- LEGS ---
     // Left Leg
     if (legLRef.current) {
         const rot = isWalk ? Math.sin(t * speed) * limbRange : 0;
         legLRef.current.rotation.x = rot;
         legLRef.current.position.y = 0.75 + bounce;

         // Knee Bend (Bends when leg is moving back/up)
         if (lowerLegLRef.current) {
            const kneeBend = isWalk ? Math.max(0, Math.sin(t * speed - 0.5)) * 1.0 : 0;
            lowerLegLRef.current.rotation.x = kneeBend;
         }
     }
     
     // Right Leg
     if (legRRef.current) {
         const rot = isWalk ? Math.sin(t * speed + Math.PI) * limbRange : 0;
         legRRef.current.rotation.x = rot;
         legRRef.current.position.y = 0.75 + bounce;

         if (lowerLegRRef.current) {
             const kneeBend = isWalk ? Math.max(0, Math.sin(t * speed + Math.PI - 0.5)) * 1.0 : 0;
             lowerLegRRef.current.rotation.x = kneeBend;
         }
     }
  });

  if (!texture) return null;

  // --- UV DEFINITIONS ---
  // Image Layout: Left Half = Front, Right Half = Back
  // Heights: Top 0.75-1.0 (Head), Mid 0.40-0.75 (Torso/Arms), Bot 0.0-0.40 (Legs)
  
  const HEAD_V = { vMin: 0.75, vMax: 1.0 };
  const BODY_V = { vMin: 0.40, vMax: 0.75 };
  const LEG_V  = { vMin: 0.0, vMax: 0.40 };

  // Limb Splits (Vertical for joints)
  const ARM_SPLIT = 0.58; // Y-split for elbow
  const LEG_SPLIT = 0.20; // Y-split for knee

  const uvHead = { 
      front: { uMin: 0.125, uMax: 0.375, ...HEAD_V },
      back: { uMin: 0.625, uMax: 0.875, ...HEAD_V },
      side: { uMin: 0.0, uMax: 0.125, ...HEAD_V },
      top: { uMin: 0.125, uMax: 0.375, vMin: 0.9, vMax: 1.0 }, // Fake top
      bottom: { uMin: 0.125, uMax: 0.375, vMin: 0.75, vMax: 0.8 }
  };

  const uvTorso = {
      front: { uMin: 0.15, uMax: 0.35, ...BODY_V },
      back: { uMin: 0.65, uMax: 0.85, ...BODY_V },
      side: { uMin: 0.12, uMax: 0.15, ...BODY_V },
      top: { uMin: 0.15, uMax: 0.35, vMin: 0.74, vMax: 0.75 },
      bottom: { uMin: 0.15, uMax: 0.35, vMin: 0.40, vMax: 0.41 }
  };

  // --- ARM UVs ---
  // Upper Arm: Top half of arm texture
  const uvUpperArmR = {
      front: { uMin: 0.0, uMax: 0.15, vMin: ARM_SPLIT, vMax: 0.75 },
      back: { uMin: 0.85, uMax: 1.0, vMin: ARM_SPLIT, vMax: 0.75 },
      side: { uMin: 0.0, uMax: 0.05, vMin: ARM_SPLIT, vMax: 0.75 },
      top: { uMin: 0.0, uMax: 0.15, vMin: 0.74, vMax: 0.75 },
      bottom: { uMin: 0.0, uMax: 0.15, vMin: ARM_SPLIT, vMax: ARM_SPLIT+0.01 }
  };
  const uvLowerArmR = {
      front: { uMin: 0.0, uMax: 0.15, vMin: 0.40, vMax: ARM_SPLIT },
      back: { uMin: 0.85, uMax: 1.0, vMin: 0.40, vMax: ARM_SPLIT },
      side: { uMin: 0.0, uMax: 0.05, vMin: 0.40, vMax: ARM_SPLIT },
      top: { uMin: 0.0, uMax: 0.15, vMin: ARM_SPLIT, vMax: ARM_SPLIT+0.01 },
      bottom: { uMin: 0.0, uMax: 0.15, vMin: 0.40, vMax: 0.41 } // Hand
  };

  const uvUpperArmL = {
      front: { uMin: 0.35, uMax: 0.50, vMin: ARM_SPLIT, vMax: 0.75 },
      back: { uMin: 0.50, uMax: 0.65, vMin: ARM_SPLIT, vMax: 0.75 },
      side: { uMin: 0.45, uMax: 0.50, vMin: ARM_SPLIT, vMax: 0.75 },
      top: { uMin: 0.35, uMax: 0.50, vMin: 0.74, vMax: 0.75 },
      bottom: { uMin: 0.35, uMax: 0.50, vMin: ARM_SPLIT, vMax: ARM_SPLIT+0.01 }
  };
  const uvLowerArmL = {
      front: { uMin: 0.35, uMax: 0.50, vMin: 0.40, vMax: ARM_SPLIT },
      back: { uMin: 0.50, uMax: 0.65, vMin: 0.40, vMax: ARM_SPLIT },
      side: { uMin: 0.45, uMax: 0.50, vMin: 0.40, vMax: ARM_SPLIT },
      top: { uMin: 0.35, uMax: 0.50, vMin: ARM_SPLIT, vMax: ARM_SPLIT+0.01 },
      bottom: { uMin: 0.35, uMax: 0.50, vMin: 0.40, vMax: 0.41 }
  };

  // --- LEG UVs ---
  const uvUpperLegR = {
      front: { uMin: 0.05, uMax: 0.25, vMin: LEG_SPLIT, vMax: 0.40 },
      back: { uMin: 0.75, uMax: 0.95, vMin: LEG_SPLIT, vMax: 0.40 },
      side: { uMin: 0.0, uMax: 0.05, vMin: LEG_SPLIT, vMax: 0.40 },
      top: { uMin: 0.05, uMax: 0.25, vMin: 0.39, vMax: 0.40 },
      bottom: { uMin: 0.05, uMax: 0.25, vMin: LEG_SPLIT, vMax: LEG_SPLIT+0.01 }
  };
  const uvLowerLegR = {
      front: { uMin: 0.05, uMax: 0.25, vMin: 0.0, vMax: LEG_SPLIT },
      back: { uMin: 0.75, uMax: 0.95, vMin: 0.0, vMax: LEG_SPLIT },
      side: { uMin: 0.0, uMax: 0.05, vMin: 0.0, vMax: LEG_SPLIT },
      top: { uMin: 0.05, uMax: 0.25, vMin: LEG_SPLIT, vMax: LEG_SPLIT+0.01 },
      bottom: { uMin: 0.05, uMax: 0.25, vMin: 0.0, vMax: 0.01 } // Foot
  };

  const uvUpperLegL = {
      front: { uMin: 0.25, uMax: 0.45, vMin: LEG_SPLIT, vMax: 0.40 },
      back: { uMin: 0.55, uMax: 0.75, vMin: LEG_SPLIT, vMax: 0.40 },
      side: { uMin: 0.45, uMax: 0.50, vMin: LEG_SPLIT, vMax: 0.40 },
      top: { uMin: 0.25, uMax: 0.45, vMin: 0.39, vMax: 0.40 },
      bottom: { uMin: 0.25, uMax: 0.45, vMin: LEG_SPLIT, vMax: LEG_SPLIT+0.01 }
  };
  const uvLowerLegL = {
      front: { uMin: 0.25, uMax: 0.45, vMin: 0.0, vMax: LEG_SPLIT },
      back: { uMin: 0.55, uMax: 0.75, vMin: 0.0, vMax: LEG_SPLIT },
      side: { uMin: 0.45, uMax: 0.50, vMin: 0.0, vMax: LEG_SPLIT },
      top: { uMin: 0.25, uMax: 0.45, vMin: LEG_SPLIT, vMax: LEG_SPLIT+0.01 },
      bottom: { uMin: 0.25, uMax: 0.45, vMin: 0.0, vMax: 0.01 }
  };

  return (
    <group ref={group}>
        {/* Head */}
        <group ref={headRef} position={[0, 1.5, 0]}>
             <BoxWithUV args={[0.5, 0.5, 0.5]} texture={texture} uvs={uvHead} />
        </group>
        
        {/* Body - Thicker depth for volume */}
        <group ref={bodyRef} position={[0, 0.75, 0]}>
            <BoxWithUV args={[0.4, 0.75, 0.28]} texture={texture} uvs={uvTorso} />
        </group>
        
        {/* Left Arm (Jointed) */}
        <group ref={armLRef} position={[-0.32, 1.35, 0]}>
            {/* Upper Arm */}
            <group position={[0, -0.175, 0]}> 
                <BoxWithUV args={[0.18, 0.35, 0.18]} texture={texture} uvs={uvUpperArmL} />
                {/* Lower Arm Pivot */}
                <group ref={lowerArmLRef} position={[0, -0.175, 0]}>
                    <group position={[0, -0.175, 0]}>
                        <BoxWithUV args={[0.16, 0.35, 0.16]} texture={texture} uvs={uvLowerArmL} />
                    </group>
                </group>
            </group>
        </group>
        
        {/* Right Arm (Jointed) */}
        <group ref={armRRef} position={[0.32, 1.35, 0]}>
            <group position={[0, -0.175, 0]}>
                <BoxWithUV args={[0.18, 0.35, 0.18]} texture={texture} uvs={uvUpperArmR} />
                <group ref={lowerArmRRef} position={[0, -0.175, 0]}>
                    <group position={[0, -0.175, 0]}>
                         <BoxWithUV args={[0.16, 0.35, 0.16]} texture={texture} uvs={uvLowerArmR} />
                    </group>
                </group>
            </group>
        </group>
        
        {/* Left Leg (Jointed) */}
        <group ref={legLRef} position={[-0.11, 0.75, 0]}>
            {/* Upper Leg */}
            <group position={[0, -0.19, 0]}>
                <BoxWithUV args={[0.20, 0.38, 0.20]} texture={texture} uvs={uvUpperLegL} />
                {/* Knee Pivot */}
                <group ref={lowerLegLRef} position={[0, -0.19, 0]}>
                    <group position={[0, -0.19, 0]}>
                        <BoxWithUV args={[0.18, 0.38, 0.18]} texture={texture} uvs={uvLowerLegL} />
                    </group>
                </group>
            </group>
        </group>
        
        {/* Right Leg (Jointed) */}
        <group ref={legRRef} position={[0.11, 0.75, 0]}>
            <group position={[0, -0.19, 0]}>
                <BoxWithUV args={[0.20, 0.38, 0.20]} texture={texture} uvs={uvUpperLegR} />
                <group ref={lowerLegRRef} position={[0, -0.19, 0]}>
                    <group position={[0, -0.19, 0]}>
                        <BoxWithUV args={[0.18, 0.38, 0.18]} texture={texture} uvs={uvLowerLegR} />
                    </group>
                </group>
            </group>
        </group>
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <circleGeometry args={[0.6, 32]} />
            <meshBasicMaterial color="black" opacity={0.3} transparent />
        </mesh>
    </group>
  );
};

// --- Player Controller Component ---
const Player: React.FC<{ 
  textureUrl: string; 
  position: [number, number, number];
  setGlobalPos: (pos: [number, number, number]) => void; 
  controlsRef: React.RefObject<OrbitControlsImpl>;
}> = ({ textureUrl, position: initialPos, setGlobalPos, controlsRef }) => {
  const ref = useRef<THREE.Group>(null);
  const [pos, setPos] = useState<[number, number, number]>(initialPos);
  const [isMoving, setIsMoving] = useState(false);
  const { camera } = useThree();
  
  const keys = useRef<{ [key: string]: boolean }>({});
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;

    const speed = 0.18;
    let newX = pos[0];
    let newZ = pos[2];
    let moving = false;

    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    if (keys.current['KeyW'] || keys.current['ArrowUp']) {
      newX += forward.x * speed;
      newZ += forward.z * speed;
      moving = true;
    }
    if (keys.current['KeyS'] || keys.current['ArrowDown']) {
      newX -= forward.x * speed;
      newZ -= forward.z * speed;
      moving = true;
    }
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
      newX -= right.x * speed;
      newZ -= right.z * speed;
      moving = true;
    }
    if (keys.current['KeyD'] || keys.current['ArrowRight']) {
      newX += right.x * speed;
      newZ += right.z * speed;
      moving = true;
    }

    setIsMoving(moving);

    if (moving) {
        const targetRotation = Math.atan2(newX - pos[0], newZ - pos[2]);
        let diff = targetRotation - ref.current.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ref.current.rotation.y += diff * 0.15;

        setPos([newX, 0, newZ]);
        setGlobalPos([newX, 0, newZ]);
    }
    
    ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, newX, 0.25);
    ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, newZ, 0.25);
    ref.current.position.y = 0;

    if (controlsRef.current) {
        const target = new THREE.Vector3(newX, 2, newZ); 
        controlsRef.current.target.lerp(target, 0.1);
        controlsRef.current.update();
        
        const camOffset = new THREE.Vector3().subVectors(camera.position, controlsRef.current.target);
        const desiredDist = 10;
        if(Math.abs(camOffset.length() - desiredDist) > 1) {
            camOffset.setLength(THREE.MathUtils.lerp(camOffset.length(), desiredDist, 0.05));
            camera.position.copy(controlsRef.current.target).add(camOffset);
        }
    }
  });

  useEffect(() => {
     const dist = Math.sqrt(Math.pow(pos[0]-initialPos[0], 2) + Math.pow(pos[2]-initialPos[2], 2));
     if (dist > 5) {
         setPos(initialPos);
         if(ref.current) {
             ref.current.position.set(initialPos[0], 0, initialPos[2]);
         }
     }
  }, [initialPos]);

  return (
    <group ref={ref} position={initialPos}>
       <BlockyCharacter textureUrl={textureUrl} isMoving={isMoving} />
    </group>
  );
};

// --- Environment & Time System ---

const EnvironmentController: React.FC<{ time: number, season: Season, weather: Weather }> = ({ time, season, weather }) => {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  // Calculate Celestial Positions
  // 6:00 = 0 deg (Rise), 12:00 = 90 deg (Top), 18:00 = 180 deg (Set)
  const sunAngle = ((time - 6) / 24) * Math.PI * 2;
  const radius = 100;
  const sunX = Math.cos(sunAngle) * radius;
  const sunY = Math.sin(sunAngle) * radius;
  const sunZ = -20; // Slight tilt

  // Moon is opposite to sun
  const moonX = Math.cos(sunAngle + Math.PI) * radius;
  const moonY = Math.sin(sunAngle + Math.PI) * radius;
  const moonZ = -20;

  const isNight = time < 5.5 || time > 18.5;
  const isDuskDawn = (time > 5 && time < 7) || (time > 17 && time < 19);

  // Weather Overrides
  const isRaining = weather === 'Rain';
  const isSnowing = weather === 'Snow';
  const isClear = weather === 'Clear';

  useFrame(() => {
     if (sunRef.current) {
         sunRef.current.position.set(sunX, sunY, sunZ);
         
         let intensity = isNight ? 0 : isDuskDawn ? 0.5 : 1.2;
         if (isRaining || isSnowing) intensity *= 0.4; // Dim light during storm

         sunRef.current.intensity = THREE.MathUtils.lerp(sunRef.current.intensity, intensity, 0.05);
         
         const color = new THREE.Color();
         if (isDuskDawn) color.setHSL(0.08, 0.8, 0.6); // Orange/Red
         else if (isNight) color.setHSL(0.6, 0.5, 0.1); // Dark Blue
         else if (isRaining) color.setHSL(0.6, 0.2, 0.7); // Gray Blue
         else color.setHSL(0.1, 0.1, 1.0); // White

         sunRef.current.color.lerp(color, 0.05);
     }
     
     if (ambientRef.current) {
         let intensity = isNight ? 0.15 : 0.5;
         if (isSnowing) intensity += 0.2; // Snow reflects light
         ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, intensity, 0.05);
     }
  });

  return (
    <>
       <Sky 
         sunPosition={[sunX, sunY, sunZ]} 
         turbidity={isRaining ? 10 : isDuskDawn ? 8 : 2} 
         rayleigh={isRaining ? 0.5 : isDuskDawn ? 4 : isNight ? 0.1 : 0.5} 
         mieCoefficient={isRaining ? 0.1 : 0.005} 
         mieDirectionalG={0.8} 
       />
       
       {/* 3D Celestial Bodies */}
       <group>
            {/* Sun Mesh */}
            <mesh position={[sunX, sunY, sunZ]}>
                <sphereGeometry args={[8, 32, 32]} />
                <meshStandardMaterial 
                    emissive="#FDB813" 
                    emissiveIntensity={3} 
                    color="#FDB813" 
                    toneMapped={false} 
                />
            </mesh>
            
            {/* Moon Mesh */}
            <mesh position={[moonX, moonY, moonZ]}>
                <sphereGeometry args={[5, 32, 32]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
            </mesh>
       </group>

       {/* Stars only visible at night and clear weather */}
       {isNight && isClear && (
         <Stars radius={150} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
       )}
       
       <ambientLight ref={ambientRef} intensity={0.5} />
       <directionalLight 
         ref={sunRef}
         position={[sunX, sunY, sunZ]} 
         intensity={1.5} 
         castShadow 
         shadow-mapSize={[2048, 2048]}
         shadow-bias={-0.0005}
       >
          <orthographicCamera attach="shadow-camera" args={[-50, 50, 50, -50]} />
       </directionalLight>

       {/* Weather Particles */}
       {/* Snow: Explicit setting OR Winter default if Clear */}
       {(isSnowing || (isClear && season === 'Winter')) && (
         <Sparkles count={800} scale={60} size={4} speed={0.4} opacity={0.8} color="#fff" position={[0, 10, 0]} noise={0.5} />
       )}
       
       {/* Rain: Blue fast particles */}
       {isRaining && (
          // Sparkles aren't lines, but high speed and count simulates rain decently
          <Sparkles count={1500} scale={[40, 40, 40]} size={6} speed={3} opacity={0.6} color="#a2d2ff" position={[0, 15, 0]} noise={0.2} />
       )}

       {/* Autumn Leaves */}
       {isClear && season === 'Autumn' && (
         <Sparkles count={200} scale={60} size={6} speed={0.2} opacity={0.7} color="#d35400" position={[0, 10, 0]} noise={1} />
       )}
    </>
  );
};

// --- Chunk Rendering Component ---

// Helper to shift colors based on season
const getSeasonalColor = (baseColor: string, type: string, season: Season, biome: string) => {
    if (biome === 'snow' || biome === 'magical' || biome === 'volcanic' || biome === 'desert') return baseColor;
  
    const c = new THREE.Color(baseColor);
    
    if (type === 'ground') {
        if (season === 'Winter') return '#e2e8f0'; // Snow cover
        if (season === 'Autumn') { c.offsetHSL(0.05, -0.2, -0.1); return '#' + c.getHexString(); } // Dry
    }
    if (type === 'foliage') { // Tree leaves, bushes, grass
        if (season === 'Winter') return '#f1f5f9'; // Snow covered
        if (season === 'Autumn') return '#e76f51'; // Orange/Red
        if (season === 'Spring') { c.offsetHSL(0.1, 0.2, 0.1); return '#' + c.getHexString(); } // Vibrant Green
        if (season === 'Summer') { c.offsetHSL(0, 0, -0.1); return '#' + c.getHexString(); } // Deep Green
    }
    return baseColor;
};

// Memoize chunk to prevent re-renders every frame, only update when season changes
const Chunk = React.memo(({ data, position, season, isNight, weather }: { 
    data: ChunkData, 
    position: [number, number, number], 
    season: Season,
    isNight: boolean,
    weather: Weather
}) => {
  
  const groundColor = getSeasonalColor(data.groundColor, 'ground', season, data.biomeType);
  
  // Fireflies Logic: Only appear at Night, in Clear weather, in Spring/Summer, in specific biomes
  const showFireflies = isNight && weather === 'Clear' && (season === 'Spring' || season === 'Summer') 
                        && ['forest', 'plains', 'swamp'].includes(data.biomeType);

  return (
    <group position={position}>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CHUNK_SIZE, CHUNK_SIZE]} />
        <meshStandardMaterial color={groundColor} roughness={1} />
      </mesh>

      {/* Water Layer */}
      {data.hasWater && (
        <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
           <planeGeometry args={[CHUNK_SIZE, CHUNK_SIZE]} />
           <meshStandardMaterial 
              color={data.biomeType === 'swamp' ? '#4d908e' : (season === 'Winter' ? '#a2d2ff' : '#00b4d8')} 
              transparent opacity={season === 'Winter' ? 0.8 : 0.6} roughness={0.1} metalness={0.2} 
           />
        </mesh>
      )}
      
      {/* Biome Atmosphere Particles */}
      {data.biomeType === 'magical' && (
         <Sparkles count={50} scale={CHUNK_SIZE} size={6} speed={0.4} opacity={0.5} color="#bfa2db" position={[0, 5, 0]} />
      )}

      {showFireflies && (
          <Sparkles count={30} scale={[CHUNK_SIZE, 5, CHUNK_SIZE]} size={4} speed={0.4} opacity={0.8} color="#aaff00" position={[0, 2, 0]} noise={0.2} />
      )}

      {/* Procedural Objects */}
      {data.objects.map((obj, i) => {
        const pos: [number, number, number] = [obj.x, obj.y, obj.z];
        const key = `obj-${i}`;

        if (obj.type === 'cloud') {
             return (
                 <group key={key} position={pos}>
                     <Cloud opacity={0.5} speed={0.1} bounds={[obj.scale[0], 2, obj.scale[2]]} segments={10} color={obj.color} />
                 </group>
             )
        }

        if (obj.type === 'water') return null; // Handled as layer

        // Determine Seasonal Colors
        let renderColor = obj.color;
        if (['tree', 'bush', 'grass', 'palm'].includes(obj.type)) {
            renderColor = getSeasonalColor(obj.color, 'foliage', season, data.biomeType);
        }
        if (obj.type === 'palm' && season === 'Winter') renderColor = '#8d99ae'; // Dead/Frozen palm

        return (
            <group key={key} position={pos} rotation={[0, obj.rotation, 0]}>
                {/* Trees with separate trunk and leaves */}
                {obj.type === 'tree' && (
                    <group>
                        <mesh position={[0, obj.scale[1]/3, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.15 * obj.scale[0], 0.25 * obj.scale[0], obj.scale[1]/2, 6]} />
                            <meshStandardMaterial color="#4a3b2a" />
                        </mesh>
                        <mesh position={[0, obj.scale[1]*0.8, 0]} castShadow>
                            <coneGeometry args={[1.2 * obj.scale[0], obj.scale[1]*0.8, 8]} />
                            <meshStandardMaterial color={renderColor} />
                        </mesh>
                    </group>
                )}

                {/* Palm Trees */}
                {obj.type === 'palm' && (
                    <group>
                         <mesh position={[0, obj.scale[1]/2, 0]} rotation={[0.1, 0, 0]} castShadow>
                             <cylinderGeometry args={[0.1 * obj.scale[0], 0.15 * obj.scale[0], obj.scale[1], 5]} />
                             <meshStandardMaterial color="#8a6a4b" />
                         </mesh>
                         <group position={[0, obj.scale[1], 0.1 * obj.scale[1]]}>
                             {[0, 1, 2, 3, 4].map(idx => (
                                 <mesh key={idx} rotation={[0.5, idx * (Math.PI*2/5), 0]} position={[0, 0, 0]}>
                                     <boxGeometry args={[0.8 * obj.scale[0], 0.05, 2.5 * obj.scale[0]]} />
                                     <meshStandardMaterial color={renderColor} />
                                 </mesh>
                             ))}
                         </group>
                    </group>
                )}
                
                {/* Mushrooms */}
                {obj.type === 'mushroom' && (
                    <group>
                        <mesh position={[0, obj.scale[1]/2, 0]}>
                            <cylinderGeometry args={[0.2 * obj.scale[0], 0.3 * obj.scale[0], obj.scale[1], 6]} />
                            <meshStandardMaterial color="#f1faee" />
                        </mesh>
                        <mesh position={[0, obj.scale[1], 0]}>
                            <coneGeometry args={[0.8 * obj.scale[0], 0.5 * obj.scale[0], 8]} />
                            <meshStandardMaterial color={obj.color} />
                        </mesh>
                    </group>
                )}

                {/* Rocks (Jagged) */}
                {obj.type === 'rock' && (
                    <mesh castShadow receiveShadow scale={obj.scale}>
                        <dodecahedronGeometry args={[0.8, 0]} />
                        <meshStandardMaterial color={season === 'Winter' ? '#dee2e6' : obj.color} roughness={0.9} />
                    </mesh>
                )}

                {/* Bushes (Round) */}
                {obj.type === 'bush' && (
                    <mesh castShadow scale={obj.scale} position={[0, 0.4, 0]}>
                         <sphereGeometry args={[0.6, 7, 6]} />
                         <meshStandardMaterial color={renderColor} roughness={1} />
                    </mesh>
                )}

                {/* Reeds (Thin clusters) */}
                {obj.type === 'reed' && (
                    <group>
                        {[-0.1, 0.1].map((ox, idx) => (
                            <mesh key={idx} position={[ox, obj.scale[1]/2, 0]}>
                                <cylinderGeometry args={[0.03, 0.03, obj.scale[1], 4]} />
                                <meshStandardMaterial color={season === 'Autumn' ? '#d4a373' : obj.color} />
                            </mesh>
                        ))}
                    </group>
                )}

                {/* Dead Bushes */}
                {obj.type === 'deadbush' && (
                     <mesh castShadow>
                         <dodecahedronGeometry args={[0.3, 0]} />
                         <meshStandardMaterial color={obj.color} wireframe />
                     </mesh>
                )}
                
                {/* Simple objects fallbacks */}
                {['grass', 'flower', 'crystal'].includes(obj.type) && (
                    <mesh castShadow receiveShadow scale={obj.scale}>
                        {obj.type === 'grass' ? <coneGeometry args={[1, 1, 3]} /> :
                         obj.type === 'crystal' ? <octahedronGeometry args={[1, 0]} /> :
                         <torusKnotGeometry args={[0.5, 0.2, 16, 4]} />
                        }
                        <meshStandardMaterial 
                            color={obj.type === 'grass' ? renderColor : obj.color} 
                            emissive={obj.type === 'crystal' ? obj.color : '#000'}
                            emissiveIntensity={obj.type === 'crystal' ? 0.5 : 0}
                        />
                    </mesh>
                )}

                {obj.type === 'ruins' && (
                    <mesh castShadow receiveShadow scale={obj.scale}>
                         <boxGeometry args={[1, 1, 1]} />
                         <meshStandardMaterial color={obj.color} roughness={0.9} />
                    </mesh>
                )}
                
                {obj.type === 'cactus' && (
                    <mesh castShadow receiveShadow scale={obj.scale}>
                         <boxGeometry args={[0.8, 1, 0.8]} />
                         <meshStandardMaterial color={obj.color} />
                    </mesh>
                )}

            </group>
        );
      })}
    </group>
  );
}, (prev, next) => {
    return prev.data === next.data && 
           prev.season === next.season && 
           prev.isNight === next.isNight &&
           prev.weather === next.weather;
});


// --- Main World Component ---
export const GameWorld: React.FC<GameWorldProps> = ({ character }) => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 1, 0]);
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map());
  const [activeChunkKeys, setActiveChunkKeys] = useState<string[]>([]);
  
  // Time & Season State
  const [time, setTime] = useState(8.0); // 8:00 AM start
  const [season, setSeason] = useState<Season>('Spring');
  const [weather, setWeather] = useState<Weather>('Clear');
  
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [timeSpeed, setTimeSpeed] = useState(1.0);

  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Timer Loop
  useEffect(() => {
     if (!autoAdvance) return;
     const interval = setInterval(() => {
         setTime(prev => {
             // Base Rate: 1 hour every 10 seconds at speed 1.0
             // interval 100ms. 0.01 hours per tick = 36 seconds for 1 hour
             // Let's do: 1 hour = 20 seconds real time at 1x
             // 1 hour = 1.0 units. 20s = 200 ticks. 1/200 = 0.005
             let next = prev + (0.01 * timeSpeed);
             if (next >= 24) next = 0;
             return next;
         });
     }, 50);
     return () => clearInterval(interval);
  }, [autoAdvance, timeSpeed]);

  const getChunkKey = (cx: number, cz: number) => `${cx},${cz}`;

  const handleTeleport = (x: number, z: number) => {
    setPlayerPosition([x, 0, z]);
    if (controlsRef.current) {
        controlsRef.current.target.set(x, 2, z);
        controlsRef.current.update();
    }
  };

  useEffect(() => {
    const cx = Math.floor(playerPosition[0] / CHUNK_SIZE);
    const cz = Math.floor(playerPosition[2] / CHUNK_SIZE);

    const newActiveKeys: string[] = [];
    const newChunks = new Map(chunks);
    let changed = false;

    const radius = 2;
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        const key = getChunkKey(cx + x, cz + z);
        newActiveKeys.push(key);

        if (!newChunks.has(key)) {
          const chunkData = generateChunkData(cx + x, cz + z);
          newChunks.set(key, chunkData);
          changed = true;
        }
      }
    }

    if (changed) {
      setChunks(newChunks);
    }
    setActiveChunkKeys(newActiveKeys);
  }, [playerPosition[0], playerPosition[2]]); 

  // Format Time for UI
  const formatTime = (t: number) => {
      const h = Math.floor(t);
      const m = Math.floor((t - h) * 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  const getSeasonIcon = () => {
      switch(season) {
          case 'Spring': return <Leaf size={16} className="text-green-400" />;
          case 'Summer': return <Sun size={16} className="text-yellow-400" />;
          case 'Autumn': return <Wind size={16} className="text-orange-400" />;
          case 'Winter': return <Snowflake size={16} className="text-blue-200" />;
      }
  }

  const isNight = time < 5.5 || time > 18.5;

  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 8, 12], fov: 50 }}>
        <EnvironmentController time={time} season={season} weather={weather} />
        
        <Player 
          textureUrl={character.imageData} 
          position={playerPosition} 
          setGlobalPos={setPlayerPosition}
          controlsRef={controlsRef}
        />

        <OrbitControls 
            ref={controlsRef} 
            enablePan={false}
            minDistance={5}
            maxDistance={40}
            maxPolarAngle={Math.PI / 2 - 0.05} 
        />

        {activeChunkKeys.map(key => {
          const chunk = chunks.get(key);
          if (!chunk) return null;
          const [cx, cz] = key.split(',').map(Number);
          return (
            <Chunk 
                key={key} 
                data={chunk} 
                position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]} 
                season={season} 
                isNight={isNight}
                weather={weather}
            />
          );
        })}
        
        <fog attach="fog" args={[season === 'Winter' ? '#e0fbfc' : weather === 'Rain' ? '#1e293b' : '#0f172a', 10, 70]} />
      </Canvas>

      {/* --- Central Control Dashboard --- */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 w-full max-w-lg pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl text-white shadow-2xl flex flex-col gap-3 pointer-events-auto w-full max-w-md">
              
              {/* Top Row: Time Display + Season + Weather */}
              <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                        <Clock size={20} className="text-cyan-400" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-2xl font-bold font-mono leading-none">{formatTime(time)}</span>
                        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Day {Math.floor(time/24) + 1}</span>
                     </div>
                  </div>

                  <div className="h-8 w-px bg-slate-700 mx-2"></div>

                  <div className="flex gap-2">
                      <button 
                        onClick={() => {
                            const seasons: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
                            const idx = seasons.indexOf(season);
                            setSeason(seasons[(idx + 1) % 4]);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-md transition border border-slate-700"
                        title="Change Season"
                      >
                          {getSeasonIcon()}
                          <span className="text-xs font-bold">{season}</span>
                      </button>

                      <div className="flex bg-slate-800 rounded-md p-1 border border-slate-700">
                          <button 
                             onClick={() => setWeather('Clear')}
                             className={`p-1 rounded ${weather === 'Clear' ? 'bg-yellow-500 text-white' : 'text-slate-400 hover:text-white'}`}
                             title="Clear"
                          ><Sun size={14}/></button>
                          <button 
                             onClick={() => setWeather('Rain')}
                             className={`p-1 rounded ${weather === 'Rain' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                             title="Rain"
                          ><CloudRain size={14}/></button>
                          <button 
                             onClick={() => setWeather('Snow')}
                             className={`p-1 rounded ${weather === 'Snow' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white'}`}
                             title="Snow"
                          ><Snowflake size={14}/></button>
                      </div>
                  </div>
              </div>
              
              {/* Middle Row: Time Scrubber */}
              <div className="w-full flex items-center gap-2">
                  <Sun size={12} className="text-yellow-500" />
                  <input 
                    type="range" 
                    min="0" max="24" step="0.1"
                    value={time}
                    onChange={(e) => setTime(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <Moon size={12} className="text-blue-300" />
              </div>

              {/* Bottom Row: Speed Control & Pause */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                      <Zap size={12} />
                      <span>Time Speed: {timeSpeed.toFixed(1)}x</span>
                      <input 
                        type="range" 
                        min="0" max="5" step="0.5"
                        value={timeSpeed}
                        onChange={(e) => setTimeSpeed(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                  </div>
                  
                  <button 
                    onClick={() => setAutoAdvance(!autoAdvance)}
                    className={`flex items-center gap-1 px-2 py-1 rounded border ${
                        autoAdvance 
                        ? 'bg-green-500/10 border-green-500/50 text-green-400' 
                        : 'bg-red-500/10 border-red-500/50 text-red-400'
                    }`}
                  >
                      {autoAdvance ? <Pause size={10} /> : <Play size={10} />}
                      {autoAdvance ? 'RUNNING' : 'PAUSED'}
                  </button>
              </div>

          </div>
      </div>

      {/* Character Card - Left */}
      <div className="absolute top-24 left-4 p-4 bg-slate-900/80 backdrop-blur text-white rounded-lg border border-slate-700 max-w-xs select-none shadow-lg pointer-events-none z-10 transform scale-90 origin-top-left">
        <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 bg-slate-800 rounded-lg overflow-hidden border border-cyan-500 flex items-center justify-center relative">
                <div className="w-full h-full overflow-hidden relative">
                     <img src={character.imageData} alt="Avatar" className="w-[200%] max-w-none h-full object-cover absolute top-0 left-0" />
                </div>
            </div>
            <div>
                <h2 className="font-bold text-cyan-400">{character.name}</h2>
                <div className="text-xs text-slate-400">{character.description.substring(0, 30)}...</div>
            </div>
        </div>
        <div className="space-y-1 text-xs font-mono text-slate-300">
            <div className="flex justify-between"><span>STR</span> <div className="w-24 bg-slate-700 rounded overflow-hidden"><div className="h-full bg-red-500" style={{width: `${character.stats.strength * 10}%`}}></div></div></div>
            <div className="flex justify-between"><span>SPD</span> <div className="w-24 bg-slate-700 rounded overflow-hidden"><div className="h-full bg-green-500" style={{width: `${character.stats.speed * 10}%`}}></div></div></div>
            <div className="flex justify-between"><span>MAG</span> <div className="w-24 bg-slate-700 rounded overflow-hidden"><div className="h-full bg-purple-500" style={{width: `${character.stats.magic * 10}%`}}></div></div></div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 text-white/50 text-sm font-mono select-none pointer-events-none">
        <p>Pos: {playerPosition[0].toFixed(0)}, {playerPosition[2].toFixed(0)}</p>
        <p>WASD to Walk • Drag to Orbit</p>
      </div>

      <div className="absolute top-4 right-4 z-50">
        <Minimap chunks={chunks} playerPos={playerPosition} onTeleport={handleTeleport} />
      </div>
    </div>
  );
};