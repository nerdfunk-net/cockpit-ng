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
