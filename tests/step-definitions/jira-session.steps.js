'use strict';

// Session, navigation and message step definitions: signing in and out with
// the users registry, the sign-in form and its errors, the top navigation and
// its menus, named pages, the project sidebar, the messages the application
// shows (flags and inline messages), the dialogs and the error pages.
//
// The other step files: jira-issues.steps.js (the issue lifecycle and the
// issue view), jira-search.steps.js (issue search and filters),
// jira-agile.steps.js (boards, backlog and sprints) and jira-admin.steps.js
// (dashboards, project settings, administration).
//
// Steps that webship-js already covers with its generic click, fill and see
// vocabulary are not duplicated here; see "Rules for a new step" in README.md
// of this folder.
//
// Every assertion waits on its locator (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout
// stack.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  literal,
  exactly,
  tidy,
  open,
  actOrExplain,
  assertPresence,
  waitForValue,
  resolveUser,
  clearObstacles,
  safeClick,
  messages,
  MESSAGE_TYPES,
  currentUser,
  signOut,
  submitSignIn,
  signInAs,
  dialog,
  dialogTitle,
  submitDialog,
  pickSuggestion,
  typeRichText,
} = require('./jira-helpers');

// ---------------------------------------------------------------------------
// Signing in (the first steps of the pack), then the rest of the session
// ---------------------------------------------------------------------------

/**
 * Sign in with an account of the users registry in cucumber.js
 * (`worldParameters.users`), by its handle, and make sure the session is that
 * account's. An account that is already signed in is kept. The first time in
 * a run the account goes through the sign-in form; after that its session is
 * put back, so switching accounts inside a scenario is quick. The help tips
 * and flags that cover the page after signing in are closed.
 *
 * Example #1: Given I am signed in as "alex"
 * Example #2: Given I am signed in as "admin"
 * Example #3: Given we are signed in as "sam"
 * Example #4: And I am signed in as "alex"
 * Example #5: Given I am signed in with the "admin" account
 *
 */
Given(/^(I am|we are) signed in (as|with the) "([^"]*)"( account)?$/, async function (pronounCase, asCase, handle, accountCase) {
  await signInAs(this, handle);
});

/**
 * Sign in through the form with the password of an account of the users
 * registry, without the checks of "I am signed in as": the step to use when
 * the scenario is about the sign-in itself.
 *
 * Example #1: When I sign in with the "alex" account
 * Example #2: When I sign in with the "admin" account
 * Example #3: When we sign in with the "sam" account
 * Example #4: And I sign in with the "alex" account
 * Example #5: When sign in with the "sam" account
 *
 */
When(/^(I |we )*sign in with the "([^"]*)" account$/, async function (pronounCase, handle) {
  const user = resolveUser(this, handle);
  await submitSignIn(this, user.username, user.password);
  await this.page.waitForURL((url) => !/\/login\.jsp/.test(url.toString()), { timeout: budget(this) }).catch(() => {});
  await smartSettle(this.page, 2000);
});

/**
 * Fill in the sign-in form with a username and a password as typed in the
 * step, and submit it. It asserts nothing: follow it with a step that says
 * what should happen (signed in, or a sign-in error). For the accounts of the
 * registry use "I am signed in as".
 *
 * Example #1: When I sign in as "alex" with the password "not-the-right-password"
 * Example #2: When I sign in as "nobody" with the password "whatever"
 * Example #3: When we sign in as "sam" with the password "wrong"
 * Example #4: And I sign in as "admin" with the password "wrong-password"
 * Example #5: When I sign in as "alex" with the password ""
 *
 */
