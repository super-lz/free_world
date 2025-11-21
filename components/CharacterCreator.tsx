import React, { useState } from 'react';
import { Sparkles, Wand2, User, Shield, Zap } from 'lucide-react';

interface CharacterCreatorProps {
  onComplete: (prompt: string) => void;
}

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onComplete }) => {
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("Cyberpunk");

  const styles = ["Cyberpunk", "Fantasy Knight", "Anime", "Minecraft", "Robot", "Wizard"];

  const handleGenerate = () => {
    if (!description.trim()) return;
    // Combine description with style for better results
    const fullPrompt = `${style} style. ${description}`;
    onComplete(fullPrompt);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] p-4 text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="max-w-2xl w-full z-10 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 drop-shadow-lg">
            Neural Avatar Forge
          </h1>
          <p className="text-slate-400 text-lg">
            Describe your hero. The AI will construct a full 3D rigged model.
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl space-y-6">
          
          {/* Style Selector */}
          <div>
            <label className="block text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
               <Wand2 size={16} /> Visual Style
            </label>
            <div className="flex flex-wrap gap-2">
              {styles.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                    style === s 
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 scale-105' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div>
             <label className="block text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
               <User size={16} /> Character Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., A golden paladin with glowing wings and a red cape..."
              className="w-full h-40 bg-slate-900/80 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none resize-none transition text-lg"
            />
          </div>

          {/* Examples */}
          <div className="flex gap-2 text-xs text-slate-500">
             <span className="font-bold text-slate-400">Try:</span>
             <button onClick={() => setDescription("A futuristic samurai with neon armor")} className="hover:text-cyan-400 transition">Samurai</button> •
             <button onClick={() => setDescription("A cute slime creature with a wizard hat")} className="hover:text-cyan-400 transition">Slime Wizard</button> •
             <button onClick={() => setDescription("A dark assassin with a hood and purple eyes")} className="hover:text-cyan-400 transition">Assassin</button>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!description.trim()}
            className={`w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xl font-black uppercase tracking-wider rounded-xl shadow-xl transition transform flex items-center justify-center gap-3 group ${
                !description.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-cyan-500/40'
            }`}
          >
            <Sparkles className={`transition ${description.trim() ? 'animate-pulse' : ''}`} />
            Forge 3D Model
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-slate-500 text-sm font-mono">
            <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-slate-800 rounded-lg"><User size={20}/></div>
                <span>Auto-Rigging</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-slate-800 rounded-lg"><Shield size={20}/></div>
                <span>360° Geometry</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-slate-800 rounded-lg"><Zap size={20}/></div>
                <span>AI Textures</span>
            </div>
        </div>
      </div>
    </div>
  );
};