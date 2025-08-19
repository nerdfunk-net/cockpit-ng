// Simple script to find potential React key issues
const fs = require('fs');

const componentContent = fs.readFileSync('./src/components/compare/git-compare.tsx', 'utf8');

// Find all JSX elements that could be siblings
const patterns = [
  // Look for adjacent JSX elements
  /<\w+[^>]*>[^<]*<\/\w+>\s*<\w+[^>]*>/g,
  // Look for conditional rendering + JSX
  /\{[^}]*&&[^}]*\}\s*<\w+/g,
  // Look for map + conditional
  /\.map\([^)]+\)\}\s*\{[^}]*&&/g,
  // Look for multiple divs in sequence
  /<div[^>]*>[^<]*<\/div>\s*<div/g,
];

console.log('🔍 Scanning for potential React key issues...\n');

patterns.forEach((pattern, index) => {
  const matches = componentContent.match(pattern);
  if (matches) {
    console.log(`Pattern ${index + 1}: Found ${matches.length} potential issues`);
    matches.forEach((match, i) => {
      console.log(`  ${i + 1}: ${match.substring(0, 100)}...`);
    });
    console.log('');
  }
});

// Look for all places where we have multiple children
const lines = componentContent.split('\n');
let inJSX = false;
let braceLevel = 0;
let potentialIssues = [];

lines.forEach((line, lineNumber) => {
  // Simple heuristic: look for multiple JSX elements or text nodes on same level
  if (line.includes('<') && line.includes('>')) {
    const jsxElements = (line.match(/<\w+/g) || []).length;
    const closingElements = (line.match(/<\/\w+>/g) || []).length;
    
    if (jsxElements > 1) {
      potentialIssues.push({
        line: lineNumber + 1,
        content: line.trim(),
        reason: `Multiple JSX elements on same line (${jsxElements})`
      });
    }
  }
});

if (potentialIssues.length > 0) {
  console.log('🚨 Potential key issues found:');
  potentialIssues.forEach(issue => {
    console.log(`Line ${issue.line}: ${issue.reason}`);
    console.log(`  ${issue.content}`);
    console.log('');
  });
}

console.log('✅ Scan complete!');
