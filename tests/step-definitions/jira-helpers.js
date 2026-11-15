'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the steps use and that downstream packs can require instead of
// copying: the wait budget, presence assertions with friendly errors, URL
// building, the users registry, the things that sit on top of a page (flags and
// help tips), dialogs, the single-select fields, the rich text fields, the
// issue search and the boards.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`,
// `friendly`) so the steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least
 * 10 seconds, so a slow page does not fail an assertion that would pass a moment
 * later. Kept below webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/**
 * Whether an optional step argument was supplied.
 *
 * @param {*} value
 * @returns {boolean}
 */
function supplied(value) {
  return value !== undefined && value !== null;
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A case-sensitive RegExp that matches the literal text anywhere.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function literal(text) {
  return new RegExp(escapeRegExp(text));
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space and case),
 * for exact titles, names and labels.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + escapeRegExp(text) + '\\s*$', 'i');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function tidy(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass
 * through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * Open a URL and wait for the page to settle.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  await gotoUrl(world.page, siteUrl(world, url));
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target,
 * cause and a hint) instead of Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match
 * and fail with a friendly error otherwise: the wait and the assertion are one
 * call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number, state?: string}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout, state = 'visible' }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : state, timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * Poll a reader until its value satisfies a test, and return the last value
 * read. The steps that compare a text use it so a value that changes a moment
 * after the action (a status after a transition) still passes.
 *
 * @param {Function} read - async () => value
 * @param {Function} test - (value) => boolean
 * @param {number} timeout
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function waitForValue(read, test, timeout) {
  const deadline = Date.now() + timeout;
  let value;
  for (;;) {
    try { value = await read(); } catch { value = undefined; }
    if (value !== undefined && test(value)) return { ok: true, value };
    if (Date.now() >= deadline) return { ok: false, value };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string, name: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The account "${handle}" is not in the users registry. Known accounts: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '...', password: process.env.JIRA_${handle.toUpperCase()}_PASSWORD } }. The account itself is created once by the site build or by an administrator, never by a feature.`,
    });
  }
  const username = entry.username || handle;
  const password = typeof entry === 'string' ? entry : entry.password;
  if (!password) {
    throw friendly({
      message: `The account "${handle}" has no password in the users registry.`,
      hint: `Set worldParameters.users.${handle}.password in cucumber.js, from an environment variable.`,
    });
  }
  return { username, password, name: entry.name || '' };
}

// ---------------------------------------------------------------------------
// What sits on top of a page: flags and help tips
// ---------------------------------------------------------------------------

/**
 * Close what the application lays over a page and that takes the clicks meant
 * for the page: help tips (`.jira-help-tip`, "OK, got it") and flags (the
 * notices in the top right corner, `#aui-flag-container .aui-flag`). Closing a
 * help tip is remembered for the account.
 *
 * @param {object} world
 * @returns {Promise<number>} how many things were closed
 */
async function clearObstacles(world) {
  const page = world.page;
  // Flags are stacked: only the one on top can be clicked with the pointer, so
  // their close buttons are pressed in the page, all at once.
  const closed = await page.evaluate(() => {
    const visible = (element) => !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    const buttons = [
      ...document.querySelectorAll('.jira-help-tip .helptip-close'),
      ...document.querySelectorAll('#aui-flag-container .aui-flag[aria-hidden="false"] .aui-close-button'),
    ].filter(visible);
    buttons.forEach((button) => button.click());
    return buttons.length;
  }).catch(() => 0);
  if (closed) {
    await page.locator('.jira-help-tip:visible, #aui-flag-container .aui-flag[aria-hidden="false"]').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  }
  return closed;
}

/**
 * Click the way a person does: when a flag or a help tip covers the target,
 * close it first, then click.
 *
 * @param {object} world
 * @param {import('playwright').Locator} locator
 * @param {object} [options] - Playwright click options
 */
async function safeClick(world, locator, options = {}) {
  const timeout = options.timeout || budget(world);
  await locator.waitFor({ state: 'visible', timeout });
  try {
    await locator.click({ ...options, trial: true, timeout: 1500 });
  } catch (err) {
    if (/intercepts pointer events/.test(String(err && err.message))) await clearObstacles(world);
  }
  await locator.click({ ...options, timeout });
}

