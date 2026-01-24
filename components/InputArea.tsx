/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useCallback, useState, useEffect } from 'react';
import { ArrowUpTrayIcon, SparklesIcon, CpuChipIcon, PaintBrushIcon, MicrophoneIcon, StopIcon, CodeBracketSquareIcon } from '@heroicons/react/24/outline';

interface InputAreaProps {
  onGenerate: (prompt: string, file?: File, style?: string, customCss?: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const STYLES = [
    'Default', 'Sketch', 'Cyberpunk', 'Corporate', 'Retro 8-bit', 
    'Neumorphism', 'Brutalist', 'Hand-Drawn', 'Claymorphism', 
    'Glassmorphism', 'Matrix', 'Terminal', 'Watercolor', 
    'Blueprint', 'Papercraft', 'Synthwave', 'Minimalist',
    'Futuristic UI', 'Vintage Comic Book', 'Steampunk', 'Abstract Art', 'Pixel Art'
];

const CyclingText = () => {
    const words = [
        "a napkin sketch",
        "a chaotic whiteboard",
        "a game level design",
        "a sci-fi interface",
        "a diagram of a machine",
        "an ancient scroll"
    ];
    const [index, setIndex] = useState(0);
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false); 
            setTimeout(() => {
                setIndex(prev => (prev + 1) % words.length);
                setFade(true); 
            }, 500); 
        }, 3000); 
        return () => clearInterval(interval);
    }, [words.length]);

    return (
        <span className={`inline-block whitespace-nowrap transition-all duration-500 transform ${fade ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-2 blur-sm'} text-white font-medium pb-1 border-b-2 border-blue-500/50`}>
            {words[index]}
        </span>
    );
};

export const InputArea: React.FC<InputAreaProps> = ({ onGenerate, isGenerating, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('Default');
  const [prompt, setPrompt] = useState('');
  const [customCss, setCustomCss] = useState('');
  const [showCssInput, setShowCssInput] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const handleFile = (file: File) => {
    // 1. Check File Type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert(`Unsupported file type: ${file.type}. Please upload an Image (JPEG, PNG, WebP) or PDF.`);
      return;
    }

    // 2. Check File Size (e.g., 10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Please upload a file smaller than 10MB.`);
      return;
    }

    onGenerate(prompt, file, selectedStyle, customCss);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isGenerating) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [disabled, isGenerating, selectedStyle, prompt, customCss]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!disabled && !isGenerating) {
        setIsDragging(true);
    }
  }, [disabled, isGenerating]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Voice input is not supported in this browser.");
        return;
    }

    if (isListening) {
        setIsListening(false);
        return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setPrompt(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.start();
  };

  return (
    <div className="w-full max-w-4xl mx-auto perspective-1000 flex flex-col gap-6">
      
      <div 
        className={`relative group transition-all duration-300 ${isDragging ? 'scale-[1.01]' : ''}`}
      >
        <label
          className={`
            relative flex flex-col items-center justify-center
            bg-zinc-900/30 
            backdrop-blur-sm
            rounded-2xl border border-dashed
            cursor-pointer overflow-hidden
            transition-all duration-300
            ${isDragging 
              ? 'border-blue-500 bg-zinc-900/50 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]' 
              : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/40'
            }
            ${isGenerating ? 'pointer-events-none' : ''}
            /* Adjust height based on content */
            py-12 sm:py-16
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
            {/* Technical Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px'}}>
            </div>
            
            {/* Corner Brackets */}
            <div className={`absolute top-4 left-4 w-4 h-4 border-l-2 border-t-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>
            <div className={`absolute top-4 right-4 w-4 h-4 border-r-2 border-t-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>
            <div className={`absolute bottom-4 left-4 w-4 h-4 border-l-2 border-b-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>
            <div className={`absolute bottom-4 right-4 w-4 h-4 border-r-2 border-b-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>

            <div className="relative z-10 flex flex-col items-center text-center space-y-6 w-full px-4">
                
                {/* Header Text */}
                <div className="space-y-2 md:space-y-4 w-full max-w-3xl">
                    <h3 className="flex flex-col items-center justify-center text-xl sm:text-2xl md:text-4xl text-zinc-100 leading-none font-bold tracking-tighter gap-3">
                        <span>Bring</span>
                        <div className="h-8 sm:h-10 md:h-14 flex items-center justify-center w-full">
                           <CyclingText />
                        </div>
                        <span>to life</span>
                    </h3>
                </div>

                {/* Optional Prompt Input */}
                <div className="w-full max-w-md relative group/input" onClick={(e) => e.preventDefault()}>
                    <input 
                        type="text" 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Optional: Add specific instructions..."
                        className="w-full bg-black/40 border border-zinc-700 rounded-full py-3 pl-5 pr-12 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                    <button 
                        type="button"
                        onClick={(e) => { e.preventDefault(); toggleListening(); }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${isListening ? 'text-red-400 bg-red-500/10' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        {isListening ? <StopIcon className="w-4 h-4 animate-pulse" /> : <MicrophoneIcon className="w-4 h-4" />}
                    </button>
                </div>

                {/* Custom CSS Toggle */}
                <div className="w-full max-w-md" onClick={(e) => e.preventDefault()}>
                    <button 
                        type="button"
                        onClick={() => setShowCssInput(!showCssInput)}
                        className="text-xs text-zinc-500 flex items-center gap-1 hover:text-blue-400 transition-colors mx-auto"
                    >
                        <CodeBracketSquareIcon className="w-3 h-3" />
                        {showCssInput ? 'Hide Custom CSS' : 'Add Custom CSS'}
                    </button>
                    
                    {showCssInput && (
                        <textarea
                            value={customCss}
                            onChange={(e) => setCustomCss(e.target.value)}
                            placeholder=".button { border-radius: 8px; } body { font-family: 'Courier New'; }"
                            className="w-full mt-2 h-24 bg-black/40 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 resize-none transition-all"
                        />
                    )}
                </div>

                {/* Icon & CTA */}
                <div className="flex flex-col items-center space-y-4 mt-2">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-zinc-800 border border-zinc-700 shadow-xl transition-transform duration-500 ${isDragging ? 'scale-110' : 'group-hover:-translate-y-1'}`}>
                        {isGenerating ? (
                            <CpuChipIcon className="w-6 h-6 text-blue-400 animate-spin-slow" />
                        ) : (
                            <ArrowUpTrayIcon className={`w-6 h-6 text-zinc-300 transition-all duration-300 ${isDragging ? 'text-blue-400' : ''}`} />
                        )}
                    </div>
                    <p className="text-zinc-500 text-sm font-light tracking-wide">
                        <span className="hidden md:inline">Drag & Drop</span>
                        <span className="md:hidden">Tap</span> to upload image or PDF
                    </p>
                </div>
            </div>

            <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isGenerating || disabled}
            />
        </label>
      </div>

      {/* Style Selector */}
      <div className={`flex items-center justify-center space-x-2 transition-opacity duration-500 ${isGenerating || disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
        <PaintBrushIcon className="w-4 h-4 text-zinc-500 shrink-0" />
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide max-w-full mask-linear-fade">
            {STYLES.map(style => (
                <button
                    key={style}
                    onClick={() => setSelectedStyle(style)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
                        selectedStyle === style 
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' 
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                >
                    {style}
                </button>
            ))}
        </div>
      </div>
      
      <style>{`
        .mask-linear-fade {
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
            -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
    </div>
  );
};