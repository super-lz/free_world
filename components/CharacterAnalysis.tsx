import React, { useEffect, useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CharacterData } from '../App';

interface Props {
  userPrompt: string;
  onComplete: (data: CharacterData) => void;
}

export const CharacterAnalysis: React.FC<Props> = ({ userPrompt, onComplete }) => {
  const [status, setStatus] = useState("Initializing Neural Core...");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const analyzeCharacter = async () => {
      try {
        if (!process.env.API_KEY) {
           throw new Error("No API Key");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // --- Phase 1: Generate Texture Map ---
        setStatus("Generating Skin Texture...");
        
        // Optimized Prompt for Blocky Character Mapping
        // We need: Left Half = Front, Right Half = Back
        // Vertical layout: Top=Head, Mid=Body, Bottom=Legs
        const texturePrompt = `
          Generate a texture skin for a Minecraft-style blocky character.
          Subject: ${userPrompt}.
          
          CRITICAL FORMAT REQUIREMENTS:
          1. The image must be a square aspect ratio.
          2. Divide vertically into TWO EQUAL columns:
             - LEFT HALF: The FRONT view of the character.
             - RIGHT HALF: The BACK view of the character.
          3. Divide horizontally into THREE zones (approximate):
             - TOP 25%: Head/Face.
             - MIDDLE 40%: Torso and Arms.
             - BOTTOM 35%: Legs/Feet.
          
          Style:
          - Vibrant, high-contrast pixel art or detailed cartoon style.
          - Symmetrical standing pose.
          - No background (or solid white/grey). 
          - Fill the space efficiently.
        `;

        const imageResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: texturePrompt }
                ]
            }
        });

        let textureUrl = "";
        const parts = imageResponse.candidates?.[0]?.content?.parts;
        if (parts) {
            for (const part of parts) {
                if (part.inlineData) {
                    textureUrl = `data:image/png;base64,${part.inlineData.data}`;
                    setPreviewImage(textureUrl);
                    break;
                }
            }
        }

        if (!textureUrl) throw new Error("Failed to generate texture");

        // --- Phase 2: Generate Stats & Lore ---
        setStatus("Calibrating Animation Rig & Bio-Stats...");
        
        const statsResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Generate RPG stats and a cool fantasy/sci-fi name for this character: "${userPrompt}".
                     Return valid JSON with fields: 
                     - name (string)
                     - description (string, max 120 chars)
                     - stats { strength (1-10), speed (1-10), magic (1-10) }.
                     Do not use Markdown.`,
          config: {
              responseMimeType: "application/json"
          }
        });

        const text = statsResponse.text;
        if (!text) throw new Error("No analysis returned");
        const data = JSON.parse(text);

        // Wait a moment to show the loading state
        setTimeout(() => {
            onComplete({
                imageData: textureUrl,
                name: data.name || "Unknown Hero",
                description: data.description || "A mysterious traveler.",
                userPrompt: userPrompt,
                stats: {
                    strength: data.stats?.strength || 5,
                    speed: data.stats?.speed || 5,
                    magic: data.stats?.magic || 5
                }
            });
        }, 1500);

      } catch (error) {
        console.error("Analysis failed:", error);
        setStatus("Connection Lost. Retrying...");
        // Simple retry mechanism could go here, or just error out
      }
    };

    analyzeCharacter();
  }, [userPrompt, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-white space-y-8 overflow-hidden">
      {/* Fancy Loading UI */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        <div className="absolute inset-0 border-2 border-slate-800 rounded-lg rotate-45"></div>
        <div className="absolute inset-0 border-2 border-slate-800 rounded-lg -rotate-45"></div>
        
        {previewImage ? (
            <div className="relative w-56 h-56 bg-white rounded-md overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.5)] animate-pulse">
                <img src={previewImage} alt="Generated Texture" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                <div className="absolute bottom-2 left-2 text-xs font-mono text-cyan-300">TEXTURE_MAP_GENERATED</div>
            </div>
        ) : (
            <div className="w-32 h-32 relative">
                <div className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-4 border-4 border-purple-500 border-b-transparent rounded-full animate-spin animate-reverse"></div>
            </div>
        )}
      </div>
      
      <div className="text-center space-y-2 z-10">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 animate-pulse">
            {status}
        </h2>
        <p className="text-slate-500 text-sm font-mono uppercase tracking-widest">
            System Processing
        </p>
      </div>

      <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-800">
          <div className="h-full bg-cyan-500 animate-progress w-full origin-left scale-x-0" style={{animation: 'grow 4s infinite linear'}}></div>
      </div>
      <style>{`@keyframes grow { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }`}</style>
    </div>
  );
};