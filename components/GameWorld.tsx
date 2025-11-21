import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Sky, OrbitControls, Sparkles, Cloud, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CharacterData } from '../App';
import { generateChunkData, ChunkData, CHUNK_SIZE } from '../utils/worldGen';
import { Minimap } from './Minimap';

interface GameWorldProps {
  character: CharacterData;
}

// --- 3D BLOCK CHARACTER UTILS ---

// A custom Box component that re-maps UVs to support "Split Texture" (Left=Front, Right=Back)
const BoxWithUV: React.FC<{
  position?: [number, number, number];
  args: [number, number, number]; // width, height, depth
  texture: THREE.Texture | null;
  uvRange: { u: [number, number], v: [number, number] }; // The region of the texture this part uses
}> = ({ position, args, texture, uvRange }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    
    const geo = meshRef.current.geometry;
    // BoxGeometry has 24 vertices (4 per face * 6 faces)
    // Face Order in ThreeJS BoxGeometry (usually):
    // 0: +x (Right), 1: -x (Left), 2: +y (Top), 3: -y (Bottom), 4: +z (Front), 5: -z (Back)
    // Each face has 4 vertices.
    
    const uvAttribute = geo.attributes.uv;
    
    // Texture Layout from AI:
    // [  FRONT (Left Half)  |  BACK (Right Half)  ]
    // u: 0.0 -> 0.5         |  u: 0.5 -> 1.0
    
    // We pass in uvRange for the vertical slice (e.g. Head is top, Legs bottom)
    // uvRange.v = [ymin, ymax]
    
    const uFrontMin = 0.05; const uFrontMax = 0.45; // Slight padding to avoid bleeding
    const uBackMin = 0.55; const uBackMax = 0.95;
    
    const vMin = uvRange.v[0];
    const vMax = uvRange.v[1];

    // Helper to set UVs for a specific face index (0-5)
    const setFaceUV = (faceIdx: number, uMin: number, uMax: number, vMin: number, vMax: number, flipX = false) => {
       const offset = faceIdx * 4;
       // Standard quad mapping: (0,1), (1,1), (0,0), (1,0) -- order depends on geometry construction
       // BoxGeometry non-indexed vertices order:
       // 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right (roughly)
       // Let's just map corners.
       
       // Correct mapping for ThreeJS Box:
       // 0: (0, 1) -> top-left
       // 1: (1, 1) -> top-right
       // 2: (0, 0) -> bottom-left
       // 3: (1, 0) -> bottom-right
       
       const u0 = flipX ? uMax : uMin;
       const u1 = flipX ? uMin : uMax;
       
       uvAttribute.setXY(offset + 0, u0, vMax);
       uvAttribute.setXY(offset + 1, u1, vMax);
       uvAttribute.setXY(offset + 2, u0, vMin);
       uvAttribute.setXY(offset + 3, u1, vMin);
    };

    // 4: Front Face (+Z) -> Maps to Left Half of texture
    setFaceUV(4, uFrontMin, uFrontMax, vMin, vMax);
    
    // 5: Back Face (-Z) -> Maps to Right Half of texture
    setFaceUV(5, uBackMin, uBackMax, vMin, vMax, true); // Flip X for back so it matches correctly?

    // 0: Right Face (+X) -> Sample edge of Front or Back? Let's sample the "side" between them?
    // Or just use the edge pixel of the front face to extend color.
    setFaceUV(0, uFrontMax - 0.02, uFrontMax, vMin, vMax);

    // 1: Left Face (-X)
    setFaceUV(1, uFrontMin, uFrontMin + 0.02, vMin, vMax);

    // 2: Top Face (+Y) -> Sample top row of front
    setFaceUV(2, uFrontMin, uFrontMax, vMax - 0.02, vMax);

    // 3: Bottom Face (-Y) -> Sample bottom row
    setFaceUV(3, uFrontMin, uFrontMax, vMin, vMin + 0.02);

    uvAttribute.needsUpdate = true;
  }, [texture, uvRange]);

  return (
    <mesh ref={meshRef} position={position} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial map={texture} roughness={0.8} metalness={0.1} />
    </mesh>
  );
};