// The classes of the messages, by the word a step uses.
const MESSAGE_TYPES = { success: 'success', error: 'error', warning: 'warning', info: 'info', information: 'info' };

/**
 * The visible messages of the page: the flags in the top right corner and the
 * messages inside the page or a dialog (`.aui-message`), optionally of one
 * type and containing some text.
 *
 * @param {object} world
 * @param {string} [type] success, error, warning or info
 * @param {string} [text]
 * @returns {import('playwright').Locator}
 */
function messages(world, type, text) {
  const key = type ? MESSAGE_TYPES[String(type).toLowerCase()] : null;
  let locator = world.page.locator(key ? `.aui-message.aui-message-${key}` : '.aui-message');
  if (supplied(text) && text !== '') locator = locator.filter({ hasText: literal(text) });
  return locator.locator('visible=true');
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

// The sessions of the accounts that signed in during the run, by site and
// handle: the cookies of the browser right after the sign-in. "I am signed in
// as" puts them back instead of going through the sign-in form again, which is
// what makes switching accounts inside a scenario quick. A session that was
// ended (by "I sign out") is noticed and replaced by a new sign-in.
const sessions = new Map();

/**
 * The username of the account whose session the browser holds, asked from the
 * site itself (`/rest/api/2/myself` with the cookies of the browser); an empty
 * string for a visitor.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function currentUser(world) {
  try {
    const response = await world.page.request.get(siteUrl(world, '/rest/api/2/myself'), { headers: { Accept: 'application/json' }, timeout: 10000 });
    if (!response.ok()) return '';
    const data = await response.json();
    return (data && data.name) || '';
  } catch {
    return '';
  }
}

/**
 * Whether the page is showing a page of the site (and not the blank page a
 * scenario starts with).
 *
 * @param {object} world
 * @returns {boolean}
 */
function onSite(world) {
  return world.page.url().startsWith(siteRoot(world));
}

/**
 * Open the dashboard and wait for the top navigation only: the landing page
 * after a change of session, so the page on screen belongs to the session.
 *
 * @param {object} world
 */
async function land(world) {
  await gotoUrl(world.page, siteUrl(world, '/secure/Dashboard.jspa'));
  await world.page.locator('#header').first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
}

/**
 * End the session of the browser by dropping its cookies. The page on screen
 * is replaced when it belonged to the session. The session stays valid on the
 * site, so "I am signed in as" can take it up again; "I sign out" is the step
 * that ends a session through the screens.
 *
 * @param {object} world
 */
async function signOut(world) {
  const wasOnSite = onSite(world);
  await dropSession(world);
  if (wasOnSite) await land(world);
}

/**
 * Drop the cookies of the browser. The page is emptied first: a page of the
 * site keeps asking the site for news, and the answer to a request sent
 * without cookies would bring a new, anonymous session cookie that replaces
 * the one put back a moment later.
 *
 * @param {object} world
 */
async function dropSession(world) {
  if (world.page.url() !== 'about:blank') await world.page.goto('about:blank').catch(() => {});
  await world.context.clearCookies();
}

/**
 * The username the page on screen was drawn for (`meta ajs-remote-user`); an
 * empty string for a visitor.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function pageUser(world) {
  return world.page.evaluate(() => {
    const meta = document.querySelector('meta[name="ajs-remote-user"]');
    return meta ? meta.getAttribute('content') || '' : '';
  }).catch(() => '');
}

/**
 * Fill and submit the sign-in form with a username and a password. The form is
 * drawn by a script after the page loads, so its fields are waited for.
 *
 * @param {object} world
 * @param {string} username
 * @param {string} password
 */
async function submitSignIn(world, username, password) {
  const page = world.page;
  if (!/\/login\.jsp/.test(page.url()) || !(await page.locator('#login-form').count())) await open(world, '/login.jsp');
  await actOrExplain('fill in the sign-in form for', username, async () => {
    await page.locator('#username-field').waitFor({ state: 'visible', timeout: budget(world) });
    await page.locator('#username-field').fill(username);
    await page.locator('#password-field').fill(password);
    await page.locator('#login-button').click();
  }, 'The sign-in form (#username-field, #password-field, #login-button) did not show at /login.jsp. A site behind single sign-on has no such form, and an account that is already signed in is sent to its home page instead.');
}

/**
 * Sign in with an account of the users registry and make sure the session is
 * that account's. An account that is already signed in is left as it is; an
 * account that signed in earlier in the run gets its session back; otherwise
 * the account goes through the sign-in form.
 *
 * @param {object} world
 * @param {string} handle
 */
async function signInAs(world, handle) {
  const user = resolveUser(world, handle);
  const page = world.page;
  const key = siteRoot(world) + '|' + handle;
  if ((await currentUser(world)) === user.username) {
    if (!onSite(world)) await land(world);
    return;
  }
  await dropSession(world);
  const saved = sessions.get(key);
  if (saved) {
    await world.context.addCookies(saved);
    if ((await currentUser(world)) === user.username) {
      await land(world);
      // The page must have been drawn for the account, not only the session be its own.
      if ((await pageUser(world)) === user.username) {
        await clearObstacles(world);
        return;
      }
    }
    sessions.delete(key);
    await dropSession(world);
  }
  await submitSignIn(world, user.username, user.password);
  const result = await waitForValue(() => currentUser(world), (name) => name === user.username, budget(world));
  if (!result.ok) {
    const error = tidy(await page.locator('#login-message').first().innerText({ timeout: 1500 }).catch(() => ''));
    throw friendly({
      message: `Signing in as "${handle}" (username "${user.username}") did not work${error ? `: the form says "${error}"` : `; the page is ${page.url()}`}.`,
      hint: 'Check the username and password of this account in worldParameters.users of cucumber.js, and that the account exists on the site and may sign in (application access, licence seats).',
    });
  }
  await page.waitForURL((url) => !/\/login\.jsp/.test(url.toString()), { timeout: budget(world) }).catch(() => {});
  await page.locator('#header').first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  sessions.set(key, await world.context.cookies());
  await clearObstacles(world);
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

/**
 * The dialog that is open (the last one when a dialog opened another).
 *
 * @param {object} world
 * @returns {import('playwright').Locator}
 */
function dialog(world) {
  return world.page.locator('section[role="dialog"][open]').last();
}

/**
 * The heading of the open dialog.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function dialogTitle(world) {
  return tidy(await dialog(world).locator('#jira-dialog2__heading, .aui-dialog2-header-main').first().innerText({ timeout: 1500 }).catch(() => ''));
}

/**
 * Wait for a dialog to be open and return it.
 *
 * @param {object} world
 * @param {string} what - how the failure names the dialog
 * @returns {Promise<import('playwright').Locator>}
 */
async function waitForDialog(world, what) {
  const box = dialog(world);
  try {
    await box.waitFor({ state: 'visible', timeout: budget(world) });
    // The content of an issue dialog loads after its frame.
    await box.locator('form, .aui-dialog2-content').first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `The ${what} dialog did not open.`, hint: 'Check that the account may do this (the operation is missing or greyed out without the permission) and that no message on the page reports an error.' });
  }
  return box;
}

