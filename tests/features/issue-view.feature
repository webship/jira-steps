# Reads the issues the site build seeded (site/build-jira-site.sh); nothing is changed.
@issue-view
Feature: The issue view
  As a member of a project
  I want the page of an issue to show its fields and the operations I may use
  So that I know what the issue is and what I can do with it

  @critical
  Scenario: The fields of a seeded issue, opened by key
    Given I am signed in as "alex"
    When I open the issue "SCRUM-2"
    Then the issue key should be "SCRUM-2"
    And the issue summary should be "Fix the login redirect"
    And the issue project should be "Scrum Sample"
    And the issue type should be "Bug"
    And the issue status should be "To Do"
    And the issue priority should be "Medium"
    And the issue resolution should be "Unresolved"
    And the issue assignee should be "Alex Tester"
    And the issue reporter should be "Site Administrator"
    And the issue description should contain "Seeded by the site build script"

  Scenario: An issue opened by its summary
    Given I am signed in as "alex"
    When I open the issue "Broken link in the footer"
    Then the issue key should contain "KAN-"
    And the issue type should be "Bug"
    And the issue status should be "Backlog"
    And the issue status should not be "Done"

  Scenario: Seeded issues exist, unknown ones do not
    Given I am signed in as "alex"
    Then the issue "SCRUM-1" should exist
    And the issue "Write the release notes" should exist
    And the issue "SCRUM-99999" should not exist
    And the issue "No issue has this summary" should not exist

  Scenario: The operations an ordinary account is offered
    Given I am signed in as "alex"
    When I open the issue "KAN-2"
    Then the issue should offer the "Edit" operation
    And the issue should offer the "Assign" operation
    And the issue should offer the "Clone" operation
    And the issue should offer the "Log work" operation
    And the issue should offer the "Move" operation
    And the issue should not offer the "Delete" operation

  Scenario: The operations an administrator is offered
    Given I am signed in as "admin"
    When I open the issue "KAN-2"
    Then the issue should offer the "Delete" operation
    And the issue should offer the "Edit" operation

  Scenario: The transitions a Kanban issue offers
    Given I am signed in as "alex"
    When I open the issue "KAN-1"
    Then the issue should offer the "Selected for Development" transition
    And the issue should offer the "In Progress" transition
    And the issue should offer the "Done" transition
    And the issue should not offer the "Reopen" transition

  Scenario: An issue that does not exist cannot be viewed
    Given I am signed in as "alex"
    When I go to "/browse/SCRUM-99999"
    Then I should see that the issue cannot be viewed
    And I should see "You can't view this issue"
    When I go to "/browse/SCRUM-1"
    Then I should not see that the issue cannot be viewed
