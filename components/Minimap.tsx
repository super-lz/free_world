
import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Minimize2, Map as MapIcon, ZoomIn, ZoomOut, Locate } from 'lucide-react';
import { ChunkData, CHUNK_SIZE } from '../utils/worldGen';

interface MinimapProps {
  chunks: Map<string, ChunkData>;
  playerPos: [number, number, number];
  onTeleport: (x: number, z: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({ chunks, playerPos, onTeleport }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);
  
  // Interactive State
  const [viewPos, setViewPos] = useState<{x:number, z:number}>({x: 0, z: 0});
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<{x:number, y:number}|null>(null);

  // Sync view with player only when NOT expanded or just opened
  useEffect(() => {
      if (!expanded) {
          setViewPos({ x: playerPos[0], z: playerPos[2] });
          setZoom(1);
      }
  }, [playerPos, expanded]);

  const renderMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = expanded ? '#0f172a' : 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Grid if expanded
    if (expanded) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gridSize = 50;
        for(let i=0; i<canvas.width; i+=gridSize) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
        for(let i=0; i<canvas.height; i+=gridSize) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
        ctx.stroke();
    }
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    
    // Scaling: 
    // expanded: BASE_SCALE * zoom
    // minimized: Fixed small scale
    const BASE_SCALE = 4; 
    const currentScale = expanded ? BASE_SCALE * zoom : 8; // Pixels per world unit approx

    // Render Chunks
    // We iterate all chunks. In a huge world, we might want to cull, but for now Map is fast enough.
    chunks.forEach((chunk, key) => {
        const [chunkX, chunkZ] = key.split(',').map(Number);
        const worldX = chunkX * CHUNK_SIZE;
        const worldZ = chunkZ * CHUNK_SIZE;

        // Transform World -> Screen
        // dx = worldX - viewX
        const dx = worldX - viewPos.x;
        const dz = worldZ - viewPos.z;

        // In minimized mode, viewPos is playerPos.
        // In expanded mode, viewPos is the camera center.

        // Screen Coords
        // Note: Game Chunk is centered at worldX? No, Chunk generation usually uses corner or center.
        // In worldGen, object placement is relative to chunk center if we assume (cx, cz) is index.
        // Our Chunk logic: `position={[cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE]}`
        // So chunk origin is (worldX, worldZ).
        
        // To draw properly, we scale the distance
        // Actually, scale should be pixels per chunk unit?
        // If CHUNK_SIZE = 20. 
        // Let's map 1 unit to X pixels.
        const pixelScale = expanded ? zoom * 3 : 0.8; // Multiplier for translation
        
        const screenX = cx + dx * pixelScale;
        const screenY = cy + dz * pixelScale;
        
        const size = CHUNK_SIZE * pixelScale;

        // Culling
        if (screenX + size < 0 || screenX - size > canvas.width || 
            screenY + size < 0 || screenY - size > canvas.height) return;

        let color = '#444';
        if (chunk.biomeType === 'forest') color = '#2d6a4f';
        else if (chunk.biomeType === 'desert') color = '#e9c46a';
        else if (chunk.biomeType === 'snow') color = '#e0fbfc';
        else if (chunk.biomeType === 'magical') color = '#560bad';
        else if (chunk.biomeType === 'volcanic') color = '#6a040f';
        
        ctx.fillStyle = color;
        // Draw rect centered? No, chunk position is likely corner or center. 
        // Based on GameWorld: position is cx*SIZE. Objects are +/- relative.
        // So (cx*SIZE, cz*SIZE) is the center of the chunk in world space.
        ctx.fillRect(screenX - size/2, screenY - size/2, size - 1, size - 1); // -1 for grid effect
    });

    // Draw Player Arrow/Dot
    const pdx = playerPos[0] - viewPos.x;
    const pdz = playerPos[2] - viewPos.z;
    const pixelScale = expanded ? zoom * 3 : 0.8;
    const px = cx + pdx * pixelScale;
    const py = cy + pdz * pixelScale;

