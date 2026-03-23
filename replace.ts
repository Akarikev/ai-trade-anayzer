import fs from 'fs';

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

const replacements = [
  { from: /text-white dark:text-black dark:text-white/g, to: 'text-black dark:text-white' },
  { from: /bg-white dark:bg-black\/5 dark:bg-white\/5/g, to: 'bg-black/5 dark:bg-white/5' },
  { from: /bg-white dark:bg-black\/10 dark:bg-white\/10/g, to: 'bg-black/10 dark:bg-white/10' },
  { from: /bg-white dark:bg-black\/20 dark:bg-white\/20/g, to: 'bg-black/20 dark:bg-white/20' },
  { from: /bg-white dark:bg-black\/\[0\.02\] dark:bg-white\/\[0\.02\]/g, to: 'bg-black/[0.02] dark:bg-white/[0.02]' },
  { from: /text-white dark:text-black dark:text-white/g, to: 'text-black dark:text-white' },
  { from: /bg-white dark:bg-black\/80 dark:bg-white\/80/g, to: 'bg-white/80 dark:bg-black/80' },
];

for (const { from, to } of replacements) {
  content = content.replace(from, to);
}

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Cleanup done.');