/**
 * Press the main button of the open dialog (Create, Update, Assign, Delete,
 * Save, Start, Complete) and wait for the dialog to close. A dialog that stays
 * open is reported with the errors it shows.
 *
 * @param {object} world
 * @param {{keepOpen?: boolean}} [options] - `keepOpen`: do not wait for the dialog to close
 */
async function submitDialog(world, options = {}) {
  const box = dialog(world);
  const title = await dialogTitle(world);
  const submit = box.locator('input[type="submit"], button[type="submit"], button.aui-button-primary, [id$="-submit"], #dialog-submit-button').locator('visible=true').last();
  await actOrExplain('press the main button of the dialog', title || 'dialog', async () => {
    await submit.waitFor({ state: 'visible', timeout: budget(world) });
    await submit.click();
  }, 'No dialog with a submit button is open: open it first.');
  if (options.keepOpen) return;
  try {
    await box.waitFor({ state: 'hidden', timeout: budget(world) });
  } catch {
    const errors = (await box.locator('.error, .aui-message-error').locator('visible=true').allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    throw friendly({
      message: `The "${title}" dialog did not close after its main button was pressed${errors.length ? `: ${errors.join(' | ')}` : '.'}`,
      hint: 'Fill in the required fields of the dialog before submitting it; the errors above are what the dialog shows.',
    });
  }
  await smartSettle(world.page, 2000);
}

/**
 * Pick a value in a single-select field (Project, Issue Type, Assignee,
 * Priority): type the value, wait for the suggestion, pick it.
 *
 * @param {object} world
 * @param {import('playwright').Locator} input - the text input of the field (`#project-field`)
 * @param {string} value
 * @param {string} fieldName - for the failure message
 */
async function pickSuggestion(world, input, value, fieldName) {
  const page = world.page;
  const wanted = new RegExp(escapeRegExp(value), 'i');
  const items = page.locator('.ajs-layer.active li.aui-list-item');
  let offered = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    await input.waitFor({ state: 'visible', timeout: budget(world) });
    await input.click();
    await input.fill('');
    await input.pressSequentially(value, { delay: 20 });
    const option = items.filter({ hasText: wanted }).first();
    const shown = await option.waitFor({ state: 'visible', timeout: budget(world) }).then(() => true).catch(() => false);
    offered = (await items.allInnerTexts().catch(() => [])).map(tidy).filter(Boolean);
    if (!shown) break;
    // The list is redrawn when the answer to an earlier keystroke arrives: wait
    // until two readings of it agree before picking from it.
    let last = '';
    await waitForValue(async () => {
      const now = (await items.allInnerTexts().catch(() => [])).join('|');
      const settled = now === last && now !== '';
      last = now;
      return settled;
    }, (settled) => settled, 3000);
    await option.click().catch(() => {});
    await page.locator('.ajs-layer.active').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    // The field shows what was picked ("Scrum Sample (SCRUM)", "Sam Reporter"): check it is the value asked for.
    const picked = await waitForValue(() => input.inputValue({ timeout: 1500 }), (text) => wanted.test(text) || new RegExp(escapeRegExp(text), 'i').test(offered.find((entry) => wanted.test(entry)) || '\u0000'), 2000);
    if (picked.ok && picked.value !== '') return;
  }
  await page.keyboard.press('Escape').catch(() => {});
  const now = await input.inputValue({ timeout: 1500 }).catch(() => '');
  throw friendly({
    message: offered.some((entry) => wanted.test(entry))
      ? `The "${fieldName}" field did not take "${value}": it shows "${now}".`
      : `The "${fieldName}" field offers no "${value}". It offers: ${offered.join(' | ') || '(nothing)'}.`,
    hint: 'Use the name as the field shows it (a project by its name or key, a person by the display name or the username).',
  });
}

