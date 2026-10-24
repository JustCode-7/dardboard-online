import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';

/**
 * Critical multiplayer journey: create -> share link -> join -> host start -> throws -> turn switch,
 * spectator lock, server-computed scores, history and offline lock. Requires emulators + backend.
 */

async function newPlayer(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

async function enterName(page: Page, name: string): Promise<void> {
  await page.locator('#display-name').fill(name);
  await page.locator('#save-name-btn').click();
}

async function throwDart(page: Page, segment: number, multiplier: 1 | 2 | 3 = 1): Promise<void> {
  if (multiplier > 1) {
    await page.locator(`#multiplier-${multiplier} button`).click();
  }
  await page.locator(`#dart-btn-${segment}`).click();
}

function remainingOf(page: Page, name: string) {
  return page.locator('.pow-container li', { hasText: name }).locator('.remaining');
}

test('two players play a 501 lobby against the authoritative backend', async ({ browser }) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);

  // Alice creates a lobby.
  await alice.page.goto('/');
  await enterName(alice.page, 'Alice');
  await alice.page.locator('#create-x01-btn').click();
  await expect(alice.page).toHaveURL(/\/game\/[A-Za-z0-9_-]+$/);
  const lobbyId = (await alice.page.locator('#lobby-id-display').textContent())?.trim() ?? '';
  expect(lobbyId).toMatch(/^[A-Za-z0-9_-]+$/);

  // Start is locked with a single player.
  await expect(alice.page.locator('#start-game-btn')).toBeDisabled();

  // Bob opens the shared link, is asked for a name first, then joins.
  await bob.page.goto(`/game/${lobbyId}`);
  await expect(bob.page).toHaveURL(/returnUrl=/);
  await enterName(bob.page, 'Bob');
  await expect(bob.page).toHaveURL(new RegExp(`/game/${lobbyId}$`));
  await bob.page.locator('#join-lobby-btn').click();
  await expect(bob.page.getByText('Warte auf den Host')).toBeVisible();

  // Real-time: Alice sees Bob and starts the game.
  await expect(alice.page.locator('app-player-overview li', { hasText: 'Bob' })).toBeVisible();
  await alice.page.locator('#start-game-btn').click();

  // Turn lock: Alice may throw, Bob is a spectator.
  await expect(alice.page.locator('#dart-btn-20')).toBeEnabled();
  await expect(bob.page.locator('#dart-btn-20')).toBeDisabled();
  await expect(bob.page.getByText('Zuschauer-Modus: Alice ist am Zug.')).toBeVisible();

  // Alice throws 180; the third dart submits the turn automatically.
  await throwDart(alice.page, 20, 3);
  await throwDart(alice.page, 20, 3);
  await throwDart(alice.page, 20, 3);

  // Server-computed score reaches both players; the turn passes to Bob.
  await expect(remainingOf(bob.page, 'Alice')).toHaveText('321');
  await expect(remainingOf(alice.page, 'Alice')).toHaveText('321');
  await expect(bob.page.locator('#dart-btn-20')).toBeEnabled();
  await expect(alice.page.locator('#dart-btn-20')).toBeDisabled();

  // Bob throws 60 with singles.
  await throwDart(bob.page, 20);
  await throwDart(bob.page, 20);
  await throwDart(bob.page, 20);
  await expect(remainingOf(alice.page, 'Bob')).toHaveText('441');
  await expect(alice.page.locator('#dart-btn-20')).toBeEnabled();

  // Turn history comes from the read-only turns/ subcollection.
  await alice.page.locator('#history-btn').click();
  const rows = alice.page.locator('app-history-dialog tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Bob');
  await alice.page.keyboard.press('Escape');

  // Reconnection: offline locks the input, coming back online unlocks it again.
  await alice.context.setOffline(true);
  await expect(alice.page.locator('#offline-banner')).toBeVisible();
  await expect(alice.page.locator('#dart-btn-20')).toBeDisabled();
  await alice.context.setOffline(false);
  await expect(alice.page.locator('#offline-banner')).toBeHidden();
  await expect(alice.page.locator('#dart-btn-20')).toBeEnabled();

  await alice.context.close();
  await bob.context.close();
});

test('a bust keeps the score and a double-out checkout finishes the game for everyone', async ({ browser }) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);

  await alice.page.goto('/');
  await enterName(alice.page, 'Alice');
  await alice.page.locator('#create-x01-btn').click();
  await expect(alice.page).toHaveURL(/\/game\//);
  const lobbyId = (await alice.page.locator('#lobby-id-display').textContent())?.trim() ?? '';

  await bob.page.goto('/');
  await enterName(bob.page, 'Bob');
  await bob.page.locator('#lobby-id').fill(lobbyId);
  await bob.page.locator('#join-btn').click();
  await expect(bob.page).toHaveURL(new RegExp(`/game/${lobbyId}$`));
  await expect(alice.page.locator('app-player-overview li', { hasText: 'Bob' })).toBeVisible();
  await alice.page.locator('#start-game-btn').click();

  const bobMisses = async (): Promise<void> => {
    await expect(bob.page.locator('#miss-btn')).toBeEnabled();
    for (let i = 0; i < 3; i++) {
      await bob.page.locator('#miss-btn').click();
    }
    await expect(alice.page.locator('#dart-btn-20')).toBeEnabled();
  };

  // 501 -> 321 -> 141
  for (let turn = 0; turn < 2; turn++) {
    for (let i = 0; i < 3; i++) {
      await throwDart(alice.page, 20, 3);
    }
    await bobMisses();
  }
  await expect(remainingOf(bob.page, 'Alice')).toHaveText('141');

  // Bust: 141 - 180 < 0 -> the first T20 + T20 + T20 overshoots on the third dart, score stays 141.
  await throwDart(alice.page, 20, 3);
  await throwDart(alice.page, 20, 3);
  await throwDart(alice.page, 20, 3);
  await expect(bob.page.locator('#miss-btn')).toBeEnabled();
  await expect(remainingOf(bob.page, 'Alice')).toHaveText('141');
  await expect(bob.page.locator('app-turn-status')).toContainText('Bust');
  await bobMisses();

  // Checkout: T20 (60) + T19 (57) + D12 (24) = 141.
  await throwDart(alice.page, 20, 3);
  await throwDart(alice.page, 19, 3);
  await throwDart(alice.page, 12, 2);

  await expect(alice.page.locator('#winner-text')).toHaveText('Du hast gewonnen!');
  await expect(bob.page.locator('#winner-text')).toHaveText('Alice gewinnt!');

  await alice.context.close();
  await bob.context.close();
});
