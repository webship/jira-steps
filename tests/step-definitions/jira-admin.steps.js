'use strict';

// Dashboard, project settings and administration step definitions: the
// gadgets of a dashboard, creating, opening and deleting dashboards, the
// settings of a project an administrator reaches, the list of accounts.
//
// No step here creates or deletes an account: accounts are configuration,
// named in the users registry of cucumber.js.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  literal,
  exactly,
  tidy,
  siteUrl,
  open,
  actOrExplain,
  assertPresence,
  waitForValue,
  clearObstacles,
  safeClick,
  currentUser,
  waitForDialog,
  submitDialog,
} = require('./jira-helpers');

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

/**
 * The row of a dashboard in the "My" tab of the Manage Dashboards page, by
 * the name of the dashboard. The page is opened first.
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<import('playwright').Locator>}
 */
async function myDashboardRow(world, name) {
  await open(world, '/secure/ConfigurePortalPages.jspa?view=my');
  await world.page.locator('#my-dash-tab').first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  await clearObstacles(world);
  return world.page.locator('tr[id^="pp_"]').filter({ has: world.page.locator('a[id^="dashboardlink_"]', { hasText: exactly(name) }) });
}

/**
 * Delete the dashboard of a row through its Operations menu and the
 * confirmation dialog.
 *
 * @param {object} world
 * @param {import('playwright').Locator} row
 * @param {string} name
 */
async function deleteDashboardRow(world, row, name) {
  await actOrExplain('delete the dashboard', name, async () => {
    await safeClick(world, row.locator('button.aui-dropdown2-trigger').first());
    const item = row.locator('a[id^="delete_"]').first();
    await item.waitFor({ state: 'visible', timeout: budget(world) });
    await item.click();
    await waitForDialog(world, 'Delete Dashboard');
    await submitDialog(world);
    await row.first().waitFor({ state: 'hidden', timeout: budget(world) });
  }, 'The row of the dashboard has an "Operations" button with Edit, Delete and Copy for the owner of the dashboard.');
}

/**
 * Create a dashboard with the given name: open the Manage Dashboards page,
 * press "Create new dashboard", type the name, press "Add" and wait for the
 * dashboard to be in the list.
 *
 * Example #1: When I create the dashboard "Suite dashboard"
 * Example #2: When I create the dashboard "Release overview"
 * Example #3: When we create the dashboard "Team board"
 * Example #4: And I create the dashboard "My work"
 * Example #5: And we create the dashboard "Suite dashboard"
 *
 */
