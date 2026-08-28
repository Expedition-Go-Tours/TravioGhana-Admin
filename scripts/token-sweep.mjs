import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'src');
const excludeFiles = new Set(['Sidebar.tsx']);
const changed = [];

function walk(dir) {
  const hits = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) hits.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry)) hits.push(full);
  }
  return hits;
}

// Ordered: most specific first so earlier patterns win.
const subs = [
  [/hover:bg-\[#4534b3\]/g, 'hover:bg-primary/90'],
  [/bg-\[#5645d4\]/g, 'bg-primary'],
  [/text-\[#5645d4\]/g, 'text-primary'],
  [/border-\[#E5E6EA\]/g, 'border-border-muted'],
  [/hover:bg-gray-50/g, 'hover:bg-surface-muted/50'],
  [/hover:bg-gray-100/g, 'hover:bg-surface-muted'],
  [/hover:text-green-700/g, 'hover:text-primary'],
  [/hover:bg-green-50/g, 'hover:bg-primary/10'],
  [/hover:border-green-300/g, 'hover:border-primary/30'],
  [/focus-visible:ring-green-400/g, 'focus-visible:ring-primary'],
  [/focus-visible:bg-white/g, 'focus-visible:bg-surface-base'],
  [/ring-green-400/g, 'ring-primary'],
  [/bg-white(?![\/-\w])/g, 'bg-surface-base'],
  [/text-gray-900/g, 'text-text-primary'],
  [/text-gray-800/g, 'text-text-primary'],
  [/text-gray-700/g, 'text-text-secondary'],
  [/text-gray-600/g, 'text-text-secondary'],
  [/text-gray-500/g, 'text-text-secondary'],
  [/text-gray-400/g, 'text-text-tertiary'],
  [/text-gray-300/g, 'text-text-tertiary'],
  [/text-slate-900/g, 'text-text-primary'],
  [/text-slate-400/g, 'text-text-tertiary'],
  [/bg-gray-100/g, 'bg-surface-muted'],
  [/bg-gray-50/g, 'bg-surface-muted/50'],
  [/bg-slate-100/g, 'bg-surface-muted'],
  [/border-gray-300/g, 'border-border-muted'],
  [/border-gray-200/g, 'border-border-muted'],
  [/text-green-800/g, 'text-primary'],
  [/text-green-700/g, 'text-primary'],
  [/text-green-600/g, 'text-primary'],
  [/text-green-500/g, 'text-primary'],
  [/text-green-400/g, 'text-primary'],
  [/border-green-700/g, 'border-primary'],
  [/border-green-600/g, 'border-primary'],
  [/border-green-400/g, 'border-primary'],
  [/border-green-300/g, 'border-primary/30'],
  [/border-green-200/g, 'border-primary/20'],
  [/bg-green-50/g, 'bg-primary/10'],
  [/bg-green-100/g, 'bg-primary/10'],
  [/bg-green-400/g, 'bg-primary'],
  [/text-red-800/g, 'text-status-rejected'],
  [/text-red-700/g, 'text-status-rejected'],
  [/text-red-600/g, 'text-status-rejected'],
  [/text-red-500/g, 'text-status-rejected'],
  [/text-red-400/g, 'text-status-rejected'],
  [/border-red-200/g, 'border-status-rejected/30'],
  [/bg-red-600/g, 'bg-status-rejected'],
  [/bg-red-500/g, 'bg-status-rejected'],
  [/bg-red-100/g, 'bg-status-rejected/10'],
  [/bg-red-50/g, 'bg-status-rejected/10'],
  [/hover:bg-red-700/g, 'hover:bg-status-rejected/90'],
  [/hover:bg-red-50/g, 'hover:bg-status-rejected/10'],
  [/text-indigo-800/g, 'text-primary'],
  [/text-indigo-700/g, 'text-primary'],
  [/text-indigo-600/g, 'text-primary'],
  [/text-indigo-500/g, 'text-primary'],
  [/text-indigo-400/g, 'text-primary/70'],
  [/border-indigo-200/g, 'border-primary/20'],
  [/bg-indigo-500/g, 'bg-primary'],
  [/bg-indigo-100/g, 'bg-primary/10'],
  [/bg-indigo-50/g, 'bg-primary/5'],
  [/hover:text-indigo-800/g, 'hover:text-primary/80'],
];

let count = 0;
for (const file of walk(root)) {
  const base = file.split(/[\\/]/).pop();
  if (excludeFiles.has(base)) continue;
  const orig = readFileSync(file, 'utf8');
  let out = orig;
  for (const [re, sub] of subs) out = out.replace(re, sub);
  if (out !== orig) {
    writeFileSync(file, out, 'utf8');
    changed.push(file.replace(process.cwd(), ''));
    count++;
  }
}
console.log('FILES CHANGED: ' + count);
for (const c of changed) console.log(' - ' + c);
