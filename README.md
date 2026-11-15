<p align="center"><img src="https://raw.githubusercontent.com/webship/jira-steps/2.0.x/assets/logo.svg" alt="Jira logo" width="96"></p>

# jira-steps

Cucumber step definitions for testing Jira Software Data Center sites with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/jira-steps` covers what the application itself renders: signing in
and out by account handle, the top navigation and the project sidebar, the life
of an issue (create, edit, move through the workflow, comment, assign, delete),
the fields of the issue view, the issue search in its basic and query modes,
filters, the board (columns, moving a card), the backlog and a sprint (create,
start, complete), dashboards, the settings of a project, the administration
area, and the messages, dialogs and error pages along the way. REST resources
are checked with webship-js's own REST steps, which carry the session of the
browser.

No step phrase names the product: the steps speak of issues, projects, boards,
sprints, filters and dashboards.

The steps are written against Jira Software Data Center 11.3 (the long term
support release), and every one of them was written after walking its screen in
a real browser on a real local site. CI builds that site from the official
container image and runs the whole suite against it, twice, on every push and
pull request; see [`.github/workflows/test.yml`](.github/workflows/test.yml).

> This project is not affiliated with, sponsored by or endorsed by Atlassian.
> Jira is a registered trademark of Atlassian.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.10 or later)
- A Jira Software Data Center site to test (written against 11.3), with its
  own sign-in form. The steps do not cover Jira Cloud, whose screens are
  different, nor a site behind single sign-on.

## Install

```bash
npm install --save-dev @webship-js/jira-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/jira-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the site and name the accounts the suite signs in with
   (see [Test users](#test-users)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-site.example',
     users: {
       alex: { username: 'alex', password: process.env.JIRA_ALEX_PASSWORD },
     },
   },
   ```

3. Write a feature, or copy one from [`tests/features/`](tests/features/) and
   replace the project keys, summaries and names with those of your site:

   ```gherkin
   Feature: The life of an issue

     Scenario: Create an issue and move it
       Given I am signed in as "alex"
       When I create a "Task" issue in the "Scrum Sample" project with the summary "Check the footer links"
       And I open the issue I created
       Then the issue status should be "To Do"
       When I move the issue to "In Progress"
       And I comment "Started today." on the issue
       Then the issue status should be "In Progress"
       And I should see the comment "Started today." on the issue
   ```

4. Run the suite:

   ```bash
   npx cucumber-js
   ```

## Things on top of the page

The application lays flags (the notices in the top right corner) and help tips
over a page, and they take the clicks meant for what is under them. The steps
of this pack close them when they are in the way. Before a generic webship-js
click step, close them with `When I close the messages on top of the page`.

## Test users

A feature never creates or deletes an account. The accounts are configuration:
they exist on the site, and `cucumber.js` names them by a handle in
`worldParameters.users`. This is the list the reference features expect, with
the placeholder passwords `site/build-jira-site.sh` sets on the local test
site (they are not credentials of any real site; override them with the
`JIRA_*` environment variables):

```javascript
worldParameters: {
  users: {
    admin: { username: process.env.JIRA_ADMIN_USER || 'admin', password: process.env.JIRA_ADMIN_PASSWORD || 'Admin123456789!', name: 'Site Administrator' },
    alex: { username: process.env.JIRA_ALEX_USER || 'alex', password: process.env.JIRA_ALEX_PASSWORD || 'Alex123456789!', name: 'Alex Tester' },
    sam: { username: process.env.JIRA_SAM_USER || 'sam', password: process.env.JIRA_SAM_PASSWORD || 'Sam123456789!', name: 'Sam Reporter' },
  },
},
```

| Handle | Username | Password on the test site | What the account is |
| --- | --- | --- | --- |
| `admin` | `admin` | `Admin123456789!` | Administrator of the site and of the sample projects; deletes issues. |
| `alex` | `alex` | `Alex123456789!` | Ordinary account: creates, edits, comments, moves issues, runs sprints. |
| `sam` | `sam` | `Sam123456789!` | Ordinary account: the second person (assignee, reader). |

`Given I am signed in as "alex"` signs in with the entry `alex` and checks the
session is that account's. The first time in a run the account goes through the
sign-in form; after that its session is put back, so switching accounts inside
a scenario is quick.

What a suite creates, it removes: every step that creates something (an issue,
a filter, a sprint, a dashboard) has a "... is removed" step for the start and
the end of the scenario. Deleting an issue needs the Delete Issues permission,
which the default permission scheme gives to the administrators of a project
only, so the reference features delete issues as `admin`.

## What is included

The sign-in steps come first.

### Session, navigation, messages and dialogs (`jira-session.steps.js`, 32 steps)

| Example | What it does |
| --- | --- |
| `Given I am signed in as "alex"` | Sign in with an account of the users registry in cucumber.js (`worldParameters.users`), by its handle, and make sure the session is that account's. |
| `When I sign in with the "alex" account` | Sign in through the form with the password of an account of the users registry, without the checks of "I am signed in as". |
| `When I sign in as "alex" with the password "not-the-right-password"` | Fill in the sign-in form with a username and a password as typed in the step, and submit it. |
| `Given I am not signed in` | Make sure nobody is signed in. |
| `Given I am on the sign-in page` | Open the sign-in page and wait for its form. |
| `When I sign out` | Sign out through the profile menu of the top navigation. |
| `Then I should be signed in` | Assert somebody is (or nobody is) signed in. |
| `Then I should be signed in as "alex"` | Assert the session belongs to an account. |
| `Then I should see the sign-in form` | Assert the sign-in form is (or is not) on the page. |
| `Then I should see the sign-in error "Incorrect username or password."` | Assert the sign-in form reports an error with the given text, as after a wrong password. |
| `Then I should be asked to sign in` | Assert the site asks to sign in before it shows the page. |
| `When I open the "Projects" menu of the top navigation` | Open a menu of the top navigation. |
| `When I choose "View All Projects" from the "Projects" menu of the top navigation` | Open a menu of the top navigation and choose one of its items by its text. |
| `Then I should see "Manage filters" in the "Issues" menu of the top navigation` | Assert a menu of the top navigation has (or has not) an item with the given text. |
| `Then I should see the "Administration" menu in the top navigation` | Assert the top navigation has (or has not) a menu. |
| `When I search the site for "release notes"` | Type words into the search box of the top navigation and press Enter. |
| `Given I am on the "projects" screen` | Open a page of the application by its name. |
| `Given I am on the "SCRUM" project` | Open the page of a project, by its key. |
| `When I open "Backlog" in the project sidebar` | Open an item of the project sidebar by its text. |
| `Then I should see "Backlog" in the project sidebar` | Assert the project sidebar has (or has not) an item with the given text. |
| `Then the project sidebar should be of "Scrum Sample"` | Assert the project sidebar is that of the project with the given name. |
| `Then I should see the success message "has been successfully created"` | Assert a message of a type shows (or does not show) with the given text. |
| `When I close the messages on top of the page` | Close what sits on top of the page. |
| `Then I should see the field error "You must specify a summary of the issue."` | Assert a field of the form or dialog reports an error with the given text (the red text under the field). |
| `Then the "Create Issue" dialog should be open` | Assert a dialog with the given title is (or is not) open. |
| `When I submit the dialog` | Press the main button of the open dialog (Create, Update, Assign, Delete, Save, Start, Complete) and wait for the dialog to close. |
| `When I submit the dialog expecting errors` | Press the main button of the open dialog without expecting it to close. |
| `When I cancel the dialog` | Cancel the open dialog and wait for it to close. |
| `When I pick "Scrum Sample" in the "Project" field` | Pick a value in a single-select field of the open dialog or form. |
| `When I fill in the "Summary" field of the dialog with "Check the footer links"` | Fill in a text field of the open dialog, by its label. |
| `Then I should see the dead link page` | Assert the page is the one the application shows for an address that does not exist ("Oops, you've found a dead link."). |
| `Then the application version should start with "11."` | Assert the version of the application the page reports (`meta ajs-version-number`) starts with the given text, so a suite written for one release line says so. |

### Issues (`jira-issues.steps.js`, 21 steps)

| Example | What it does |
| --- | --- |
| `When I open the create issue dialog` | Open the Create dialog from the "Create" button of the top navigation. |
| `When I create a "Task" issue in the "Scrum Sample" project with the summary "Check the footer links"` | Create an issue in one step. |
| `When I open the issue I created` | Open the issue the last "I create ... |
| `When I open the issue "SCRUM-1"` | Open the page of an issue, by its key or by its exact summary. |
| `Then the issue "Check the footer links" should exist` | Assert an issue is (or is not) there for the signed-in account, by key or by exact summary. |
| `Then I should see that the issue cannot be viewed` | Assert the page says the issue cannot be viewed, as for a deleted issue or one the account may not browse ("You can't view this issue"). |
| `Then the issue status should be "To Do"` | Assert a field of the issue on the page is (or is not) the given text. |
| `Then the issue description should contain "Seeded by the site build script"` | Assert a field of the issue on the page contains (or does not contain) the given text. |
| `When I open the edit issue dialog` | Open the Edit dialog of the issue on the page. |
| `When I change the issue summary to "Check every footer link"` | Change the summary or the description of the issue on the page through the Edit dialog. |
| `When I move the issue to "In Progress"` | Move the issue on the page through its workflow. |
| `Then the issue should offer the "In Progress" transition` | Assert the workflow button of the issue offers (or does not offer) a transition. |
| `When I comment "Checked on the staging site." on the issue` | Add a comment to the issue on the page. |
| `Then I should see the comment "Checked on the staging site." on the issue` | Assert the issue on the page has (or has not) a comment with the given text. |
| `Then the comment "Checked on the staging site." should be by "Alex Tester"` | Assert the comment with the given text was written by the person with the given display name. |
| `When I delete the comment "Checked on the staging site." from the issue` | Delete the comment with the given text from the issue on the page, through its "Delete" action and the confirmation dialog. |
| `When I assign the issue to "Sam Reporter"` | Assign the issue on the page to a person through the Assign dialog. |
| `When I assign the issue to me` | Assign the issue on the page to the signed-in account with the "Assign to me" link of the People section. |
| `Then the issue should offer the "Delete" operation` | Assert the issue on the page offers (or does not offer) an operation, by its text. |
| `When I delete the issue` | Delete the issue on the page through More → Delete and the confirmation dialog. |
| `Given the issue "Check the footer links" is removed` | Make sure no issue with the given summary is left. |

### Search and filters (`jira-search.steps.js`, 18 steps)

| Example | What it does |
| --- | --- |
| `When I search for issues with the query "project = KAN ORDER BY key ASC"` | Run a query (JQL) in the issue search, the way a person does. |
| `Given I am on the issue search for "project = KAN ORDER BY key ASC"` | Open the issue search for a query by its address, as a saved link to a search does (`/issues/?jql=...`). |
| `When I search for issues containing "release notes"` | Search in the basic mode of the issue search. |
| `When I switch the issue search to the advanced mode` | Switch the issue search between its basic mode (the criteria buttons) and its advanced mode (the query box). |
| `Then the issue search should be in the advanced mode` | Assert the issue search is in the basic or in the advanced mode. |
| `When I switch the search results to the list view` | Switch the results of the issue search between the list view (a table) and the detail view (a list next to the selected issue). |
| `Then the search should find 3 issues` | Assert the number of issues the search found (the total it reports, not only the rows on the page). |
| `Then the search should find at least 1 issue` | Assert the search found at least the given number of issues. |
| `Then the search should find no issues` | Assert the search found nothing and says so ("No issues were found to match your search"). |
| `Then I should see the issue "KAN-1" in the search results` | Assert the results of the search list (or do not list) an issue, by its key or by its exact summary. |
| `Then I should see the search error "Field 'projectt' does not exist or you do not have permission to view it."` | Assert the search reports an error with the given text under the query, as for a field that does not exist. |
| `When I open the issue "KAN-2" from the search results` | Open an issue from the results of the search, by its key or by its exact summary. |
| `When I save the search as the filter "Open footer work"` | Save the search on the page as a new filter with the given name. |
| `Then the search should be the filter "Sample open issues"` | Assert the search on the page is (or is not) the saved filter with the given name. |
| `When I open the filter "Sample open issues"` | Open a saved filter by its name. |
| `Then I should see the filter "Open footer work" in my filters` | Assert the account owns (or does not own) a filter with the given name, on the "My" tab of the Manage Filters page. |
| `When I delete the filter "Open footer work"` | Delete a filter the account owns, by its name, through the Operations menu of its row on the Manage Filters page and the confirmation dialog. |
| `Given the filter "Open footer work" is removed` | Make sure the account owns no filter with the given name. |

### Boards, backlog and sprints (`jira-agile.steps.js`, 19 steps)

| Example | What it does |
| --- | --- |
| `Given I am on the board of the "KAN" project` | Open the board of a project, by the key of the project. |
| `Given I am on the backlog of the "SCRUM" project` | Open the backlog of the board of a project, by the key of the project. |
| `Then the board should have the "In Progress" column` | Assert the board has (or has not) a column with the given name. |
| `Then the board columns should be "Backlog, Selected for Development, In Progress, Done"` | Assert the columns of the board, in order, as a comma separated list. |
| `Then I should see the card "KAN-1" on the board` | Assert the board shows (or does not show) the card of an issue, by key or by exact summary. |
| `Then the card "KAN-1" should be in the "Backlog" column` | Assert the card of an issue is (or is not) in the column with the given name. |
| `When I move the card "KAN-1" to the "Selected for Development" column` | Move the card of an issue to another column by dragging it with the mouse, as a person does. |
| `Then the board should have no active sprint` | Assert the board says it has no active sprint ("There are no active sprints"), as a Scrum board does between sprints. |
| `Then the board should show the sprint "Suite Sprint"` | Assert the sprint the board is showing is (or is not) the one with the given name. |
| `When I create the sprint "Suite Sprint"` | Create a sprint in the backlog on the page. |
| `Then I should see the sprint "Suite Sprint" in the backlog` | Assert the backlog shows (or does not show) a sprint with the given name. |
| `Then the sprint "Suite Sprint" should be active` | Assert the sprint with the given name is (or is not) the active one in the backlog. |
| `When I add the issue "SCRUM-3" to the sprint "Suite Sprint"` | Send an issue of the backlog to a sprint, through the context menu of the issue (right-click → the sprint), and wait for it to be in the sprint. |
| `Then the issue "SCRUM-3" should be in the sprint "Suite Sprint"` | Assert an issue is (or is not) in the sprint with the given name, in the backlog on the page. |
| `Then the issue "SCRUM-3" should be in the backlog` | Assert an issue is (or is not) in the backlog itself, below the sprints. |
| `When I start the sprint "Suite Sprint"` | Start a planned sprint from the backlog. |
| `When I complete the active sprint` | Complete the active sprint from the board. |
| `When I delete the sprint "Suite Sprint"` | Delete a planned sprint from the backlog through its menu ("Delete sprint") and the confirmation dialog. |
| `Given the sprint "Suite Sprint" is removed from the "SCRUM" project` | Make sure the board of a project has no sprint with the given name, in any state. |

### Dashboards, project settings and administration (`jira-admin.steps.js`, 13 steps)

| Example | What it does |
| --- | --- |
| `When I create the dashboard "Suite dashboard"` | Create a dashboard with the given name. |
| `When I open the dashboard "Suite dashboard"` | Open a dashboard by its name. |
| `Then the dashboard title should be "System Dashboard"` | Assert the dashboard on the page has (or has not) the given title. |
| `Then I should see the "Assigned to Me" gadget` | Assert the dashboard on the page shows (or does not show) a gadget with the given title. |
| `Then the "Assigned to Me" gadget should contain "Fix the login redirect"` | Assert a gadget of the dashboard on the page contains (or does not contain) a text, once its content has loaded. |
| `Then I should see the dashboard "Suite dashboard" in my dashboards` | Assert the account owns (or does not own) a dashboard with the given name, on the "My" tab of the Manage Dashboards page. |
| `When I delete the dashboard "Suite dashboard"` | Delete a dashboard the account owns, by its name, through the Operations menu of its row on the Manage Dashboards page and the confirmation dialog. |
| `Given the dashboard "Suite dashboard" is removed` | Make sure the account owns no dashboard with the given name. |
| `Given I am on the "summary" settings of the "SCRUM" project` | Open a section of the settings of a project, by the key of the project. |
| `Then I should see the settings of the "Scrum Sample" project` | Assert the page is the settings of the project with the given name. |
| `Then I should be refused the project settings` | Assert the application refuses the settings of a project to the signed-in account ("You cannot edit the configuration of this project."). |
| `Then I should see the account "alex" in the user list` | Assert the list of accounts on the User management page shows (or does not show) an account, by its username. |
| `Then I should be in the administration area` | Assert the page is (or is not) a page of the administration area. |

Every step has at least five examples in the JSDoc block above its definition;
`npm run test:examples` checks each example against its own step and against
the steps of webship-js.

## The test site

[`site/build-jira-site.sh`](site/build-jira-site.sh) builds the site the
reference features run against, with Docker Compose
([`site/docker-compose.yml`](site/docker-compose.yml)):

- Jira Software Data Center `11.3.13` from the official container image
  (`atlassian/jira-software`), with its own PostgreSQL 16 container, at
  `http://localhost:2990`;
- the setup wizard driven by the script, no person at the keyboard;
- the accounts `admin`, `alex` and `sam`;
- a Scrum project `SCRUM` ("Scrum Sample") and a Kanban project `KAN`
  ("Kanban Sample"), each with a few named issues, and the shared filter
  "Sample open issues".

```bash
site/build-jira-site.sh           # build (or finish building) the site and seed it
site/build-jira-site.sh status    # the state of the application and the licence expiry
site/build-jira-site.sh renew     # restart the application: a new 3-hour licence window
site/build-jira-site.sh down      # stop and remove the containers and the volumes
```

It needs Docker with the Compose plugin, `curl` and `python3`, about 4 GB of
free memory and about 2 GB of disk for the images. The first start takes a few
minutes.

### The licence

Jira has no free self-hosted edition: Jira Software Data Center needs a
licence. The build uses the **timebomb licence Atlassian publishes for testing
Data Center products** ("10 user Jira Software Data Center license, expires in
3 hours") from
<https://developer.atlassian.com/platform/marketplace/timebomb-licenses-for-testing-server-apps/>.

- No licence key is in this repository. The script reads the key from the
  `JIRA_LICENSE` environment variable; when it is empty, it downloads the key
  from that page at build time.
- The licence counts three hours from the start of the application.
  `site/build-jira-site.sh renew` restarts the application and starts a new
  window; the data stays.
- It allows ten accounts, which is enough for the three of the suite.
- To test against a site of your own, with your own licence, skip the build
  and point `LAUNCH_URL` and the `JIRA_*` variables at it.

## Running the suite of this repository

```bash
npm install
npx playwright install chromium
site/build-jira-site.sh
npm test
```

`FEATURES=tests/features/issues.feature npm test` runs one feature,
`CUCUMBER_TAGS=@critical npm test` the smoke lane. `npm run test:examples` and
`npx cucumber-js --dry-run` need no site.

The suite leaves the site as it found it and can be run again straight away.

## What is not covered

- Jira Cloud, Jira Service Management and Jira Work Management screens.
- Sign-in through single sign-on or with two-step verification.
- Attachments, issue links, sub-tasks, work logs, bulk changes, issue import
  and export.
- Reports, releases (versions), components, epics and the plans of Advanced
  Roadmaps.
- Changing workflows, screens, schemes and permissions; creating or deleting
  projects and accounts.
- Languages other than English: the steps read menu items, buttons and
  messages by their English text.

## Logo

The Jira logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Jira name and logo are trademarks of Atlassian; this pack is not affiliated with or endorsed by Atlassian.

## License

MIT. See [LICENSE](LICENSE).
