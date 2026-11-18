@navigation
Feature: The top navigation and the project sidebar
  As a person signed in
  I want the menus of the top navigation and the sidebar of a project
  So that I reach projects, issues, boards and dashboards

  @critical
  Scenario: The top navigation of an ordinary account
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    Then I should see the "Dashboards" menu in the top navigation
    And I should see the "Projects" menu in the top navigation
    And I should see the "Issues" menu in the top navigation
    And I should see the "Boards" menu in the top navigation
    And I should not see the "Administration" menu in the top navigation
    And the application version should start with "11."
    And the application version should not start with "10."

  Scenario: The top navigation of an administrator has the Administration menu
    Given I am signed in as "admin"
    And I am on the "system dashboard" screen
    Then I should see the "Administration" menu in the top navigation
    And I should see "User management" in the "Administration" menu of the top navigation
    And I should see "System" in the "Administration" menu of the top navigation

  Scenario: A visitor has the Dashboards menu only
    Given I am not signed in
    And I am on the "system dashboard" screen
    Then I should see the "Dashboards" menu in the top navigation
    And I should not see the "Projects" menu in the top navigation
    And I should not see the "Issues" menu in the top navigation
    And I should not see the "Boards" menu in the top navigation

  Scenario: The items of the menus
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    Then I should see "Search for issues" in the "Issues" menu of the top navigation
    And I should see "Manage filters" in the "Issues" menu of the top navigation
    And I should see "View All Projects" in the "Projects" menu of the top navigation
    And I should see "View all boards" in the "Boards" menu of the top navigation
    And I should see "Manage Dashboards" in the "Dashboards" menu of the top navigation
    And I should see "Log Out" in the "Profile" menu of the top navigation
    And I should not see "No such item" in the "Issues" menu of the top navigation

  Scenario: A menu of the top navigation opens and shows its items
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    When I open the "Projects" menu of the top navigation
    Then I should see "View All Projects"
    And I should see "Scrum Sample (SCRUM)"

  Scenario: The Projects menu leads to the list of projects
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    When I choose "View All Projects" from the "Projects" menu of the top navigation
    Then I should see "Browse projects"
    And I should see "Scrum Sample"
    And I should see "Kanban Sample"

  Scenario: The Issues menu leads to the issue search
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    When I choose "Search for issues" from the "Issues" menu of the top navigation
    Then the url should match "/issues/|/browse/"

  Scenario: A favourite filter shows in the Issues menu of its owner
    Given I am signed in as "admin"
    And I am on the "system dashboard" screen
    Then I should see "Sample open issues" in the "Issues" menu of the top navigation

  Scenario: The sidebar of a Scrum project
    Given I am signed in as "alex"
    And I am on the "SCRUM" project
    Then the project sidebar should be of "Scrum Sample"
    And the project sidebar should not be of "Kanban Sample"
    And I should see "Backlog" in the project sidebar
    And I should see "Active sprints" in the project sidebar
    And I should see "Issues" in the project sidebar
    And I should not see "Kanban board" in the project sidebar
    And I should not see "Project settings" in the project sidebar

  Scenario: The sidebar of a Kanban project
    Given I am signed in as "alex"
    And I am on the "KAN" project
    Then the project sidebar should be of "Kanban Sample"
    And I should see "Kanban board" in the project sidebar
    And I should not see "Backlog" in the project sidebar

  Scenario: The sidebar opens the backlog
    Given I am signed in as "alex"
    And I am on the "SCRUM" project
    When I open "Backlog" in the project sidebar
    Then the url should match "RapidBoard.jspa"
    And the issue "Write the release notes" should be in the backlog

  Scenario: Searching from the top navigation
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    When I search the site for "release notes"
    Then I should see the issue "Write the release notes" in the search results

  Scenario: An address that does not exist
    Given I am signed in as "alex"
    When I go to "/no-such-page-here"
    Then I should see the dead link page
    When I go to "/secure/Dashboard.jspa"
    Then I should not see the dead link page
