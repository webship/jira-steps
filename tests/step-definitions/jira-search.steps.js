'use strict';

// Issue search and filter step definitions: the issue search page in its
// basic and advanced (query) modes, the two layouts of the results, the
// outcome of a search (results, none, an error), saving a search as a filter,
// opening and deleting filters.

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
  waitForValue,
  clearObstacles,
  safeClick,
  waitForDialog,
  submitDialog,
  searchOutcome,
  searchRows,
  findSearchRow,
  searchTotal,
  runJql,
  openIssue,
} = require('./jira-helpers');

/**
 * Make sure the issue search page is showing; open it when it is not.
 *
 * @param {object} world
 */
async function ensureSearchPage(world) {
  const page = world.page;
  if (!(await page.locator('.navigator-search').first().isVisible().catch(() => false))) {
    await open(world, '/issues/?jql=');
  }
  try {
    await page.locator('.navigator-search').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `The issue search did not show (${page.url()}).`, hint: 'Sign in first: a visitor is asked to sign in instead.' });
  }
  await clearObstacles(world);
}

/**
 * The mode of the issue search: `basic` or `advanced`.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function searchMode(world) {
  return (await world.page.locator('#advanced-search').first().isVisible().catch(() => false)) ? 'advanced' : 'basic';
}

/**
 * Switch the issue search to a mode with the switch at the end of the search
 * bar.
 *
 * @param {object} world
 * @param {'basic'|'advanced'} mode
 */
async function switchSearchMode(world, mode) {
  if ((await searchMode(world)) === mode) return;
  await safeClick(world, world.page.locator('.mode-switcher a.switcher-item.active').first());
  const marker = mode === 'advanced' ? '#advanced-search' : '#searcher-query';
  try {
    await world.page.locator(marker).first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `The issue search did not switch to the ${mode} mode.`, hint: 'A query that the basic mode cannot show keeps the search in the advanced mode.' });
  }
}

// ---------------------------------------------------------------------------
// Searching
// ---------------------------------------------------------------------------

/**
 * Run a query (JQL) in the issue search, the way a person does: open the
 * search, switch to the advanced mode, type the query and press Enter. The
 * step waits for the outcome: results, the "no issues" message or an error
 * under the query.
 *
 * Example #1: When I search for issues with the query "project = KAN ORDER BY key ASC"
 * Example #2: When I search for issues with the query "project = SCRUM AND type = Bug"
 * Example #3: When we search for issues with the query "assignee = currentUser() AND resolution = Unresolved"
 * Example #4: And I search for issues with the query "status = Done"
 * Example #5: When I search for issues with the query "projectt = KAN"
 *
 */
When(/^(I |we )*search for issues with the query "(.*)"$/, async function (pronounCase, jql) {
  await ensureSearchPage(this);
  await switchSearchMode(this, 'advanced');
  const box = this.page.locator('#advanced-search').first();
  await actOrExplain('run the query', jql, async () => {
    await box.fill(jql);
    await box.press('Enter');
  }, 'The query box of the advanced mode (#advanced-search) did not take the query.');
  await smartSettle(this.page, 3000);
  await searchOutcome(this);
});

/**
 * Open the issue search for a query by its address, as a saved link to a
 * search does (`/issues/?jql=...`). A query takes single or double quotes
 * around its texts.
 *
 * Example #1: Given I am on the issue search for "project = KAN ORDER BY key ASC"
 * Example #2: Given I am on the issue search for "project = SCRUM"
 * Example #3: Given we are on the issue search for "summary ~ 'release notes'"
 * Example #4: When I go to the issue search for "status = 'To Do'"
 * Example #5: When we go to the issue search for "reporter = currentUser()"
 *
 */
Given(/^(I am on|we are on|I go to|we go to) the issue search for "(.*)"$/, async function (pronounCase, jql) {
  await runJql(this, jql);
  await searchOutcome(this);
});

/**
 * Search in the basic mode of the issue search: type words into the "Contains
 * text" box and press Enter.
 *
 * Example #1: When I search for issues containing "release notes"
 * Example #2: When I search for issues containing "footer"
 * Example #3: When we search for issues containing "pipeline"
 * Example #4: And I search for issues containing "contact"
 * Example #5: When search for issues containing "nothing-like-this"
 *
 */
