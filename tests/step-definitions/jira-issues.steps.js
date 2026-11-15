'use strict';

// Issue step definitions: creating an issue through the Create dialog, opening
// an issue by key or by summary, the fields of the issue view, editing,
// moving through the workflow, commenting, assigning, the operations of the
// "More" menu and deleting.
//
// A step that names an issue takes its key ("SCRUM-12") or its summary: a
// summary is looked up for the signed-in account, newest first.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  literal,
  exactly,
  tidy,
  actOrExplain,
  assertPresence,
  waitForValue,
  clearObstacles,
  safeClick,
  messages,
  currentUser,
  dialog,
  waitForDialog,
  submitDialog,
  pickSuggestion,
  typeRichText,
  issueKeysBySummary,
  resolveIssueKey,
  openIssue,
  requireIssue,
  ISSUE_FIELDS,
  issueField,
  openMoreMenu,
  deleteShownIssue,
} = require('./jira-helpers');

/**
 * Open the Create dialog from the top navigation and wait for its form.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').Locator>}
 */
async function openCreateDialog(world) {
  const page = world.page;
  const button = page.locator('#header #create_link').first();
  if (!(await button.waitFor({ state: 'visible', timeout: budget(world) }).then(() => true).catch(() => false))) {
    throw friendly({ message: `The top navigation has no "Create" button (${page.url()}).`, hint: 'Sign in first, with an account that may create issues in at least one project.' });
  }
  await safeClick(world, button);
  const box = page.locator('#create-issue-dialog');
  await actOrExplain('open', 'the Create Issue dialog', async () => {
    await box.locator('#summary').waitFor({ state: 'visible', timeout: budget(world) });
  }, 'The "Create" button was pressed but the dialog with the Summary field did not show.');
  return box;
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------

/**
 * Open the Create dialog from the "Create" button of the top navigation.
 * Fill it with the field steps ("I pick ... in the "Project" field", "I fill
 * in the "Summary" field of the dialog with") and submit it with "I submit the
 * dialog".
 *
 * Example #1: When I open the create issue dialog
 * Example #2: When we open the create issue dialog
 * Example #3: And I open the create issue dialog
 * Example #4: Given I open the create issue dialog
 * Example #5: When open the create issue dialog
 *
 */
When(/^(I |we )*open the create issue dialog$/, async function (pronounCase) {
  await openCreateDialog(this);
});

/**
 * Create an issue in one step: open the Create dialog, pick the project (by
 * its name or key) and the issue type, type the summary, press "Create" and
 * wait for the flag that names the new issue. The key of the new issue is
 * remembered for "I open the issue I created".
 *
 * Example #1: When I create a "Task" issue in the "Scrum Sample" project with the summary "Check the footer links"
 * Example #2: When I create a "Bug" issue in the "Kanban Sample" project with the summary "Search box loses focus"
 * Example #3: When we create a "Story" issue in the "SCRUM" project with the summary "Export the report"
 * Example #4: And I create an "Epic" issue in the "Scrum Sample" project with the summary "Checkout"
 * Example #5: Given I create a "Task" issue in the "KAN" project with the summary "Tidy the board"
 *
 */
When(/^(I |we )*create (a|an) "([^"]*)" issue in the "([^"]*)" project with the summary "([^"]*)"$/, async function (pronounCase, articleCase, type, project, summary) {
  const page = this.page;
  const box = await openCreateDialog(this);
  await pickSuggestion(this, box.locator('#project-field'), project, 'Project');
  // Picking a project reloads the form: wait for the fields to be back.
  await box.locator('#issuetype-field').waitFor({ state: 'visible', timeout: budget(this) });
  await pickSuggestion(this, box.locator('#issuetype-field'), type, 'Issue Type');
  await box.locator('#summary').waitFor({ state: 'visible', timeout: budget(this) });
  await box.locator('#summary').fill(summary);
  await submitDialog(this);
  const flag = page.locator('.aui-message-success a.issue-created-key').first();
  try {
    await flag.waitFor({ state: 'visible', timeout: budget(this) });
    this.createdIssueKey = await flag.getAttribute('data-issue-key', { timeout: 1500 });
  } catch {
    // The flag may have closed already: find the issue by its summary.
    const keys = await issueKeysBySummary(this, summary);
    if (!keys.length) {
      throw friendly({ message: `The issue "${summary}" was submitted but no flag confirmed it and no issue with this summary is found.`, hint: 'Check the messages on the page; the account may lack the Create Issues permission in the project.' });
    }
    this.createdIssueKey = keys[0];
  }
});