When(/^(I |we )*sign in as "([^"]*)" with the password "([^"]*)"$/, async function (pronounCase, username, password) {
  await submitSignIn(this, username, password);
  await smartSettle(this.page, 2000);
});

/**
 * Make sure nobody is signed in: the browser forgets its session. (To end a
 * session through the screens, use "I sign out".)
 *
 * Example #1: Given I am not signed in
 * Example #2: Given we are not signed in
 * Example #3: And I am not signed in
 * Example #4: Given I am signed out
 * Example #5: Given we are signed out
 *
 */
Given(/^(I am|we are) (not signed in|signed out)$/, async function (pronounCase, stateCase) {
  await signOut(this);
  const result = await waitForValue(() => currentUser(this), (name) => name === '', budget(this));
  if (!result.ok) {
    throw friendly({ message: `Signing out did not work: "${result.value}" is still signed in.`, hint: 'The cookies of the browser were dropped but the site still answers with a session.' });
  }
});

/**
 * Open the sign-in page and wait for its form.
 *
 * Example #1: Given I am on the sign-in page
 * Example #2: Given we are on the sign-in page
 * Example #3: When I go to the sign-in page
 * Example #4: And I am on the sign-in page
 * Example #5: When we go to the sign-in page
 *
 */
Given(/^(I am on|we are on|I go to|we go to) the sign-in page$/, async function (pronounCase) {
  await open(this, '/login.jsp');
  await assertPresence(this.page.locator('#login-form #username-field'), null, {
    label: 'the sign-in form',
    hint: 'An account that is already signed in is sent to its home page instead: add "Given I am not signed in" first.',
    timeout: budget(this),
  });
});

/**
 * Sign out through the profile menu of the top navigation: open the menu and
 * choose "Log Out".
 *
 * Example #1: When I sign out
 * Example #2: When we sign out
 * Example #3: And I sign out
 * Example #4: When I sign out of the site
 * Example #5: And we sign out of the site
 *
 */
When(/^(I |we )*sign out( of the site)?$/, async function (pronounCase, siteCase) {
  const page = this.page;
  const trigger = page.locator('#header-details-user-fullname').first();
  if (!(await trigger.isVisible().catch(() => false))) {
    throw friendly({ message: 'There is no profile menu in the top navigation: nobody is signed in.', hint: 'Sign in first: Given I am signed in as "..."' });
  }
  await actOrExplain('sign out through', 'the profile menu', async () => {
    await safeClick(this, trigger);
    const link = page.locator('#log_out').first();
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  }, 'The profile menu did not show its "Log Out" item (#log_out).');
  await smartSettle(page, 2000);
});

/**
 * Assert somebody is (or nobody is) signed in: the site is asked whose
 * session the browser holds.
 *
 * Example #1: Then I should be signed in
 * Example #2: Then I should not be signed in
 * Example #3: Then we should be signed in
 * Example #4: And I should not be signed in
 * Example #5: And we should not be signed in
 *
 */
Then(/^(I |we )*should( not)* be signed in$/, async function (pronounCase, notCase) {
  const result = await waitForValue(() => currentUser(this), (name) => (notCase ? name === '' : name !== ''), budget(this));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected nobody to be signed in, but "${result.value}" is.` : `Expected somebody to be signed in, but the page (${this.page.url()}) has no session.`,
      hint: notCase ? 'Sign out first (When I sign out).' : 'Sign in first (Given I am signed in as "..."), and check the sign-in did not show an error.',
    });
  }
});

/**
 * Assert the session belongs to an account: the argument is a handle of the
 * users registry, or a username as the site knows it.
 *
 * Example #1: Then I should be signed in as "alex"
 * Example #2: Then I should be signed in as "admin"
 * Example #3: Then we should be signed in as "sam"
 * Example #4: And I should be signed in as "alex"
 * Example #5: Then I should not be signed in as "admin"
 *
 */
Then(/^(I |we )*should( not)* be signed in as "([^"]*)"$/, async function (pronounCase, notCase, handle) {
  const users = (this.parameters && this.parameters.users) || {};
  const username = users[handle] ? users[handle].username || handle : handle;
  const result = await waitForValue(() => currentUser(this), (name) => (notCase ? name !== username : name === username), budget(this));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the session not to be "${username}", but it is.` : `Expected to be signed in as "${username}", but ${result.value ? `"${result.value}" is signed in` : 'nobody is signed in'}.`,
      hint: 'The site is asked whose session the browser holds (the "myself" resource).',
    });
  }
});

/**
 * Assert the sign-in form is (or is not) on the page.
 *
 * Example #1: Then I should see the sign-in form
 * Example #2: Then I should not see the sign-in form
 * Example #3: Then we should see the sign-in form
 * Example #4: And I should see the sign-in form
 * Example #5: And we should not see the sign-in form
 *
 */
Then(/^(I |we )*should( not)* see the sign-in form$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('#login-form #password-field'), notCase, {
    label: 'the sign-in form',
    hint: 'The sign-in form is at /login.jsp and on the pages a visitor may not see.',
    timeout: budget(this),
  });
});

/**
 * Assert the sign-in form reports an error with the given text, as after a
 * wrong password.
 *
 * Example #1: Then I should see the sign-in error "Incorrect username or password."
 * Example #2: Then I should see the sign-in error "Incorrect username or password"
 * Example #3: Then we should see the sign-in error "Incorrect username"
 * Example #4: And I should see the sign-in error "Incorrect username or password."
 * Example #5: Then I should not see the sign-in error "Incorrect username or password."
 *
 */