When(/^(I |we )*create the dashboard "([^"]*)"$/, async function (pronounCase, name) {
  const page = this.page;
  await open(this, '/secure/ConfigurePortalPages.jspa?view=my');
  await clearObstacles(this);
  const button = page.locator('#create_page').first();
  if (!(await button.waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    throw friendly({ message: `The Manage Dashboards page has no "Create new dashboard" button (${page.url()}).`, hint: 'Sign in first: a visitor cannot own dashboards.' });
  }
  await safeClick(this, button);
  await actOrExplain('create the dashboard', name, async () => {
    const field = page.locator('#edit-entity-dashboard-name').first();
    await field.waitFor({ state: 'visible', timeout: budget(this) });
    await field.fill(name);
    await page.locator('#edit-entity-submit').first().click();
    await page.locator('a[id^="dashboardlink_"]').filter({ hasText: exactly(name) }).first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The form (name #edit-entity-dashboard-name, button "Add") did not lead back to the list with the new dashboard; a dashboard with this name may exist already.');
});

/**
 * Open a dashboard by its name: one of the favourite dashboards of the
 * account, one of its own, or the "System Dashboard".
 *
 * Example #1: When I open the dashboard "Suite dashboard"
 * Example #2: When I open the dashboard "System Dashboard"
 * Example #3: When we open the dashboard "Release overview"
 * Example #4: And I open the dashboard "Team board"
 * Example #5: Given I open the dashboard "System Dashboard"
 *
 */
When(/^(I |we )*open the dashboard "([^"]*)"$/, async function (pronounCase, name) {
  const page = this.page;
  let href = null;
  const seen = [];
  if (exactly('System Dashboard').test(name)) href = '/secure/Dashboard.jspa?selectPageId=10000';
  for (const view of href ? [] : ['favourites', 'my']) {
    await open(this, `/secure/ConfigurePortalPages.jspa?view=${view}`);
    await page.locator('#my-dash-tab').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
    const links = page.locator('a[id^="dashboardlink_"]');
    seen.push(...(await links.allInnerTexts().catch(() => [])).map(tidy));
    const link = links.filter({ hasText: exactly(name) }).first();
    if (await link.count()) { href = await link.getAttribute('href', { timeout: 1500 }); break; }
  }
  if (!href) {
    throw friendly({ message: `The account has no dashboard "${name}" among its favourite and own dashboards: ${[...new Set(seen)].join(', ') || '(none)'}.`, hint: 'Create it first (When I create the dashboard "..."), or mark a shared dashboard as a favourite.' });
  }
  await open(this, siteUrl(this, href));
  await assertPresence(page.locator('#dashboard, #dashboard-content').first(), null, { label: `the dashboard "${name}"`, hint: 'The address of the dashboard did not show a dashboard.', timeout: budget(this) });
  await clearObstacles(this);
});

/**
 * Assert the dashboard on the page has (or has not) the given title.
 *
 * Example #1: Then the dashboard title should be "System Dashboard"
 * Example #2: Then the dashboard title should be "Suite dashboard"
 * Example #3: And the dashboard title should be "Release overview"
 * Example #4: Then the dashboard title should not be "System Dashboard"
 * Example #5: And the dashboard title should not be "Team board"
 *
 */
Then(/^the dashboard title should( not)* be "([^"]*)"$/, async function (notCase, name) {
  const title = this.page.locator('#dashboard-content .aui-page-header-main h1, #dashboard h1, .aui-page-header-main h1').first();
  const result = await waitForValue(async () => tidy(await title.innerText({ timeout: 2000 })), (text) => exactly(name).test(text) !== Boolean(notCase), budget(this));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the dashboard title not to be "${name}", but it is.` : `Expected the dashboard title "${name}", but it is "${result.value || '(no dashboard is showing)'}".`, hint: 'The title is the heading above the gadgets.' });
  }
});

/**
 * Assert the dashboard on the page shows (or does not show) a gadget with the
 * given title.
 *
 * Example #1: Then I should see the "Assigned to Me" gadget
 * Example #2: Then I should see the "Introduction" gadget
 * Example #3: Then I should not see the "Pie Chart" gadget
 * Example #4: And we should see the "Activity Stream" gadget
 * Example #5: And I should not see the "Assigned to Me" gadget
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" gadget$/, async function (pronounCase, notCase, title) {
  const gadget = this.page.locator('.dashboard-item-frame').filter({ has: this.page.locator('.dashboard-item-title, h2', { hasText: exactly(title) }) });
  try {
    await gadget.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout: notCase ? 3000 : budget(this) });
  } catch {
    const shown = (await this.page.locator('.dashboard-item-frame .dashboard-item-title, .dashboard-item-frame h2').allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    throw friendly({ message: notCase ? `Expected no "${title}" gadget, but the dashboard shows it.` : `Expected the "${title}" gadget. The dashboard shows: ${[...new Set(shown)].join(', ') || '(no gadgets)'}.`, hint: 'A gadget is named by the title in its header.' });
  }
});

/**
 * Assert a gadget of the dashboard on the page contains (or does not contain)
 * a text, once its content has loaded.
 *
 * Example #1: Then the "Assigned to Me" gadget should contain "Fix the login redirect"
 * Example #2: Then the "Introduction" gadget should contain "Welcome to"
 * Example #3: And the "Assigned to Me" gadget should contain "Update the contact page"
 * Example #4: Then the "Assigned to Me" gadget should not contain "Write the release notes"
 * Example #5: And the "Introduction" gadget should not contain "Goodbye"
 *
 */
Then(/^the "([^"]*)" gadget should( not)* contain "([^"]*)"$/, async function (title, notCase, text) {
  const gadget = this.page.locator('.dashboard-item-frame').filter({ has: this.page.locator('.dashboard-item-title, h2', { hasText: exactly(title) }) }).first();
  await assertPresence(gadget, null, { label: `the "${title}" gadget`, hint: 'Open a dashboard that has the gadget first.', timeout: budget(this) });
  const result = await waitForValue(async () => tidy(await gadget.innerText({ timeout: 2000 })), (content) => content.includes(text) !== Boolean(notCase), notCase ? 3000 : budget(this));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the "${title}" gadget not to contain "${text}", but it does.` : `Expected the "${title}" gadget to contain "${text}". It says: "${String(result.value || '').slice(0, 300)}".`, hint: 'A gadget loads its content after the dashboard shows.' });
  }
});

