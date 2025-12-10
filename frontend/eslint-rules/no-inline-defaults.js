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
