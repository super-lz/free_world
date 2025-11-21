import React, { useRef, useState, useEffect } from 'react';
import { Pen, Eraser, RotateCcw, Check, Sparkles } from 'lucide-react';

interface DrawingPadProps {
  onComplete: (imageData: string, prompt: string) => void;
}

export const DrawingPad: React.FC<DrawingPadProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(5);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    
    ctx.lineWidth = brushSize;
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleFinish = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onComplete(dataUrl, prompt);
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-center h-full bg-slate-900 p-4 gap-8">
      
      {/* Left Panel: Instructions & Input */}
      <div className="max-w-md w-full flex flex-col gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
            Design Your Hero
          </h1>
          <p className="text-slate-400">
            1. Describe your character.<br/>
            2. Draw a rough stick figure or shape.<br/>
            3. AI will fuse them into a 3D model.
          </p>
        </div>

        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <label className="block text-sm font-bold text-cyan-400 mb-2 flex items-center gap-2">
                <Sparkles size={16} /> Character Description
            </label>
            <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., A cyberpunk samurai with glowing red armor, wearing a cape..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none resize-none h-24"
            />
        </div>

        <button
            onClick={handleFinish}
            disabled={!prompt.trim()}
            className={`hidden md:flex px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition transform items-center justify-center gap-2 ${!prompt.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:from-cyan-500 hover:to-blue-500'}`}
        >
            <Check size={24} />
            Generate 3D Model
        </button>
      </div>

      {/* Right Panel: Canvas */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative bg-slate-800 rounded-xl shadow-2xl p-1 border border-slate-700">
            <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="bg-[url('https://www.transparenttextures.com/patterns/cube-coat.png')] bg-slate-700/50 rounded-lg cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            />
            
            <div className="absolute top-4 right-4 flex flex-col gap-2">
            <button 
                onClick={clearCanvas}
                className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition"
                title="Clear"
            >
                <RotateCcw size={20} />
            </button>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/20 pointer-events-none text-xs uppercase tracking-widest font-bold">
                Draw Shape Here
            </div>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-6 bg-slate-800/90 p-4 rounded-2xl backdrop-blur-sm border border-slate-700 w-full justify-center">
            <div className="flex items-center gap-2">
            <button
                onClick={() => setTool('pen')}
                className={`p-3 rounded-xl transition ${tool === 'pen' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
                <Pen size={20} />
            </button>
            <button
                onClick={() => setTool('eraser')}
                className={`p-3 rounded-xl transition ${tool === 'eraser' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
                <Eraser size={20} />
            </button>
            </div>

            <div className="h-8 w-px bg-slate-600"></div>

            <div className="flex items-center gap-2">
            {['#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7'].map(c => (
                <button
                key={c}
                onClick={() => { setColor(c); setTool('pen'); }}
                className={`w-8 h-8 rounded-full border-2 transition hover:scale-110 ${color === c && tool === 'pen' ? 'border-white shadow-md scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                />
            ))}
            </div>

            <div className="h-8 w-px bg-slate-600"></div>

            <input 
            type="range" 
            min="2" 
            max="30" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24 accent-cyan-500"
            />
        </div>
        
        <button
            onClick={handleFinish}
            disabled={!prompt.trim()}
            className={`md:hidden w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 ${!prompt.trim() ? 'opacity-50' : ''}`}
        >
            <Check size={24} />
            Generate Model
        </button>
      </div>
    </div>
  );
};