/**
 * Open the issue the last "I create ... issue" step made.
 *
 * Example #1: When I open the issue I created
 * Example #2: When we open the issue we created
 * Example #3: And I open the issue I created
 * Example #4: Then I open the issue I created
 * Example #5: And we open the issue we created
 *
 */
When(/^(I |we )*open the issue (I|we) created$/, async function (pronounCase, whoCase) {
  if (!this.createdIssueKey) {
    throw friendly({ message: 'No issue was created in this scenario yet.', hint: 'Use "When I create a "Task" issue in the "..." project with the summary "..."" before this step.' });
  }
  await openIssue(this, this.createdIssueKey);
});

// ---------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------

/**
 * Open the page of an issue, by its key or by its exact summary.
 *
 * Example #1: When I open the issue "SCRUM-1"
 * Example #2: Given I open the issue "KAN-2"
 * Example #3: When we open the issue "Write the release notes"
 * Example #4: And I open the issue "Broken link in the footer"
 * Example #5: Given I am on the issue "SCRUM-1"
 *
 */
When(/^(I open|we open|I am on|we are on) the issue "([^"]*)"$/, async function (pronounCase, nameOrKey) {
  await openIssue(this, await resolveIssueKey(this, nameOrKey));
});

/**
 * Assert an issue is (or is not) there for the signed-in account, by key or by
 * exact summary: a deleted issue, and one the account may not browse, are not
 * there.
 *
 * Example #1: Then the issue "Check the footer links" should exist
 * Example #2: Then the issue "Check the footer links" should not exist
 * Example #3: Then the issue "SCRUM-1" should exist
 * Example #4: And the issue "NOPE-1" should not exist
 * Example #5: And the issue "Write the release notes" should exist
 *
 */
Then(/^the issue "([^"]*)" should( not)* exist$/, async function (nameOrKey, notCase) {
  const lookup = async () => {
    if (/^[A-Z][A-Z0-9_]*-\d+$/.test(nameOrKey.trim())) {
      const response = await this.page.request.get(new URL('/rest/api/2/issue/' + encodeURIComponent(nameOrKey.trim()) + '?fields=summary', this.launchUrl).toString());
      return response.ok();
    }
    return (await issueKeysBySummary(this, nameOrKey)).length > 0;
  };
  const result = await waitForValue(lookup, (found) => found !== Boolean(notCase), 5000);
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected no issue "${nameOrKey}", but there is one.` : `Expected the issue "${nameOrKey}" to exist, but the account "${await currentUser(this)}" finds none.`,
      hint: 'A summary is compared in full. The lookup uses the session of the browser, so it sees what the signed-in account may browse.',
    });
  }
});

/**
 * Assert the page says the issue cannot be viewed, as for a deleted issue or
 * one the account may not browse ("You can't view this issue").
 *
 * Example #1: Then I should see that the issue cannot be viewed
 * Example #2: Then we should see that the issue cannot be viewed
 * Example #3: And I should see that the issue cannot be viewed
 * Example #4: Then I should not see that the issue cannot be viewed
 * Example #5: And we should not see that the issue cannot be viewed
 *
 */
Then(/^(I |we )*should( not)* see that the issue cannot be viewed$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('.issue-error'), notCase, {
    label: 'the "You can\'t view this issue" page',
    hint: 'Open the address of an issue with webship-js: When I go to "/browse/KEY-1".',
    timeout: notCase ? 3000 : budget(this),
  });
});

// ---------------------------------------------------------------------------
// The issue view
// ---------------------------------------------------------------------------

/**
 * Assert a field of the issue on the page is (or is not) the given text. The
 * fields are key, summary, project, type, status, priority, resolution,
 * assignee, reporter, labels and description.
 *
 * Example #1: Then the issue status should be "To Do"
 * Example #2: Then the issue summary should be "Write the release notes"
 * Example #3: Then the issue assignee should be "Alex Tester"
 * Example #4: And the issue type should not be "Bug"
 * Example #5: And the issue resolution should be "Unresolved"
 *
 */
Then(/^the issue (key|summary|project|type|status|priority|resolution|assignee|reporter|labels|description) should( not)* be "([^"]*)"$/, async function (field, notCase, expected) {
  await requireIssue(this);
  const result = await waitForValue(() => issueField(this, field), (text) => exactly(expected).test(text) !== Boolean(notCase), budget(this));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the issue ${field} not to be "${expected}", but it is.` : `Expected the issue ${field} to be "${expected}", but it is "${result.value === undefined ? '(not shown)' : result.value}".`,
      hint: `The ${field} is read from the issue view (${ISSUE_FIELDS[field]}).`,
    });
  }
});