/**
 * Type a text into a rich text field (Description, Comment). The field is a
 * textarea with a rich text editor in front of it in "Visual" mode, and a plain
 * textarea in "Text" mode: the text goes where a person would type it.
 *
 * @param {object} world
 * @param {import('playwright').Locator} scope - the form or dialog that holds the field
 * @param {string} fieldId - `description` or `comment`
 * @param {string} text
 */
async function typeRichText(world, scope, fieldId, text) {
  const page = world.page;
  const field = scope.locator(`.jira-wikifield[field-id="${fieldId}"]`).first();
  const textarea = scope.locator(`textarea#${fieldId}`).first();
  await textarea.waitFor({ state: 'attached', timeout: budget(world) });
  // The editor replaces the textarea a moment after the form shows.
  const frame = field.locator('iframe.tox-edit-area__iframe').first();
  const rich = await frame.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);
  if (rich) {
    const body = field.frameLocator('iframe.tox-edit-area__iframe').locator('body');
    await body.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type(text, { delay: 5 });
  } else {
    await textarea.click();
    await textarea.fill('');
    await textarea.pressSequentially(text, { delay: 5 });
  }
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

/**
 * A JQL string literal: the text in double quotes, with quotes and backslashes
 * escaped.
 *
 * @param {string} text
 * @returns {string}
 */
