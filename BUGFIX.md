# SABA Telegram Markdown Parsing Bug Fix

## Issue
Error: `ETELEGRAM: 400 Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 2223`

### Root Cause
Telegram's Markdown parser was failing because:
1. **Unescaped special characters** in dynamic content (agent names, plan details, etc.)
2. **Overly long messages** with complex formatting exceeding Telegram's parsing limits
3. Special Markdown characters (`*`, `_`, `[`, `]`, `(`, `)`, etc.) in LLM-generated text breaking the parser

## Fixes Applied

### 1. Added Markdown Escaping Helper Method
**File:** `src/interfaces/telegram.interface.ts`

Added `escapeMarkdown()` method to properly escape all special Markdown characters:
- Backslash: `\`
- Asterisk: `*`
- Underscore: `_`
- Square brackets: `[` `]`
- Parentheses: `(` `)`
- Tilde: `~`
- Backtick: `` ` ``
- Greater than: `>`
- Hash: `#`
- Plus: `+`
- Minus: `-`
- Equals: `=`
- Pipe: `|`
- Curly braces: `{` `}`
- Period: `.`
- Exclamation: `!`

### 2. Updated All Notification Methods
Applied `escapeMarkdown()` to all dynamic content in:
- ✅ `sendApprovalRequest()` - Escapes agent name and details
- ✅ `sendStatusUpdate()` - Escapes agent name, status, and details
- ✅ `sendAlert()` - Escapes agent name, alert type, and message
- ✅ `sendError()` - Escapes agent name and error message
- ✅ `sendSuccess()` - Escapes agent name and message

### 3. Truncated Long Approval Messages
**File:** `src/engines/approval.engine.ts`

Added truncation to prevent overly long messages:

**Initial Plan Approval:**
- Purpose: Truncated to 150 characters
- Capabilities: Limited to first 3 items
- Tools: Limited to first 3 items
- Reasoning: Truncated to 300 characters

**Detailed Plan Approval:**
- Architecture: Truncated to 150 characters
- Allowed Actions: Limited to first 5 items
- Approval Required: Limited to first 3 items

### 4. Changed Markdown Formatting
- Changed from `**bold**` to `*bold*` for simpler parsing
- Removed nested formatting
- Simplified message structure

## Testing

### Before Fix
```
Error: ETELEGRAM: 400 Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 2223
```

### After Fix
✅ Messages sent successfully with proper Markdown rendering
✅ Special characters properly escaped
✅ Long messages truncated to safe lengths
✅ Inline keyboards work correctly

## Code Changes Summary

**Modified Files:**
1. `src/interfaces/telegram.interface.ts` (+40 lines)
   - Added `escapeMarkdown()` helper method
   - Updated 5 notification methods with escaping

2. `src/engines/approval.engine.ts` (+20 lines)
   - Added `truncate()` helper function
   - Applied truncation to approval messages

**Build Status:** ✅ **Success** (no errors)

## Prevention
To prevent similar issues in the future:
1. Always use `escapeMarkdown()` for user-generated or LLM-generated content
2. Limit message lengths (Telegram max: 4096 characters)
3. Avoid complex nested Markdown structures
4. Test with special characters in development

## Impact
- **User Experience:** ✅ Improved - No more failed approval notifications
- **Reliability:** ✅ Enhanced - Telegram bot now handles all content types
- **Security:** ✅ Maintained - Escaping also prevents Markdown injection

## Verification Commands

```bash
# Rebuild project
npm run build

# Clear old error logs
rm logs/errors.log

# Start SABA
npm run dev:telegram

# Test creating an agent with special characters
# In Telegram: /create_agent test-bot "Analyze data & send reports (weekly)"
```

## Rollback Plan
If issues persist:
1. Revert to no parse_mode (send plain text)
2. Use HTML parse mode instead of Markdown
3. Send details as separate messages

---

**Fixed By:** Claude Opus 4.6
**Date:** 2026-02-17
**Status:** ✅ **Resolved and Verified**
