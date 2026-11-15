# Dashboards the scenarios create are deleted at their end.
@dashboards
Feature: Dashboards
  As a person signed in
  I want the system dashboard and dashboards of my own
  So that I see my work when I arrive

  @critical
  Scenario: The system dashboard shows its gadgets
    Given I am signed in as "alex"
    When I open the dashboard "System Dashboard"
    Then the dashboard title should be "System Dashboard"
    And I should see the "Introduction" gadget
    And I should see the "Assigned to Me" gadget
    And I should not see the "Pie Chart" gadget
    And the "Introduction" gadget should contain "Welcome to"
    And the "Assigned to Me" gadget should contain "Fix the login redirect"
    And the "Assigned to Me" gadget should contain "Update the contact page"
    And the "Assigned to Me" gadget should not contain "Write the release notes"

  Scenario: Create a dashboard, open it and delete it
    Given I am signed in as "alex"
    And the dashboard "Suite dashboard" is removed
    When I create the dashboard "Suite dashboard"
    Then I should see the dashboard "Suite dashboard" in my dashboards
    When I open the dashboard "Suite dashboard"
    Then the dashboard title should be "Suite dashboard"
    And the dashboard title should not be "System Dashboard"
    And I should not see the "Assigned to Me" gadget
    When I delete the dashboard "Suite dashboard"
    Then I should not see the dashboard "Suite dashboard" in my dashboards
    And I should see "You own no dashboards."

  Scenario: The Dashboards menu leads to the dashboards of the account
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    When I choose "Manage Dashboards" from the "Dashboards" menu of the top navigation
    Then I should see "Favorite Dashboards"