Then(/^(I |we )*should( not)* see the sign-in error "([^"]*)"$/, async function (pronounCase, notCase, text) {
  const error = this.page.locator('#login-message').filter({ hasText: literal(text) });
  try {
    await error.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout: budget(this) });
  } catch {
    const shown = tidy(await this.page.locator('#login-message').first().innerText({ timeout: 1500 }).catch(() => ''));
    throw friendly({
      message: notCase ? `Expected no sign-in error "${text}", but the form shows it.` : `Expected the sign-in error "${text}", but the form shows ${shown ? `"${shown}"` : 'no error'} (${this.page.url()}).`,
      hint: 'The error is the alert above the sign-in form (#login-message).',
    });
  }
});

/**
 * Assert the site asks to sign in before it shows the page: the sign-in form
 * with the notice a visitor (or an account without the permission) gets.
 *
 * Example #1: Then I should be asked to sign in
 * Example #2: Then we should be asked to sign in
 * Example #3: And I should be asked to sign in
 * Example #4: Then I should be asked to sign in first
 * Example #5: And we should be asked to sign in first
 *
 */
Then(/^(I |we )*should be asked to sign in( first)?$/, async function (pronounCase, firstCase) {
  const page = this.page;
  try {
    await page.waitForURL(/\/login\.jsp\?.*permissionViolation=true/, { timeout: budget(this) });
    await page.locator('#login-form #username-field').waitFor({ state: 'visible', timeout: budget(this) });
  } catch {
    throw friendly({
      message: `Expected the site to ask to sign in, but the page is ${page.url()} ("${tidy(await page.title())}").`,
      hint: 'A page a visitor may not see redirects to /login.jsp?permissionViolation=true with the sign-in form.',
    });
  }
});

// ---------------------------------------------------------------------------
// Top navigation
// ---------------------------------------------------------------------------

// The menus of the top navigation, by the name a step uses, with the id of
// the item that opens the menu.
const TOP_MENUS = {
  dashboards: '#home_link',
  projects: '#browse_link',
  issues: '#find_link',
  boards: '#greenhopper_menu',
  help: '#help_menu',
  administration: '#admin_menu',
  profile: '#header-details-user-fullname',
};

/**
 * The item of the top navigation that opens a named menu.
 *
 * @param {object} world
 * @param {string} name
 * @returns {import('playwright').Locator}
 */
function topMenuTrigger(world, name) {
  const selector = TOP_MENUS[String(name).trim().toLowerCase()];
  if (!selector) {
    throw friendly({ message: `"${name}" is not a menu of the top navigation these steps know.`, hint: `Use one of: ${Object.keys(TOP_MENUS).join(', ')}.` });
  }
  return world.page.locator(`#header ${selector}`).first();
}

/**
 * Open a menu of the top navigation and return the list it shows. The content
 * of a menu loads after the click, so its first item is waited for.
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<import('playwright').Locator>}
 */
async function openTopMenu(world, name) {
  const page = world.page;
  const trigger = topMenuTrigger(world, name);
  if (!(await trigger.isVisible().catch(() => false))) {
    await trigger.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  }
  if (!(await trigger.isVisible().catch(() => false))) {
    throw friendly({
      message: `The top navigation has no "${name}" menu for ${(await currentUser(world)) ? `the account "${await currentUser(world)}"` : 'a visitor'} (${page.url()}).`,
      hint: 'The Projects, Issues and Boards menus need a signed-in account, the Administration menu an administrator.',
    });
  }
  const id = await trigger.getAttribute('aria-controls', { timeout: 1500 });
  const menu = page.locator(`[id="${id}"]`);
  if ((await trigger.getAttribute('aria-expanded', { timeout: 1500 })) !== 'true') await safeClick(world, trigger);
  await actOrExplain('open the menu of the top navigation', name, async () => {
    await menu.waitFor({ state: 'visible', timeout: budget(world) });
    await menu.locator('a').first().waitFor({ state: 'visible', timeout: budget(world) });
  }, `The "${name}" item was clicked but its menu did not show.`);
  return menu;
}

/**
 * Open a menu of the top navigation: Dashboards, Projects, Issues, Boards,
 * Help, Administration or Profile (the menu behind the avatar).
 *
 * Example #1: When I open the "Projects" menu of the top navigation
 * Example #2: When I open the "Issues" menu of the top navigation
 * Example #3: When we open the "Boards" menu of the top navigation
 * Example #4: And I open the "Profile" menu of the top navigation
 * Example #5: When I open the "Administration" menu of the top navigation
 *
 */
When(/^(I |we )*open the "([^"]*)" menu of the top navigation$/, async function (pronounCase, name) {
  await openTopMenu(this, name);
});

