'use strict';

// Board, backlog and sprint step definitions: the columns and cards of a
// board, moving a card to another column, the backlog of a Scrum board,
// creating, filling, starting, completing and deleting a sprint.
//
// A step that names a card or a backlog issue takes its key ("KAN-3") or its
// exact summary.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  exactly,
  tidy,
  siteUrl,
  actOrExplain,
  assertPresence,
  waitForValue,
  clearObstacles,
  safeClick,
  waitForDialog,
  submitDialog,
  openBoard,
  boardIdOfProject,
  boardColumns,
  boardColumn,
  boardCard,
  backlogIssue,
  sprintContainer,
  boardSprints,
} = require('./jira-helpers');

/**
 * Fail unless a board is showing.
 *
 * @param {object} world
 */
async function requireBoard(world) {
  try {
    await world.page.locator('#ghx-column-headers .ghx-column').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    const none = await world.page.locator('.ghx-no-active-sprint-message').first().isVisible().catch(() => false);
    throw friendly({ message: none ? 'The board shows no cards: there are no active sprints.' : `No board is showing (${world.page.url()}).`, hint: none ? 'Start a sprint from the backlog first.' : 'Open one first: Given I am on the board of the "KEY" project.' });
  }
}

/**
 * Fail unless a backlog is showing.
 *
 * @param {object} world
 */
async function requireBacklog(world) {
  try {
    await world.page.locator('.ghx-backlog-container').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `No backlog is showing (${world.page.url()}).`, hint: 'Open one first: Given I am on the backlog of the "KEY" project.' });
  }
}

/**
 * The id of the column a card is in, or null when the card is not on the
 * board.
 *
 * @param {object} world
 * @param {string} nameOrKey
 * @returns {Promise<string|null>}
 */
async function columnIdOfCard(world, nameOrKey) {
  const card = boardCard(world, nameOrKey).first();
  if (!(await card.count())) return null;
  return card.evaluate((element) => {
    const column = element.closest('.ghx-column');
    return column ? column.getAttribute('data-column-id') : null;
  });
}

// ---------------------------------------------------------------------------
// Opening a board
// ---------------------------------------------------------------------------

/**
 * Open the board of a project, by the key of the project: the Kanban board,
 * or the active sprints of a Scrum board.
 *
 * Example #1: Given I am on the board of the "KAN" project
 * Example #2: Given I am on the board of the "SCRUM" project
 * Example #3: When I go to the board of the "KAN" project
 * Example #4: Given we are on the board of the "SCRUM" project
 * Example #5: When we go to the board of the "KAN" project
 *
 */
Given(/^(I am on|we are on|I go to|we go to) the board of the "([^"]*)" project$/, async function (pronounCase, key) {
  await openBoard(this, key, 'work');
});

/**
 * Open the backlog of the board of a project, by the key of the project.
 *
 * Example #1: Given I am on the backlog of the "SCRUM" project
 * Example #2: When I go to the backlog of the "SCRUM" project
 * Example #3: Given we are on the backlog of the "SCRUM" project
 * Example #4: And I am on the backlog of the "SCRUM" project
 * Example #5: When we go to the backlog of the "SCRUM" project
 *
 */
Given(/^(I am on|we are on|I go to|we go to) the backlog of the "([^"]*)" project$/, async function (pronounCase, key) {
  await openBoard(this, key, 'planning');
});

// ---------------------------------------------------------------------------
// Columns and cards
// ---------------------------------------------------------------------------

/**
 * Assert the board has (or has not) a column with the given name.
 *
 * Example #1: Then the board should have the "In Progress" column
 * Example #2: Then the board should have the "Selected for Development" column
 * Example #3: Then the board should not have the "Review" column
 * Example #4: And the board should have the "Done" column
 * Example #5: And the board should not have the "Backlog" column
 *
 */
Then(/^the board should( not)* have the "([^"]*)" column$/, async function (notCase, name) {
  await requireBoard(this);
  const columns = await boardColumns(this);
  const has = columns.some((column) => exactly(name).test(column.name));
  if (has === Boolean(notCase)) {
    throw friendly({ message: notCase ? `Expected the board not to have a "${name}" column, but it does.` : `Expected the board to have a "${name}" column. Its columns: ${columns.map((column) => column.name).join(', ')}.`, hint: 'The columns are the headers of the board.' });
  }
});

