import { expect, test } from "@playwright/test";

test.describe("TaskBee task flow", () => {
  test("điều hướng từ trang chủ đến marketplace và trang đăng nhập", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /TaskBee/i }).first()).toBeVisible();

    await page.getByRole("link", { name: /Tìm việc|Việc làm nhỏ|Xem việc/i }).first().click();
    await expect(page).toHaveURL(/marketplace|viec-lam/);
    await expect(page.getByText(/việc|task|lọc/i).first()).toBeVisible();

    await page.goto("/login");
    await expect(page.getByRole("textbox", { name: /email/i }).or(page.locator('input[type="email"]'))).toBeVisible();
  });
});