function jqlString(text) {
  return '"' + String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * The JQL that finds the issues whose summary is exactly the given text (the
 * `~` operator finds the phrase; the caller compares the summary itself).
 *
 * @param {string} summary
 * @returns {string}
 */
function summaryJql(summary) {
  return `summary ~ ${jqlString('"' + String(summary).replace(/"/g, '') + '"')} ORDER BY created DESC`;
}

/**
 * The keys of the issues with exactly this summary, newest first. Read with
 * the session of the browser from the search resource the issue search page
 * itself uses, so it sees what the signed-in account may see.
 *
 * @param {object} world
 * @param {string} summary
 * @returns {Promise<string[]>}
 */
async function issueKeysBySummary(world, summary) {
  const url = siteUrl(world, '/rest/api/2/search') + '?maxResults=50&fields=summary&jql=' + encodeURIComponent(summaryJql(summary));
  const response = await world.page.request.get(url, { headers: { Accept: 'application/json' } });
  if (response.status() === 401 || response.status() === 403) {
    throw friendly({ message: `Looking for the issue "${summary}" was refused (HTTP ${response.status()}): nobody is signed in.`, hint: 'Sign in first: Given I am signed in as "..."' });
  }
  if (!response.ok()) {
    throw friendly({ message: `Looking for the issue "${summary}" failed with HTTP ${response.status()}: ${tidy(await response.text()).slice(0, 200)}`, hint: 'Check that the site is up and that the account may browse the project.' });
  }
  const data = await response.json();
  return (data.issues || []).filter((issue) => tidy(issue.fields && issue.fields.summary) === tidy(summary)).map((issue) => issue.key);
}

/**
 * Whether a text looks like an issue key (`SCRUM-12`).
 *
 * @param {string} text
 * @returns {boolean}
 */
function isIssueKey(text) {
  return /^[A-Z][A-Z0-9_]*-\d+$/.test(String(text).trim());
}

/**
 * The key of an issue named by its key or by its summary.
 *
 * @param {object} world
 * @param {string} nameOrKey
 * @returns {Promise<string>}
 */
async function resolveIssueKey(world, nameOrKey) {
  if (isIssueKey(nameOrKey)) return String(nameOrKey).trim();
  const keys = await issueKeysBySummary(world, nameOrKey);
  if (!keys.length) {
    throw friendly({ message: `There is no issue with the summary "${nameOrKey}" that this account can see.`, hint: 'Check the summary (it is compared in full), that the issue exists and that the signed-in account may browse its project.' });
  }
  return keys[0];
}

/**
 * Open the page of an issue and wait for the issue to show. An issue that is
 * not there (deleted, or not visible to the account) is reported as such.
 *
 * @param {object} world
 * @param {string} key
 */
async function openIssue(world, key) {
  await open(world, '/browse/' + encodeURIComponent(key));
  const page = world.page;
  const shown = page.locator('#key-val, .issue-error, #login-form');
  await shown.first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  if (await page.locator('#key-val').first().isVisible().catch(() => false)) {
    await clearObstacles(world);
    return;
  }
  if (await page.locator('#login-form').count()) {
    throw friendly({ message: `The sign-in form is showing instead of the issue ${key}: nobody is signed in.`, hint: 'Add "Given I am signed in as "..."" before this step.' });
  }
  const reason = tidy(await page.locator('.issue-error').first().innerText({ timeout: 1500 }).catch(() => ''));
  throw friendly({ message: `The issue ${key} did not open${reason ? `: the page says "${reason}"` : ` (the page is ${page.url()})`}.`, hint: 'Check the key, that the issue was not deleted and that the account may browse its project.' });
}

/**
 * Fail unless an issue is showing on the page.
 *
 * @param {object} world
 * @returns {Promise<string>} the key of the issue
 */
async function requireIssue(world) {
  const key = world.page.locator('#key-val').first();
  try {
    await key.waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `No issue is showing on the page (${world.page.url()}).`, hint: 'Open one first: When I open the issue "KEY-1", or When I open the issue with the summary "...".' });
  }
  return tidy(await key.innerText({ timeout: 1500 }));
}

// The fields of the issue view, by the name a step uses, with the element that
// shows the value.
const ISSUE_FIELDS = {
  key: '#key-val',
  summary: '#summary-val',
  project: '#project-name-val',
  type: '#type-val',
  priority: '#priority-val',
  resolution: '#resolution-val',
  description: '#description-val',
  assignee: '#assignee-val',
  reporter: '#reporter-val',
  labels: '#wrap-labels .labels-wrap, #labels-val',
  status: '#opsbar-transitions_more .dropdown-text, #status-val',
};

