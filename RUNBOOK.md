# 📓 Runbook

## 🚨 Incident: "Generation Failed"
**Symptoms**: User sees "Safety flag" or "Unexpected error" toast.
**Fixes**:
1. Check Google AI Studio status.
2. Verify API quota usage.
3. **Exp Backoff**: The `withRetry` logic handles transient 503 errors automatically.

## 🚨 Incident: "Preview Empty"
**Symptoms**: The iframe loads but remains blank.
**Causes**: 
- Faulty HTML generation (missing closing tags).
- **Fix**: Use the "Refine" tool and type "fix the html structure" to let Gemini heal the artifact.

## 🛠️ Maintenance: Updating Dependencies
1. Update `index.html` import maps.
2. Update `sw.js` cache versioning to force client updates.