/**
 * Open a menu of the top navigation and choose one of its items by its text.
 *
 * Example #1: When I choose "View All Projects" from the "Projects" menu of the top navigation
 * Example #2: When I choose "Search for issues" from the "Issues" menu of the top navigation
 * Example #3: When we choose "Manage filters" from the "Issues" menu of the top navigation
 * Example #4: And I choose "Manage Dashboards" from the "Dashboards" menu of the top navigation
 * Example #5: When I choose "View all boards" from the "Boards" menu of the top navigation
 *
 */
When(/^(I |we )*choose "([^"]*)" from the "([^"]*)" menu of the top navigation$/, async function (pronounCase, item, name) {
  const menu = await openTopMenu(this, name);
  const link = menu.locator('a').filter({ hasText: exactly(item) }).first();
  if (!(await link.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false))) {
    const offered = (await menu.locator('a').allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    throw friendly({ message: `The "${name}" menu has no "${item}" item. It has: ${offered.join(', ') || '(nothing)'}.`, hint: 'Use the text of the item as the menu shows it.' });
  }
  await link.click();
  await smartSettle(this.page, 3000);
});

/**
 * Assert a menu of the top navigation has (or has not) an item with the given
 * text. The menu is opened to look, and closed again.
 *
 * Example #1: Then I should see "Manage filters" in the "Issues" menu of the top navigation
 * Example #2: Then I should see "Sample open issues" in the "Issues" menu of the top navigation
 * Example #3: Then I should not see "Create project" in the "Projects" menu of the top navigation
 * Example #4: And we should see "Log Out" in the "Profile" menu of the top navigation
 * Example #5: Then I should see "User management" in the "Administration" menu of the top navigation
 *
 */
Then(/^(I |we )*should( not)* see "([^"]*)" in the "([^"]*)" menu of the top navigation$/, async function (pronounCase, notCase, item, name) {
  const menu = await openTopMenu(this, name);
  const link = menu.locator('a').filter({ hasText: exactly(item) });
  const found = await link.first().waitFor({ state: 'visible', timeout: notCase ? 1500 : budget(this) }).then(() => true).catch(() => false);
  const offered = (await menu.locator('a').allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
  await this.page.keyboard.press('Escape').catch(() => {});
  if (found === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the "${name}" menu not to have "${item}", but it does.` : `Expected the "${name}" menu to have "${item}". It has: ${offered.join(', ') || '(nothing)'}.`,
      hint: 'The items of a menu depend on the account and on its favourites.',
    });
  }
});

/**
 * Assert the top navigation has (or has not) a menu: an ordinary account has
 * no Administration menu, a visitor has no Projects, Issues or Boards menu.
 *
 * Example #1: Then I should see the "Administration" menu in the top navigation
 * Example #2: Then I should not see the "Administration" menu in the top navigation
 * Example #3: Then we should see the "Projects" menu in the top navigation
 * Example #4: And I should not see the "Boards" menu in the top navigation
 * Example #5: Then I should see the "Dashboards" menu in the top navigation
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" menu in the top navigation$/, async function (pronounCase, notCase, name) {
  await this.page.locator('#header').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
  await assertPresence(topMenuTrigger(this, name), notCase, {
    label: `the "${name}" menu in the top navigation`,
    hint: 'The menus of the top navigation depend on who is signed in.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Type words into the search box of the top navigation and press Enter: the
 * issue search opens with the issues that contain the words.
 *
 * Example #1: When I search the site for "release notes"
 * Example #2: When I search the site for "footer"
 * Example #3: When we search the site for "pipeline"
 * Example #4: And I search the site for "contact page"
 * Example #5: When search the site for "login"
 *
 */
When(/^(I |we )*search the site for "([^"]*)"$/, async function (pronounCase, words) {
  const page = this.page;
  const box = page.locator('#quickSearchInput').first();
  await actOrExplain('search the site for', words, async () => {
    await clearObstacles(this);
    await box.waitFor({ state: 'visible', timeout: budget(this) });
    await box.click();
    await box.fill(words);
    await page.locator('#quicksearch-results, .quicksearch-dropdown').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await box.press('Enter');
    await page.waitForURL(/\/issues\/|\/browse\//, { timeout: budget(this) });
  }, 'The search box of the top navigation (#quickSearchInput) shows on every page of a signed-in account.');
  await smartSettle(page, 3000);
});

// ---------------------------------------------------------------------------
// Named pages
// ---------------------------------------------------------------------------

// The pages a step opens by name, with their address.
const PAGES = {
  'system dashboard': '/secure/Dashboard.jspa',
  'dashboard': '/secure/Dashboard.jspa',
  'projects': '/secure/BrowseProjects.jspa',
  'issue search': '/issues/?jql=',
  'filters': '/secure/ManageFilters.jspa?filterView=my',
  'favourite filters': '/secure/ManageFilters.jspa?filterView=favourites',
  'dashboards': '/secure/ConfigurePortalPages.jspa?view=my',
  'boards': '/secure/ManageRapidViews.jspa',
  'profile': '/secure/ViewProfile.jspa',
  'user management': '/secure/admin/user/UserBrowser.jspa',
  'system settings': '/secure/admin/ViewApplicationProperties.jspa',
  'project administration': '/secure/project/BrowseProjects.jspa',
  'issue types': '/secure/admin/ViewIssueTypes.jspa',
  'applications': '/plugins/servlet/applications/versions-licenses',
};

/**
 * Open a page of the application by its name: system dashboard, projects,
 * issue search, filters, favourite filters, dashboards, boards, profile, and
 * for an administrator user management, system settings, project
 * administration, issue types, applications.
 *
 * Example #1: Given I am on the "projects" screen
 * Example #2: Given I am on the "system dashboard" screen
 * Example #3: When I go to the "issue search" screen
 * Example #4: Given we are on the "filters" screen
 * Example #5: When I go to the "user management" screen
 *
 */
Given(/^(I am on|we are on|I go to|we go to) the "([^"]*)" screen$/, async function (pronounCase, name) {
  const key = String(name).trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(PAGES, key)) {
    throw friendly({ message: `"${name}" is not a screen these steps know by name.`, hint: `Use one of: ${Object.keys(PAGES).join(', ')}; or open an address with webship-js: Given I am on "/secure/Dashboard.jspa".` });
  }
  await open(this, PAGES[key]);
  await clearObstacles(this);
});

/**
 * Open the page of a project, by its key.
 *
 * Example #1: Given I am on the "SCRUM" project
 * Example #2: Given I am on the "KAN" project
 * Example #3: When I go to the "SCRUM" project
 * Example #4: Given we are on the "KAN" project
 * Example #5: When we go to the "SCRUM" project
 *
 */
Given(/^(I am on|we are on|I go to|we go to) the "([^"]*)" project$/, async function (pronounCase, key) {
  await open(this, `/projects/${encodeURIComponent(key)}/summary`);
  const page = this.page;
  const sidebar = page.locator('.aui-sidebar .aui-nav-item').first();
  if (!(await sidebar.waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    throw friendly({
      message: `The project "${key}" did not open: the page is "${tidy(await page.title())}" (${page.url()}).`,
      hint: 'Use the key of a project (for example "SCRUM"), signed in with an account that may browse it.',
    });
  }
  await clearObstacles(this);
});

// ---------------------------------------------------------------------------
// Project sidebar
// ---------------------------------------------------------------------------

/**
 * Open an item of the project sidebar by its text: Backlog, Active sprints,
 * Kanban board, Releases, Reports, Issues, Components, and for a project
 * administrator "Project settings".
 *
 * Example #1: When I open "Backlog" in the project sidebar
 * Example #2: When I open "Issues" in the project sidebar
 * Example #3: When we open "Active sprints" in the project sidebar
 * Example #4: And I open "Kanban board" in the project sidebar
 * Example #5: When I open "Project settings" in the project sidebar
 *
 */
When(/^(I |we )*open "([^"]*)" in the project sidebar$/, async function (pronounCase, item) {
  const link = this.page.locator('.aui-sidebar a').filter({ hasText: exactly(item) }).first();
  if (!(await link.waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    const offered = (await this.page.locator('.aui-sidebar a.aui-nav-item, .aui-sidebar a.aui-button').allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    throw friendly({ message: `The project sidebar has no "${item}" item. It has: ${offered.join(', ') || '(no sidebar is showing)'}.`, hint: 'Open a project first (Given I am on the "KEY" project); "Project settings" shows for the administrators of the project only.' });
  }
  await safeClick(this, link);
  await smartSettle(this.page, 3000);
});

/**
 * Assert the project sidebar has (or has not) an item with the given text.
 *
 * Example #1: Then I should see "Backlog" in the project sidebar
 * Example #2: Then I should see "Kanban board" in the project sidebar
 * Example #3: Then I should not see "Project settings" in the project sidebar
 * Example #4: And we should see "Reports" in the project sidebar
 * Example #5: And I should not see "Backlog" in the project sidebar
 *
 */
Then(/^(I |we )*should( not)* see "([^"]*)" in the project sidebar$/, async function (pronounCase, notCase, item) {
  await this.page.locator('.aui-sidebar .aui-nav-item').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
  await assertPresence(this.page.locator('.aui-sidebar a').filter({ hasText: exactly(item) }), notCase, {
    label: `"${item}" in the project sidebar`,
    hint: 'Open a project first (Given I am on the "KEY" project). The items depend on the type of the board and on the account.',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Assert the project sidebar is that of the project with the given name.
 *
 * Example #1: Then the project sidebar should be of "Scrum Sample"
 * Example #2: Then the project sidebar should be of "Kanban Sample"
 * Example #3: And the project sidebar should be of "Scrum Sample"
 * Example #4: Then the project sidebar should not be of "Kanban Sample"
 * Example #5: And the project sidebar should not be of "Scrum Sample"
 *
 */
Then(/^the project sidebar should( not)* be of "([^"]*)"$/, async function (notCase, name) {
  const title = this.page.locator('.aui-sidebar .project-title, .aui-sidebar .aui-page-header-main').first();
  const result = await waitForValue(async () => tidy(await title.innerText({ timeout: 2000 })), (text) => exactly(name).test(text) !== Boolean(notCase), budget(this));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the project sidebar not to be of "${name}", but it is.` : `Expected the project sidebar to be of "${name}", but it is of "${result.value || '(no sidebar)'}".`,
      hint: 'The name is the heading at the top of the project sidebar.',
    });
  }
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Assert a message of a type shows (or does not show) with the given text:
 * the flags in the top right corner ("SCRUM-5 has been updated.") and the
 * messages inside a page or a dialog. The types are success, error, warning
 * and info.
 *
 * Example #1: Then I should see the success message "has been successfully created"
 * Example #2: Then I should see the success message "has been updated."
 * Example #3: Then I should see the error message "There is 1 error in this form."
 * Example #4: And we should not see the error message "does not exist"
 * Example #5: Then I should see the info message "time zone"
 *
 */
Then(/^(I |we )*should( not)* see the (success|error|warning|info) message "([^"]*)"$/, async function (pronounCase, notCase, type, text) {
  const wanted = messages(this, type, text);
  try {
    await wanted.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout: notCase ? 3000 : budget(this) });
  } catch {
    const shown = (await messages(this).allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    throw friendly({
      message: notCase ? `Expected no ${type} message "${text}", but it is showing.` : `Expected the ${type} message "${text}". The page shows: ${shown.length ? shown.map((message) => `"${message.slice(0, 120)}"`).join(' | ') : 'no message'}.`,
      hint: `A message is an element with the class aui-message-${MESSAGE_TYPES[type]}; a flag closes by itself after a few seconds, so assert it right after the action.`,
    });
  }
});

