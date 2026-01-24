/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { 
    ArrowDownTrayIcon, ViewColumnsIcon, DocumentIcon, 
    CodeBracketIcon, XMarkIcon, SparklesIcon, PaperAirplaneIcon,
    DevicePhoneMobileIcon, ComputerDesktopIcon, MicrophoneIcon,
    ArrowUturnLeftIcon, ArrowUturnRightIcon, CommandLineIcon,
    CursorArrowRaysIcon, EyeIcon
} from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';

interface LivePreviewProps {
  creation: Creation | null;
  isLoading: boolean;
  isRefining?: boolean;
  isFocused: boolean;
  onReset: () => void;
  onRefine: (instruction: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

declare global {
  interface Window {
    pdfjsLib: any;
    webkitSpeechRecognition: any;
  }
}

type InteractionMode = 'interact' | 'inspect' | 'edit';

interface InspectedElement {
  tagName: string;
  id: string;
  className: string;
  text: string;
  computedStyles: { [key: string]: string };
}

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  targetDescription?: string;
  targetTagName?: string;
}

const LoadingStep = ({ text, active, completed }: { text: string, active: boolean, completed: boolean }) => (
    <div className={`flex items-center space-x-3 transition-all duration-500 ${active || completed ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-4'}`}>
        <div className={`w-4 h-4 flex items-center justify-center ${completed ? 'text-green-400' : active ? 'text-blue-400' : 'text-zinc-700'}`}>
            {completed ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : active ? (
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
            ) : (
                <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></div>
            )}
        </div>
        <span className={`font-mono text-xs tracking-wide uppercase ${active ? 'text-zinc-200' : completed ? 'text-zinc-400 line-through' : 'text-zinc-600'}`}>{text}</span>
    </div>
);

const PdfRenderer = ({ dataUrl }: { dataUrl: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderPdf = async () => {
      if (!window.pdfjsLib) {
        setError("PDF library not initialized");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const loadingTask = window.pdfjsLib.getDocument(dataUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;
        setLoading(false);
      } catch (err) {
        console.error("Error rendering PDF:", err);
        setError("Could not render PDF preview.");
        setLoading(false);
      }
    };

    renderPdf();
  }, [dataUrl]);

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center">
            <DocumentIcon className="w-12 h-12 mb-3 opacity-50 text-red-400" />
            <p className="text-sm mb-2 text-red-400/80">{error}</p>
        </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        )}
        <canvas 
            ref={canvasRef} 
            className={`max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />
    </div>
  );
};

export const LivePreview: React.FC<LivePreviewProps> = ({ 
    creation, isLoading, isRefining = false, isFocused, 
    onReset, onRefine, onUndo, onRedo, canUndo, canRedo 
}) => {
    const [loadingStep, setLoadingStep] = useState(0);
    const [showSplitView, setShowSplitView] = useState(false);
    const [refineInput, setRefineInput] = useState("");
    const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
    const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
    const [isListening, setIsListening] = useState(false);
    
    // New States for Inspection/Editing
    const [interactionMode, setInteractionMode] = useState<InteractionMode>('interact');
    const [inspectedElement, setInspectedElement] = useState<InspectedElement | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, visible: false });
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (isLoading) {
            setLoadingStep(0);
            const interval = setInterval(() => {
                setLoadingStep(prev => (prev < 3 ? prev + 1 : prev));
            }, 2000); 
            return () => clearInterval(interval);
        } else {
            setLoadingStep(0);
        }
    }, [isLoading]);

    useEffect(() => {
        if (creation?.originalImage) {
            setShowSplitView(true);
        } else {
            setShowSplitView(false);
        }
    }, [creation]);

    // Handle iframe interactions
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || !creation?.html || viewMode !== 'preview') return;

        const loadHandler = () => {
            const doc = iframe.contentDocument;
            if (!doc) return;

            // Inject styles for highlighting
            const style = doc.createElement('style');
            style.textContent = `
                .gemini-inspector-hover {
                    outline: 2px solid #3b82f6 !important;
                    background-color: rgba(59, 130, 246, 0.1) !important;
                    cursor: default !important;
                }
                .gemini-edit-hover {
                    outline: 2px dashed #f59e0b !important;
                    cursor: pointer !important;
                }
            `;
            doc.head.appendChild(style);

            const handleMouseOver = (e: Event) => {
                if (interactionMode === 'interact') return;
                e.stopPropagation();
                const target = e.target as HTMLElement;
                if (target === doc.body || target === doc.documentElement) return;
                
                target.classList.add(interactionMode === 'inspect' ? 'gemini-inspector-hover' : 'gemini-edit-hover');
            };

            const handleMouseOut = (e: Event) => {
                if (interactionMode === 'interact') return;
                e.stopPropagation();
                const target = e.target as HTMLElement;
                target.classList.remove('gemini-inspector-hover', 'gemini-edit-hover');
            };

            const handleClick = (e: MouseEvent) => {
                if (interactionMode === 'interact') return;
                e.preventDefault();
                e.stopPropagation();
                
                const target = e.target as HTMLElement;
                
                if (interactionMode === 'inspect') {
                    const computed = window.getComputedStyle(target);
                    setInspectedElement({
                        tagName: target.tagName.toLowerCase(),
                        id: target.id,
                        className: target.className.replace('gemini-inspector-hover', '').trim(),
                        text: target.innerText.substring(0, 50),
                        computedStyles: {
                            color: computed.color,
                            backgroundColor: computed.backgroundColor,
                            fontSize: computed.fontSize,
                            fontFamily: computed.fontFamily,
                            padding: computed.padding,
                            margin: computed.margin
                        }
                    });
                } else if (interactionMode === 'edit') {
                    // Calculate position relative to the iframe container
                    const rect = target.getBoundingClientRect();
                    const iframeRect = iframe.getBoundingClientRect();
                    
                    // Generate a description for the AI
                    let description = target.tagName.toLowerCase();
                    if (target.id) description += `#${target.id}`;
                    if (target.className.replace('gemini-edit-hover', '').trim()) description += `.${target.className.replace('gemini-edit-hover', '').trim().split(' ').join('.')}`;
                    if (target.innerText) description += ` containing text "${target.innerText.substring(0, 20)}..."`;

                    setContextMenu({
                        x: iframeRect.left + e.clientX,
                        y: iframeRect.top + e.clientY,
                        visible: true,
                        targetDescription: description,
                        targetTagName: target.tagName.toLowerCase()
                    });
                }
            };

            doc.body.addEventListener('mouseover', handleMouseOver);
            doc.body.addEventListener('mouseout', handleMouseOut);
            doc.body.addEventListener('click', handleClick);

            return () => {
                doc.body.removeEventListener('mouseover', handleMouseOver);
                doc.body.removeEventListener('mouseout', handleMouseOut);
                doc.body.removeEventListener('click', handleClick);
            };
        };

        iframe.addEventListener('load', loadHandler);
        // If already loaded
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            loadHandler();
        }

        return () => {
            iframe.removeEventListener('load', loadHandler);
        };
    }, [creation?.html, interactionMode, viewMode]);

    // Close context menu on outside click
    useEffect(() => {
        const closeMenu = () => setContextMenu(prev => ({ ...prev, visible: false }));
        window.addEventListener('click', closeMenu);
        return () => window.removeEventListener('click', closeMenu);
    }, []);

    const handleExportJson = () => {
        if (!creation) return;
        const dataStr = JSON.stringify(creation, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_artifact.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportHtml = () => {
        if (!creation) return;
        const blob = new Blob([creation.html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleRefineSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (refineInput.trim() && !isRefining) {
            onRefine(refineInput);
            setRefineInput("");
        }
    };

    const handleContextMenuAction = (action: string) => {
        if (!contextMenu.targetDescription) return;
        
        let prompt = "";
        switch(action) {
            case 'color':
                const color = window.prompt("Enter new color (e.g., #ff0000, blue):");
                if (color) prompt = `Change the color/background of the element [${contextMenu.targetDescription}] to ${color}.`;
                break;
            case 'text':
                const text = window.prompt("Enter new text:");
                if (text) prompt = `Change the text content of the element [${contextMenu.targetDescription}] to "${text}".`;
                break;
            case 'size':
                const size = window.prompt("Enter new size (e.g., 20px, 1.5rem):");
                if (size) prompt = `Change the size/font-size of the element [${contextMenu.targetDescription}] to ${size}.`;
                break;
            case 'delete':
                if (window.confirm("Remove this element?")) prompt = `Remove the element [${contextMenu.targetDescription}] from the DOM.`;
                break;
        }

        if (prompt) {
            onRefine(prompt);
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

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
            setRefineInput(prev => prev + (prev ? ' ' : '') + transcript);
        };

        recognition.start();
    };

  return (
    <div
      className={`
        fixed z-40 flex flex-col
        rounded-lg overflow-hidden border border-zinc-800 bg-[#0E0E10] shadow-2xl
        transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isFocused
          ? 'inset-2 md:inset-4 opacity-100 scale-100'
          : 'top-1/2 left-1/2 w-[90%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-0 scale-95 pointer-events-none'
        }
      `}
    >
      {/* Header */}
      <div className="bg-[#121214] px-4 py-3 flex items-center justify-between border-b border-zinc-800 shrink-0">
        <div className="flex items-center space-x-3">
           <div className="flex space-x-2 group/controls mr-2">
                <button onClick={onReset} className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-red-500 hover:!bg-red-600 transition-colors flex items-center justify-center focus:outline-none" title="Close Preview">
                  <XMarkIcon className="w-2 h-2 text-black opacity-0 group-hover/controls:opacity-100" />
                </button>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-yellow-500 transition-colors"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-green-500 transition-colors"></div>
           </div>
           
           {/* Undo/Redo Controls */}
           {!isLoading && creation && (
               <div className="flex items-center space-x-1 border-l border-zinc-800 pl-3">
                   <button 
                       onClick={onUndo} 
                       disabled={!canUndo}
                       className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                       title="Undo"
                   >
                       <ArrowUturnLeftIcon className="w-4 h-4" />
                   </button>
                   <button 
                       onClick={onRedo} 
                       disabled={!canRedo}
                       className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                       title="Redo"
                   >
                       <ArrowUturnRightIcon className="w-4 h-4" />
                   </button>
               </div>
           )}
        </div>
        
        {/* Center: Device Toggles & Interaction Modes */}
        {!isLoading && creation && (
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
                    <button 
                        onClick={() => setDeviceMode('desktop')}
                        className={`p-1.5 rounded transition-colors ${deviceMode === 'desktop' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Desktop View"
                    >
                        <ComputerDesktopIcon className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setDeviceMode('mobile')}
                        className={`p-1.5 rounded transition-colors ${deviceMode === 'mobile' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                        title="Mobile View"
                    >
                        <DevicePhoneMobileIcon className="w-4 h-4" />
                    </button>
                </div>

                {viewMode === 'preview' && (
                    <div className="flex items-center bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
                         <button 
                            onClick={() => { setInteractionMode('interact'); setInspectedElement(null); }}
                            className={`p-1.5 rounded transition-colors ${interactionMode === 'interact' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Interact Mode"
                        >
                            <CursorArrowRaysIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => { setInteractionMode('inspect'); setInspectedElement(null); }}
                            className={`p-1.5 rounded transition-colors ${interactionMode === 'inspect' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Inspect Element"
                        >
                            <EyeIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => { setInteractionMode('edit'); setInspectedElement(null); }}
                            className={`p-1.5 rounded transition-colors ${interactionMode === 'edit' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Click to Edit"
                        >
                            <SparklesIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center justify-end space-x-1">
            {!isLoading && creation && (
                <>
                    <button 
                        onClick={() => setViewMode(prev => prev === 'preview' ? 'code' : 'preview')}
                        title={viewMode === 'preview' ? "View Source Code" : "View App"}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'code' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                    >
                        <CodeBracketIcon className="w-4 h-4" />
                    </button>

                    {creation.originalImage && (
                         <button 
                            onClick={() => setShowSplitView(!showSplitView)}
                            title={showSplitView ? "Show App Only" : "Compare with Original"}
                            className={`p-1.5 rounded-md transition-all ${showSplitView ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <ViewColumnsIcon className="w-4 h-4" />
                        </button>
                    )}
                    
                    <div className="h-4 w-px bg-zinc-800 mx-1"></div>

                    <button 
                        onClick={handleExportHtml} 
                        title="Download HTML"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                    >
                        <CommandLineIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={handleExportJson} 
                        title="Export JSON Artifact"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative w-full flex-1 bg-[#09090b] flex overflow-hidden justify-center">
        {isRefining && (
             <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center transition-all duration-300">
                 <div className="flex flex-col items-center space-y-4">
                     <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                     <p className="text-zinc-200 font-mono text-sm animate-pulse">Refining Application...</p>
                 </div>
             </div>
        )}

        {/* Context Menu for Edit Mode */}
        {contextMenu.visible && interactionMode === 'edit' && (
            <div 
                className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[160px] animate-in fade-in zoom-in duration-200"
                style={{ top: contextMenu.y, left: contextMenu.x }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-2 border-b border-zinc-700 bg-zinc-900/50">
                    <p className="text-[10px] font-mono uppercase text-zinc-500">{contextMenu.targetTagName}</p>
                </div>
                <div className="p-1">
                    <button onClick={() => handleContextMenuAction('text')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 rounded flex items-center gap-2">
                        <span>Edit Text</span>
                    </button>
                    <button onClick={() => handleContextMenuAction('color')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 rounded flex items-center gap-2">
                        <span>Change Color</span>
                    </button>
                    <button onClick={() => handleContextMenuAction('size')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 rounded flex items-center gap-2">
                        <span>Adjust Size</span>
                    </button>
                    <div className="h-px bg-zinc-700 my-1"></div>
                    <button onClick={() => handleContextMenuAction('delete')} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded flex items-center gap-2">
                        <span>Delete Element</span>
                    </button>
                </div>
            </div>
        )}

        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 w-full">
             <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 mb-6 text-blue-500 animate-spin-slow">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-zinc-100 font-mono text-lg tracking-tight">Constructing Environment</h3>
                    <p className="text-zinc-500 text-sm mt-2">Interpreting visual data...</p>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-[loading_3s_ease-in-out_infinite] w-1/3"></div>
                </div>
                 <div className="border border-zinc-800 bg-black/50 rounded-lg p-4 space-y-3 font-mono text-sm">
                     <LoadingStep text="Analyzing visual inputs" active={loadingStep === 0} completed={loadingStep > 0} />
                     <LoadingStep text="Identifying UI patterns" active={loadingStep === 1} completed={loadingStep > 1} />
                     <LoadingStep text="Generating functional logic" active={loadingStep === 2} completed={loadingStep > 2} />
                     <LoadingStep text="Compiling preview" active={loadingStep === 3} completed={loadingStep > 3} />
                 </div>
             </div>
          </div>
        ) : creation?.html ? (
          <>
            {/* Split View Left */}
            {showSplitView && creation.originalImage && (
                <div className="w-full md:w-1/2 h-full border-r border-zinc-800 bg-[#0c0c0e] relative flex flex-col shrink-0">
                    <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur text-zinc-400 text-[10px] font-mono uppercase px-2 py-1 rounded border border-zinc-800">Input Source</div>
                    <div className="w-full h-full p-6 flex items-center justify-center overflow-hidden">
                        {creation.originalImage.startsWith('data:application/pdf') ? (
                            <PdfRenderer dataUrl={creation.originalImage} />
                        ) : (
                            <img src={creation.originalImage} alt="Original Input" className="max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded" />
                        )}
                    </div>
                </div>
            )}

            {/* App Preview / Code View */}
            <div className={`relative h-full bg-zinc-900/50 transition-all duration-500 flex items-center justify-center overflow-auto ${showSplitView && creation.originalImage ? 'w-full md:w-1/2' : 'w-full'}`}>
                 {viewMode === 'preview' ? (
                     <div 
                        className={`transition-all duration-300 bg-white shadow-2xl overflow-hidden ${deviceMode === 'mobile' ? 'w-[375px] h-[667px] rounded-3xl border-8 border-zinc-800' : 'w-full h-full'}`}
                     >
                         <iframe
                            ref={iframeRef}
                            title="Gemini Live Preview"
                            srcDoc={creation.html}
                            className="w-full h-full"
                            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                        />
                     </div>
                 ) : (
                     <div className="w-full h-full p-6 overflow-auto">
                         <pre className="text-xs font-mono text-zinc-300 bg-black/50 p-4 rounded-lg border border-zinc-800 whitespace-pre-wrap break-all">
                             {creation.html}
                         </pre>
                     </div>
                 )}
            </div>
            
            {/* Inspector Panel - Only visible in inspect mode when an element is selected */}
            {interactionMode === 'inspect' && inspectedElement && (
                <div className="absolute top-4 left-4 z-50 w-64 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-lg p-4 shadow-xl text-xs font-mono text-zinc-300 pointer-events-none">
                    <div className="flex items-center justify-between mb-2 border-b border-zinc-700 pb-2">
                        <span className="font-bold text-blue-400 uppercase">{inspectedElement.tagName}</span>
                        <span className="text-zinc-500">{inspectedElement.id ? `#${inspectedElement.id}` : ''}</span>
                    </div>
                    <div className="space-y-1.5">
                        {inspectedElement.className && (
                            <div className="break-words">
                                <span className="text-zinc-500">Class:</span> <span className="text-yellow-600">.{inspectedElement.className.split(' ').join('.')}</span>
                            </div>
                        )}
                         <div className="grid grid-cols-2 gap-2 mt-2">
                             <div>
                                 <span className="text-zinc-500 block">Color</span>
                                 <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full border border-zinc-600" style={{ backgroundColor: inspectedElement.computedStyles.color }}></div>
                                    <span>{inspectedElement.computedStyles.color}</span>
                                 </div>
                             </div>
                             <div>
                                 <span className="text-zinc-500 block">Bg</span>
                                 <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full border border-zinc-600" style={{ backgroundColor: inspectedElement.computedStyles.backgroundColor }}></div>
                                    <span>{inspectedElement.computedStyles.backgroundColor}</span>
                                 </div>
                             </div>
                         </div>
                         <div className="mt-2">
                            <span className="text-zinc-500 block">Font</span>
                            <span className="truncate block">{inspectedElement.computedStyles.fontSize} {inspectedElement.computedStyles.fontFamily}</span>
                         </div>
                    </div>
                </div>
            )}
            
            {/* Refinement Bar - Hidden in Edit Mode to avoid clutter */}
            {interactionMode === 'interact' && (
                <div className="absolute bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
                    <form 
                        onSubmit={handleRefineSubmit}
                        className="w-full max-w-xl pointer-events-auto shadow-2xl shadow-black/50 rounded-full overflow-hidden flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all"
                    >
                        <div className="pl-4 pr-2 text-zinc-400">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                        <input 
                            type="text" 
                            value={refineInput}
                            onChange={(e) => setRefineInput(e.target.value)}
                            disabled={isRefining}
                            placeholder="Type a change... (e.g., 'Add a dark mode button')"
                            className="flex-1 bg-transparent border-none text-sm text-white placeholder-zinc-500 focus:ring-0 py-3 px-2 outline-none"
                        />
                        
                        <button
                            type="button"
                            onClick={toggleListening}
                            className={`p-2 rounded-full transition-all mr-1 ${isListening ? 'text-red-400 bg-red-500/10 animate-pulse' : 'text-zinc-400 hover:text-zinc-200'}`}
                            title="Voice Input"
                        >
                            <MicrophoneIcon className="w-4 h-4" />
                        </button>

                        <button 
                            type="submit"
                            disabled={!refineInput.trim() || isRefining}
                            className="mr-1.5 p-2 rounded-full bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:text-white disabled:opacity-50 transition-all"
                        >
                            <PaperAirplaneIcon className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};