/**
 * Assert the columns of the board, in order, as a comma separated list.
 *
 * Example #1: Then the board columns should be "Backlog, Selected for Development, In Progress, Done"
 * Example #2: Then the board columns should be "To Do, In Progress, Done"
 * Example #3: And the board columns should be "To Do, In Progress, Done"
 * Example #4: And the board columns should be "Backlog, Selected for Development, In Progress, Done"
 * Example #5: Then the board columns should be "To Do, Done"
 *
 */
Then(/^the board columns should be "([^"]*)"$/, async function (list) {
  await requireBoard(this);
  const wanted = list.split(',').map((name) => tidy(name).toLowerCase());
  const columns = (await boardColumns(this)).map((column) => column.name);
  if (columns.map((name) => name.toLowerCase()).join('|') !== wanted.join('|')) {
    throw friendly({ message: `Expected the board columns "${list}", but the board has "${columns.join(', ')}".`, hint: 'The names are compared in order, ignoring case.' });
  }
});

/**
 * Assert the board shows (or does not show) the card of an issue, by key or
 * by exact summary.
 *
 * Example #1: Then I should see the card "KAN-1" on the board
 * Example #2: Then I should see the card "Review the style guide" on the board
 * Example #3: Then I should not see the card "SCRUM-1" on the board
 * Example #4: And we should see the card "Broken link in the footer" on the board
 * Example #5: And I should not see the card "Tidy the board" on the board
 *
 */
Then(/^(I |we )*should( not)* see the card "([^"]*)" on the board$/, async function (pronounCase, notCase, nameOrKey) {
  if (!notCase) await requireBoard(this);
  await assertPresence(boardCard(this, nameOrKey), notCase, {
    label: `the card "${nameOrKey}" on the board`,
    hint: 'A board shows the issues of its filter; a Scrum board shows the issues of the active sprint only, a Kanban board hides done issues after a while.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Assert the card of an issue is (or is not) in the column with the given
 * name.
 *
 * Example #1: Then the card "KAN-1" should be in the "Backlog" column
 * Example #2: Then the card "Review the style guide" should be in the "Selected for Development" column
 * Example #3: Then the card "KAN-2" should not be in the "Done" column
 * Example #4: And the card "Tidy the board" should be in the "In Progress" column
 * Example #5: And the card "SCRUM-3" should be in the "To Do" column
 *
 */
Then(/^the card "([^"]*)" should( not)* be in the "([^"]*)" column$/, async function (nameOrKey, notCase, columnName) {
  await requireBoard(this);
  const column = await boardColumn(this, columnName);
  await assertPresence(boardCard(this, nameOrKey), null, { label: `the card "${nameOrKey}" on the board`, hint: 'The card is not on this board: check the issue belongs to the board (and, on a Scrum board, to the active sprint).', timeout: budget(this) });
  const result = await waitForValue(() => columnIdOfCard(this, nameOrKey), (id) => (id === column.id) !== Boolean(notCase), budget(this));
  if (!result.ok) {
    const columns = await boardColumns(this);
    const now = columns.find((entry) => entry.id === result.value);
    throw friendly({ message: notCase ? `Expected the card "${nameOrKey}" not to be in the "${column.name}" column, but it is.` : `Expected the card "${nameOrKey}" to be in the "${column.name}" column, but it is in "${now ? now.name : '(no column)'}".`, hint: 'A card moves when its issue changes status: the column shows the statuses mapped to it.' });
  }
});

/**
 * Move the card of an issue to another column by dragging it with the mouse,
 * as a person does: press on the card, move to the column, release. The issue
 * goes through the transition to the status of that column; the step waits
 * for the card to be in the column.
 *
 * Example #1: When I move the card "KAN-1" to the "Selected for Development" column
 * Example #2: When I move the card "Review the style guide" to the "In Progress" column
 * Example #3: When we move the card "KAN-2" to the "Done" column
 * Example #4: And I move the card "Tidy the board" to the "Backlog" column
 * Example #5: And we move the card "SCRUM-3" to the "In Progress" column
 *
 */
When(/^(I |we )*move the card "([^"]*)" to the "([^"]*)" column$/, async function (pronounCase, nameOrKey, columnName) {
  await requireBoard(this);
  const page = this.page;
  const column = await boardColumn(this, columnName);
  const card = boardCard(this, nameOrKey).first();
  await assertPresence(card, null, { label: `the card "${nameOrKey}" on the board`, hint: 'The card is not on this board.', timeout: budget(this) });
  if ((await columnIdOfCard(this, nameOrKey)) === column.id) return;
  await clearObstacles(this);
  const target = page.locator(`#ghx-pool .ghx-column[data-column-id="${column.id}"]`).first();
  await actOrExplain('drag the card', nameOrKey, async () => {
    await card.scrollIntoViewIfNeeded();
    const from = await card.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error('the card or the column has no box on the page');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    // The board starts a drag after the pointer has moved a little.
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 6 });
    await page.mouse.move(to.x + to.width / 2, to.y + Math.min(60, to.height / 2), { steps: 20 });
    // The column reports itself as a drop target a moment after the pointer arrives.
    await page.locator('.ghx-zone-overlay-column, .ghx-drag-in-progress, .ui-sortable-helper').first().waitFor({ state: 'attached', timeout: 2000 }).catch(() => {});
    await page.mouse.move(to.x + to.width / 2, to.y + Math.min(70, to.height / 2 + 5), { steps: 4 });
    await page.mouse.up();
  }, 'The card could not be dragged.');
  // A transition with a screen opens a dialog: submit it as it is.
  const withScreen = await page.locator('section[role="dialog"][open]').last().waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
  if (withScreen) await submitDialog(this);
  const result = await waitForValue(() => columnIdOfCard(this, nameOrKey), (id) => id === column.id, budget(this));
  if (!result.ok) {
    const columns = await boardColumns(this);
    const now = columns.find((entry) => entry.id === result.value);
    throw friendly({ message: `The card "${nameOrKey}" was dragged to "${column.name}" but it is in "${now ? now.name : '(no column)'}".`, hint: 'The workflow may have no transition from the status of the card to a status of that column, or the account may not transition issues.' });
  }
  await smartSettle(page, 2000);
});

