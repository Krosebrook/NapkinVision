/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation } from './components/CreationHistory';
import { bringToLife, refineApp } from './services/gemini';
import { ArrowUpTrayIcon } from '@heroicons/react/24/solid';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [history, setHistory] = useState<Creation[]>([]);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load history
  useEffect(() => {
    const initHistory = async () => {
      const saved = localStorage.getItem('gemini_app_history');
      let loadedHistory: Creation[] = [];

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          loadedHistory = parsed.map((item: any) => ({
              ...item,
              timestamp: new Date(item.timestamp)
          }));
        } catch (e) {
          console.error("Failed to load history", e);
        }
      }
      if (loadedHistory.length > 0) setHistory(loadedHistory);
    };
    initHistory();
  }, []);

  // Safe Persist with LRU Eviction
  const persistHistory = (newHistory: Creation[]) => {
      try {
          localStorage.setItem('gemini_app_history', JSON.stringify(newHistory));
      } catch (e: any) {
          if (e.name === 'QuotaExceededError' || e.code === 22) {
              // LRU Eviction: Remove oldest items until it fits
              if (newHistory.length > 1) {
                  // Keep the first one (newest) and try to save fewer from the rest
                  const smallerHistory = newHistory.slice(0, -1);
                  persistHistory(smallerHistory);
                  setHistory(smallerHistory); // Sync state with reality
              } else {
                  console.error("Item too large for localStorage even alone.");
                  alert("Storage full. History not saved.");
              }
          }
      }
  };

  useEffect(() => {
      if (history.length > 0) persistHistory(history);
  }, [history]);

  // Reset Undo/Redo when switching creations
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, [activeCreation?.id]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const getFriendlyErrorMessage = (error: any): string => {
      const msg = error?.message || error?.toString() || '';
      if (msg.includes('429')) return "You're sending requests too quickly. Please wait a moment before trying again.";
      if (msg.includes('503') || msg.includes('500')) return "Google's AI service is currently unavailable. Please try again later.";
      if (msg.includes('400')) return "The AI couldn't process this specific input. Try a different image or prompt.";
      if (msg.includes('SAFETY')) return "The content was flagged by safety filters. Please try a different input.";
      return "An unexpected error occurred. Please try again.";
  };

  const handleGenerate = async (promptText: string, file?: File, style?: string, customCss?: string) => {
    setIsGenerating(true);
    setActiveCreation(null);

    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;

      if (file) {
        imageBase64 = await fileToBase64(file);
        mimeType = file.type.toLowerCase();
      }

      const html = await bringToLife(promptText, imageBase64, mimeType, style, customCss);
      
      if (html) {
        const newCreation: Creation = {
          id: crypto.randomUUID(),
          name: file ? file.name : (promptText.slice(0, 20) || 'New Creation'),
          html: html,
          originalImage: imageBase64 && mimeType ? `data:${mimeType};base64,${imageBase64}` : undefined,
          timestamp: new Date(),
        };
        setActiveCreation(newCreation);
        setHistory(prev => [newCreation, ...prev]);
      }

    } catch (error) {
      console.error("Failed to generate:", error);
      alert(getFriendlyErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const updateActiveCreationHtml = (newHtml: string) => {
      if (!activeCreation) return;

      const updatedCreation = { ...activeCreation, html: newHtml };
      setActiveCreation(updatedCreation);
      
      // Update persistent history
      setHistory(prev => prev.map(item => item.id === updatedCreation.id ? updatedCreation : item));
  };

  const handleRefine = async (instruction: string) => {
    if (!activeCreation) return;
    
    setIsRefining(true);
    try {
        let base64Image: string | undefined;
        let mimeType: string | undefined;

        if (activeCreation.originalImage) {
            const matches = activeCreation.originalImage.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Image = matches[2];
            }
        }

        const newHtml = await refineApp(activeCreation.html, instruction, base64Image, mimeType);
        
        if (newHtml) {
            // Push current state to undo stack before updating
            setUndoStack(prev => [...prev, activeCreation.html]);
            setRedoStack([]); // Clear redo stack on new change

            updateActiveCreationHtml(newHtml);
        }
    } catch (error) {
        console.error("Refinement failed:", error);
        alert(getFriendlyErrorMessage(error));
    } finally {
        setIsRefining(false);
    }
  };

  const handleUndo = () => {
      if (undoStack.length === 0 || !activeCreation) return;

      const previousHtml = undoStack[undoStack.length - 1];
      const newUndoStack = undoStack.slice(0, -1);

      // Save current to redo
      setRedoStack(prev => [...prev, activeCreation.html]);
      setUndoStack(newUndoStack);
      
      updateActiveCreationHtml(previousHtml);
  };

  const handleRedo = () => {
      if (redoStack.length === 0 || !activeCreation) return;

      const nextHtml = redoStack[redoStack.length - 1];
      const newRedoStack = redoStack.slice(0, -1);

      // Save current to undo
      setUndoStack(prev => [...prev, activeCreation.html]);
      setRedoStack(newRedoStack);

      updateActiveCreationHtml(nextHtml);
  };

  const handleReset = () => {
    setActiveCreation(null);
    setIsGenerating(false);
    setIsRefining(false);
  };

  const handleSelectCreation = (creation: Creation) => {
    setActiveCreation(creation);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = event.target?.result as string;
            const parsed = JSON.parse(json);
            
            if (parsed.html && parsed.name) {
                const importedCreation: Creation = {
                    ...parsed,
                    timestamp: new Date(parsed.timestamp || Date.now()),
                    id: parsed.id || crypto.randomUUID()
                };
                
                setHistory(prev => {
                    const exists = prev.some(c => c.id === importedCreation.id);
                    return exists ? prev : [importedCreation, ...prev];
                });
                setActiveCreation(importedCreation);
            } else {
                alert("Invalid creation file format.");
            }
        } catch (err) {
            console.error("Import error", err);
            alert("Failed to import creation. The file might be corrupted.");
        }
        if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="h-[100dvh] bg-zinc-950 bg-dot-grid text-zinc-50 selection:bg-blue-500/30 overflow-y-auto overflow-x-hidden relative flex flex-col">
      <div 
        className={`
          min-h-full flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 relative z-10 
          transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
          ${isFocused 
            ? 'opacity-0 scale-95 blur-sm pointer-events-none h-[100dvh] overflow-hidden' 
            : 'opacity-100 scale-100 blur-0'
          }
        `}
      >
        <div className="flex-1 flex flex-col justify-center items-center w-full py-12 md:py-20">
          <div className="w-full mb-8 md:mb-16">
              <Hero />
          </div>
          <div className="w-full flex justify-center mb-8">
              <InputArea onGenerate={handleGenerate} isGenerating={isGenerating} disabled={isFocused} />
          </div>
        </div>
        
        <div className="flex-shrink-0 pb-6 w-full mt-auto flex flex-col items-center gap-6">
            <div className="w-full px-2 md:px-0">
                <CreationHistory history={history} onSelect={handleSelectCreation} />
            </div>
            <a 
              href="https://x.com/ammaar" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors pb-2"
            >
              Created by @ammaar
            </a>
        </div>
      </div>

      <LivePreview
        creation={activeCreation}
        isLoading={isGenerating}
        isRefining={isRefining}
        isFocused={isFocused}
        onReset={handleReset}
        onRefine={handleRefine}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />

      <div className="fixed bottom-4 right-4 z-50">
        <button 
            onClick={handleImportClick}
            className="flex items-center space-x-2 p-2 text-zinc-500 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Import Artifact"
        >
            <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">Upload previous artifact</span>
            <ArrowUpTrayIcon className="w-5 h-5" />
        </button>
        <input 
            type="file" 
            ref={importInputRef} 
            onChange={handleImportFile} 
            accept=".json" 
            className="hidden" 
        />
      </div>
    </div>
  );
};

export default App;