/**
 * Assert a field of the issue on the page contains (or does not contain) the
 * given text.
 *
 * Example #1: Then the issue description should contain "Seeded by the site build script"
 * Example #2: Then the issue key should contain "SCRUM-"
 * Example #3: Then the issue summary should contain "release notes"
 * Example #4: And the issue description should not contain "secret"
 * Example #5: And the issue assignee should contain "Alex"
 *
 */
Then(/^the issue (key|summary|project|type|status|priority|resolution|assignee|reporter|labels|description) should( not)* contain "([^"]*)"$/, async function (field, notCase, expected) {
  await requireIssue(this);
  const result = await waitForValue(() => issueField(this, field), (text) => text.includes(expected) !== Boolean(notCase), budget(this));
  if (!result.ok) {
    throw friendly({
      message: notCase ? `Expected the issue ${field} not to contain "${expected}", but it is "${result.value}".` : `Expected the issue ${field} to contain "${expected}", but it is "${result.value === undefined ? '(not shown)' : result.value}".`,
      hint: `The ${field} is read from the issue view (${ISSUE_FIELDS[field]}).`,
    });
  }
});

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

/**
 * Open the Edit dialog of the issue on the page. Change its fields with the
 * field steps and save with "I submit the dialog".
 *
 * Example #1: When I open the edit issue dialog
 * Example #2: When we open the edit issue dialog
 * Example #3: And I open the edit issue dialog
 * Example #4: Given I open the edit issue dialog
 * Example #5: When open the edit issue dialog
 *
 */
When(/^(I |we )*open the edit issue dialog$/, async function (pronounCase) {
  await requireIssue(this);
  const button = this.page.locator('#edit-issue').first();
  if (!(await button.isVisible().catch(() => false))) {
    throw friendly({ message: `The issue has no "Edit" operation for the account "${await currentUser(this)}".`, hint: 'Editing needs the Edit Issues permission of the project.' });
  }
  await safeClick(this, button);
  await actOrExplain('open', 'the Edit Issue dialog', async () => {
    await this.page.locator('#edit-issue-dialog #summary').waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The "Edit" button was pressed but the dialog did not show.');
});

/**
 * Change the summary or the description of the issue on the page through the
 * Edit dialog: open it, replace the text, press "Update" and wait for the
 * issue view to show the change.
 *
 * Example #1: When I change the issue summary to "Check every footer link"
 * Example #2: When I change the issue description to "The footer has four links."
 * Example #3: When we change the issue summary to "Export the report as PDF"
 * Example #4: And I change the issue description to "Updated by the suite"
 * Example #5: And we change the issue summary to "Tidy the Kanban board"
 *
 */
When(/^(I |we )*change the issue (summary|description) to "([^"]*)"$/, async function (pronounCase, field, text) {
  await requireIssue(this);
  const page = this.page;
  await safeClick(this, page.locator('#edit-issue').first());
  const box = page.locator('#edit-issue-dialog');
  await actOrExplain('open', 'the Edit Issue dialog', async () => {
    await box.locator('#summary').waitFor({ state: 'visible', timeout: budget(this) });
  }, 'The issue has no "Edit" operation for this account, or the dialog did not show.');
  if (field === 'summary') await box.locator('#summary').fill(text);
  else await typeRichText(this, box, 'description', text);
  await submitDialog(this);
  const result = await waitForValue(() => issueField(this, field), (shown) => shown === tidy(text), budget(this));
  if (!result.ok) {
    throw friendly({ message: `The issue ${field} was saved as "${text}" but the issue view shows "${result.value}".`, hint: 'Check the messages on the page for a reason.' });
  }
});

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

