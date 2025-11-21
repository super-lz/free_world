
export const CHUNK_SIZE = 20;

export type BiomeType = 'forest' | 'desert' | 'snow' | 'volcanic' | 'magical';

export interface WorldObject {
  type: 'tree' | 'rock' | 'cactus' | 'grass' | 'cloud' | 'crystal' | 'flower' | 'ruins';
  x: number;
  y: number;
  z: number;
  scale: [number, number, number];
  color: string;
  rotation: number;
}

export interface ChunkData {
  id: string;
  x: number;
  z: number;
  biomeType: BiomeType;
  objects: WorldObject[];
  groundColor: string;
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const generateChunkData = (cx: number, cz: number): ChunkData => {
  const id = `${cx},${cz}`;
  // 2D Noise simulation for biomes
  const scale = 0.05;
  const noise = Math.sin(cx * scale) + Math.cos(cz * scale) * 0.8 + Math.sin((cx + cz) * 0.1) * 0.5;
  
  let biomeType: BiomeType = 'forest';
  let groundColor = '#2d6a4f';

  if (noise > 1.5) { biomeType = 'snow'; groundColor = '#e0fbfc'; }
  else if (noise > 0.8) { biomeType = 'magical'; groundColor = '#240046'; }
  else if (noise > -0.5) { biomeType = 'forest'; groundColor = '#2d6a4f'; }
  else if (noise > -1.2) { biomeType = 'desert'; groundColor = '#e9c46a'; }
  else { biomeType = 'volcanic'; groundColor = '#370617'; }

  const objects: WorldObject[] = [];
  const seedBase = cx * 10000 + cz;
  
  const density = biomeType === 'forest' ? 15 : biomeType === 'desert' ? 5 : 10;
  const objectCount = Math.floor(seededRandom(seedBase) * density) + 5;

  // Chance for ancient ruins
  const hasRuins = seededRandom(seedBase + 888) > 0.9;

  if (hasRuins) {
     objects.push({
         type: 'ruins',
         x: 0,
         y: 1,
         z: 0,
         scale: [2, 4 + seededRandom(seedBase)*4, 2],
         color: biomeType === 'snow' ? '#adb5bd' : '#5c5c5c',
         rotation: seededRandom(seedBase) * Math.PI
     });
  }

  for (let i = 0; i < objectCount; i++) {
    const seed = seedBase + i;
    const r1 = seededRandom(seed);
    const r2 = seededRandom(seed + 1);
    const r3 = seededRandom(seed + 2);

    const localX = (r1 - 0.5) * CHUNK_SIZE;
    const localZ = (r2 - 0.5) * CHUNK_SIZE;
    
    let type: WorldObject['type'] = 'tree';
    let height = 1 + r3 * 3;
    let y = height / 2;
    let color = '#fff';
    let scale: [number, number, number] = [1, height, 1];
    
    if (biomeType === 'forest') {
      if (r3 > 0.7) {
        type = 'tree';
        color = `hsl(130, ${40 + r1 * 20}%, ${30 + r2 * 20}%)`;
        height = 2 + r3 * 4;
        y = height / 2;
        scale = [0.8, height, 0.8];
      } else {
        type = 'grass';
        height = 0.2 + r1 * 0.5;
        y = height / 2;
        scale = [0.1, height, 0.1];
        color = `hsl(100, ${60 + r1 * 20}%, ${40 + r2 * 10}%)`;
      }
    } else if (biomeType === 'desert') {
      if (r3 > 0.6) {
        type = 'cactus';
        color = '#556b2f';
        height = 1.5 + r3 * 2;
        y = height / 2;
        scale = [0.4, height, 0.4];
      } else {
        type = 'rock';
        height = 0.3 + r1 * 0.5;
        y = height / 2;
        scale = [0.5 + r2, height, 0.5 + r1];
        color = '#8d99ae';
      }
    } else if (biomeType === 'magical') {
      if (r3 > 0.8) {
        type = 'crystal';
        height = 2 + r1 * 4;
        y = height / 2;
        scale = [0.3, height, 0.3];
        color = `hsl(${250 + r1 * 60}, 80%, 70%)`;
      } else {
        type = 'flower';
        height = 0.5;
        y = height / 2;
        scale = [0.2, 0.2, 0.2];
        color = `hsl(${300 + r1 * 60}, 100%, 60%)`;
      }
    } else if (biomeType === 'snow') {
        type = 'tree';
        color = '#caf0f8';
        height = 3 + r3 * 3;
        y = height / 2;
        scale = [1, height, 1];
    } else { 
        type = 'rock';
        color = '#3e1f47';
        height = 0.5 + r1 * 2;
        y = height / 2;
        scale = [1 + r2, height, 1 + r3];
    }

    objects.push({
      type,
      x: localX,
      y,
      z: localZ,
      scale,
      color,
      rotation: r1 * Math.PI * 2
    });
  }

  if (seededRandom(seedBase + 99) > 0.6) {
    objects.push({
      type: 'cloud',
      x: (seededRandom(seedBase + 100) - 0.5) * CHUNK_SIZE,
      y: 12 + seededRandom(seedBase + 101) * 4,
      z: (seededRandom(seedBase + 102) - 0.5) * CHUNK_SIZE,
      scale: [3 + seededRandom(seedBase)*2, 0.8, 2 + seededRandom(seedBase+1)],
      color: '#ffffff',
      rotation: 0
    });
  }

  return { id, x: cx, z: cz, biomeType, objects, groundColor };
};
