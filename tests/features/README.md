# Features

Reference features for the site that `site/build-jira-site.sh` builds: Jira
Software Data Center 11.3 with the accounts `admin`, `alex` and `sam`, a Scrum
project `SCRUM` and a Kanban project `KAN`, each with a few named issues, and
the shared filter "Sample open issues". Copy a feature into your project and
replace the project keys, summaries and names with those of your site.

| Feature | Covers |
| --- | --- |
| `session` | Signing in and out, wrong passwords, what a visitor and an ordinary account are refused. |
| `navigation` | The menus of the top navigation per account, the project sidebar, the search box, the dead link page. |
| `issues` | Creating (in one step and field by field), validation, editing, the workflow, comments, assigning, deleting. |
| `issue-view` | The fields of an issue, the operations and transitions an account is offered, an issue that cannot be viewed. |
| `search` | Queries, their errors and empty outcome, the basic mode, the list and detail views, opening a result. |
| `filters` | Saving a search as a filter, opening it, the Issues menu, deleting it. |
| `board` | The columns and cards of the Kanban board, moving a card by dragging and by a transition, the Scrum board between sprints. |
| `sprints` | The backlog, creating and deleting a sprint, planning, starting and completing a sprint. |
| `dashboards` | The system dashboard and its gadgets, a dashboard of one's own. |
| `administration` | The settings of a project, the administration area and the list of accounts, and their refusal to an ordinary account. |
| `rest` | REST resources checked with webship-js's own REST steps and the session of the browser. |

Scenarios that create something remove it at the end and start with a
"... is removed" step, so a failed run does not stop the next one. Issues are
deleted by the administrator: an ordinary account has no Delete operation in the
default permission scheme. No scenario creates or deletes an account.