/**
 * The text of a field of the issue on the page.
 *
 * @param {object} world
 * @param {string} name - one of ISSUE_FIELDS
 * @returns {Promise<string>}
 */
async function issueField(world, name) {
  const selector = ISSUE_FIELDS[String(name).toLowerCase()];
  if (!selector) {
    throw friendly({ message: `"${name}" is not a field these steps read from the issue view.`, hint: `Use one of: ${Object.keys(ISSUE_FIELDS).join(', ')}.` });
  }
  return tidy(await world.page.locator(selector).first().innerText({ timeout: 3000 }));
}

/**
 * Open the "More" menu of the issue and return its list of operations.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').Locator>}
 */
async function openMoreMenu(world) {
  const page = world.page;
  const menu = page.locator('#opsbar-operations_more_drop');
  if (!(await menu.isVisible().catch(() => false))) {
    await safeClick(world, page.locator('#opsbar-operations_more').first());
    await menu.waitFor({ state: 'visible', timeout: budget(world) });
  }
  return menu;
}

/**
 * Delete the issue that is showing, through More → Delete and the confirmation
 * dialog.
 *
 * @param {object} world
 */
async function deleteShownIssue(world) {
  const key = await requireIssue(world);
  const page = world.page;
  const menu = await openMoreMenu(world);
  const item = menu.locator('#delete-issue').first();
  if (!(await item.isVisible().catch(() => false))) {
    await page.keyboard.press('Escape').catch(() => {});
    throw friendly({
      message: `The issue ${key} has no "Delete" operation for the signed-in account "${await currentUser(world)}".`,
      hint: 'Deleting an issue needs the Delete Issues permission of the project (in the default scheme: the project administrators). Sign in with an account that has it.',
    });
  }
  await item.click();
  await waitForDialog(world, 'Delete Issue');
  await submitDialog(world);
  await page.locator('#key-val').filter({ hasText: exactly(key) }).first().waitFor({ state: 'hidden', timeout: budget(world) }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Issue search
// ---------------------------------------------------------------------------

/**
 * Wait for the issue search to show its outcome (results, the empty message or
 * an error) and return what it is.
 *
 * @param {object} world
 * @returns {Promise<'results'|'empty'|'error'>}
 */
async function searchOutcome(world) {
  const page = world.page;
  const any = page.locator('.navigator-content .issue-list li[data-key], #issuetable tr.issuerow, .navigator-content .no-results, .navigator-search .aui-message-error, .navigator-group .aui-message-error');
  try {
    await any.first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `The issue search showed neither results nor a message (${page.url()}).`, hint: 'Run a search first: When I search for issues with the query "project = KEY".' });
  }
  if (await page.locator('.navigator-search .aui-message-error, .navigator-group .aui-message-error').locator('visible=true').count()) return 'error';
  if (await page.locator('.navigator-content .no-results').locator('visible=true').count()) return 'empty';
  return 'results';
}

/**
 * The issues the search shows on the page, in order: `{ key, summary }`. Works
 * in both layouts (the detail view lists `li[data-key]`, the list view is the
 * table `#issuetable`).
 *
 * @param {object} world
 * @returns {Promise<Array<{key: string, summary: string}>>}
 */
async function searchRows(world) {
  return world.page.evaluate(() => {
    const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    const table = [...document.querySelectorAll('#issuetable tr.issuerow')];
    if (table.length) {
      return table.map((row) => ({ key: row.getAttribute('data-issuekey') || '', summary: clean((row.querySelector('td.summary') || {}).innerText) }));
    }
    return [...document.querySelectorAll('.navigator-content .issue-list li[data-key]')].map((item) => {
      const key = item.getAttribute('data-key') || '';
      const summary = item.querySelector('.issue-link-summary');
      // An entry reads "KEY-1 The summary": without a summary element, the text after the key is the summary.
      return { key, summary: summary ? clean(summary.innerText) : clean(clean(item.innerText).replace(key, '')) };
    });
  });
}

