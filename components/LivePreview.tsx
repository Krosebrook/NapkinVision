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
    CursorArrowRaysIcon, EyeIcon, PencilSquareIcon, TrashIcon,
    SwatchIcon, ArrowsPointingOutIcon
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
  targetInnerHtml?: string;
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

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || !creation?.html || viewMode !== 'preview') return;

        const loadHandler = () => {
            const doc = iframe.contentDocument;
            if (!doc) return;

            const styleId = 'gemini-preview-styles';
            let style = doc.getElementById(styleId) as HTMLStyleElement;
            if (!style) {
                style = doc.createElement('style');
                style.id = styleId;
                doc.head.appendChild(style);
            }
            
            style.textContent = `
                .gemini-inspector-hover {
                    outline: 2px solid #3b82f6 !important;
                    outline-offset: -2px !important;
                    background-color: rgba(59, 130, 246, 0.1) !important;
                    transition: all 0.1s ease;
                }
                .gemini-edit-hover {
                    outline: 2px dashed #f59e0b !important;
                    outline-offset: -2px !important;
                    background-color: rgba(245, 158, 11, 0.05) !important;
                    cursor: pointer !important;
                    transition: all 0.1s ease;
                }
            `;

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
                        text: target.innerText.substring(0, 100),
                        computedStyles: {
                            color: computed.color,
                            backgroundColor: computed.backgroundColor,
                            fontSize: computed.fontSize,
                            fontWeight: computed.fontWeight,
                            fontFamily: computed.fontFamily,
                            padding: computed.padding,
                            margin: computed.margin,
                            borderRadius: computed.borderRadius,
                            border: computed.border,
                            display: computed.display,
                            position: computed.position
                        }
                    });
                } else if (interactionMode === 'edit') {
                    const iframeRect = iframe.getBoundingClientRect();
                    
                    let description = target.tagName.toLowerCase();
                    if (target.id) description += `#${target.id}`;
                    if (target.className.replace('gemini-edit-hover', '').trim()) {
                        description += `.${target.className.replace('gemini-edit-hover', '').trim().split(' ').join('.')}`;
                    }
                    if (target.innerText) {
                         description += ` (current text: "${target.innerText.substring(0, 20)}...")`;
                    }

                    setContextMenu({
                        x: iframeRect.left + e.clientX,
                        y: iframeRect.top + e.clientY,
                        visible: true,
                        targetDescription: description,
                        targetTagName: target.tagName.toLowerCase(),
                        targetInnerHtml: target.innerHTML
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
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            loadHandler();
        }

        return () => {
            iframe.removeEventListener('load', loadHandler);
        };
    }, [creation?.html, interactionMode, viewMode]);

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
                const color = window.prompt("New color or theme (e.g. 'ocean blue', '#ff5500', 'soft gradients'):");
                if (color) prompt = `Update the style of the element [${contextMenu.targetDescription}] to use ${color}.`;
                break;
            case 'text':
                const text = window.prompt("Enter the new text content:");
                if (text !== null) prompt = `Change the text content of the element [${contextMenu.targetDescription}] to "${text}".`;
                break;
            case 'size':
                const size = window.prompt("New size or dimensions (e.g. 'larger', 'wider', 'height: 400px'):");
                if (size) prompt = `Adjust the size/scale of the element [${contextMenu.targetDescription}] to be ${size}.`;
                break;
            case 'delete':
                if (window.confirm("Are you sure you want to remove this element?")) {
                    prompt = `Remove the element [${contextMenu.targetDescription}] completely from the application.`;
                }
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

        const recognition = new (window as any).webkitSpeechRecognition();
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
      <div className="bg-[#121214] px-4 py-3 flex items-center justify-between border-b border-zinc-800 shrink-0">
        <div className="flex items-center space-x-3">
           <div className="flex space-x-2 group/controls mr-2">
                <button onClick={onReset} className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-red-500 hover:!bg-red-600 transition-colors flex items-center justify-center focus:outline-none" title="Close Preview">
                  <XMarkIcon className="w-2 h-2 text-black opacity-0 group-hover/controls:opacity-100" />
                </button>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-yellow-500 transition-colors"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-green-500 transition-colors"></div>
           </div>
           
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
                            title="Interact"
                        >
                            <CursorArrowRaysIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => { setInteractionMode('inspect'); setInspectedElement(null); }}
                            className={`p-1.5 rounded transition-colors ${interactionMode === 'inspect' ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Inspect"
                        >
                            <EyeIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => { setInteractionMode('edit'); setInspectedElement(null); }}
                            className={`p-1.5 rounded transition-colors ${interactionMode === 'edit' ? 'bg-orange-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            title="Smart Edit"
                        >
                            <SparklesIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        )}

        <div className="flex items-center justify-end space-x-1">
            {!isLoading && creation && (
                <>
                    <button 
                        onClick={() => setViewMode(prev => prev === 'preview' ? 'code' : 'preview')}
                        title={viewMode === 'preview' ? "View Source" : "View App"}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'code' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                    >
                        <CodeBracketIcon className="w-4 h-4" />
                    </button>

                    {creation.originalImage && (
                         <button 
                            onClick={() => setShowSplitView(!showSplitView)}
                            title={showSplitView ? "Hide Source Image" : "Show Source Image"}
                            className={`p-1.5 rounded-md transition-all ${showSplitView ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <ViewColumnsIcon className="w-4 h-4" />
                        </button>
                    )}
                    
                    <div className="h-4 w-px bg-zinc-800 mx-1"></div>

                    <button 
                        onClick={handleExportHtml} 
                        title="Download .html"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                    >
                        <CommandLineIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={handleExportJson} 
                        title="Export Artifact"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
      </div>

      <div className="relative w-full flex-1 bg-[#09090b] flex overflow-hidden justify-center">
        {isRefining && (
             <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                 <div className="flex flex-col items-center space-y-4">
                     <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                     <p className="text-zinc-200 font-mono text-sm">Refining with Gemini...</p>
                 </div>
             </div>
        )}

        {contextMenu.visible && interactionMode === 'edit' && (
            <div 
                className="fixed z-[60] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200"
                style={{ top: contextMenu.y + 10, left: contextMenu.x }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                        {contextMenu.targetTagName}
                    </p>
                    <button onClick={() => setContextMenu({ ...contextMenu, visible: false })}>
                        <XMarkIcon className="w-3 h-3 text-zinc-600 hover:text-zinc-400" />
                    </button>
                </div>
                <div className="p-1.5 space-y-0.5">
                    <button onClick={() => handleContextMenuAction('text')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-md flex items-center gap-2.5 transition-colors">
                        <PencilSquareIcon className="w-4 h-4 text-zinc-500" />
                        <span>Edit Text</span>
                    </button>
                    <button onClick={() => handleContextMenuAction('color')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-md flex items-center gap-2.5 transition-colors">
                        <SwatchIcon className="w-4 h-4 text-zinc-500" />
                        <span>Change Style</span>
                    </button>
                    <button onClick={() => handleContextMenuAction('size')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 rounded-md flex items-center gap-2.5 transition-colors">
                        <ArrowsPointingOutIcon className="w-4 h-4 text-zinc-500" />
                        <span>Adjust Dimensions</span>
                    </button>
                    <div className="h-px bg-zinc-800 my-1 mx-2"></div>
                    <button onClick={() => handleContextMenuAction('delete')} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-md flex items-center gap-2.5 transition-colors">
                        <TrashIcon className="w-4 h-4 opacity-70" />
                        <span>Remove Element</span>
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
                    <h3 className="text-zinc-100 font-mono text-lg tracking-tight">Creating Experience</h3>
                </div>
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-[loading_3s_ease-in-out_infinite] w-1/3"></div>
                </div>
                 <div className="border border-zinc-800 bg-black/50 rounded-lg p-4 space-y-3 font-mono text-sm">
                     <LoadingStep text="Analyzing input" active={loadingStep === 0} completed={loadingStep > 0} />
                     <LoadingStep text="Structuring layout" active={loadingStep === 1} completed={loadingStep > 1} />
                     <LoadingStep text="Injecting logic" active={loadingStep === 2} completed={loadingStep > 2} />
                     <LoadingStep text="Booting app" active={loadingStep === 3} completed={loadingStep > 3} />
                 </div>
             </div>
          </div>
        ) : creation?.html ? (
          <>
            {showSplitView && creation.originalImage && (
                <div className="w-full md:w-1/2 h-full border-r border-zinc-800 bg-[#0c0c0e] relative flex flex-col shrink-0">
                    <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur text-zinc-400 text-[10px] font-mono uppercase px-2 py-1 rounded border border-zinc-800">Source Asset</div>
                    <div className="w-full h-full p-6 flex items-center justify-center overflow-hidden">
                        {creation.originalImage.startsWith('data:application/pdf') ? (
                            <PdfRenderer dataUrl={creation.originalImage} />
                        ) : (
                            <img src={creation.originalImage} alt="Input" className="max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded" />
                        )}
                    </div>
                </div>
            )}

            <div className={`relative h-full bg-zinc-900/50 flex items-center justify-center overflow-auto ${showSplitView && creation.originalImage ? 'w-full md:w-1/2' : 'w-full'}`}>
                 {viewMode === 'preview' ? (
                     <div 
                        className={`transition-all duration-300 bg-white shadow-2xl overflow-hidden ${deviceMode === 'mobile' ? 'w-[375px] h-[667px] rounded-[3rem] border-[12px] border-zinc-800 relative' : 'w-full h-full'}`}
                     >
                         {deviceMode === 'mobile' && (
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-b-2xl z-20"></div>
                         )}
                         <iframe
                            ref={iframeRef}
                            title="Live Preview"
                            srcDoc={creation.html}
                            className="w-full h-full"
                            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                        />
                     </div>
                 ) : (
                     <div className="w-full h-full p-6 overflow-auto bg-zinc-950 font-mono text-[13px] leading-relaxed text-zinc-300">
                         <div className="max-w-4xl mx-auto">
                            <pre className="whitespace-pre-wrap break-all selection:bg-blue-500/30">
                                {creation.html}
                            </pre>
                         </div>
                     </div>
                 )}
            </div>
            
            {interactionMode === 'inspect' && inspectedElement && (
                <div className="absolute top-4 left-4 z-50 w-72 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl p-4 shadow-2xl text-[11px] font-mono text-zinc-300 overflow-hidden animate-in fade-in slide-in-from-left-4">
                    <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                             <span className="font-bold text-blue-400 uppercase text-xs">{inspectedElement.tagName}</span>
                        </div>
                        <button onClick={() => setInspectedElement(null)}>
                            <XMarkIcon className="w-3 h-3 text-zinc-600 hover:text-zinc-400" />
                        </button>
                    </div>
                    
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                        {inspectedElement.id && (
                            <div className="bg-zinc-950/50 p-2 rounded border border-zinc-800">
                                <span className="text-zinc-500 mr-2">ID:</span>
                                <span className="text-orange-400">#{inspectedElement.id}</span>
                            </div>
                        )}
                        
                        {inspectedElement.className && (
                            <div className="bg-zinc-950/50 p-2 rounded border border-zinc-800">
                                <span className="text-zinc-500 block mb-1">Classes:</span>
                                <div className="flex flex-wrap gap-1">
                                    {inspectedElement.className.split(' ').map((cls, i) => (
                                        <span key={i} className="text-yellow-600">.{cls}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-widest">Computed Styles</span>
                            <div className="grid grid-cols-1 gap-1.5">
                                {Object.entries(inspectedElement.computedStyles).map(([key, value]) => (
                                    <div key={key} className="flex justify-between items-center py-1 border-b border-zinc-800/50 last:border-0">
                                        <span className="text-zinc-500">{key.replace(/([A-Z])/g, '-$1').toLowerCase()}</span>
                                        <span className="text-zinc-200 text-right">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {inspectedElement.text && (
                            <div className="space-y-1">
                                <span className="text-zinc-500 uppercase text-[9px] font-bold tracking-widest">Inner Text</span>
                                <p className="text-zinc-400 italic bg-zinc-950/50 p-2 rounded leading-tight">
                                    "{inspectedElement.text}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {interactionMode === 'interact' && !isRefining && (
                <div className="absolute bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
                    <form 
                        onSubmit={handleRefineSubmit}
                        className="w-full max-w-xl pointer-events-auto shadow-2xl shadow-black/50 rounded-full overflow-hidden flex items-center bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 focus-within:border-blue-500/50 transition-all"
                    >
                        <div className="pl-4 pr-2 text-zinc-400">
                            <SparklesIcon className="w-5 h-5" />
                        </div>
                        <input 
                            type="text" 
                            value={refineInput}
                            onChange={(e) => setRefineInput(e.target.value)}
                            disabled={isRefining}
                            placeholder="Type a specific change..."
                            className="flex-1 bg-transparent border-none text-sm text-white placeholder-zinc-500 focus:ring-0 py-3 px-2 outline-none"
                        />
                        
                        <button
                            type="button"
                            onClick={toggleListening}
                            className={`p-2 rounded-full transition-all mr-1 ${isListening ? 'text-red-400 bg-red-500/10' : 'text-zinc-400 hover:text-zinc-200'}`}
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
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #27272a;
            border-radius: 4px;
        }
      `}</style>
    </div>
  );
};