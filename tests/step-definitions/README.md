# Step definitions

| File | Covers |
| --- | --- |
| `jira-session.steps.js` | Signing in and out with the users registry, the sign-in form and its errors, the top navigation and its menus, named screens, the project sidebar, messages (flags and inline), dialogs, single-select fields, the dead link page, the application version. |
| `jira-issues.steps.js` | Creating an issue, opening one by key or summary, the fields of the issue view, editing, moving through the workflow, comments, assigning, the operations an account is offered, deleting. |
| `jira-search.steps.js` | The issue search in its basic and advanced (query) modes, the list and detail views, the outcome of a search, filters: saving, opening, deleting. |
| `jira-agile.steps.js` | Boards: columns, cards, moving a card; the backlog; sprints: creating, filling, starting, completing, deleting. |
| `jira-admin.steps.js` | Dashboards and their gadgets, the settings of a project, the administration area, the list of accounts. |
| `jira-helpers.js` | Shared plumbing: wait budget, presence assertions, URLs, the users registry, flags and help tips, dialogs, suggestions, rich text, issue lookup, the search results, boards and sprints. It registers no step. |

## Rules for a new step

- Check `node_modules/webship-js/tests/step-definitions/` first: a step that the
  generic click, fill and see vocabulary already covers is not added here.
- A step phrase never names the product or its vendor. It uses the nouns of the
  screens: issue, project, board, backlog, sprint, filter, dashboard, comment.
- The regular expression starts with the pronoun group `(I |we )*` where a
  person acts, and an assertion takes `should( not)*`, so one definition reads
  both polarities.
- A JSDoc block above the step holds at least five `Example #N:` lines. Run
  `npm run test:examples`: every example must match its own step and no step of
  webship-js.
- Wait on the locator (`locator.waitFor`, `assertPresence`, `waitForValue`),
  never on a fixed time, and fail with `friendly({ message, hint })` so the
  failure names what was expected, what was found and the way out.
- Click through `safeClick`: flags and help tips sit on top of the page and take
  the click otherwise.
- A step never creates or deletes an account: accounts are configuration, named
  in the `users` registry of `cucumber.js` and created by the site build.
- A step that creates something has a "... is removed" step that a scenario
  calls at its start and at its end.