/**
 * Close what sits on top of the page: the flags in the top right corner and
 * the help tips. They take the clicks meant for the page; the steps of this
 * pack close them where needed, this step does it for the generic webship-js
 * click steps.
 *
 * Example #1: When I close the messages on top of the page
 * Example #2: When we close the messages on top of the page
 * Example #3: And I close the messages on top of the page
 * Example #4: When I close the flags and help tips
 * Example #5: And we close the flags and help tips
 *
 */
When(/^(I |we )*close the (messages on top of the page|flags and help tips)$/, async function (pronounCase, whatCase) {
  await clearObstacles(this);
});

/**
 * Assert a field of the form or dialog reports an error with the given text
 * (the red text under the field).
 *
 * Example #1: Then I should see the field error "You must specify a summary of the issue."
 * Example #2: Then I should see the field error "You must specify a summary"
 * Example #3: Then we should see the field error "You must specify a summary of the issue."
 * Example #4: And I should not see the field error "You must specify a summary of the issue."
 * Example #5: Then I should see the field error "A sprint name is required"
 *
 */
Then(/^(I |we )*should( not)* see the field error "([^"]*)"$/, async function (pronounCase, notCase, text) {
  const errors = this.page.locator('.error[data-field], .field-group .error, form .error').locator('visible=true');
  const wanted = errors.filter({ hasText: literal(text) });
  try {
    await wanted.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout: notCase ? 3000 : budget(this) });
  } catch {
    const shown = (await errors.allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    throw friendly({
      message: notCase ? `Expected no field error "${text}", but it is showing.` : `Expected the field error "${text}". The form shows: ${shown.length ? shown.map((error) => `"${error}"`).join(' | ') : 'no field error'}.`,
      hint: 'Submit the form first; the error is the text with the class "error" under the field.',
    });
  }
});

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