/**
 * Assert the account owns (or does not own) a dashboard with the given name,
 * on the "My" tab of the Manage Dashboards page.
 *
 * Example #1: Then I should see the dashboard "Suite dashboard" in my dashboards
 * Example #2: Then I should not see the dashboard "Suite dashboard" in my dashboards
 * Example #3: Then we should see the dashboard "Release overview" in our dashboards
 * Example #4: And I should see the dashboard "Team board" in my dashboards
 * Example #5: And we should not see the dashboard "My work" in our dashboards
 *
 */
Then(/^(I |we )*should( not)* see the dashboard "([^"]*)" in (my|our) dashboards$/, async function (pronounCase, notCase, name, whoseCase) {
  const row = await myDashboardRow(this, name);
  const found = await row.first().waitFor({ state: 'visible', timeout: notCase ? 2000 : budget(this) }).then(() => true).catch(() => false);
  if (found === Boolean(notCase)) {
    const owned = (await this.page.locator('a[id^="dashboardlink_"]').allInnerTexts().catch(() => [])).map(tidy);
    throw friendly({ message: notCase ? `Expected not to own a dashboard "${name}", but it is in the list.` : `Expected to own the dashboard "${name}". The account owns: ${owned.join(', ') || '(no dashboards)'}.`, hint: 'The "My" tab of Manage Dashboards lists the dashboards the signed-in account owns.' });
  }
});

/**
 * Delete a dashboard the account owns, by its name, through the Operations
 * menu of its row on the Manage Dashboards page and the confirmation dialog.
 *
 * Example #1: When I delete the dashboard "Suite dashboard"
 * Example #2: When I delete the dashboard "Release overview"
 * Example #3: When we delete the dashboard "Team board"
 * Example #4: And I delete the dashboard "My work"
 * Example #5: And we delete the dashboard "Suite dashboard"
 *
 */
When(/^(I |we )*delete the dashboard "([^"]*)"$/, async function (pronounCase, name) {
  const row = await myDashboardRow(this, name);
  if (!(await row.first().waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    const owned = (await this.page.locator('a[id^="dashboardlink_"]').allInnerTexts().catch(() => [])).map(tidy);
    throw friendly({ message: `The account owns no dashboard "${name}". It owns: ${owned.join(', ') || '(no dashboards)'}.`, hint: 'Only the owner of a dashboard can delete it.' });
  }
  await deleteDashboardRow(this, row.first(), name);
});

/**
 * Make sure the account owns no dashboard with the given name: each one is
 * deleted. Used at the start and the end of a scenario that creates a
 * dashboard; it does nothing when there is none.
 *
 * Example #1: Given the dashboard "Suite dashboard" is removed
 * Example #2: Given the dashboard "Release overview" is removed
 * Example #3: And the dashboard "Team board" is removed
 * Example #4: Then the dashboard "My work" is removed
 * Example #5: And the dashboard "Suite dashboard" is removed
 *
 */
