# Code Quality Enforcement Guide

This guide documents the complete code quality enforcement system for Cockpit-NG. Use this as a reference when setting up new projects based on this template.

## Overview

The code quality system uses multiple layers of automated enforcement to prevent common bugs (especially infinite re-render loops in React) and maintain code standards:

- **ESLint** - Real-time error detection during development
- **TypeScript Strict Mode** - Compile-time type safety
- **Pre-commit Hooks** - Automatic validation before commits
- **Prettier** - Consistent code formatting
- **Custom Rules** - Project-specific validations

## Installation

### 1. Install Dependencies

```bash
cd frontend
npm install --save-dev eslint-plugin-react-hooks husky lint-staged
```

### 2. Initialize Husky

```bash
npx husky init
```

## Configuration Files

### 1. ESLint Configuration (`eslint.config.mjs`)

Create `/frontend/eslint.config.mjs`:

```javascript
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import noInlineDefaults from './eslint-rules/no-inline-defaults.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      'react-hooks': reactHooksPlugin,
      'custom-rules': {
        rules: {
          'no-inline-defaults': noInlineDefaults,
        },
      },
    },
    rules: {
      // Enforce exhaustive dependencies in useEffect, useMemo, useCallback
      'react-hooks/exhaustive-deps': 'error',
      
      // Warn about missing dependencies (should be error in production)
      'react-hooks/rules-of-hooks': 'error',

      // Custom rule: Prevent inline default parameters
      'custom-rules/no-inline-defaults': 'error',

      // TypeScript rules for better type safety
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],

      // React best practices
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'warn',
      
      // Prevent common bugs
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      '.turbo/**',
      'coverage/**',
    ],
  },
];

export default eslintConfig;
```

### 2. Custom ESLint Rule (`eslint-rules/no-inline-defaults.js`)

Create `/frontend/eslint-rules/no-inline-defaults.js`:

```javascript
/**
 * Custom ESLint rule: no-inline-defaults
 * 
 * Prevents inline object/array literals as default parameters in React components.
 * This prevents unnecessary re-renders caused by reference identity changes.
 * 
 * ❌ Bad:
 * function Component({ items = [] }) { ... }
 * function Component({ config = {} }) { ... }
 * 
 * ✅ Good:
 * const EMPTY_ARRAY = []
 * function Component({ items = EMPTY_ARRAY }) { ... }
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow inline object/array literals as default parameters',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noInlineArray: 'Avoid inline array literal as default parameter. Use a constant instead (e.g., const EMPTY_ARRAY = []).',
      noInlineObject: 'Avoid inline object literal as default parameter. Use a constant instead (e.g., const EMPTY_OBJECT = {}).',
    },
    schema: [],
  },

  create(context) {
    return {
      // Check function parameters
      'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(node) {
        checkParameters(node.params, context)
      },
      
      // Check destructured parameters
      AssignmentPattern(node) {
        if (node.right.type === 'ArrayExpression' && node.right.elements.length === 0) {
          context.report({
            node: node.right,
            messageId: 'noInlineArray',
          })
        } else if (node.right.type === 'ObjectExpression' && node.right.properties.length === 0) {
          context.report({
            node: node.right,
            messageId: 'noInlineObject',
          })
        }
      },
    }
  },
}

export default rule

function checkParameters(params, context) {
  params.forEach(param => {
    if (param.type === 'AssignmentPattern') {
      const defaultValue = param.right

      // Check for empty array literal: = []
      if (defaultValue.type === 'ArrayExpression' && defaultValue.elements.length === 0) {
        context.report({
          node: defaultValue,
          messageId: 'noInlineArray',
        })
      }

      // Check for empty object literal: = {}
      if (defaultValue.type === 'ObjectExpression' && defaultValue.properties.length === 0) {
        context.report({
          node: defaultValue,
          messageId: 'noInlineObject',
        })
      }
    }

    // Handle destructured parameters with defaults
    if (param.type === 'ObjectPattern') {
      param.properties.forEach(prop => {
        if (prop.type === 'Property' && prop.value.type === 'AssignmentPattern') {
          const defaultValue = prop.value.right
          
          if (defaultValue.type === 'ArrayExpression' && defaultValue.elements.length === 0) {
            context.report({
              node: defaultValue,
              messageId: 'noInlineArray',
            })
          }
          
          if (defaultValue.type === 'ObjectExpression' && defaultValue.properties.length === 0) {
            context.report({
              node: defaultValue,
              messageId: 'noInlineObject',
            })
          }
        }
      })
    }
  })
}
```

### 3. TypeScript Configuration (`tsconfig.json`)