const BlockyCharacter: React.FC<{ 
  textureUrl: string; 
  isMoving: boolean;
}> = ({ textureUrl, isMoving }) => {
  const group = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  
  // Animation Refs
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null); // Includes Arms/Legs? No, separate hierarchy.
  const armLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(textureUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter; // Pixel art look
      tex.minFilter = THREE.NearestFilter;
      setTexture(tex);
    });
  }, [textureUrl]);

  useFrame((state) => {
     if (!group.current) return;
     const t = state.clock.elapsedTime;
     const speed = 12; // Faster walk cycle for blocks
     
     const isWalk = isMoving;
     const rot = isWalk ? Math.sin(t * speed) : 0;
     const bounce = isWalk ? Math.abs(Math.sin(t * speed * 2)) * 0.05 : 0;

     // Head Bob
     if (headRef.current) {
         headRef.current.rotation.y = Math.sin(t * 0.5) * 0.1;
         headRef.current.position.y = 1.5 + bounce;
     }
     
     // Body 
     if (bodyRef.current) {
         bodyRef.current.rotation.y = rot * 0.05;
         bodyRef.current.position.y = 0.75 + bounce;
     }

     const limbRange = 0.6;

     // Arms (Opposite to legs)
     if (armLRef.current) {
         armLRef.current.rotation.x = isWalk ? -rot * limbRange : Math.sin(t) * 0.05;
         // Link to body bounce
         armLRef.current.position.y = 1.35 + bounce;
     }
     if (armRRef.current) {
         armRRef.current.rotation.x = isWalk ? rot * limbRange : -Math.sin(t) * 0.05;
         armRRef.current.position.y = 1.35 + bounce;
     }

     // Legs
     if (legLRef.current) {
         legLRef.current.rotation.x = isWalk ? rot * limbRange : 0;
         legLRef.current.position.y = 0.75 + bounce;
     }
     if (legRRef.current) {
         legRRef.current.rotation.x = isWalk ? -rot * limbRange : 0;
         legRRef.current.position.y = 0.75 + bounce;
     }
  });

  if (!texture) return null;

  // Dimensions (Minecraft-ish scale)
  // Total height ~ 1.8 units
  
  // UV Mappings (Vertical percentage of the image)
  // Head: Top 25%
  const uvHead: { u: [number, number]; v: [number, number] } = { u: [0, 1], v: [0.75, 1.0] };
  // Body: Middle-Top 35%
  const uvBody: { u: [number, number]; v: [number, number] } = { u: [0, 1], v: [0.40, 0.75] };
  // Arms: Same as body roughly, but maybe sampled differently? We'll reuse Body region for simplicity or slightly shifted.
  // Let's use Body region for Arms too, it usually matches color.
  // Legs: Bottom 40%
  const uvLegs: { u: [number, number]; v: [number, number] } = { u: [0, 1], v: [0.0, 0.40] };

  return (
    <group ref={group}>
        {/* HEAD */}
        <group ref={headRef} position={[0, 1.5, 0]}>
             <BoxWithUV args={[0.5, 0.5, 0.5]} texture={texture} uvRange={uvHead} />
        </group>

        {/* BODY */}
        <group ref={bodyRef} position={[0, 0.75, 0]}>
            <BoxWithUV args={[0.5, 0.75, 0.25]} texture={texture} uvRange={uvBody} />
        </group>

        {/* LEFT ARM */}
        <group ref={armLRef} position={[-0.4, 1.35, 0]}>
            {/* Pivot is at top of arm */}
            <group position={[0, -0.3, 0]}> 
                <BoxWithUV args={[0.25, 0.75, 0.25]} texture={texture} uvRange={uvBody} />
            </group>
        </group>

        {/* RIGHT ARM */}
        <group ref={armRRef} position={[0.4, 1.35, 0]}>
            <group position={[0, -0.3, 0]}>
                <BoxWithUV args={[0.25, 0.75, 0.25]} texture={texture} uvRange={uvBody} />
            </group>
        </group>

        {/* LEFT LEG */}
        <group ref={legLRef} position={[-0.15, 0.75, 0]}>
            {/* Pivot at hip */}
            <group position={[0, -0.375, 0]}>
                <BoxWithUV args={[0.25, 0.75, 0.25]} texture={texture} uvRange={uvLegs} />
            </group>
        </group>

        {/* RIGHT LEG */}
        <group ref={legRRef} position={[0.15, 0.75, 0]}>
            <group position={[0, -0.375, 0]}>
                <BoxWithUV args={[0.25, 0.75, 0.25]} texture={texture} uvRange={uvLegs} />
            </group>
        </group>
        
        {/* Shadow */}
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
  
  // Input Handling
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

    // Movement relative to camera
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
        // Rotate character to face movement direction
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

    // Camera Follow
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
  }, [initialPos]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={ref} position={initialPos}>
       <BlockyCharacter textureUrl={textureUrl} isMoving={isMoving} />
    </group>
  );
};

