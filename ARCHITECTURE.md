# 🏗️ Architecture

## 🧬 Design Philosophy
- **Zero-Build**: Relies on browser-native ESM and CDN-loaded libraries to minimize supply chain complexity.
- **Artifact-First**: The output of the AI is treated as a first-class "Artifact" that can be versioned, refined, and exported.

## 🔄 Data Flow
1. **Input**: `InputArea` captures `File` (Image/PDF) or `Prompt`.
2. **Context**: `App.tsx` hydrates the request with `CreationHistory` context.
3. **Synthesis**: `services/gemini.ts` orchestrates the Gemini 3 LLM call.
4. **Execution**: The response is injected into an isolated `<iframe>` with a strict `sandbox` policy.
5. **Persistence**: `LocalStorage` stores the JSON representation (Base64 image + HTML code) for offline retrieval.

## 🧱 Key Components
- **LivePreview**: A complex host component managing `interactionMode` (Interact, Inspect, Edit).
- **Service Worker**: Manages a `Cache-First` strategy for expensive dependencies (PDF.js, Tailwind).