/**
 * The transitions the workflow button of the issue offers, by their text.
 *
 * @param {object} world
 * @returns {Promise<{menu: import('playwright').Locator, transitions: Array<{name: string, status: string}>, names: string[]}>}
 */
async function openTransitions(world) {
  const page = world.page;
  const trigger = page.locator('#opsbar-transitions_more').first();
  if (!(await trigger.isVisible().catch(() => false))) {
    throw friendly({ message: `The issue has no workflow button for the account "${await currentUser(world)}".`, hint: 'Moving an issue needs the Transition Issues permission of the project.' });
  }
  const menu = page.locator('#opsbar-transitions_more_drop');
  if (!(await menu.isVisible().catch(() => false))) {
    await safeClick(world, trigger);
    await menu.waitFor({ state: 'visible', timeout: budget(world) });
  }
  // An item reads "<transition> → <status>": the name of the transition is its first cell, the status its lozenge.
  const transitions = await menu.locator('.issueaction-workflow-transition').evaluateAll((items) => items.map((item) => {
    const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    const cells = item.querySelectorAll('.transition-label .workflow-cell');
    const lozenge = item.querySelector('.jira-issue-status-lozenge');
    return { name: clean(cells.length ? cells[0].textContent : item.textContent), status: clean(lozenge ? lozenge.textContent : '') };
  }));
  return { menu, transitions, names: transitions.map((transition) => transition.name).filter(Boolean) };
}

/**
 * Move the issue on the page through its workflow: open the workflow button
 * (it shows the current status) and choose the transition by its name, or by
 * the name of the status it leads to (in the default workflows the two are
 * the same). Waits for the status of the issue to change.
 *
 * Example #1: When I move the issue to "In Progress"
 * Example #2: When I move the issue to "Done"
 * Example #3: When we move the issue to "To Do"
 * Example #4: And I move the issue to "Selected for Development"
 * Example #5: And we move the issue to "Backlog"
 *
 */
When(/^(I |we )*move the issue to "([^"]*)"$/, async function (pronounCase, name) {
  const key = await requireIssue(this);
  const before = await issueField(this, 'status');
  const { menu, transitions, names } = await openTransitions(this);
  let index = transitions.findIndex((transition) => exactly(name).test(transition.name));
  if (index < 0) index = transitions.findIndex((transition) => exactly(name).test(transition.status));
  const item = menu.locator('.issueaction-workflow-transition').nth(Math.max(index, 0));
  if (index < 0) {
    await this.page.keyboard.press('Escape').catch(() => {});
    throw friendly({ message: `The issue ${key} (status "${before}") offers no "${name}" transition. It offers: ${names.join(', ') || '(none)'}.`, hint: 'The transitions depend on the workflow of the project and on the current status.' });
  }
  await item.click();
  // A transition with a screen opens a dialog: submit it as it is.
  const withScreen = await dialog(this).waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
  if (withScreen) await submitDialog(this);
  const result = await waitForValue(() => issueField(this, 'status'), (status) => status !== before, budget(this));
  if (!result.ok) {
    throw friendly({ message: `The "${name}" transition was chosen but the status of ${key} is still "${before}".`, hint: 'Check the messages on the page: a condition or a validator of the workflow may have refused the transition.' });
  }
  await smartSettle(this.page, 2000);
});

/**
 * Assert the workflow button of the issue offers (or does not offer) a
 * transition. The menu is opened to look, and closed again.
 *
 * Example #1: Then the issue should offer the "In Progress" transition
 * Example #2: Then the issue should offer the "Done" transition
 * Example #3: Then the issue should not offer the "To Do" transition
 * Example #4: And the issue should offer the "Selected for Development" transition
 * Example #5: And the issue should not offer the "Reopen" transition
 *
 */