    // Pulse effect for player
    if (expanded) {
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fill();
    }

    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, expanded ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  useEffect(() => {
      renderMap();
  });

  // --- Interaction Handlers ---

  const handleWheel = (e: React.WheelEvent) => {
      if (!expanded) return;
      const delta = -Math.sign(e.deltaY) * 0.1;
      setZoom(z => Math.min(Math.max(z + delta, 0.5), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!expanded) return;
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!expanded || !isDragging || !lastMousePos) return;
      
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      
      // Dragging moves the VIEW, so we subtract delta from viewPos.
      // We need to scale delta back to world units.
      const pixelScale = zoom * 3;
      const worldDx = dx / pixelScale;
      const worldDz = dy / pixelScale;

      setViewPos(prev => ({ x: prev.x - worldDx, z: prev.z - worldDz }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
      setIsDragging(false);
      setLastMousePos(null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      if (!expanded) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      
      // Inverse Transform
      // screenX = cx + (worldX - viewX) * scale
      // (screenX - cx) / scale = worldX - viewX
      // worldX = viewX + (screenX - cx) / scale
      
      const pixelScale = zoom * 3;
      
      const targetX = viewPos.x + (mx - cx) / pixelScale;
      const targetZ = viewPos.z + (my - cy) / pixelScale;
      
      onTeleport(targetX, targetZ);
      // Optional: Center view on teleport
      setViewPos({x: targetX, z: targetZ});
  };

  const resetView = () => {
      setViewPos({ x: playerPos[0], z: playerPos[2] });
      setZoom(1);
  };

  if (expanded) {
      return (
          <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4" 
               onClick={() => setExpanded(false)}>
             <div className="relative flex flex-col items-center w-full max-w-4xl h-[80vh]" 
                  onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-4 bg-slate-800/90 p-2 rounded-lg backdrop-blur border border-slate-700 shadow-lg">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 px-2">
                        <MapIcon size={20} className="text-cyan-400"/> World Atlas
                    </h2>
                    <div className="h-6 w-px bg-slate-600"></div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setZoom(z => Math.min(z + 0.2, 5))} className="p-2 hover:bg-slate-700 rounded text-white"><ZoomIn size={18} /></button>
                        <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))} className="p-2 hover:bg-slate-700 rounded text-white"><ZoomOut size={18} /></button>
                        <button onClick={resetView} className="p-2 hover:bg-slate-700 rounded text-cyan-400" title="Center on Player"><Locate size={18} /></button>
                    </div>
                </div>

                <canvas 
                    ref={canvasRef} 
                    width={800} 
                    height={600} 
                    className="w-full h-full rounded-xl shadow-2xl border-2 border-slate-600 bg-slate-900 cursor-move touch-none"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                />

                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm pointer-events-none backdrop-blur">
                    Drag to Pan • Scroll to Zoom • Double Click to Teleport
                </div>

                <button 
                    onClick={() => setExpanded(false)}
                    className="absolute top-4 right-4 p-2 bg-red-500/20 text-red-200 border border-red-500/50 rounded-lg hover:bg-red-500 hover:text-white transition"
                >
                    <Minimize2 size={20} />
                </button>
             </div>
          </div>
      )
  }

  return (
    <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => setExpanded(true)} title="Click to Expand">
        <div className="relative">
            <canvas 
                ref={canvasRef} 
                width={150} 
                height={150} 
                className="rounded-lg shadow-xl border-2 border-slate-700 group-hover:border-cyan-500 transition-colors bg-slate-900"
            />
            <div className="absolute bottom-2 right-2 bg-slate-900/50 p-1 rounded text-white opacity-0 group-hover:opacity-100 transition">
                <Maximize2 size={14} />
            </div>
        </div>
        <span className="text-xs text-slate-400 font-bold tracking-widest group-hover:text-cyan-400">MINIMAP</span>
    </div>
  );
};