/**
 * The row of the search results for an issue named by key or by summary. The
 * list view shows only the columns the account chose, which may leave the
 * summary out: then the summary is looked up and the rows are matched by key.
 *
 * @param {object} world
 * @param {Array<{key: string, summary: string}>} rows
 * @param {string} nameOrKey
 * @returns {Promise<{key: string, summary: string}|undefined>}
 */
async function findSearchRow(world, rows, nameOrKey) {
  if (isIssueKey(nameOrKey)) return rows.find((row) => row.key === String(nameOrKey).trim());
  if (rows.some((row) => row.summary)) return rows.find((row) => exactly(nameOrKey).test(row.summary));
  if (!rows.length) return undefined;
  const keys = await issueKeysBySummary(world, nameOrKey);
  return rows.find((row) => keys.includes(row.key));
}

/**
 * The total the search reports ("1 of 7", "Showing results 1-4 of 4"), or the
 * number of rows on the page when no total is shown.
 *
 * @param {object} world
 * @returns {Promise<number>}
 */
async function searchTotal(world) {
  const outcome = await searchOutcome(world);
  if (outcome === 'empty') return 0;
  if (outcome === 'error') {
    const error = tidy(await world.page.locator('.navigator-search .aui-message-error, .navigator-group .aui-message-error').first().innerText({ timeout: 1500 }).catch(() => ''));
    throw friendly({ message: `The issue search reports an error instead of results: "${error}".`, hint: 'Correct the query.' });
  }
  const text = tidy(await world.page.locator('.results-count-total, .showing, .results-count-text').locator('visible=true').first().innerText({ timeout: 3000 }).catch(() => ''));
  const total = text.match(/of\s+(\d+)/i) || text.match(/(\d+)\s*$/);
  if (total) return Number(total[1]);
  return (await searchRows(world)).length;
}

/**
 * Run a query in the issue search by its address, as a bookmark or a link to a
 * search does.
 *
 * @param {object} world
 * @param {string} jql
 */