/**
 * Assert a dialog with the given title is (or is not) open. The title is
 * compared from its start, so "Delete Issue" matches "Delete Issue: SCRUM-5".
 *
 * Example #1: Then the "Create Issue" dialog should be open
 * Example #2: Then the "Delete Issue" dialog should be open
 * Example #3: Then the "Create Issue" dialog should not be open
 * Example #4: And the "Assign" dialog should be open
 * Example #5: And the "Create sprint" dialog should not be open
 *
 */
Then(/^the "([^"]*)" dialog should( not)* be open$/, async function (title, notCase) {
  const starts = (text) => tidy(text).toLowerCase().startsWith(String(title).trim().toLowerCase());
  const result = await waitForValue(async () => ((await dialog(this).isVisible().catch(() => false)) ? await dialogTitle(this) : ''), (text) => starts(text) !== Boolean(notCase), notCase ? 5000 : budget(this));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the "${title}" dialog not to be open, but it is.` : `Expected the "${title}" dialog to be open, but ${result.value ? `the open dialog is "${result.value}"` : 'no dialog is open'}.`,
      hint: 'The title is the heading of the dialog.',
    });
  }
});

/**
 * Press the main button of the open dialog (Create, Update, Assign, Delete,
 * Save, Start, Complete) and wait for the dialog to close. When it stays open
 * the failure lists the errors the dialog shows.
 *
 * Example #1: When I submit the dialog
 * Example #2: When we submit the dialog
 * Example #3: And I submit the dialog
 * Example #4: When I confirm the dialog
 * Example #5: And we confirm the dialog
 *
 */
When(/^(I |we )*(submit|confirm) the dialog$/, async function (pronounCase, verbCase) {
  await submitDialog(this);
});

/**
 * Press the main button of the open dialog without expecting it to close: for
 * a scenario about the errors of the dialog.
 *
 * Example #1: When I submit the dialog expecting errors
 * Example #2: When we submit the dialog expecting errors
 * Example #3: And I submit the dialog expecting errors
 * Example #4: When I try to submit the dialog
 * Example #5: And we try to submit the dialog
 *
 */
When(/^(I |we )*(submit the dialog expecting errors|try to submit the dialog)$/, async function (pronounCase, verbCase) {
  await submitDialog(this, { keepOpen: true });
  await this.page.locator('section[role="dialog"][open] .error, section[role="dialog"][open] .aui-message-error').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
});

/**
 * Cancel the open dialog and wait for it to close. A dialog with changes asks
 * the browser to confirm leaving: that question is accepted.
 *
 * Example #1: When I cancel the dialog
 * Example #2: When we cancel the dialog
 * Example #3: And I cancel the dialog
 * Example #4: When I close the dialog without saving
 * Example #5: And we close the dialog without saving
 *
 */
When(/^(I |we )*(cancel the dialog|close the dialog without saving)$/, async function (pronounCase, verbCase) {
  const page = this.page;
  const box = dialog(this);
  const accept = (question) => question.accept().catch(() => {});
  page.on('dialog', accept);
  try {
    await actOrExplain('cancel', 'the open dialog', async () => {
      await box.waitFor({ state: 'visible', timeout: budget(this) });
      await box.locator('.cancel, [id$="-cancel"], button.aui-button-link').locator('visible=true').last().click();
      await box.waitFor({ state: 'hidden', timeout: budget(this) });
    }, 'No dialog is open, or it has no Cancel button.');
  } finally {
    page.off('dialog', accept);
  }
});

/**
 * Pick a value in a single-select field of the open dialog or form: Project,
 * Issue Type, Assignee, Priority. The value is typed and its suggestion is
 * picked, as a person does. Text fields are filled with "I fill in the
 * "Summary" field of the dialog with".
 *
 * Example #1: When I pick "Scrum Sample" in the "Project" field
 * Example #2: When I pick "Bug" in the "Issue Type" field
 * Example #3: When we pick "Sam Reporter" in the "Assignee" field
 * Example #4: And I pick "High" in the "Priority" field
 * Example #5: When I pick "Kanban Sample" in the "Project" field
 *
 */
When(/^(I |we )*pick "([^"]*)" in the "(Project|Issue Type|Assignee|Priority)" field$/, async function (pronounCase, value, field) {
  const ids = { 'Project': 'project-field', 'Issue Type': 'issuetype-field', 'Assignee': 'assignee-field', 'Priority': 'priority-field' };
  const open = await dialog(this).isVisible().catch(() => false);
  const scope = open ? dialog(this) : this.page.locator('body');
  await pickSuggestion(this, scope.locator(`#${ids[field]}`).first(), value, field);
});