/**
 * Assert the board says it has no active sprint ("There are no active
 * sprints"), as a Scrum board does between sprints.
 *
 * Example #1: Then the board should have no active sprint
 * Example #2: And the board should have no active sprint
 * Example #3: Then the board should have no active sprints
 * Example #4: And the board should have no active sprints
 * Example #5: But the board should have no active sprint
 *
 */
Then(/^the board should have no active sprints?$/, async function () {
  await assertPresence(this.page.locator('.ghx-no-active-sprint-message'), null, {
    label: 'the "There are no active sprints" message',
    hint: 'Open the board of a Scrum project first; with an active sprint the board shows its cards instead.',
    timeout: budget(this),
  });
});

/**
 * Assert the sprint the board is showing is (or is not) the one with the
 * given name: the heading of an active sprints board names the sprint.
 *
 * Example #1: Then the board should show the sprint "Suite Sprint"
 * Example #2: Then the board should show the sprint "Sprint 1"
 * Example #3: And the board should show the sprint "Suite Sprint"
 * Example #4: Then the board should not show the sprint "Sprint 2"
 * Example #5: And the board should not show the sprint "Old Sprint"
 *
 */
Then(/^the board should( not)* show the sprint "([^"]*)"$/, async function (notCase, name) {
  const result = await waitForValue(async () => tidy(await this.page.locator('#ghx-header').first().innerText({ timeout: 2000 })), (text) => text.includes(name) !== Boolean(notCase), notCase ? 3000 : budget(this));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the board not to show the sprint "${name}", but it does.` : `Expected the board to show the sprint "${name}", but its header says "${result.value || '(no board header)'}".`, hint: 'The active sprints board of a Scrum project names its sprint in the header.' });
  }
});

// ---------------------------------------------------------------------------
// Backlog and sprints
// ---------------------------------------------------------------------------

/**
 * Create a sprint in the backlog on the page: press "Create sprint", type the
 * name, press "Create" and wait for the sprint to show above the backlog.
 *
 * Example #1: When I create the sprint "Suite Sprint"
 * Example #2: When I create the sprint "Sprint 7"
 * Example #3: When we create the sprint "Release sprint"
 * Example #4: And I create the sprint "Hardening"
 * Example #5: And we create the sprint "Suite Sprint"
 *
 */
When(/^(I |we )*create the sprint "([^"]*)"$/, async function (pronounCase, name) {
  await requireBacklog(this);
  const page = this.page;
  const button = page.locator('.js-add-sprint').first();
  if (!(await button.isVisible().catch(() => false))) {
    throw friendly({ message: 'The backlog has no "Create sprint" button for this account.', hint: 'Creating a sprint needs the Manage Sprints permission of the project, on a Scrum board.' });
  }
  await safeClick(this, button);
  await waitForDialog(this, 'Create sprint');
  await page.locator('#ghx-dialog-add-sprint #ghx-sprint-name').fill(name);
  await submitDialog(this);
  await assertPresence(sprintContainer(this, name), null, { label: `the sprint "${name}" in the backlog`, hint: 'The sprint was submitted but does not show; check the messages on the page.', timeout: budget(this) });
});

/**
 * Assert the backlog shows (or does not show) a sprint with the given name.
 *
 * Example #1: Then I should see the sprint "Suite Sprint" in the backlog
 * Example #2: Then I should not see the sprint "Suite Sprint" in the backlog
 * Example #3: Then we should see the sprint "Sprint 7" in the backlog
 * Example #4: And I should see the sprint "Hardening" in the backlog
 * Example #5: And we should not see the sprint "Release sprint" in the backlog
 *
 */
Then(/^(I |we )*should( not)* see the sprint "([^"]*)" in the backlog$/, async function (pronounCase, notCase, name) {
  await requireBacklog(this);
  await assertPresence(sprintContainer(this, name), notCase, {
    label: `the sprint "${name}" in the backlog`,
    hint: 'The backlog lists the sprints that are planned or active; a completed sprint is not there.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Assert the sprint with the given name is (or is not) the active one in the
 * backlog.
 *
 * Example #1: Then the sprint "Suite Sprint" should be active
 * Example #2: Then the sprint "Suite Sprint" should not be active
 * Example #3: And the sprint "Sprint 7" should be active
 * Example #4: And the sprint "Hardening" should not be active
 * Example #5: Then the sprint "Release sprint" should be active
 *
 */
Then(/^the sprint "([^"]*)" should( not)* be active$/, async function (name, notCase) {
  await requireBacklog(this);
  const sprint = sprintContainer(this, name).first();
  await assertPresence(sprint, null, { label: `the sprint "${name}" in the backlog`, hint: 'Open the backlog of the board that has the sprint.', timeout: budget(this) });
  const result = await waitForValue(async () => /ghx-sprint-active/.test((await sprint.getAttribute('class', { timeout: 1500 })) || ''), (active) => active !== Boolean(notCase), budget(this));
  if (!result.ok) {
    throw friendly({ message: `Expected the sprint "${name}" ${notCase ? 'not ' : ''}to be active, but it is ${result.value ? 'active' : 'planned (not started)'}.`, hint: 'A sprint is active between "Start sprint" and "Complete sprint".' });
  }
});

/**
 * Send an issue of the backlog to a sprint, through the context menu of the
 * issue (right-click → the sprint), and wait for it to be in the sprint.
 *
 * Example #1: When I add the issue "SCRUM-3" to the sprint "Suite Sprint"
 * Example #2: When I add the issue "Write the release notes" to the sprint "Suite Sprint"
 * Example #3: When we add the issue "SCRUM-1" to the sprint "Sprint 7"
 * Example #4: And I add the issue "Export the report" to the sprint "Hardening"
 * Example #5: And we add the issue "SCRUM-2" to the sprint "Release sprint"
 *
 */
When(/^(I |we )*add the issue "([^"]*)" to the sprint "([^"]*)"$/, async function (pronounCase, nameOrKey, sprintName) {
  await requireBacklog(this);
  const page = this.page;
  const issue = backlogIssue(this, nameOrKey).first();
  await assertPresence(issue, null, { label: `the issue "${nameOrKey}" in the backlog`, hint: 'The backlog lists the open issues of the board; a new issue shows after the page is opened again.', timeout: budget(this) });
  const sprint = sprintContainer(this, sprintName).first();
  await assertPresence(sprint, null, { label: `the sprint "${sprintName}" in the backlog`, hint: 'Create the sprint first: When I create the sprint "...".', timeout: budget(this) });
  await clearObstacles(this);
  await actOrExplain('send the issue to the sprint', `${nameOrKey} → ${sprintName}`, async () => {
    await issue.scrollIntoViewIfNeeded();
    await issue.locator('.ghx-summary, .ghx-row').first().click({ button: 'right' });
    const item = page.locator('#gh-ctx-menu-content a').filter({ hasText: exactly(sprintName) }).first();
    await item.waitFor({ state: 'visible', timeout: budget(this) });
    await item.click();
  }, 'The context menu of a backlog issue (right-click) lists the sprints under "Send to".');
  await assertPresence(sprint.locator('.js-issue').and(backlogIssue(this, nameOrKey)), null, {
    label: `the issue "${nameOrKey}" in the sprint "${sprintName}"`,
    hint: 'The issue was sent but does not show in the sprint; check the messages on the page.',
    timeout: budget(this),
  });
});

/**
 * Assert an issue is (or is not) in the sprint with the given name, in the
 * backlog on the page.
 *
 * Example #1: Then the issue "SCRUM-3" should be in the sprint "Suite Sprint"
 * Example #2: Then the issue "Write the release notes" should be in the sprint "Suite Sprint"
 * Example #3: Then the issue "SCRUM-1" should not be in the sprint "Suite Sprint"
 * Example #4: And the issue "Export the report" should be in the sprint "Hardening"
 * Example #5: And the issue "SCRUM-2" should not be in the sprint "Sprint 7"
 *
 */
Then(/^the issue "([^"]*)" should( not)* be in the sprint "([^"]*)"$/, async function (nameOrKey, notCase, sprintName) {
  await requireBacklog(this);
  const sprint = sprintContainer(this, sprintName).first();
  await assertPresence(sprint, null, { label: `the sprint "${sprintName}" in the backlog`, hint: 'Open the backlog of the board that has the sprint.', timeout: budget(this) });
  await assertPresence(sprint.locator('.js-issue').and(backlogIssue(this, nameOrKey)), notCase, {
    label: `the issue "${nameOrKey}" in the sprint "${sprintName}"`,
    hint: 'The issues of a sprint are listed under its name in the backlog.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Assert an issue is (or is not) in the backlog itself, below the sprints.
 *
 * Example #1: Then the issue "SCRUM-3" should be in the backlog
 * Example #2: Then the issue "Write the release notes" should be in the backlog
 * Example #3: Then the issue "SCRUM-1" should not be in the backlog
 * Example #4: And the issue "Export the report" should be in the backlog
 * Example #5: And the issue "SCRUM-2" should not be in the backlog
 *
 */
Then(/^the issue "([^"]*)" should( not)* be in the backlog$/, async function (nameOrKey, notCase) {
  await requireBacklog(this);
  await assertPresence(this.page.locator('.ghx-backlog-container.ghx-everything-else .js-issue').and(backlogIssue(this, nameOrKey)), notCase, {
    label: `the issue "${nameOrKey}" in the backlog`,
    hint: 'The backlog is the list under the sprints; it holds the open issues that are in no sprint.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Start a planned sprint from the backlog: press its "Start sprint" button,
 * keep the dates the dialog proposes, press "Start". The active sprints board
 * opens. A sprint without an issue cannot be started, and a board runs one
 * sprint at a time unless parallel sprints are turned on.
 *
 * Example #1: When I start the sprint "Suite Sprint"
 * Example #2: When I start the sprint "Sprint 7"
 * Example #3: When we start the sprint "Release sprint"
 * Example #4: And I start the sprint "Hardening"
 * Example #5: And we start the sprint "Suite Sprint"
 *
 */
When(/^(I |we )*start the sprint "([^"]*)"$/, async function (pronounCase, name) {
  await requireBacklog(this);
  const page = this.page;
  const sprint = sprintContainer(this, name).first();
  await assertPresence(sprint, null, { label: `the sprint "${name}" in the backlog`, hint: 'Create the sprint first.', timeout: budget(this) });
  const button = sprint.locator('.js-sprint-start').first();
  if (!(await button.isVisible().catch(() => false))) {
    throw friendly({ message: `The sprint "${name}" has no "Start sprint" button.`, hint: 'Only a planned sprint has it, for an account with the Manage Sprints permission; an active sprint is already started.' });
  }
  if ((await button.getAttribute('aria-disabled', { timeout: 1500 })) === 'true') {
    throw friendly({ message: `The sprint "${name}" cannot be started: ${tidy(await button.getAttribute('title', { timeout: 1500 })) || 'its "Start sprint" button is disabled'}.`, hint: 'Add an issue to the sprint first, and complete the sprint that is active.' });
  }
  await safeClick(this, button);
  await waitForDialog(this, 'Start sprint');
  await submitDialog(this);
  await actOrExplain('start the sprint', name, async () => {
    await page.locator('#ghx-complete-sprint, .ghx-sprint-active').first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The sprint dialog closed but neither the active sprints board nor an active sprint shows.');
  await smartSettle(page, 2000);
});

/**
 * Complete the active sprint from the board: press "Complete sprint", keep
 * the proposal for the open issues (back to the backlog) and confirm. The
 * sprint report opens.
 *
 * Example #1: When I complete the active sprint
 * Example #2: When we complete the active sprint
 * Example #3: And I complete the active sprint
 * Example #4: When I complete the sprint on the board
 * Example #5: And we complete the sprint on the board
 *
 */
When(/^(I |we )*complete the (active sprint|sprint on the board)$/, async function (pronounCase, whichCase) {
  const page = this.page;
  const button = page.locator('#ghx-complete-sprint').first();
  if (!(await button.waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    throw friendly({ message: `The page has no "Complete sprint" button (${page.url()}).`, hint: 'Open the board of a Scrum project with an active sprint first: Given I am on the board of the "KEY" project.' });
  }
  await safeClick(this, button);
  await waitForDialog(this, 'Complete sprint');
  await submitDialog(this);
  await actOrExplain('complete', 'the active sprint', async () => {
    await page.waitForURL(/view=reporting|chart=sprintRetrospective/, { timeout: budget(this) });
  }, 'The dialog closed but the sprint report did not open.');
  await smartSettle(page, 2000);
});

/**
 * Delete a planned sprint from the backlog through its menu ("Delete sprint")
 * and the confirmation dialog. Its issues go back to the backlog.
 *
 * Example #1: When I delete the sprint "Suite Sprint"
 * Example #2: When I delete the sprint "Sprint 7"
 * Example #3: When we delete the sprint "Release sprint"
 * Example #4: And I delete the sprint "Hardening"
 * Example #5: And we delete the sprint "Suite Sprint"
 *
 */
When(/^(I |we )*delete the sprint "([^"]*)"$/, async function (pronounCase, name) {
  await requireBacklog(this);
  const page = this.page;
  const sprint = sprintContainer(this, name).first();
  await assertPresence(sprint, null, { label: `the sprint "${name}" in the backlog`, hint: 'The backlog lists planned and active sprints only.', timeout: budget(this) });
  await safeClick(this, sprint.locator('.js-sprint-actions-trigger').first());
  const item = page.locator('.ajs-layer.active a.js-sprint-action').filter({ hasText: /^\s*Delete sprint\s*$/ }).first();
  if (!(await item.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false))) {
    const offered = (await page.locator('.ajs-layer.active a.js-sprint-action').allInnerTexts().catch(() => [])).map(tidy);
    await page.keyboard.press('Escape').catch(() => {});
    throw friendly({ message: `The menu of the sprint "${name}" has no "Delete sprint". It has: ${offered.join(', ') || '(nothing)'}.`, hint: 'An active sprint is completed, not deleted; a planned sprint can be deleted.' });
  }
  await item.click();
  await waitForDialog(this, 'Delete sprint');
  await submitDialog(this);
  await assertPresence(sprintContainer(this, name), 'not', { label: `the sprint "${name}"`, hint: 'The deletion was confirmed but the sprint still shows.', timeout: budget(this) });
});

/**
 * Make sure the board of a project has no sprint with the given name, in any
 * state. Used at the start and the end of a scenario that creates a sprint.
 * A completed sprint has no delete in the screens, so this step removes the
 * sprint through the sprint resource of the application, with the session of
 * the signed-in account (it needs the Manage Sprints permission); it does
 * nothing when there is no such sprint.
 *
 * Example #1: Given the sprint "Suite Sprint" is removed from the "SCRUM" project
 * Example #2: Given the sprint "Sprint 7" is removed from the "SCRUM" project
 * Example #3: And the sprint "Release sprint" is removed from the "SCRUM" project
 * Example #4: Then the sprint "Hardening" is removed from the "SCRUM" project
 * Example #5: And the sprint "Suite Sprint" is removed from the "SCRUM" project
 *
 */
Given(/^the sprint "([^"]*)" is removed from the "([^"]*)" project$/, async function (name, projectKey) {
  const boardId = await boardIdOfProject(this, projectKey);
  const sprints = (await boardSprints(this, boardId)).filter((sprint) => exactly(name).test(sprint.name));
  for (const sprint of sprints) {
    const response = await this.page.request.delete(siteUrl(this, `/rest/agile/1.0/sprint/${sprint.id}`), { headers: { 'X-Atlassian-Token': 'no-check' } });
    if (!response.ok()) {
      throw friendly({ message: `The sprint "${name}" (${sprint.state}) could not be removed: HTTP ${response.status()} ${tidy(await response.text()).slice(0, 200)}`, hint: 'Removing a sprint needs the Manage Sprints permission of the project.' });
    }
  }
});
