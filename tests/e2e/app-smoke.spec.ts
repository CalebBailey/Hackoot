import { expect, test } from "@playwright/test";

test("home page renders primary actions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Create and host interactive quizzes")).toBeVisible();
  await expect(page.getByRole("button", { name: "New Quiz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join Game" })).toBeVisible();
});

test("join route accepts valid room code and name", async ({ page }) => {
  await page.goto("/#/join");

  await page.getByPlaceholder("ABCD12").fill("ab12cd");
  await page.getByPlaceholder("Enter your name").fill("Player One");

  await expect(page.getByRole("button", { name: "Join Game" })).toBeEnabled();
});