When(/^(I |we )*search for issues containing "([^"]*)"$/, async function (pronounCase, words) {
  await ensureSearchPage(this);
  await switchSearchMode(this, 'basic');
  const box = this.page.locator('#searcher-query').first();
  await actOrExplain('search for issues containing', words, async () => {
    await box.fill(words);
    await box.press('Enter');
  }, 'The "Contains text" box of the basic mode (#searcher-query) did not take the words.');
  await smartSettle(this.page, 3000);
  await searchOutcome(this);
});

/**
 * Switch the issue search between its basic mode (the criteria buttons) and
 * its advanced mode (the query box).
 *
 * Example #1: When I switch the issue search to the advanced mode
 * Example #2: When I switch the issue search to the basic mode
 * Example #3: When we switch the issue search to the advanced mode
 * Example #4: And I switch the issue search to the basic mode
 * Example #5: And we switch the issue search to the advanced mode
 *
 */
When(/^(I |we )*switch the issue search to the (basic|advanced) mode$/, async function (pronounCase, mode) {
  await ensureSearchPage(this);
  await switchSearchMode(this, mode);
});

/**
 * Assert the issue search is in the basic or in the advanced mode.
 *
 * Example #1: Then the issue search should be in the advanced mode
 * Example #2: Then the issue search should be in the basic mode
 * Example #3: And the issue search should be in the advanced mode
 * Example #4: And the issue search should be in the basic mode
 * Example #5: Then the issue search should not be in the basic mode
 *
 */
Then(/^the issue search should( not)* be in the (basic|advanced) mode$/, async function (notCase, mode) {
  const result = await waitForValue(() => searchMode(this), (now) => (now === mode) !== Boolean(notCase), budget(this));
  if (!result.ok) {
    throw friendly({ message: `Expected the issue search ${notCase ? 'not ' : ''}to be in the ${mode} mode, but it is in the ${result.value} mode.`, hint: 'The advanced mode shows the query box (#advanced-search), the basic mode the criteria buttons.' });
  }
});

/**
 * Switch the results of the issue search between the list view (a table) and
 * the detail view (a list next to the selected issue).
 *
 * Example #1: When I switch the search results to the list view
 * Example #2: When I switch the search results to the detail view
 * Example #3: When we switch the search results to the list view
 * Example #4: And I switch the search results to the detail view
 * Example #5: And we switch the search results to the list view
 *
 */
