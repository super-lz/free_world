import React, { useState } from 'react';
import { CharacterCreator } from './components/CharacterCreator';
import { GameWorld } from './components/GameWorld';
import { CharacterAnalysis } from './components/CharacterAnalysis';

export enum AppState {
  CREATING,
  ANALYZING,
  PLAYING
}

export interface CharacterData {
  imageData: string; // The AI generated texture (Split View: Front | Back)
  name: string;
  description: string;
  userPrompt: string; 
  stats: {
    strength: number;
    speed: number;
    magic: number;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.CREATING);
  const [userPrompt, setUserPrompt] = useState<string>("");
  const [character, setCharacter] = useState<CharacterData | null>(null);

  const handleCreationSubmit = (prompt: string) => {
    setUserPrompt(prompt);
    setAppState(AppState.ANALYZING);
  };

  const handleAnalysisComplete = (data: CharacterData) => {
    setCharacter(data);
    setAppState(AppState.PLAYING);
  };

  return (
    <div className="w-full h-screen relative">
      {appState === AppState.CREATING && (
        <CharacterCreator onComplete={handleCreationSubmit} />
      )}

      {appState === AppState.ANALYZING && (
        <CharacterAnalysis 
          userPrompt={userPrompt}
          onComplete={handleAnalysisComplete} 
        />
      )}

      {appState === AppState.PLAYING && character && (
        <GameWorld character={character} />
      )}
    </div>
  );
}