Update `/frontend/tsconfig.json` to enable strict mode:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    },
    // Strict type-checking options
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noImplicitAny": true,
    "alwaysStrict": true,
    // Additional checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4. Lint-Staged Configuration (`.lintstagedrc.json`)

Create `/frontend/.lintstagedrc.json`:

```json
{
  "*.{ts,tsx,js,jsx}": [
    "eslint --fix --max-warnings 0",
    "prettier --write"
  ],
  "*.{json,css,md}": [
    "prettier --write"
  ]
}
```

### 5. Pre-commit Hook (`.husky/pre-commit`)

Create `/frontend/.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run lint-staged to lint and format staged files
npx lint-staged
```

Make it executable:
```bash
chmod +x .husky/pre-commit
```

### 6. Package.json Scripts

Add to `/frontend/package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "check": "npm run type-check && npm run lint && npm run format:check",
    "check:fix": "npm run type-check && npm run lint:fix && npm run format",
    "prepare": "husky"
  }
}
```

### 7. Pull Request Template (`.github/PULL_REQUEST_TEMPLATE.md`)

Create `/.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description
<!-- Provide a brief description of what this PR does -->

## Type of Change
<!-- Check all that apply -->
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test update

## Related Issues
<!-- Link to related issues -->
Fixes #(issue)

## Changes Made
<!-- List the key changes made in this PR -->
- 
- 
- 

## Testing
<!-- Describe the tests you ran to verify your changes -->
- [ ] Tested locally with `npm run dev`
- [ ] All existing tests pass (`npm run check`)
- [ ] Added new tests for new functionality
- [ ] Tested on multiple browsers/devices (if applicable)

## React Best Practices Checklist
<!-- Ensure your code follows our React conventions -->
- [ ] ✅ No inline default parameters (e.g., `items = []` or `config = {}`)
- [ ] ✅ Used constants for empty arrays/objects (e.g., `const EMPTY_ARRAY = []`)
- [ ] ✅ Custom hooks return memoized values (`useMemo`)
- [ ] ✅ useEffect dependencies are exhaustive and stable
- [ ] ✅ No functions/objects created inside render body used in deps
- [ ] ✅ Components properly split (Server/Client Components)
- [ ] ✅ Loading states and error boundaries where needed

## Code Quality Checklist
- [ ] ✅ Code follows TypeScript strict mode
- [ ] ✅ No ESLint errors or warnings
- [ ] ✅ Code is properly formatted (Prettier)
- [ ] ✅ No console.log statements (except console.warn/error)
- [ ] ✅ Type safety maintained (no `any` types)
- [ ] ✅ Proper error handling implemented
- [ ] ✅ Comments added for complex logic

## Backend Changes (if applicable)
- [ ] ✅ All endpoints have proper authentication
- [ ] ✅ Permission checks using `require_permission()` decorator
- [ ] ✅ Pydantic models for request/response validation
- [ ] ✅ Proper error handling with HTTPException
- [ ] ✅ Database operations in manager files
- [ ] ✅ Business logic in services layer

## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->

## Additional Notes
<!-- Any additional information that reviewers should know -->

---

**Pre-merge Verification:**
- [ ] All CI/CD checks pass
- [ ] Code reviewed by at least one team member
- [ ] No merge conflicts
- [ ] Branch is up-to-date with main
```

## React Best Practices

### Critical Rules (Prevents Infinite Loops)

#### 1. Default Parameters - Use Constants

**❌ WRONG:**
```typescript
function Component({ items = [], config = {} }) {
  // Creates new array/object every render
  // Causes infinite loops in child useEffect
}
```

**✅ CORRECT:**
```typescript
const EMPTY_ARRAY: string[] = []
const EMPTY_OBJECT = {}

function Component({ items = EMPTY_ARRAY, config = EMPTY_OBJECT }) {
  // Stable references prevent re-renders
}
```

#### 2. Custom Hooks - Memoize Returns

**❌ WRONG:**
```typescript
export function useMyHook() {
  const [state, setState] = useState()
  return { state, setState }  // New object each render!
}
```

**✅ CORRECT:**
```typescript
export function useMyHook() {
  const [state, setState] = useState()
  return useMemo(() => ({
    state,
    setState
  }), [state])  // Stable reference
}
```

#### 3. useEffect Dependencies - Must Be Stable

**❌ WRONG:**
```typescript
function Component() {
  const config = { key: 'value' }  // New object each render!
  
  useEffect(() => {
    doSomething(config)
  }, [config])  // Runs every render!
}
```

