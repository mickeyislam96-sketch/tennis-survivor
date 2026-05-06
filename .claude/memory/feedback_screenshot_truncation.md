---
name: Never trust screenshot text for high-precision strings
description: 6 May 2026 we wasted 4 verify attempts because the Google Search Console TXT token had its last 5 characters cut off in screenshots. Always pull the exact value from the DOM (or copy-paste) for tokens, hashes, secrets, and any other character-perfect string.
type: feedback
---

When you need a character-perfect string (verification token, API key,
hash, signature, invite code), do NOT type it from a screenshot. Read
it programmatically from the DOM, or use a copy-paste action through
the page itself.

**Why:** 6 May 2026, setting up Google Search Console domain
verification, the TXT token was visually truncated by the COPY button
overlap in the GSC dialog. The screenshot showed
`google-site-verification=28bF0UID_eealiUCa756rQ6s9beWCFJ4xCPDIX`
(38 chars after the `=`). The actual token had 5 more characters:
`...HYX3E` (43 chars after the `=`). The first DNS record I added to
Namecheap was missing those 5 chars, so Google's verification check
failed three times before I noticed. Fixing the Namecheap record and
waiting for DNS to re-propagate cost ~10 minutes during the live R1
window.

**How to apply:**

When working with browser-based UIs (via Chrome MCP) and you need a
precise string from the page, prefer in this order:

1. `mcp__Claude_in_Chrome__javascript_tool` to read the exact text
   from the DOM. For a token visible in the page:

   ```js
   const els = document.querySelectorAll('*');
   for (const el of els) {
     const t = el.textContent || '';
     if (t.includes('google-site-verification=')) console.log(t.trim());
   }
   ```

2. The page's COPY button + `read_clipboard` (with grant), if that
   workflow is available.

3. As a last resort, transcribe from a high-resolution screenshot,
   AND immediately verify by querying or pasting back into a search.

**General rule:** any string longer than ~20 characters that needs
to match exactly elsewhere should never be transcribed by eye.