// --- Chunk Component ---
const Chunk: React.FC<{ data: ChunkData, position: [number, number, number] }> = ({ data, position }) => {
  return (
    <group position={position}>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CHUNK_SIZE, CHUNK_SIZE]} />
        <meshStandardMaterial color={data.groundColor} roughness={0.8} />
      </mesh>
      
      {data.biomeType === 'magical' && (
         <Sparkles count={50} scale={CHUNK_SIZE} size={6} speed={0.4} opacity={0.5} color="#bfa2db" position={[0, 5, 0]} />
      )}
      {data.biomeType === 'snow' && (
         <Sparkles count={30} scale={CHUNK_SIZE} size={4} speed={0.2} opacity={0.3} color="#fff" position={[0, 5, 0]} />
      )}

      {/* Procedural Objects */}
      {data.objects.map((obj, i) => {
        if (obj.type === 'cloud') {
             return (
                 <group key={i} position={[obj.x, obj.y, obj.z]}>
                     <Cloud opacity={0.5} speed={0.1} bounds={[obj.scale[0], 2, obj.scale[2]]} segments={10} color={obj.color} />
                 </group>
             )
        }
        
        return (
            <group key={`obj-${i}`} position={[obj.x, obj.y, obj.z]} rotation={[0, obj.rotation, 0]}>
                <mesh castShadow receiveShadow scale={obj.scale}>
                    {obj.type === 'tree' ? <coneGeometry args={[1, 1, 8]} /> : 
                     obj.type === 'grass' ? <coneGeometry args={[1, 1, 3]} /> :
                     obj.type === 'crystal' ? <octahedronGeometry args={[1, 0]} /> :
                     obj.type === 'flower' ? <torusKnotGeometry args={[0.5, 0.2, 16, 4]} /> :
                     obj.type === 'ruins' ? <boxGeometry args={[1, 1, 1]} /> :
                     <boxGeometry args={[1, 1, 1]} />
                    }
                    <meshStandardMaterial 
                        color={obj.color} 
                        emissive={obj.type === 'crystal' ? obj.color : '#000'}
                        emissiveIntensity={obj.type === 'crystal' ? 0.5 : 0}
                    />
                </mesh>
            </group>
        );
      })}
    </group>
  );
};

// --- Main World Component ---
export const GameWorld: React.FC<GameWorldProps> = ({ character }) => {
  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 1, 0]);
  const [chunks, setChunks] = useState<Map<string, ChunkData>>(new Map());
  const [activeChunkKeys, setActiveChunkKeys] = useState<string[]>([]);
  
  const controlsRef = useRef<OrbitControlsImpl>(null);

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

  return (
    <div className="w-full h-full relative bg-black">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 8, 12], fov: 50 }}>
        <Environment preset="sunset" />
        <Sky sunPosition={[100, 20, 100]} turbidity={8} rayleigh={6} mieCoefficient={0.005} mieDirectionalG={0.8} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[50, 50, 25]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]}>
            <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40]} />
        </directionalLight>
        
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
          return <Chunk key={key} data={chunk} position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]} />;
        })}
        
        <fog attach="fog" args={['#0f172a', 10, 70]} />
      </Canvas>

      <div className="absolute top-4 left-4 p-4 bg-slate-900/80 backdrop-blur text-white rounded-lg border border-slate-700 max-w-xs select-none shadow-lg pointer-events-none z-10">
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