Then(/^the issue should( not)* offer the "([^"]*)" transition$/, async function (notCase, name) {
  await requireIssue(this);
  const { names } = await openTransitions(this);
  await this.page.keyboard.press('Escape').catch(() => {});
  const offered = names.some((text) => exactly(name).test(text));
  if (offered === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the issue not to offer the "${name}" transition, but it does.` : `Expected the issue to offer the "${name}" transition. It offers: ${names.join(', ') || '(none)'}.`,
      hint: 'The transitions depend on the workflow of the project and on the current status.',
    });
  }
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * The comments of the issue on the page with the given text.
 *
 * @param {object} world
 * @param {string} text
 * @returns {import('playwright').Locator}
 */
function comments(world, text) {
  return world.page.locator('.activity-comment').filter({ has: world.page.locator('.action-body', { hasText: literal(text) }) });
}

/**
 * Add a comment to the issue on the page: press "Add comment", type the text
 * into the editor, press "Add" and wait for the comment to show.
 *
 * Example #1: When I comment "Checked on the staging site." on the issue
 * Example #2: When I comment "Needs a second look" on the issue
 * Example #3: When we comment "Done in the last release" on the issue
 * Example #4: And I comment "Waiting for the design" on the issue
 * Example #5: And we comment "Thanks!" on the issue
 *
 */
When(/^(I |we )*comment "([^"]*)" on the issue$/, async function (pronounCase, text) {
  await requireIssue(this);
  const page = this.page;
  const form = page.locator('#issue-comment-add');
  if (!(await form.locator('#comment').isVisible().catch(() => false))) {
    const button = page.locator('#comment-issue, #footer-comment-button').locator('visible=true').first();
    if (!(await button.isVisible().catch(() => false))) {
      throw friendly({ message: `The issue has no "Add comment" operation for the account "${await currentUser(this)}".`, hint: 'Commenting needs the Add Comments permission of the project.' });
    }
    await safeClick(this, button);
  }
  await actOrExplain('type the comment', text, async () => {
    await typeRichText(this, form, 'comment', text);
    await form.locator('#issue-comment-add-submit').click({ timeout: budget(this) });
  }, 'The comment form (#issue-comment-add) did not take the text: its "Add" button stays disabled until something is typed.');
  await assertPresence(comments(this, text), null, {
    label: `the comment "${text}"`,
    hint: 'The comment was submitted but does not show in the Activity section; check the messages on the page.',
    timeout: budget(this),
  });
});

/**
 * Assert the issue on the page has (or has not) a comment with the given
 * text.
 *
 * Example #1: Then I should see the comment "Checked on the staging site." on the issue
 * Example #2: Then I should not see the comment "Checked on the staging site." on the issue
 * Example #3: Then we should see the comment "Needs a second look" on the issue
 * Example #4: And I should see the comment "Thanks!" on the issue
 * Example #5: And we should not see the comment "Waiting for the design" on the issue
 *
 */
Then(/^(I |we )*should( not)* see the comment "([^"]*)" on the issue$/, async function (pronounCase, notCase, text) {
  await requireIssue(this);
  await assertPresence(comments(this, text), notCase, {
    label: `the comment "${text}"`,
    hint: 'Comments show in the Activity section of the issue (All or Comments tab).',
    timeout: notCase ? 3000 : budget(this),
  });
});

/**
 * Assert the comment with the given text was written by the person with the
 * given display name.
 *
 * Example #1: Then the comment "Checked on the staging site." should be by "Alex Tester"
 * Example #2: Then the comment "Needs a second look" should be by "Sam Reporter"
 * Example #3: And the comment "Thanks!" should be by "Site Administrator"
 * Example #4: Then the comment "Checked on the staging site." should not be by "Sam Reporter"
 * Example #5: And the comment "Done in the last release" should not be by "Alex Tester"
 *
 */
Then(/^the comment "([^"]*)" should( not)* be by "([^"]*)"$/, async function (text, notCase, author) {
  const comment = comments(this, text).first();
  await assertPresence(comment, null, { label: `the comment "${text}"`, hint: 'Add the comment first, or open the issue that has it.', timeout: budget(this) });
  const by = tidy(await comment.locator('a[id^="commentauthor_"]').first().innerText({ timeout: 1500 }).catch(() => ''));
  if (exactly(author).test(by) === Boolean(notCase)) {
    throw friendly({ message: notCase ? `Expected the comment "${text}" not to be by "${author}", but it is.` : `Expected the comment "${text}" to be by "${author}", but it is by "${by}".`, hint: 'The author is the name in the heading of the comment.' });
  }
});

/**
 * Delete the comment with the given text from the issue on the page, through
 * its "Delete" action and the confirmation dialog. An account deletes its own
 * comments; deleting the comments of others needs a permission.
 *
 * Example #1: When I delete the comment "Checked on the staging site." from the issue
 * Example #2: When I delete the comment "Needs a second look" from the issue
 * Example #3: When we delete the comment "Thanks!" from the issue
 * Example #4: And I delete the comment "Waiting for the design" from the issue
 * Example #5: And we delete the comment "Done in the last release" from the issue
 *
 */
When(/^(I |we )*delete the comment "([^"]*)" from the issue$/, async function (pronounCase, text) {
  const comment = comments(this, text).first();
  await assertPresence(comment, null, { label: `the comment "${text}"`, hint: 'Open the issue that has the comment first.', timeout: budget(this) });
  await clearObstacles(this);
  await comment.scrollIntoViewIfNeeded();
  await comment.hover();
  const action = comment.locator('a.delete-comment').first();
  if (!(await action.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false))) {
    throw friendly({ message: `The comment "${text}" has no "Delete" action for the account "${await currentUser(this)}".`, hint: 'An account may delete its own comments (Delete Own Comments); deleting the comments of others needs Delete All Comments.' });
  }
  await action.click();
  await waitForDialog(this, 'Delete Comment');
  await submitDialog(this);
  await assertPresence(comments(this, text), 'not', { label: `the comment "${text}"`, hint: 'The comment was confirmed for deletion but still shows.', timeout: budget(this) });
});

// ---------------------------------------------------------------------------
// Assigning
// ---------------------------------------------------------------------------

/**
 * Assign the issue on the page to a person through the Assign dialog: the
 * person is typed (display name or username) and picked from the suggestions.
 *
 * Example #1: When I assign the issue to "Sam Reporter"
 * Example #2: When I assign the issue to "Alex Tester"
 * Example #3: When we assign the issue to "sam"
 * Example #4: And I assign the issue to "Site Administrator"
 * Example #5: And we assign the issue to "alex"
 *
 */
When(/^(I |we )*assign the issue to "([^"]*)"$/, async function (pronounCase, person) {
  const key = await requireIssue(this);
  const page = this.page;
  const button = page.locator('#assign-issue').first();
  if (!(await button.isVisible().catch(() => false))) {
    throw friendly({ message: `The issue ${key} has no "Assign" operation for the account "${await currentUser(this)}".`, hint: 'Assigning needs the Assign Issues permission of the project.' });
  }
  const before = await issueField(this, 'assignee').catch(() => '');
  await safeClick(this, button);
  await waitForDialog(this, 'Assign');
  await pickSuggestion(this, page.locator('#assign-dialog #assignee-field'), person, 'Assignee');
  await submitDialog(this);
  await waitForValue(() => issueField(this, 'assignee'), (name) => name !== before, 5000);
});

/**
 * Assign the issue on the page to the signed-in account with the "Assign to
 * me" link of the People section.
 *
 * Example #1: When I assign the issue to me
 * Example #2: When we assign the issue to us
 * Example #3: And I assign the issue to me
 * Example #4: When I assign the issue to myself
 * Example #5: And I assign the issue to myself
 *
 */
When(/^(I |we )*assign the issue to (me|us|myself)$/, async function (pronounCase, whoCase) {
  const key = await requireIssue(this);
  const link = this.page.locator('#assign-to-me').first();
  if (!(await link.isVisible().catch(() => false))) {
    throw friendly({ message: `The issue ${key} has no "Assign to me" link.`, hint: 'The link shows in the People section when the issue is not yet assigned to the signed-in account, and the account may be assigned issues.' });
  }
  await safeClick(this, link);
  await link.waitFor({ state: 'hidden', timeout: budget(this) }).catch(() => {});
  await smartSettle(this.page, 2000);
});

// ---------------------------------------------------------------------------
// Operations and deleting
// ---------------------------------------------------------------------------

/**
 * Assert the issue on the page offers (or does not offer) an operation, by
 * its text: the buttons of the issue (Edit, Add comment, Assign) and the items
 * of the "More" menu (Log work, Clone, Move, Delete, ...). What an account is
 * offered follows from its permissions.
 *
 * Example #1: Then the issue should offer the "Delete" operation
 * Example #2: Then the issue should not offer the "Delete" operation
 * Example #3: Then the issue should offer the "Edit" operation
 * Example #4: And the issue should offer the "Clone" operation
 * Example #5: And the issue should not offer the "Move" operation
 *
 */
Then(/^the issue should( not)* offer the "([^"]*)" operation$/, async function (notCase, name) {
  await requireIssue(this);
  const page = this.page;
  const buttons = (await page.locator('#opsbar-edit-issue_container a.aui-button, #opsbar-comment-issue_container a.aui-button, #opsbar-assign-issue_container a.aui-button, .command-bar .toolbar-trigger').allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
  const menu = await openMoreMenu(this);
  const items = (await menu.locator('aui-item-link').allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
  await page.keyboard.press('Escape').catch(() => {});
  const all = [...new Set([...buttons, ...items])];
  const offered = all.some((text) => exactly(name).test(text));
  if (offered === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the issue not to offer "${name}" to the account "${await currentUser(this)}", but it does.` : `Expected the issue to offer "${name}" to the account "${await currentUser(this)}". It offers: ${all.join(', ') || '(nothing)'}.`,
      hint: 'The operations follow from the permissions of the account in the project.',
    });
  }
});