Given(/^the dashboard "([^"]*)" is removed$/, async function (name) {
  for (let round = 0; round < 10; round++) {
    const row = await myDashboardRow(this, name);
    if (!(await row.first().waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false))) return;
    await deleteDashboardRow(this, row.first(), name);
  }
});

// ---------------------------------------------------------------------------
// Project settings
// ---------------------------------------------------------------------------

// The sections of the settings of a project a step opens by name, with the
// last part of their address.
const SETTINGS_SECTIONS = {
  'summary': 'summary',
  'users and roles': 'roles',
  'workflows': 'workflows',
  'issue types': 'issuetypes',
  'screens': 'screens',
  'fields': 'fields',
  'versions': 'administer-versions',
  'components': 'administer-components',
  'permissions': 'permissions',
  'notifications': 'notifications',
};

/**
 * Open a section of the settings of a project, by the key of the project:
 * summary, users and roles, workflows, issue types, screens, fields, versions,
 * components, permissions, notifications. It asserts nothing about the
 * outcome: an account that is not an administrator of the project is refused,
 * which "I should be refused the project settings" asserts.
 *
 * Example #1: Given I am on the "summary" settings of the "SCRUM" project
 * Example #2: Given I am on the "users and roles" settings of the "SCRUM" project
 * Example #3: When I go to the "workflows" settings of the "KAN" project
 * Example #4: Given we are on the "permissions" settings of the "SCRUM" project
 * Example #5: When we go to the "issue types" settings of the "KAN" project
 *
 */
Given(/^(I am on|we are on|I go to|we go to) the "([^"]*)" settings of the "([^"]*)" project$/, async function (pronounCase, section, key) {
  const part = SETTINGS_SECTIONS[String(section).trim().toLowerCase()];
  if (!part) {
    throw friendly({ message: `"${section}" is not a section of the project settings these steps know.`, hint: `Use one of: ${Object.keys(SETTINGS_SECTIONS).join(', ')}.` });
  }
  await open(this, `/plugins/servlet/project-config/${encodeURIComponent(key)}/${part}`);
  await clearObstacles(this);
});

/**
 * Assert the page is the settings of the project with the given name: the
 * project header and the settings navigation show.
 *
 * Example #1: Then I should see the settings of the "Scrum Sample" project
 * Example #2: Then I should see the settings of the "Kanban Sample" project
 * Example #3: Then we should see the settings of the "Scrum Sample" project
 * Example #4: And I should see the settings of the "Kanban Sample" project
 * Example #5: And we should see the settings of the "Scrum Sample" project
 *
 */
Then(/^(I |we )*should see the settings of the "([^"]*)" project$/, async function (pronounCase, name) {
  const page = this.page;
  const navigation = page.locator('#project-config-tabs, .project-config-nav, a#view_project_summary, #project-config-panel-summary, .project-config-panel').first();
  const result = await waitForValue(async () => ({ onSettings: /\/project-config\//.test(page.url()) && (await navigation.count()) > 0, title: tidy(await page.title()), header: tidy(await page.locator('.aui-sidebar .project-title, #project-config-header-name, .aui-page-header-main').first().innerText({ timeout: 2000 }).catch(() => '')) }),
    (state) => state.onSettings && (state.header.includes(name) || state.title.includes(name)), budget(this));
  if (!result.ok) {
    const error = tidy(await page.locator('#main .aui-message, main .aui-message').first().innerText({ timeout: 1500 }).catch(() => ''));
    throw friendly({
      message: `Expected the settings of the project "${name}", but the page is "${result.value ? result.value.title : ''}" (${page.url()})${error ? `: "${error}"` : ''}.`,
      hint: 'The settings of a project open for its administrators only (Given I am on the "summary" settings of the "KEY" project).',
    });
  }
});