async function runJql(world, jql) {
  await open(world, '/issues/?jql=' + encodeURIComponent(jql));
  await clearObstacles(world);
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

/**
 * The id of the board of a project (the first board that shows the project),
 * read with the session of the browser from the boards resource.
 *
 * @param {object} world
 * @param {string} projectKey
 * @returns {Promise<number>}
 */
async function boardIdOfProject(world, projectKey) {
  const response = await world.page.request.get(siteUrl(world, '/rest/agile/1.0/board') + '?projectKeyOrId=' + encodeURIComponent(projectKey), { headers: { Accept: 'application/json' } });
  if (response.status() === 401 || response.status() === 403) {
    throw friendly({ message: `Looking for the board of the project "${projectKey}" was refused (HTTP ${response.status()}).`, hint: 'Sign in first, with an account that may browse the project.' });
  }
  const data = response.ok() ? await response.json() : { values: [] };
  if (!data.values || !data.values.length) {
    throw friendly({ message: `The project "${projectKey}" has no board this account can see (HTTP ${response.status()}).`, hint: 'Use the key of a software project (for example "SCRUM"), and an account that may browse it.' });
  }
  return data.values[0].id;
}

/**
 * Open a view of the board of a project: the board itself (`work`) or the
 * backlog (`planning`).
 *
 * @param {object} world
 * @param {string} projectKey
 * @param {'work'|'planning'} view
 */
async function openBoard(world, projectKey, view) {
  const id = await boardIdOfProject(world, projectKey);
  world.boardId = id;
  await open(world, `/secure/RapidBoard.jspa?rapidView=${id}` + (view === 'planning' ? '&view=planning.nodetail' : ''));
  const ready = view === 'planning' ? '.ghx-backlog-container' : '#ghx-column-headers .ghx-column, .ghx-no-active-sprint-message';
  try {
    await world.page.locator(ready).first().waitFor({ state: 'visible', timeout: budget(world) });
  } catch {
    throw friendly({ message: `The ${view === 'planning' ? 'backlog' : 'board'} of the project "${projectKey}" did not show (${world.page.url()}).`, hint: view === 'planning' ? 'Only a Scrum board (and a Kanban board with the backlog turned on) has a backlog.' : 'Check that the account may see the board.' });
  }
  await clearObstacles(world);
}

/**
 * The columns of the board on the page: `{ id, name }`.
 *
 * @param {object} world
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function boardColumns(world) {
  return world.page.evaluate(() => [...document.querySelectorAll('#ghx-column-headers .ghx-column')].map((column) => {
    const title = column.querySelector('h2, .ghx-column-title');
    return { id: column.getAttribute('data-id') || '', name: String((title || column).textContent || '').replace(/\s+/g, ' ').trim() };
  }));
}

/**
 * The column of the board with the given name.
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<{id: string, name: string}>}
 */
async function boardColumn(world, name) {
  await world.page.locator('#ghx-column-headers .ghx-column').first().waitFor({ state: 'visible', timeout: budget(world) }).catch(() => {});
  const columns = await boardColumns(world);
  const found = columns.find((column) => exactly(name).test(column.name));
  if (!found) {
    throw friendly({ message: `The board has no "${name}" column. Its columns: ${columns.map((column) => column.name).join(', ') || '(none: is a board showing?)'}.`, hint: 'Open a board first (Given I am on the board of the "KEY" project) and use the name of one of its columns.' });
  }
  return found;
}

/**
 * The card of an issue on the board, by key or by summary.
 *
 * @param {object} world
 * @param {string} nameOrKey
 * @returns {import('playwright').Locator}
 */
function boardCard(world, nameOrKey) {
  const cards = world.page.locator('#ghx-pool .ghx-issue');
  if (isIssueKey(nameOrKey)) return world.page.locator(`#ghx-pool .ghx-issue[data-issue-key="${String(nameOrKey).trim()}"]`);
  return cards.filter({ has: world.page.locator('.ghx-summary', { hasText: exactly(nameOrKey) }) });
}

/**
 * The entry of an issue in the backlog, by key or by summary.
 *
 * @param {object} world
 * @param {string} nameOrKey
 * @returns {import('playwright').Locator}
 */
function backlogIssue(world, nameOrKey) {
  if (isIssueKey(nameOrKey)) return world.page.locator(`.ghx-backlog-container .js-issue[data-issue-key="${String(nameOrKey).trim()}"]`);
  return world.page.locator('.ghx-backlog-container .js-issue').filter({ has: world.page.locator('.ghx-summary', { hasText: exactly(nameOrKey) }) });
}

/**
 * The container of a sprint in the backlog, by its name.
 *
 * @param {object} world
 * @param {string} name
 * @returns {import('playwright').Locator}
 */
function sprintContainer(world, name) {
  return world.page.locator('.ghx-backlog-container.js-sprint-container').filter({ has: world.page.locator('.ghx-backlog-header .ghx-name', { hasText: exactly(name) }) });
}

/**
 * The sprints of a board, in every state, read with the session of the
 * browser: `{ id, name, state }`.
 *
 * @param {object} world
 * @param {number} boardId
 * @returns {Promise<Array<{id: number, name: string, state: string}>>}
 */
async function boardSprints(world, boardId) {
  const response = await world.page.request.get(siteUrl(world, `/rest/agile/1.0/board/${boardId}/sprint`) + '?maxResults=200', { headers: { Accept: 'application/json' } });
  if (!response.ok()) return [];
  const data = await response.json();
  return data.values || [];
}

module.exports = {
  budget,
  supplied,
  escapeRegExp,
  literal,
  exactly,
  tidy,
  siteRoot,
  siteUrl,
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
  onSite,
  land,
  pageUser,
  dropSession,
  signOut,
  submitSignIn,
  signInAs,
  dialog,
  dialogTitle,
  waitForDialog,
  submitDialog,
  pickSuggestion,
  typeRichText,
  jqlString,
  summaryJql,
  issueKeysBySummary,
  isIssueKey,
  resolveIssueKey,
  openIssue,
  requireIssue,
  ISSUE_FIELDS,
  issueField,
  openMoreMenu,
  deleteShownIssue,
  searchOutcome,
  searchRows,
  findSearchRow,
  searchTotal,
  runJql,
  boardIdOfProject,
  openBoard,
  boardColumns,
  boardColumn,
  boardCard,
  backlogIssue,
  sprintContainer,
  boardSprints,
};