/**
 * Delete the issue on the page through More → Delete and the confirmation
 * dialog. It needs the Delete Issues permission (in the default permission
 * scheme: the administrators of the project).
 *
 * Example #1: When I delete the issue
 * Example #2: When we delete the issue
 * Example #3: And I delete the issue
 * Example #4: When I delete the issue on the page
 * Example #5: And we delete the issue on the page
 *
 */
When(/^(I |we )*delete the issue( on the page)?$/, async function (pronounCase, pageCase) {
  await deleteShownIssue(this);
});

/**
 * Make sure no issue with the given summary is left: every issue with exactly
 * this summary is opened and deleted through More → Delete. Used at the start
 * and the end of a scenario that creates an issue, so a run that failed does
 * not stop the next one. The signed-in account needs the Delete Issues
 * permission; it does nothing when there is no such issue.
 *
 * Example #1: Given the issue "Check the footer links" is removed
 * Example #2: Given the issue "Search box loses focus" is removed
 * Example #3: And the issue "Export the report" is removed
 * Example #4: Then the issue "Tidy the board" is removed
 * Example #5: And the issue "Checkout" is removed
 *
 */
Given(/^the issue "([^"]*)" is removed$/, async function (summary) {
  for (let round = 0; round < 20; round++) {
    const keys = await issueKeysBySummary(this, summary);
    if (!keys.length) return;
    await openIssue(this, keys[0]);
    await deleteShownIssue(this);
    const gone = await waitForValue(async () => (await issueKeysBySummary(this, summary)).includes(keys[0]), (still) => !still, budget(this));
    if (!gone.ok) {
      throw friendly({ message: `The issue ${keys[0]} ("${summary}") was confirmed for deletion but is still there.`, hint: 'Check the messages on the page.' });
    }
  }
  throw friendly({ message: `More than 20 issues have the summary "${summary}": stopped removing them.`, hint: 'Remove them with a bulk change, then run the suite again.' });
});
