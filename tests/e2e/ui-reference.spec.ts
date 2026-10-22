import { test, expect } from './fixtures'

test('local component reference preserves size, disabled, dialog, theme and mobile contracts', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/zh/dev/ui')
  await expect(page.getByRole('heading', { name: '组件样板', exact: true })).toBeVisible()
  for (const [size, height] of [
    ['sm', 32],
    ['default', 36],
    ['lg', 44],
  ] as const) {
    const controls = page
      .locator(`[data-ui-row="${size}"]`)
      .locator('[data-slot="input"], [data-slot="select-trigger"], [data-slot="button"]')
    await expect(controls).toHaveCount(3)
    expect(
      await controls.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().height),
      ),
    ).toEqual([height, height, height])
    const bottoms = await controls.evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().bottom),
    )
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1)
  }
  await expect(page.getByLabel('禁用输入框', { exact: true })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: '禁用下拉框', exact: true })).toBeDisabled()
  await expect(page.getByLabel('输入错误状态')).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: '切换禁用状态', exact: true }).click()
  await expect(page.getByRole('button', { name: '主要操作', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '打开弹窗', exact: true }).nth(1).click()
  const dialog = page.getByRole('dialog', { name: '表单交互示例' })
  await dialog.getByLabel('项目名称', { exact: true }).fill('Local demo')
  await dialog.getByRole('combobox', { name: '当前状态', exact: true }).click()
  await page.getByRole('option', { name: '开发中', exact: true }).click()
  await dialog.getByRole('button', { name: '提交演示', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('演示已提交，没有创建项目或写入服务端。')
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('打开上方弹窗，体验完整表单。')
  await page.getByRole('button', { name: '切换明暗主题', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/ui$/)
  await expect(
    page.getByRole('heading', { name: 'Component reference', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