When(/^(I |we )*switch the search results to the (list|detail) view$/, async function (pronounCase, layout) {
  const page = this.page;
  await searchOutcome(this);
  const isList = async () => (await page.locator('#issuetable').count()) > 0;
  if ((await isList()) === (layout === 'list')) return;
  await safeClick(this, page.locator('#layout-switcher-button').first());
  const option = page.locator('#layout-switcher-options a').filter({ hasText: new RegExp(layout === 'list' ? 'List View' : 'Detail View', 'i') }).first();
  await actOrExplain('switch the search results to', `the ${layout} view`, async () => {
    await option.waitFor({ state: 'visible', timeout: budget(this) });
    await option.click();
    await page.locator(layout === 'list' ? '#issuetable tr.issuerow' : '.navigator-content .issue-list li[data-key]').first().waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The view switch (#layout-switcher-button) shows when the search has results.');
});

// ---------------------------------------------------------------------------
// The outcome of a search
// ---------------------------------------------------------------------------

/**
 * Assert the number of issues the search found (the total it reports, not
 * only the rows on the page).
 *
 * Example #1: Then the search should find 3 issues
 * Example #2: Then the search should find 1 issue
 * Example #3: Then the search should find 7 issues
 * Example #4: And the search should find 4 issues
 * Example #5: And the search should find 0 issues
 *
 */
Then(/^the search should find (\d+) issues?$/, async function (count) {
  const wanted = Number(count);
  const result = await waitForValue(() => searchTotal(this), (total) => total === wanted, budget(this));
  if (!result.ok) {
    const rows = await searchRows(this).catch(() => []);
    throw friendly({ message: `Expected the search to find ${wanted} issue(s), but it found ${result.value === undefined ? 'nothing readable' : result.value}${rows.length ? `: ${rows.map((row) => row.key).join(', ')}` : ''}.`, hint: 'The total is read from the count the search shows ("1 of 7", "Showing results 1-4 of 4").' });
  }
});

/**
 * Assert the search found at least the given number of issues.
 *
 * Example #1: Then the search should find at least 1 issue
 * Example #2: Then the search should find at least 3 issues
 * Example #3: And the search should find at least 2 issues
 * Example #4: And the search should find at least 7 issues
 * Example #5: Then the search should find at least 4 issues
 *
 */
Then(/^the search should find at least (\d+) issues?$/, async function (count) {
  const wanted = Number(count);
  const result = await waitForValue(() => searchTotal(this), (total) => total >= wanted, budget(this));
  if (!result.ok) {
    throw friendly({ message: `Expected the search to find at least ${wanted} issue(s), but it found ${result.value === undefined ? 'nothing readable' : result.value}.`, hint: 'The total is read from the count the search shows.' });
  }
});

/**
 * Assert the search found nothing and says so ("No issues were found to match
 * your search").
 *
 * Example #1: Then the search should find no issues
 * Example #2: And the search should find no issues
 * Example #3: Then the search should find no issue
 * Example #4: And the search should find no issue
 * Example #5: Then the search should find no issues at all
 *
 */
Then(/^the search should find no issues?( at all)?$/, async function (allCase) {
  const result = await waitForValue(() => searchOutcome(this), (outcome) => outcome === 'empty', budget(this));
  if (!result.ok) {
    const rows = await searchRows(this).catch(() => []);
    throw friendly({ message: `Expected the search to find no issues, but ${result.value === 'error' ? 'it reports an error' : `it shows: ${rows.map((row) => row.key).join(', ')}`}.`, hint: 'The empty outcome is the message "No issues were found to match your search".' });
  }
});

/**
 * Assert the results of the search list (or do not list) an issue, by its key
 * or by its exact summary.
 *
 * Example #1: Then I should see the issue "KAN-1" in the search results
 * Example #2: Then I should see the issue "Write the release notes" in the search results
 * Example #3: Then I should not see the issue "SCRUM-1" in the search results
 * Example #4: And we should see the issue "Broken link in the footer" in the search results
 * Example #5: And I should not see the issue "Review the style guide" in the search results
 *
 */
Then(/^(I |we )*should( not)* see the issue "([^"]*)" in the search results$/, async function (pronounCase, notCase, nameOrKey) {
  await searchOutcome(this);
  const result = await waitForValue(async () => {
    const rows = await searchRows(this);
    return { rows, listed: Boolean(await findSearchRow(this, rows, nameOrKey)) };
  }, (state) => state.listed !== Boolean(notCase), notCase ? 3000 : budget(this));
  if (!result.ok) {
    const shown = ((result.value && result.value.rows) || []).map((row) => (row.summary ? `${row.key} "${row.summary}"` : row.key)).join(', ');
    throw friendly({
      message: notCase ? `Expected the search results not to list "${nameOrKey}", but they do.` : `Expected the search results to list "${nameOrKey}". They list: ${shown || '(nothing)'}.`,
      hint: 'Only the rows on the page are read: narrow the query when the search has more than one page of results.',
    });
  }
});

/**
 * Assert the search reports an error with the given text under the query, as
 * for a field that does not exist.
 *
 * Example #1: Then I should see the search error "Field 'projectt' does not exist or you do not have permission to view it."
 * Example #2: Then I should see the search error "does not exist"
 * Example #3: Then we should see the search error "Error in the JQL Query"
 * Example #4: And I should see the search error "does not exist or you do not have permission"
 * Example #5: Then I should not see the search error "does not exist"
 *
 */
Then(/^(I |we )*should( not)* see the search error "([^"]*)"$/, async function (pronounCase, notCase, text) {
  const errors = this.page.locator('.navigator-search .aui-message-error, .navigator-group .aui-message-error').locator('visible=true');
  const wanted = errors.filter({ hasText: literal(text) });
  try {
    await wanted.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout: notCase ? 3000 : budget(this) });
  } catch {
    const shown = (await errors.allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    throw friendly({
      message: notCase ? `Expected no search error "${text}", but the search shows it.` : `Expected the search error "${text}". The search shows: ${shown.length ? shown.map((error) => `"${error}"`).join(' | ') : 'no error'}.`,
      hint: 'The error shows under the query box of the advanced mode.',
    });
  }
});

/**
 * Open an issue from the results of the search, by its key or by its exact
 * summary.
 *
 * Example #1: When I open the issue "KAN-2" from the search results
 * Example #2: When I open the issue "Write the release notes" from the search results
 * Example #3: When we open the issue "SCRUM-1" from the search results
 * Example #4: And I open the issue "Broken link in the footer" from the search results
 * Example #5: And we open the issue "KAN-3" from the search results
 *
 */
