import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import ui from '../../scripts/eslint-ui.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only
const tester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
})
tester.run('no-native-controls', ui.rules['no-native-controls'], {
  valid: ['<Input />', '<SelectTrigger />', '<div><Label /></div>'],
  invalid: ['<select />', '<textarea />', '<button />', '<input type="text" />'].map((code) => ({
    code,
    errors: [{ messageId: 'native' }],
  })),
})
const from = 'import { Button as Action } from "@/components/ui/button";'
tester.run('control-geometry', ui.rules['control-geometry'], {
  valid: [
    `${from}<Action size="lg" className="w-full mt-4" />`,
    `${from}<Action className={cn("w-full", compact && "max-w-xs")} />`,
    `${from}<Action className="text-primary [&_svg]:size-4" />`,
    `${from}<Action style={{ width: "100%" }} />`,
  ],
  invalid: [
    '<Action className="h-12" />',
    '<Action className={cn("w-full", compact && "sm:py-4")} />',
    '<Action className={`w-full ${compact ? "rounded-none" : "text-lg"}`} />',
    '<Action className="[height:50px]" />',
    '<Action className={unknownClasses} />',
    '<Action style={{ height: 50 }} />',
    '<Action style={unknownStyles} />',
  ].map((code) => ({ code: from + code, errors: [{ messageId: 'geometry' }] })),
})