/**
 * Assert the application refuses the settings of a project to the signed-in
 * account ("You cannot edit the configuration of this project.").
 *
 * Example #1: Then I should be refused the project settings
 * Example #2: Then we should be refused the project settings
 * Example #3: And I should be refused the project settings
 * Example #4: Then I should be refused the settings of the project
 * Example #5: And we should be refused the settings of the project
 *
 */
Then(/^(I |we )*should be refused the (project settings|settings of the project)$/, async function (pronounCase, whatCase) {
  const page = this.page;
  const refusal = page.locator('body').filter({ hasText: literal('You cannot edit the configuration of this project') });
  try {
    await refusal.first().waitFor({ state: 'visible', timeout: budget(this) });
  } catch {
    throw friendly({
      message: `Expected the project settings to be refused to "${await currentUser(this)}", but the page is "${tidy(await page.title())}" (${page.url()}).`,
      hint: 'An account that is not an administrator of the project gets the page "Error": "You cannot edit the configuration of this project."',
    });
  }
});

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

/**
 * Assert the list of accounts on the User management page shows (or does not
 * show) an account, by its username. The list is filtered by the username
 * first, so the account is found whatever the size of the list. The suite
 * only reads this list: accounts are never created or deleted by a step.
 *
 * Example #1: Then I should see the account "alex" in the user list
 * Example #2: Then I should see the account "sam" in the user list
 * Example #3: Then I should not see the account "nobody" in the user list
 * Example #4: And we should see the account "admin" in the user list
 * Example #5: And I should not see the account "ghost" in the user list
 *
 */
Then(/^(I |we )*should( not)* see the account "([^"]*)" in the user list$/, async function (pronounCase, notCase, username) {
  const page = this.page;
  if (!/\/UserBrowser\.jspa/.test(page.url())) await open(this, '/secure/admin/user/UserBrowser.jspa');
  const filter = page.locator('#user-filter-userSearchFilter').first();
  if (!(await filter.waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    throw friendly({ message: `The User management page did not show for "${await currentUser(this)}" (${page.url()}).`, hint: 'Only an administrator reaches it; other accounts are asked to sign in.' });
  }
  await clearObstacles(this);
  await filter.fill(username);
  await filter.press('Enter');
  await smartSettle(page, 3000);
  const row = page.locator(`#user_browser_table tbody tr[data-user="${username.replace(/"/g, '\\"')}"]`);
  const found = await row.first().waitFor({ state: 'visible', timeout: notCase ? 3000 : budget(this) }).then(() => true).catch(() => false);
  if (found === Boolean(notCase)) {
    const listed = await page.locator('#user_browser_table tbody tr[data-user]').evaluateAll((rows) => rows.map((entry) => entry.getAttribute('data-user')));
    throw friendly({ message: notCase ? `Expected no account "${username}" in the user list, but it is there.` : `Expected the account "${username}" in the user list. The filter "${username}" lists: ${listed.join(', ') || '(nobody)'}.`, hint: 'The list is filtered by the username; an account is a row with data-user="<username>".' });
  }
});

/**
 * Assert the page is (or is not) a page of the administration area: its
 * header shows the "Administration" heading with the search for settings.
 *
 * Example #1: Then I should be in the administration area
 * Example #2: Then I should not be in the administration area
 * Example #3: Then we should be in the administration area
 * Example #4: And I should be in the administration area
 * Example #5: And we should not be in the administration area
 *
 */
Then(/^(I |we )*should( not)* be in the administration area$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('#admin-search-link, .aui-page-header-main:has-text("Administration"), #admin-nav-heading').first(), notCase, {
    label: 'the administration area',
    hint: 'The administration pages open for an administrator only; other accounts are asked to sign in.',
    timeout: notCase ? 3000 : budget(this),
  });
});