When(/^(I |we )*open the issue "([^"]*)" from the search results$/, async function (pronounCase, nameOrKey) {
  await searchOutcome(this);
  const rows = await searchRows(this);
  const row = await findSearchRow(this, rows, nameOrKey);
  if (!row) {
    throw friendly({ message: `The search results do not list "${nameOrKey}". They list: ${rows.map((entry) => `${entry.key} "${entry.summary}"`).join(', ') || '(nothing)'}.`, hint: 'Run a search that finds the issue first.' });
  }
  await openIssue(this, row.key);
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * The row of a filter in the "My" tab of the Manage Filters page, by the name
 * of the filter. The page is opened first.
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<import('playwright').Locator>}
 */
async function myFilterRow(world, name) {
  await open(world, '/secure/ManageFilters.jspa?filterView=my');
  await world.page.locator('#my-filters-tab, #mf_my_li').first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  await clearObstacles(world);
  return world.page.locator('tr[id^="mf_"]').filter({ has: world.page.locator('a[id^="filterlink_"]', { hasText: exactly(name) }) });
}

/**
 * Delete the filter of a row through its Operations menu and the confirmation
 * dialog.
 *
 * @param {object} world
 * @param {import('playwright').Locator} row
 * @param {string} name
 */
async function deleteFilterRow(world, row, name) {
  await actOrExplain('delete the filter', name, async () => {
    await safeClick(world, row.locator('button.aui-dropdown2-trigger').first());
    const item = row.locator('a[id^="delete_"]').first();
    await item.waitFor({ state: 'visible', timeout: budget(world) });
    await item.click();
    await waitForDialog(world, 'Delete this filter');
    await submitDialog(world);
    await row.first().waitFor({ state: 'hidden', timeout: budget(world) });
  }, 'The row of the filter has an "Operations" button with Edit and Delete for the owner of the filter.');
}

/**
 * Save the search on the page as a new filter with the given name: press
 * "Save as", type the name, press "Save" and wait for the search to carry the
 * name.
 *
 * Example #1: When I save the search as the filter "Open footer work"
 * Example #2: When I save the search as the filter "My Kanban issues"
 * Example #3: When we save the search as the filter "Bugs to fix"
 * Example #4: And I save the search as the filter "Release notes"
 * Example #5: And we save the search as the filter "Unassigned work"
 *
 */
When(/^(I |we )*save the search as the filter "([^"]*)"$/, async function (pronounCase, name) {
  const page = this.page;
  const button = page.locator('.save-as-new-filter').first();
  if (!(await button.waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    throw friendly({ message: `The issue search has no "Save as" button (${page.url()}).`, hint: 'Run a search first, signed in: a visitor cannot save filters.' });
  }
  await safeClick(this, button);
  await waitForDialog(this, 'Save filter');
  await page.locator('#save-filter-dialog #filterName').fill(name);
  await submitDialog(this);
  const title = page.locator('.search-title').first();
  const result = await waitForValue(async () => tidy(await title.innerText({ timeout: 2000 })), (text) => exactly(name).test(text), budget(this));
  if (!result.ok) {
    throw friendly({ message: `The filter "${name}" was saved but the search is titled "${result.value}".`, hint: 'Check the messages on the page.' });
  }
});

/**
 * Assert the search on the page is (or is not) the saved filter with the given
 * name: the title of the search is the name of the filter.
 *
 * Example #1: Then the search should be the filter "Sample open issues"
 * Example #2: Then the search should be the filter "Open footer work"
 * Example #3: And the search should be the filter "My Kanban issues"
 * Example #4: Then the search should not be the filter "Bugs to fix"
 * Example #5: And the search should not be the filter "Sample open issues"
 *
 */
Then(/^the search should( not)* be the filter "([^"]*)"$/, async function (notCase, name) {
  const title = this.page.locator('.search-title').first();
  const result = await waitForValue(async () => tidy(await title.innerText({ timeout: 2000 })), (text) => exactly(name).test(text) !== Boolean(notCase), budget(this));
  if (!result.ok) {
    throw friendly({ message: notCase ? `Expected the search not to be the filter "${name}", but it is.` : `Expected the search to be the filter "${name}", but its title is "${result.value || '(none)'}".`, hint: 'A search that is not saved is titled "Search".' });
  }
});

