/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Using gemini-3-pro-preview for complex coding tasks.
const GEMINI_MODEL = 'gemini-3-pro-preview';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are an expert AI Engineer and Product Designer specializing in "bringing artifacts to life".
Your goal is to take a user uploaded file—which might be a polished UI design, a messy napkin sketch, a photo of a whiteboard with jumbled notes, or a picture of a real-world object (like a messy desk)—and instantly generate a fully functional, interactive, single-page HTML/JS/CSS application.

CORE DIRECTIVES:
1. **Analyze & Abstract**: Look at the image.
    - **Sketches/Wireframes**: Detect buttons, inputs, and layout. Turn them into a modern, clean UI.
    - **Real-World Photos (Mundane Objects)**: If the user uploads a photo of a desk, a room, or a fruit bowl, DO NOT just try to display it. **Gamify it** or build a **Utility** around it.
      - *Cluttered Desk* -> Create a "Clean Up" game where clicking items (represented by emojis or SVG shapes) clears them, or a Trello-style board.
      - *Fruit Bowl* -> A nutrition tracker or a still-life painting app.
    - **Documents/Forms**: specific interactive wizards or dashboards.

2. **NO EXTERNAL IMAGES**:
    - **CRITICAL**: Do NOT use <img src="..."> with external URLs (like imgur, placeholder.com, or generic internet URLs). They will fail.
    - **INSTEAD**: Use **CSS shapes**, **inline SVGs**, **Emojis**, or **CSS gradients** to visually represent the elements you see in the input.
    - If you see a "coffee cup" in the input, render a ☕ emoji or draw a cup with CSS. Do not try to load a jpg of a coffee cup.

3. **Make it Interactive**: The output MUST NOT be static. It needs buttons, sliders, drag-and-drop, or dynamic visualizations.
4. **Self-Contained**: The output must be a single HTML file with embedded CSS (<style>) and JavaScript (<script>). No external dependencies unless absolutely necessary (Tailwind via CDN is allowed).
5. **Robust & Creative**: If the input is messy or ambiguous, generate a "best guess" creative interpretation. Never return an error. Build *something* fun and functional.

RESPONSE FORMAT:
Return ONLY the raw HTML code. Do not wrap it in markdown code blocks (\`\`\`html ... \`\`\`). Start immediately with <!DOCTYPE html>.`;

/**
 * Helper to strip markdown code fences from the model response.
 */
function cleanHtmlOutput(text: string): string {
    if (!text) return "<!-- Failed to generate content -->";
    return text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
}

export async function bringToLife(prompt: string, fileBase64?: string, mimeType?: string, stylePreset?: string, customCss?: string): Promise<string> {
  const parts: any[] = [];
  
  let finalPrompt = fileBase64 
    ? "Analyze this image/document. Detect what functionality is implied. If it is a real-world object (like a desk), gamify it (e.g., a cleanup game). Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate the visuals using CSS, SVGs, or Emojis." 
    : prompt || "Create a demo app that shows off your capabilities.";

  if (stylePreset && stylePreset !== 'Default') {
      finalPrompt += `\n\nDESIGN CONSTRAINT: The visual style of the application must strictly follow this aesthetic: "${stylePreset}".`;
  }

  if (customCss) {
      finalPrompt += `\n\nTECHNICAL CONSTRAINT: You must incorporate the following custom CSS rules into the generated application's <style> block:\n${customCss}`;
  }

  parts.push({ text: finalPrompt });

  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    });
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: parts
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.5,
      },
    });

    return cleanHtmlOutput(response.text || "");
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
}

export async function refineApp(currentHtml: string, instruction: string, fileBase64?: string, mimeType?: string): Promise<string> {
    const parts: any[] = [];
    
    if (fileBase64 && mimeType) {
        parts.push({
            inlineData: {
                data: fileBase64,
                mimeType: mimeType,
            }
        });
    }

    parts.push({ 
        text: `Here is the current HTML code for a web application:
        
        ${currentHtml}
        
        USER INSTRUCTION: ${instruction}
        
        TASK:
        1. Update the code to satisfy the user's instruction.
        2. Keep the rest of the functionality intact.
        3. Ensure the result is still a single valid HTML file with no external dependencies (other than Tailwind CDN).
        4. Do not use external images.
        
        Return ONLY the raw HTML code. Do not wrap it in markdown.` 
    });

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: { parts },
            config: {
                systemInstruction: "You are an expert Frontend Engineer. Your task is to modify existing HTML/JS/CSS code based on user instructions. Be precise. Do not break existing features.",
                temperature: 0.3, 
            },
        });

        return cleanHtmlOutput(response.text || "");

    } catch (error) {
        console.error("Gemini Refinement Error:", error);
        throw error;
    }
}