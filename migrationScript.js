#!/usr/bin/env node
/**
 * Migration script: PSSailpoint 1.x → 2.0
 *
 * Run from any directory:
 *   node migrationScript.js [target-directory]
 *
 * If no target directory is supplied the script processes the current
 * working directory recursively.
 *
 * What this script changes
 * ────────────────────────
 *  *.ps1 / *.psm1 / *.psd1 files
 *
 *  Beta cmdlet renames (deterministic)
 *    Verb-BetaNoun → Verb-NounV1
 *    e.g.  Get-BetaAccounts     → Get-AccountsV1
 *          Update-BetaEntitlement → Update-EntitlementV1
 *
 *  V3 / plain cmdlet renames
 *    Verb-Noun → Verb-NounV1   for any cmdlet on a line that also
 *    references -WithHttpInfo, -Limit, -Offset, -Count, -Filters, or
 *    -Id (strong indicators of a SailPoint SDK call).
 *
 *    String references inside cmdlet-name arguments are also updated:
 *    "Get-Accounts" → "Get-AccountsV1"
 *    Invoke-Paginate -Function "Get-Accounts" → Invoke-Paginate "Get-AccountsV1"
 *
 *  Import-Module insertion (*.ps1 only)
 *    Adds `Import-Module PSSailpoint` to the top of any *.ps1 that uses SDK
 *    cmdlets but does not already import the module.  In 2.0 the nested
 *    resource cmdlets are no longer auto-loaded, so a missing import surfaces
 *    at runtime as "The term 'Get-...V1' is not recognized as a name of a
 *    cmdlet" — which a try/catch that prints only $_.ErrorDetails will hide.
 *
 * Cmdlets that are NOT updated automatically
 *    • Invoke-Paginate, Invoke-PaginateSearch, ConvertFrom-JsonTo*
 *      (these do not change)
 *    • Any plain Verb-Noun call that does not have recognisable SailPoint
 *      parameters on the same line.  A list of these is printed at the end.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(process.argv[2] || '.');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build']);

let scanned = 0;
let changed = 0;
let importsAdded = 0;

// Module that must be imported for the 2.0 nested resource cmdlets to resolve
const MODULE_NAME = 'PSSailpoint';

// Standard PowerShell nouns that should never be V1-suffixed
const STANDARD_PS_NOUNS = new Set([
    'Item', 'ChildItem', 'Content', 'Date', 'Host', 'Variable', 'Location',
    'Process', 'Service', 'Command', 'Module', 'PSDrive', 'PSProvider',
    'Event', 'Job', 'Member', 'Object', 'Property', 'WmiObject', 'ComObject',
    'Help', 'History', 'Alias', 'Culture', 'UICulture', 'Random', 'Error',
    'Warning', 'Information', 'Verbose', 'Debug', 'Output', 'Null', 'Clipboard',
    'Path', 'ExecutionPolicy', 'StrictMode', 'DefaultConfiguration',
    'Expression', 'WebRequest', 'RestMethod', 'Transcript', 'Counter',
    'EventLog', 'HotFix', 'Package', 'Type',
]);

// SailPoint-specific parameters that identify a cmdlet call as an SDK call
const SAILPOINT_PARAM_RE = /-WithHttpInfo\b|-Limit\s+\$|-Offset\s+\$|-Count\s+\$true|-Filters\s+|-Id\s+"|-JsonPatchOperation\b|-Search\s+\$|-Transform\s+\$|-WithHttpInfo/;

// Cmdlets that keep their current name (no V1 suffix)
const EXEMPT_CMDLETS = new Set([
    'Invoke-Paginate',
    'Invoke-PaginateSearch',
    'Set-DefaultConfiguration',
    'Get-DefaultConfiguration',
]);

// Matches any PowerShell-style Verb-Noun token (including ones with Beta / V3)
const CMDLET_RE = /\b([A-Z][a-z]+)-(Beta|V3)?([A-Z][a-zA-Z]+)\b/g;

// ─── helpers ─────────────────────────────────────────────────────────────────

function walk(dir) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(full);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.ps1', '.psm1', '.psd1'].includes(ext)) {
                processFile(full);
            }
        }
    }
}

function isSailPointNoun(noun) {
    // Exempt standard PS nouns
    if (STANDARD_PS_NOUNS.has(noun)) return false;
    // Short generic nouns are likely standard PS
    if (noun.length <= 4) return false;
    return true;
}

function buildV1Name(verb, noun) {
    return `${verb}-${noun}V1`;
}

function applyReplacements(text) {
    const lines = text.split('\n');
    const updatedLines = lines.map(line => {
        // Skip comment lines
        if (/^\s*#/.test(line)) return line;

        let out = line;

        // 1. Beta cmdlets: Verb-BetaNoun → Verb-NounV1  (always safe)
        out = out.replace(
            /\b([A-Z][a-z]+)-Beta([A-Z][a-zA-Z]+)\b/g,
            (match, verb, noun) => {
                const full = `${verb}-Beta${noun}`;
                if (EXEMPT_CMDLETS.has(full)) return match;
                return buildV1Name(verb, noun);
            }
        );

        // 2. V3-prefixed cmdlets: Verb-V3Noun → Verb-NounV1
        out = out.replace(
            /\b([A-Z][a-z]+)-V3([A-Z][a-zA-Z]+)\b/g,
            (match, verb, noun) => buildV1Name(verb, noun)
        );

        // 3. Plain Verb-Noun cmdlets on lines with SailPoint SDK parameters
        if (SAILPOINT_PARAM_RE.test(out)) {
            out = out.replace(
                /\b([A-Z][a-z]+)-([A-Z][a-zA-Z]+)\b/g,
                (match, verb, noun) => {
                    // Already versioned?
                    if (/V\d+$/.test(noun)) return match;
                    // Exempt cmdlets
                    if (EXEMPT_CMDLETS.has(`${verb}-${noun}`)) return match;
                    // Standard PS nouns
                    if (!isSailPointNoun(noun)) return match;
                    return buildV1Name(verb, noun);
                }
            );
        }

        // 4. String cmdlet references, e.g. "Get-Accounts" or -Function "Get-Accounts"
        //    These are almost always SailPoint SDK function-name arguments.
        out = out.replace(
            /"([A-Z][a-z]+-[A-Z][a-zA-Z]+)"/g,
            (match, cmdlet) => {
                if (/V\d+$/.test(cmdlet)) return match;
                if (EXEMPT_CMDLETS.has(cmdlet)) return match;
                const [verb, noun] = cmdlet.split('-');
                if (!isSailPointNoun(noun)) return match;
                return `"${buildV1Name(verb, noun)}"`;
            }
        );

        // 5. -Function parameter (positional style after transformation above)
        //    Invoke-Paginate -Function "..." → Invoke-Paginate "..."
        out = out.replace(/Invoke-Paginate\s+-Function\s+/g, 'Invoke-Paginate ');

        return out;
    });

    return updatedLines.join('\n');
}

// True if the file already imports the SDK module (any quoting/casing)
function hasSdkImport(text) {
    return /^\s*Import-Module\s+['"]?PSSailpoint\b/im.test(text);
}

// True if the file calls SDK cmdlets that require the module to be imported:
// a versioned resource cmdlet (…V1), a pagination/config helper, or a
// ConvertFrom-JsonTo* helper.
function usesSdkCmdlets(text) {
    if (/\b[A-Z][a-z]+-[A-Za-z]+V\d+\b/.test(text)) return true;
    if (/\bConvertFrom-JsonTo[A-Z][a-zA-Z]+\b/.test(text)) return true;
    for (const cmdlet of EXEMPT_CMDLETS) {
        if (new RegExp(`\\b${cmdlet}\\b`).test(text)) return true;
    }
    return false;
}

// Prepend `Import-Module PSSailpoint` when a *.ps1 uses SDK cmdlets but does
// not already import the module. Preserves a leading shebang line if present.
function ensureSdkImport(text) {
    if (hasSdkImport(text) || !usesSdkCmdlets(text)) return text;

    const importBlock = `Import-Module ${MODULE_NAME}\n\n`;

    if (text.startsWith('#!')) {
        const nl = text.indexOf('\n');
        if (nl !== -1) {
            return text.slice(0, nl + 1) + importBlock + text.slice(nl + 1);
        }
    }
    return importBlock + text;
}

// Collect cmdlets that were NOT automatically updated (for the summary)
function findRemainingUnversioned(text) {
    const found = [];
    let m;
    CMDLET_RE.lastIndex = 0;
    while ((m = CMDLET_RE.exec(text)) !== null) {
        const [, verb, , noun] = m;
        if (!noun) continue;
        if (/V\d+$/.test(noun)) continue;
        if (EXEMPT_CMDLETS.has(`${verb}-${noun}`)) continue;
        if (STANDARD_PS_NOUNS.has(noun)) continue;
        if (!SAILPOINT_PARAM_RE.test(text)) continue; // only flag if in SDK context
        found.push(m[0]);
    }
    return [...new Set(found)];
}

function processFile(file) {
    scanned++;
    let original;
    try {
        original = fs.readFileSync(file, 'utf8');
    } catch {
        return;
    }

    let updated = applyReplacements(original);

    // Import-Module PSSailpoint applies to standalone *.ps1 scripts only —
    // never to module manifests (.psd1) or module files (.psm1).
    if (path.extname(file).toLowerCase() === '.ps1') {
        const withImport = ensureSdkImport(updated);
        if (withImport !== updated) {
            importsAdded++;
            console.log(`  +import  ${path.relative(ROOT, file)}`);
        }
        updated = withImport;
    }

    if (updated !== original) {
        fs.writeFileSync(file, updated, 'utf8');
        console.log(`  updated  ${path.relative(ROOT, file)}`);
        changed++;
    }
}

// ─── main ────────────────────────────────────────────────────────────────────

console.log(`\nSailPoint PSSailpoint 1.x → 2.0 migration`);
console.log(`Target: ${ROOT}\n`);

walk(ROOT);

console.log(`\n${changed} file(s) changed out of ${scanned} scanned.`);
console.log(`${importsAdded} file(s) had "Import-Module ${MODULE_NAME}" added.\n`);

console.log(`Manual review required
══════════════════════
1. Plain Verb-Noun cmdlets not on a line with SDK parameters
   Any SailPoint cmdlet call that did not appear alongside -WithHttpInfo,
   -Limit, -Offset, -Count, -Filters, or -Id may not have been updated.
   Search your scripts for unversioned SailPoint cmdlets and add V1:
     Get-Accounts          → Get-AccountsV1
     New-Transform         → New-TransformV1
     Search-Post           → Search-PostV1
     (and so on for every resource type you use)

2. Import / Install statements
   Update any Install-Module or Import-Module calls to reference
   PSSailpoint version 2.0 or later.

3. ConvertFrom-JsonTo* helpers
   These remain unchanged and do not receive a V1 suffix.

4. Invoke-Paginate function-name argument
   The -Function named parameter has been replaced by a positional argument:
     Old: Invoke-Paginate -Function "Get-Accounts" -Increment 50 ...
     New: Invoke-Paginate "Get-AccountsV1" -Increment 50 ...
   Verify these calls were updated correctly.

5. NERM cmdlets
   NERM cmdlets (Get-NERMUsers, Invoke-NERMV2025DelegationsGet, etc.)
   do not follow the V1 naming convention and are unchanged.

6. Filter operators (semantic — NOT auto-fixed)
   Cmdlet renames do not validate -Filters values. Some endpoints reject
   operators that were tolerated before. For example the Accounts API only
   supports these on each field:
     id: eq, in | identityId: eq | name: eq, in
     nativeIdentity: eq, in | sourceId: eq, in | uncorrelated: eq
   A filter like 'name co "Andrew"' returns HTTP 400 (Illegal value).
   Review your -Filters strings against the API reference for each resource.
`);