/**
 * Open a saved filter by its name: one of the favourite filters of the
 * account, or one of its own.
 *
 * Example #1: When I open the filter "Sample open issues"
 * Example #2: When I open the filter "Open footer work"
 * Example #3: When we open the filter "My Kanban issues"
 * Example #4: And I open the filter "Bugs to fix"
 * Example #5: Given I open the filter "Sample open issues"
 *
 */
When(/^(I |we )*open the filter "([^"]*)"$/, async function (pronounCase, name) {
  const page = this.page;
  let href = null;
  const seen = [];
  for (const view of ['favourites', 'my']) {
    await open(this, `/secure/ManageFilters.jspa?filterView=${view}`);
    const links = page.locator('a[id^="filterlink_"]');
    await page.locator('#fav-filters-tab').first().waitFor({ state: 'visible', timeout: budget(this) }).catch(() => {});
    seen.push(...(await links.allInnerTexts().catch(() => [])).map(tidy));
    const link = links.filter({ hasText: exactly(name) }).first();
    if (await link.count()) { href = await link.getAttribute('href', { timeout: 1500 }); break; }
  }
  if (!href) {
    throw friendly({ message: `The account has no filter "${name}" among its favourite and own filters: ${[...new Set(seen)].join(', ') || '(none)'}.`, hint: 'A filter of somebody else shows here once it is shared with the account and marked as a favourite.' });
  }
  await open(this, siteUrl(this, href));
  await clearObstacles(this);
  await searchOutcome(this);
});

/**
 * Assert the account owns (or does not own) a filter with the given name, on
 * the "My" tab of the Manage Filters page.
 *
 * Example #1: Then I should see the filter "Open footer work" in my filters
 * Example #2: Then I should not see the filter "Open footer work" in my filters
 * Example #3: Then we should see the filter "Bugs to fix" in our filters
 * Example #4: And I should see the filter "Sample open issues" in my filters
 * Example #5: And we should not see the filter "Release notes" in our filters
 *
 */
Then(/^(I |we )*should( not)* see the filter "([^"]*)" in (my|our) filters$/, async function (pronounCase, notCase, name, whoseCase) {
  const row = await myFilterRow(this, name);
  const found = await row.first().waitFor({ state: 'visible', timeout: notCase ? 2000 : budget(this) }).then(() => true).catch(() => false);
  if (found === Boolean(notCase)) {
    const owned = (await this.page.locator('a[id^="filterlink_"]').allInnerTexts().catch(() => [])).map(tidy);
    throw friendly({ message: notCase ? `Expected not to own a filter "${name}", but it is in the list.` : `Expected to own the filter "${name}". The account owns: ${owned.join(', ') || '(no filters)'}.`, hint: 'The "My" tab of Manage Filters lists the filters the signed-in account owns.' });
  }
});

/**
 * Delete a filter the account owns, by its name, through the Operations menu
 * of its row on the Manage Filters page and the confirmation dialog.
 *
 * Example #1: When I delete the filter "Open footer work"
 * Example #2: When I delete the filter "My Kanban issues"
 * Example #3: When we delete the filter "Bugs to fix"
 * Example #4: And I delete the filter "Release notes"
 * Example #5: And we delete the filter "Unassigned work"
 *
 */
When(/^(I |we )*delete the filter "([^"]*)"$/, async function (pronounCase, name) {
  const row = await myFilterRow(this, name);
  if (!(await row.first().waitFor({ state: 'visible', timeout: budget(this) }).then(() => true).catch(() => false))) {
    const owned = (await this.page.locator('a[id^="filterlink_"]').allInnerTexts().catch(() => [])).map(tidy);
    throw friendly({ message: `The account owns no filter "${name}". It owns: ${owned.join(', ') || '(no filters)'}.`, hint: 'Only the owner of a filter can delete it.' });
  }
  await deleteFilterRow(this, row.first(), name);
});

/**
 * Make sure the account owns no filter with the given name: each one is
 * deleted. Used at the start and the end of a scenario that saves a filter; it
 * does nothing when there is none.
 *
 * Example #1: Given the filter "Open footer work" is removed
 * Example #2: Given the filter "My Kanban issues" is removed
 * Example #3: And the filter "Bugs to fix" is removed
 * Example #4: Then the filter "Release notes" is removed
 * Example #5: And the filter "Unassigned work" is removed
 *
 */
Given(/^the filter "([^"]*)" is removed$/, async function (name) {
  for (let round = 0; round < 10; round++) {
    const row = await myFilterRow(this, name);
    if (!(await row.first().waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false))) return;
    await deleteFilterRow(this, row.first(), name);
  }
});
