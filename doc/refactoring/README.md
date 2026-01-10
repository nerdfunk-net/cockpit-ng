# Cockpit-NG Refactoring Plans

This directory contains technical plans for major refactoring initiatives.

## 📋 Available Plans

### 1. Testing Infrastructure ✅ **IMPLEMENTED**
**File:** `ADD_TESTING_INFASTRUCTURE.md`

**Status:** ✅ Complete and implemented

**Summary:** Vitest + React Testing Library setup for the Next.js 15 frontend

**What was done:**
- Installed Vitest, React Testing Library, coverage tools
- Created test utilities with auth state support
- Wrote example tests (hooks, components)
- All 28 tests passing with 65%+ coverage

**Next steps:** Write tests before refactoring (follow "No Refactor Without Regression Tests" rule)

---

### 2. TanStack Query Migration 🚀 **READY TO IMPLEMENT**
**Files:**
- `ADD_TANSTACK_QUERY_FINAL.md` - **USE THIS ONE** (production-ready)
- `ADD_TANSTACK_QUERY_CHANGES.md` - Summary of fixes vs original
- `ADD_TANSTACK_QUERY.md` - Original (reference only)

**Status:** 🚀 PR-ready, awaiting approval to start

**Summary:** Replace manual data fetching with TanStack Query (React Query)

**Benefits:**
- Eliminate race conditions from `useEffect` data fetching
- Intelligent caching (fewer API calls, faster UX)
- Automatic job polling (no more `setInterval`)
- Optimistic updates for bulk operations
- Request deduplication across components

**Estimated effort:** 7-10 days full migration (2 days for quick wins)

**How to proceed:**
1. Review `ADD_TANSTACK_QUERY_FINAL.md` as a team
2. Start Phase 1 (Foundation setup - 1 day)
3. Phase 2 (Job polling - 1 day) - immediate value
4. Continue incrementally with code reviews between phases

---

## 🔍 Which File to Use?

### For Testing Infrastructure:
- ✅ Already implemented, no action needed
- Reference: `ADD_TESTING_INFASTRUCTURE.md`

### For TanStack Query Migration:
- 📖 **Read this:** `ADD_TANSTACK_QUERY_FINAL.md` (comprehensive, production-ready)
- 📊 **Changes summary:** `ADD_TANSTACK_QUERY_CHANGES.md` (what was fixed)
- 🗂️ **Original:** `ADD_TANSTACK_QUERY.md` (reference only, has known issues)

---

## 🚀 Quick Start: TanStack Query Migration

If you're ready to start implementing TanStack Query:

1. **Read the final plan:**
   ```bash
   cat doc/refactoring/ADD_TANSTACK_QUERY_FINAL.md
   ```

2. **Understand what was fixed:**
   ```bash
   cat doc/refactoring/ADD_TANSTACK_QUERY_CHANGES.md
   ```

3. **Start Phase 1 (Foundation):**
   ```bash
   cd frontend
   npm install @tanstack/react-query @tanstack/react-query-devtools
   # Then follow Section 2 of the final plan
   ```

4. **Verify setup:**
   ```bash
   npm run build
   npm run dev
   # Open http://localhost:3000
   # Check for DevTools in bottom-right corner
   ```

---

## 📝 Other Refactoring Documents

### Code Review Guidelines
**File:** `CODE_REVIEW_ANTIGRAVITY.md`

Best practices and patterns for code reviews in Cockpit-NG.

---

## 🤝 Contributing New Refactoring Plans

When adding new refactoring plans to this directory:

1. **Use descriptive filename:** `ADD_[FEATURE]_[TECHNOLOGY].md`
2. **Include these sections:**
   - Goal / Objective
   - Technology choice & rationale
   - Implementation steps (phases)
   - Success criteria per phase
   - Testing strategy
   - Migration roadmap with estimates
   - Troubleshooting guide

3. **Get review before starting:** Share plan with team, iterate on feedback
4. **Mark status:** Use emoji in this README (🚀 Ready, ⏳ In Progress, ✅ Done)
5. **Create CHANGES.md:** If plan evolves significantly, create a changes summary

---

## 📞 Questions?

- **Testing Infrastructure:** Check existing tests in `frontend/src/**/*.test.{ts,tsx}`
- **TanStack Query:** Read Section 13 (Troubleshooting) in final plan
- **General:** Ask in team chat or create GitHub Discussion

---

## 📅 Timeline

| Plan | Status | Started | Completed |
|------|--------|---------|-----------|
| Testing Infrastructure | ✅ Done | - | 2026-01-10 |
| TanStack Query | 🚀 Ready | - | - |

**Legend:**
- 🚀 Ready to implement
- ⏳ In progress
- ✅ Completed
- ❌ Blocked/Paused
