const nativeControls = new Set(['button', 'input', 'select', 'textarea'])
const sizedControls = new Set([
  'Button',
  'Input',
  'SelectTrigger',
  'Textarea',
  'TabsTrigger',
  'Checkbox',
  'Switch',
])
const geometry =
  /^(?:!?)(?:(?:h|min-h|max-h|size|p|py|pt|pb|rounded|leading)(?:-|$)|text-(?:xs|sm|base|lg|xl|[2-9]xl|\[)|\[(?:height|min-height|max-height|padding|font-size|line-height|border-radius):)/
const geometryProperties = new Set([
  'height',
  'minHeight',
  'maxHeight',
  'blockSize',
  'minBlockSize',
  'maxBlockSize',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingBlock',
  'paddingBlockStart',
  'paddingBlockEnd',
  'fontSize',
  'lineHeight',
  'borderRadius',
  '--control-sm',
  '--control-md',
  '--control-lg',
])

// Check finite class expressions, including responsive variants and cn/clsx calls.
// Unknown variables cannot prove the sizing contract and belong in a UI variant.
function classStrings(node) {
  if (!node) return []
  switch (node.type) {
    case 'JSXExpressionContainer':
      return classStrings(node.expression)
    case 'Literal':
      return typeof node.value === 'string' ? [node.value] : []
    case 'TemplateLiteral':
      return [
        ...node.quasis.map((part) => part.value.raw),
        ...node.expressions.flatMap(classStrings),
      ]
    case 'ConditionalExpression':
      return [...classStrings(node.consequent), ...classStrings(node.alternate)]
    case 'LogicalExpression':
      return node.operator === '&&'
        ? classStrings(node.right)
        : [...classStrings(node.left), ...classStrings(node.right)]
    case 'ArrayExpression':
      return node.elements.flatMap(classStrings)
    case 'CallExpression':
      if (node.callee.type === 'Identifier' && ['cn', 'clsx'].includes(node.callee.name))
        return node.arguments.flatMap(classStrings)
      break
    case 'ObjectExpression':
      return node.properties.flatMap((property) => {
        if (property.type !== 'Property' || property.computed) return [null]
        return [property.key.type === 'Identifier' ? property.key.name : property.key.value]
      })
  }
  return [null]
}

export default {
  rules: {
    'no-native-controls': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          native:
            'Use the shared UI component instead of <{{tag}}>. Add missing primitives in src/components/ui/ first.',
        },
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.type === 'JSXIdentifier' && nativeControls.has(node.name.name))
              context.report({ node, messageId: 'native', data: { tag: node.name.name } })
          },
        }
      },
    },
    'control-geometry': {
      meta: {
        type: 'problem',
        schema: [],
        messages: {
          geometry:
            'Use the shared size/variant API. Control height, vertical padding, font size and radius belong in src/components/ui/; keep page overrides to layout and width.',
        },
      },
      create(context) {
        const controls = new Set()
        return {
          ImportDeclaration(node) {
            if (
              !/\/ui\/(?:button|input|select|textarea|tabs|checkbox|switch)(?:\.tsx?)?$/.test(
                node.source.value,
              )
            )
              return
            for (const specifier of node.specifiers)
              if (
                specifier.type === 'ImportSpecifier' &&
                sizedControls.has(specifier.imported.name)
              )
                controls.add(specifier.local.name)
          },
          JSXOpeningElement(node) {
            if (node.name.type !== 'JSXIdentifier' || !controls.has(node.name.name)) return
            for (const attribute of node.attributes) {
              if (attribute.type !== 'JSXAttribute') continue
              if (attribute.name.name === 'className') {
                const values = classStrings(attribute.value)
                if (
                  values.some(
                    (value) =>
                      value === null ||
                      String(value)
                        .split(/\s+/)
                        .some((token) => {
                          // Child icon geometry is independent of the control's own box.
                          if (/\[&[^\]]*svg/.test(token)) return false
                          return geometry.test(token.split(/:(?![^\[]*\])/).at(-1))
                        }),
                  )
                )
                  context.report({ node: attribute, messageId: 'geometry' })
              }
              if (attribute.name.name === 'style') {
                const value = attribute.value?.expression
                if (
                  !value ||
                  value.type !== 'ObjectExpression' ||
                  value.properties.some(
                    (property) =>
                      property.type !== 'Property' ||
                      property.computed ||
                      geometryProperties.has(
                        property.key.type === 'Identifier' ? property.key.name : property.key.value,
                      ),
                  )
                )
                  context.report({ node: attribute, messageId: 'geometry' })
              }
            }
          },
        }
      },
    },
  },
}
