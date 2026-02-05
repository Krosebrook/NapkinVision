/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const GEMINI_MODEL = 'gemini-3-pro-preview';
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000;

/**
 * Exponential backoff wrapper for API calls
 */
async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = INITIAL_BACKOFF): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.status === 429 || error?.status >= 500)) {
      console.warn(`Gemini API Error (${error.status}). Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

const SYSTEM_INSTRUCTION = `You are an expert AI Engineer and Product Designer specializing in "bringing artifacts to life".
Your goal is to take a user uploaded file and instantly generate a fully functional, interactive, single-page HTML/JS/CSS application.

CORE DIRECTIVES:
1. **Analyze & Abstract**: Build a Best Guess creative interpretation.
2. **NO EXTERNAL IMAGES**: Use inline SVGs, CSS, or Emojis.
3. **Make it Interactive**: Must have JS-driven behavior (buttons, drag-drop, states).
4. **Self-Contained**: Single HTML file with Tailwind CDN.

RESPONSE FORMAT:
Return ONLY the raw HTML code. Do not wrap in markdown.`;

function cleanHtmlOutput(text: string): string {
    if (!text) return "<!-- Failed to generate content -->";
    return text.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
}

export async function bringToLife(prompt: string, fileBase64?: string, mimeType?: string, stylePreset?: string, customCss?: string): Promise<string> {
  const parts: any[] = [];
  
  let finalPrompt = fileBase64 
    ? "Analyze this image/document. Build a fully interactive web app. IMPORTANT: Recreate visuals using CSS, SVGs, or Emojis." 
    : prompt || "Create a demo app that shows off your capabilities.";

  if (stylePreset && stylePreset !== 'Default') {
      finalPrompt += `\n\nDESIGN CONSTRAINT: Visual style: "${stylePreset}".`;
  }

  if (customCss) {
      finalPrompt += `\n\nCUSTOM CSS REQ:\n${customCss}`;
  }

  parts.push({ text: finalPrompt });

  if (fileBase64 && mimeType) {
    parts.push({
      inlineData: { data: fileBase64, mimeType },
    });
  }

  return withRetry(async () => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.5,
      },
    });
    return cleanHtmlOutput(response.text || "");
  });
}

export async function refineApp(currentHtml: string, instruction: string, fileBase64?: string, mimeType?: string): Promise<string> {
    const parts: any[] = [];
    
    if (fileBase64 && mimeType) {
        parts.push({
            inlineData: { data: fileBase64, mimeType }
        });
    }

    parts.push({ 
        text: `Update this HTML code based on instruction: "${instruction}"\n\nCURRENT CODE:\n${currentHtml}` 
    });

    return withRetry(async () => {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: { parts },
            config: {
                systemInstruction: "You are an expert Frontend Engineer. Modify the code precisely. Do not break existing features.",
                temperature: 0.3, 
            },
        });
        return cleanHtmlOutput(response.text || "");
    });
}