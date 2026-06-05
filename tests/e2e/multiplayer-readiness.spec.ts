import { expect, test } from "@playwright/test";

test("20 parallel clients can reach and prepare join page", async ({ browser }) => {
  const clients = 20;
  const contexts = await Promise.all(
    Array.from({ length: clients }, () =>
      browser.newContext({ viewport: { width: 390, height: 844 } })
    )
  );

  try {
    await Promise.all(
      contexts.map(async (context, index) => {
        const page = await context.newPage();
        await page.goto("/#/join");

        await page.getByPlaceholder("ABCD12").fill("AB12CD");
        await page.getByPlaceholder("Enter your name").fill(`Player ${index + 1}`);

        await expect(page.getByRole("button", { name: "Join Game" })).toBeEnabled();
      })
    );
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
