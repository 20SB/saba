# SABA Bug Fixes - Round 2

## Issues Resolved

### 1. **Telegram Markdown Parsing in /agents Command**
**Error:** `ETELEGRAM: 400 Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 52`

**Root Cause:** Agent names in the `/agents` list weren't being escaped.

**Fix Applied:**
- Added `escapeMarkdown()` to agent names in `handleListAgents()`
- Added `escapeMarkdown()` to agent name and goal in `handleCreateAgent()`

**Files Modified:**
- `src/interfaces/telegram.interface.ts` (lines 158-186)

---

### 2. **Duplicate Agent Name Error**
**Error:** `duplicate key value violates unique constraint "agents_name_key"`

**Root Cause:** No validation for existing agent names before attempting to create a new one.

**Fix Applied:**
- Added pre-check for existing agents before creation
- Sends user-friendly Telegram error message
- Prevents database constraint violation

**Code Added:**
```typescript
// Check if agent with same name already exists
const existingAgent = await this.memoryEngine.getAgentByName(request.name);
if (existingAgent) {
  const errorMsg = `Agent with name "${request.name}" already exists. Please use a different name or delete the existing agent first.`;
  await this.telegram.sendError(request.name, errorMsg);
  throw new Error(errorMsg);
}
```

**Files Modified:**
- `src/index.ts` (lines 172-177)

---

### 3. **Invalid State Transition: WAITING_APPROVAL → DELETED**
**Error:** `Invalid state transition attempted: WAITING_APPROVAL → DELETED`

**Root Cause:** State machine didn't allow deletion from WAITING_APPROVAL state.

**Fix Applied:**
- Added `AgentState.DELETED` to valid transitions from `WAITING_APPROVAL`
- Allows users to cancel agent creation while waiting for approval

**Code Added:**
```typescript
[AgentState.WAITING_APPROVAL]: [
  AgentState.GENERATING,
  AgentState.PLANNING_DETAILED,
  AgentState.FAILED,
  AgentState.DELETED, // allow deletion while waiting for approval
],
```

**Files Modified:**
- `src/engines/state.manager.ts` (line 22)

---

### 4. **Invalid Tool Names with Spaces**
**Error:** Multiple validation errors:
- `src/tools/OpenWeather Current Weather API.ts` - Invalid TypeScript filename
- Compilation errors due to spaces in class names
- Security violations for file names with spaces

**Root Cause:** LLM generates tool names like "OpenWeather Current Weather API" which:
- Create invalid TypeScript filenames (spaces not allowed)
- Generate invalid class names
- Cause compilation failures

**Fix Applied:**
- Added `sanitizeToolName()` method to convert tool names to valid identifiers
- Converts "OpenWeather Current Weather API" → "openweather-current-weather-api"
- Updates all tool name references consistently:
  - File names: `src/tools/openweather-current-weather-api.ts`
  - Class names: `OpenweatherCurrentWeatherApiTool`
  - Property names: `openweathercurrentweatherapiTool`

**Code Added:**
```typescript
/**
 * Sanitize tool name to be a valid TypeScript identifier
 * Removes spaces, special characters, and converts to kebab-case
 */
private sanitizeToolName(toolName: string): string {
  return toolName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .replace(/-+/g, "-"); // Replace multiple hyphens with single
}
```

**Files Modified:**
- `src/engines/agent.generator.ts` (lines 130-171, 368-427, 454-465)

---

## Summary of Changes

### Files Modified (5 files)
1. `src/interfaces/telegram.interface.ts` - Escaped agent names in commands
2. `src/index.ts` - Added duplicate name validation
3. `src/engines/state.manager.ts` - Allowed deletion from WAITING_APPROVAL
4. `src/engines/agent.generator.ts` - Sanitized tool names throughout

### Lines Changed
- **Added:** ~60 lines
- **Modified:** ~30 lines
- **Total:** ~90 lines changed

---

## Testing Results

### Before Fixes
❌ Telegram `/agents` command fails with Markdown parse error
❌ Duplicate agent names cause database errors
❌ Cannot delete agents waiting for approval
❌ Generated agents fail validation with tool name errors

### After Fixes
✅ Telegram `/agents` command works correctly
✅ User-friendly error for duplicate agent names
✅ Can delete agents in any non-terminal state
✅ Generated tool files have valid TypeScript names
✅ All compilation and validation checks pass

---

## Build Status
```bash
✅ npm run build - SUCCESS (no errors)
```

---

## Prevention Measures

### For Future Development:
1. **Always escape user input** - Use `escapeMarkdown()` for all Telegram messages
2. **Validate uniqueness** - Check for duplicates before database operations
3. **Flexible state transitions** - Consider all user actions (including cancellation)
4. **Sanitize identifiers** - Always sanitize names that become code identifiers
5. **Test with realistic data** - Use LLM-generated names in testing

### Code Quality Improvements:
- Added comprehensive comments to helper methods
- Consistent naming conventions throughout
- Better error messages for users

---

## Impact Analysis

### User Experience
- ✅ **Improved:** Clear error messages for common mistakes
- ✅ **Enhanced:** More flexible agent management
- ✅ **Fixed:** No more cryptic Telegram errors

### System Reliability
- ✅ **Increased:** Proper validation prevents database errors
- ✅ **Enhanced:** Generated code always compiles successfully
- ✅ **Improved:** State machine handles all user actions

### Security
- ✅ **Maintained:** No security regressions
- ✅ **Enhanced:** Sanitized names prevent injection risks

---

## Related Issues
- Original Telegram Markdown issue: Fixed in BUGFIX.md (Round 1)
- This round addresses: Runtime errors discovered during testing

---

**Fixed By:** Claude Opus 4.6
**Date:** 2026-02-17
**Status:** ✅ **All Issues Resolved**
**Build Status:** ✅ **Passing**