**✅ CORRECT:**
```typescript
// Option 1: Constant outside component
const DEFAULT_CONFIG = { key: 'value' }

function Component() {
  useEffect(() => {
    doSomething(DEFAULT_CONFIG)
  }, [])  // Runs once
}

// Option 2: Memoize dynamic values
function Component({ value }) {
  const config = useMemo(() => ({ key: value }), [value])
  
  useEffect(() => {
    doSomething(config)
  }, [config])  // Only runs when value changes
}
```

#### 4. Avoid Circular Dependencies

**❌ WRONG:**
```typescript
function Parent() {
  const [data, setData] = useState([])
  
  return <Child 
    initialData={data}
    onDataLoad={setData}  // Circular dependency
  />
}
```

**✅ CORRECT:**
```typescript
function Parent() {
  const [data, setData] = useState([])
  
  useEffect(() => {
    loadData().then(setData)  // Parent owns data loading
  }, [])
  
  return <Child data={data} />
}
```

#### 5. Exhaustive Dependencies

**❌ WRONG:**
```typescript
useEffect(() => {
  if (isReady) {
    loadData(userId)  // Uses isReady and userId
  }
}, [])  // Missing dependencies!
```

**✅ CORRECT:**
```typescript
useEffect(() => {
  if (isReady) {
    loadData(userId)
  }
}, [isReady, userId, loadData])  // All dependencies included
```

## Backend Best Practices

### FastAPI Code Standards

1. **Always use authentication:**
   ```python
   @router.get("/users")
   async def list_users(user: dict = Depends(require_permission("users", "read"))):
       pass
   ```

2. **Validate with Pydantic:**
   ```python
   class UserCreate(BaseModel):
       username: str
       email: EmailStr
   ```

3. **Business logic in services:**
   ```python
   # In routers/ - HTTP layer only
   @router.post("/users")
   async def create_user(user: UserCreate):
       return user_service.create(user)
   
   # In services/ - Business logic
   def create(user: UserCreate):
       # Validation, business rules, etc.
       return user_db_manager.insert(user)
   ```

4. **Error handling:**
   ```python
   try:
       result = operation()
   except ValueError as e:
       raise HTTPException(status_code=400, detail=str(e))
   except Exception as e:
       logger.error(f"Error: {e}")
       raise HTTPException(status_code=500, detail="Internal error")
   ```

## Usage

### Development Workflow

```bash
# 1. Write code
# ESLint catches errors in real-time in your editor

# 2. Check before commit
npm run check

# 3. Commit (pre-commit hook runs automatically)
git add .
git commit -m "feat: add new feature"
# → Husky runs lint-staged
# → ESLint --fix runs on staged files
# → Prettier formats code
# → Commit blocked if errors remain

# 4. Push
git push

# 5. Create PR using template
# Review checklist items before submitting
```

### Testing the System

```bash
# Test ESLint
npm run lint

# Test TypeScript
npm run type-check

# Test formatting
npm run format:check

# Run all checks
npm run check

# Auto-fix issues
npm run check:fix
```

### Common Commands

```bash
# Lint with auto-fix
npm run lint:fix

# Format all files
npm run format

# Type check
npm run type-check

# Complete check (recommended before commit)
npm run check

# Complete check with auto-fix
npm run check:fix
```

## CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/quality-check.yml`:

```yaml
name: Code Quality

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run ESLint
        run: cd frontend && npm run lint -- --max-warnings 0
      
      - name: Run TypeScript check
        run: cd frontend && npm run type-check
      
      - name: Check formatting
        run: cd frontend && npm run format:check
      
      - name: Build
        run: cd frontend && npm run build
```

## Troubleshooting

### Pre-commit Hook Not Running

```bash
# Reinitialize Husky
rm -rf .husky
npx husky init
chmod +x .husky/pre-commit

# Verify hook content
cat .husky/pre-commit
```

### ESLint Errors

```bash
# Show all errors
npm run lint

# Auto-fix what's possible
npm run lint:fix

# Check specific file
npx eslint src/path/to/file.tsx
```

### TypeScript Errors

```bash
# Run type check
npm run type-check

# Check specific file
npx tsc --noEmit src/path/to/file.tsx
```

### Prettier Formatting

```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format
```

## VSCode Integration

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Summary

This code quality system provides:

- ✅ **Real-time feedback** during development (ESLint in editor)
- ✅ **Automatic fixes** for common issues (Prettier, ESLint --fix)
- ✅ **Pre-commit validation** (Husky hooks)
- ✅ **Type safety** (TypeScript strict mode)
- ✅ **Custom rules** for project-specific patterns
- ✅ **PR guidelines** (Template with checklists)
- ✅ **CI/CD ready** (All checks scriptable)

The multi-layer approach ensures code quality without requiring manual vigilance, catching issues at the earliest possible point in the development cycle.
