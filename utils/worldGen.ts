
export const CHUNK_SIZE = 20;

export type BiomeType = 'forest' | 'desert' | 'snow' | 'volcanic' | 'magical' | 'plains' | 'swamp' | 'beach';

export interface WorldObject {
  type: 'tree' | 'palm' | 'rock' | 'cactus' | 'grass' | 'cloud' | 'crystal' | 'flower' | 'ruins' | 'bush' | 'mushroom' | 'reed' | 'deadbush' | 'water';
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
  hasWater?: boolean;
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
  const detailNoise = Math.sin(cx * 0.2) * Math.cos(cz * 0.2); // High freq noise for details

  let biomeType: BiomeType = 'forest';
  let groundColor = '#2d6a4f';
  let hasWater = false;

  // Expanded Biome Distribution
  if (noise > 1.5) { biomeType = 'snow'; groundColor = '#e0fbfc'; }
  else if (noise > 1.0) { biomeType = 'magical'; groundColor = '#240046'; }
  else if (noise > 0.6) { biomeType = 'forest'; groundColor = '#2d6a4f'; }
  else if (noise > 0.2) { biomeType = 'plains'; groundColor = '#90be6d'; }
  else if (noise > -0.2) { biomeType = 'swamp'; groundColor = '#3a5a40'; hasWater = true; }
  else if (noise > -0.6) { biomeType = 'beach'; groundColor = '#f4a261'; hasWater = true; }
  else if (noise > -1.3) { biomeType = 'desert'; groundColor = '#e9c46a'; }
  else { biomeType = 'volcanic'; groundColor = '#370617'; }

  const objects: WorldObject[] = [];
  const seedBase = cx * 10000 + cz;
  
  // Objects Generation
  const density = 
    biomeType === 'forest' ? 12 : 
    biomeType === 'desert' ? 4 : 
    biomeType === 'plains' ? 8 :
    biomeType === 'swamp' ? 15 :
    biomeType === 'beach' ? 5 : 10;

  const objectCount = Math.floor(seededRandom(seedBase) * density) + 3;

  // Water Layer
  if (hasWater) {
      objects.push({
          type: 'water',
          x: 0,
          y: 0.2, // Slightly above ground
          z: 0,
          scale: [CHUNK_SIZE, 1, CHUNK_SIZE],
          color: biomeType === 'swamp' ? '#4d908e' : '#00b4d8', // Murky vs Clear blue
          rotation: 0
      });
  }

  // Chance for ancient ruins (Rare)
  const hasRuins = seededRandom(seedBase + 888) > 0.95;
  if (hasRuins) {
     objects.push({
         type: 'ruins',
         x: 0,
         y: 1,
         z: 0,
         scale: [2, 3 + seededRandom(seedBase)*3, 2],
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
    let y = 0;
    let color = '#fff';
    let scale: [number, number, number] = [1, 1, 1];
    let rot = r1 * Math.PI * 2;

    // Biome Specific Logic
    switch (biomeType) {
        case 'forest':
            if (r3 > 0.6) {
                type = 'tree';
                color = `hsl(130, ${40 + r1 * 20}%, ${25 + r2 * 15}%)`;
                height = 3 + r3 * 5;
                scale = [0.8 + r1*0.4, height, 0.8 + r1*0.4];
            } else if (r3 > 0.3) {
                type = 'bush';
                color = '#40916c';
                scale = [1, 1, 1];
            } else {
                type = 'grass';
                scale = [0.2, 0.5 + r1, 0.2];
                color = '#52b788';
            }
            break;
        case 'plains':
            if (r3 > 0.9) { // Sparse trees
                type = 'tree';
                color = '#74c69d';
                height = 4;
                scale = [1, height, 1];
            } else if (r3 > 0.4) {
                type = 'grass';
                scale = [0.1, 0.4 + r1*0.4, 0.1];
                color = '#b7e4c7';
            } else {
                type = 'flower';
                scale = [0.3, 0.3, 0.3];
                color = `hsl(${r1 * 360}, 80%, 60%)`;
            }
            break;
        case 'swamp':
            if (r3 > 0.7) {
                type = 'tree'; // Will look like Willow/Mangrove via color
                color = '#2d3436'; // Dark trunk
                height = 3 + r3 * 3;
                scale = [1.2, height, 1.2];
            } else if (r3 > 0.4) {
                type = 'mushroom';
                color = r1 > 0.5 ? '#e63946' : '#a8dadc';
                scale = [0.5 + r1, 0.5 + r1, 0.5 + r1];
            } else {
                type = 'reed';
                color = '#a3b18a';
                scale = [0.1, 1.5 + r1, 0.1];
            }
            break;
        case 'beach':
            if (r3 > 0.75) {
                type = 'palm';
                color = '#2e8b57';
                height = 4 + r3 * 4;
                scale = [0.6, height, 0.6];
            } else if (r3 > 0.5) {
                type = 'rock'; // Pebbles
                color = '#d3d3d3';
                scale = [0.3, 0.2, 0.3];
            } else {
                // Maybe nothing or small grass
                type = 'grass';
                color = '#e9c46a';
                scale = [0.1, 0.3, 0.1];
            }
            break;
        case 'desert':
            if (r3 > 0.7) {
                type = 'cactus';
                color = '#606c38';
                height = 2 + r3 * 3;
                scale = [0.5, height, 0.5];
            } else if (r3 > 0.4) {
                type = 'deadbush';
                color = '#bc6c25';
                scale = [0.5, 0.5, 0.5];
            } else {
                type = 'rock';
                color = '#cb997e';
                scale = [0.5 + r1, 0.5, 0.5 + r2];
            }
            break;
        case 'snow':
            type = 'tree'; // Pine
            color = '#caf0f8';
            height = 4 + r3 * 4;
            scale = [1, height, 1];
            break;
        case 'magical':
            if (r3 > 0.7) {
                type = 'crystal';
                height = 2 + r1 * 5;
                scale = [0.4, height, 0.4];
                color = `hsl(${260 + r1 * 60}, 80%, 70%)`;
            } else {
                type = 'mushroom'; // Giant magical mushrooms
                scale = [1 + r1, 1.5 + r2, 1 + r1];
                color = `hsl(${300 + r1 * 50}, 70%, 60%)`;
            }
            break;
        case 'volcanic':
            type = 'rock';
            color = '#220901';
            scale = [1 + r1 * 2, 0.5 + r2 * 2, 1 + r3];
            break;
    }

    objects.push({
      type,
      x: localX,
      y,
      z: localZ,
      scale,
      color,
      rotation: rot
    });
  }

  // Clouds
  if (seededRandom(seedBase + 99) > 0.6) {
    objects.push({
      type: 'cloud',
      x: (seededRandom(seedBase + 100) - 0.5) * CHUNK_SIZE,
      y: 12 + seededRandom(seedBase + 101) * 5,
      z: (seededRandom(seedBase + 102) - 0.5) * CHUNK_SIZE,
      scale: [3 + seededRandom(seedBase)*3, 1, 2 + seededRandom(seedBase+1)*2],
      color: '#ffffff',
      rotation: 0
    });
  }

  return { id, x: cx, z: cz, biomeType, objects, groundColor, hasWater };
};