/**
 * Fill in a text field of the open dialog, by its label: Summary, Description,
 * Environment, Sprint Name, Filter Name, Name. A rich text field (Description)
 * is typed into its editor. The generic `I fill in "Summary" with` of
 * webship-js cannot be used in the issue dialogs: their field picker has a
 * checkbox with the same label as each field.
 *
 * Example #1: When I fill in the "Summary" field of the dialog with "Check the footer links"
 * Example #2: When I fill in the "Description" field of the dialog with "The footer has four links."
 * Example #3: When we fill in the "Summary" field of the dialog with "Search box loses focus"
 * Example #4: And I fill in the "Sprint Name" field of the dialog with "Sprint 7"
 * Example #5: And we fill in the "Environment" field of the dialog with "Staging"
 *
 */
When(/^(I |we )*fill in the "([^"]*)" field of the dialog with "([^"]*)"$/, async function (pronounCase, label, text) {
  const box = dialog(this);
  if (!(await box.waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    throw friendly({ message: `No dialog is open to fill in "${label}".`, hint: 'Open the dialog first (When I open the create issue dialog).' });
  }
  // The text of a label without its "Required" marker and its colon.
  const fields = await box.locator('.field-group > label, .field-group label[for], label').evaluateAll((labels) => labels.map((element) => {
    const own = [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join(' ');
    return { name: own.replace(/\s+/g, ' ').replace(/[:*]\s*$/, '').trim(), target: element.getAttribute('for') || '', visible: !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length) };
  }).filter((entry) => entry.name && entry.target && entry.visible));
  const field = fields.find((entry) => exactly(label).test(entry.name));
  if (!field) {
    throw friendly({ message: `The dialog has no "${label}" field. Its fields: ${[...new Set(fields.map((entry) => entry.name))].join(', ') || '(none)'}.`, hint: 'Use the label of the field as the dialog shows it. Project, Issue Type, Assignee and Priority are picked: When I pick "..." in the "Project" field.' });
  }
  const control = box.locator(`[id="${field.target}"]`).first();
  await actOrExplain('fill in the field', label, async () => {
    const rich = await box.locator(`.jira-wikifield[field-id="${field.target}"]`).count();
    if (rich) await typeRichText(this, box, field.target, text);
    else await control.fill(text, { timeout: budget(this) });
  }, 'The field did not take the text; a single-select field is picked, not filled in.');
});

// ---------------------------------------------------------------------------
// Error pages
// ---------------------------------------------------------------------------

/**
 * Assert the page is the one the application shows for an address that does
 * not exist ("Oops, you've found a dead link.").
 *
 * Example #1: Then I should see the dead link page
 * Example #2: Then we should see the dead link page
 * Example #3: And I should see the dead link page
 * Example #4: Then I should not see the dead link page
 * Example #5: And we should not see the dead link page
 *
 */
Then(/^(I |we )*should( not)* see the dead link page$/, async function (pronounCase, notCase) {
  const result = await waitForValue(async () => tidy(await this.page.title()), (title) => /dead link/i.test(title) !== Boolean(notCase), notCase ? 3000 : budget(this));
  if (!result.ok) {
    throw friendly({
      message: notCase ? 'Expected a page of the site, but the dead link page is showing.' : `Expected the dead link page, but the page is "${result.value}" (${this.page.url()}).`,
      hint: 'The dead link page has the title "Oops, you\'ve found a dead link."',
    });
  }
});

/**
 * Assert the version of the application the page reports (`meta
 * ajs-version-number`) starts with the given text, so a suite written for one
 * release line says so.
 *
 * Example #1: Then the application version should start with "11."
 * Example #2: Then the application version should start with "11.3"
 * Example #3: And the application version should start with "11.3.13"
 * Example #4: Then the application version should not start with "9."
 * Example #5: And the application version should not start with "10."
 *
 */
Then(/^the application version should( not)* start with "([^"]*)"$/, async function (notCase, prefix) {
  const version = await this.page.evaluate(() => {
    const meta = document.querySelector('meta[name="ajs-version-number"]');
    return meta ? meta.getAttribute('content') || '' : '';
  });
  if (!version) {
    throw friendly({ message: `The page (${this.page.url()}) does not report a version.`, hint: 'Open a page of the application first; the version is in the meta tag "ajs-version-number".' });
  }
  if (version.startsWith(prefix) === Boolean(notCase)) {
    throw friendly({ message: notCase ? `Expected a version that does not start with "${prefix}", but the application is ${version}.` : `Expected a version that starts with "${prefix}", but the application is ${version}.`, hint: 'The steps of this pack were written against the 11.3 long term support release.' });
  }
});
