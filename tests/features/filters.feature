# The filter "Sample open issues" is seeded by the site build (owned by the administrator,
# shared with every signed-in account). Filters the scenarios save are deleted at their end.
@filters
Feature: Filters
  As a member of a project
  I want to save a search as a filter and open it again
  So that I do not write the same query twice

  @critical
  Scenario: Save a search as a filter, open it and delete it
    Given I am signed in as "alex"
    And the filter "Suite: Kanban work" is removed
    When I search for issues with the query "project = KAN ORDER BY key ASC"
    And I save the search as the filter "Suite: Kanban work"
    Then the search should be the filter "Suite: Kanban work"
    And I should see the filter "Suite: Kanban work" in my filters
    When I open the filter "Suite: Kanban work"
    Then the search should be the filter "Suite: Kanban work"
    And the search should find 3 issues
    And I should see the issue "KAN-3" in the search results
    When I delete the filter "Suite: Kanban work"
    Then I should not see the filter "Suite: Kanban work" in my filters

  Scenario: A new filter shows in the Issues menu
    Given I am signed in as "alex"
    And the filter "Suite: my bugs" is removed
    When I search for issues with the query "type = Bug"
    And I save the search as the filter "Suite: my bugs"
    Then I should see "Suite: my bugs" in the "Issues" menu of the top navigation
    Given the filter "Suite: my bugs" is removed
    And I am on the "system dashboard" screen
    Then I should not see "Suite: my bugs" in the "Issues" menu of the top navigation

  Scenario: The owner opens the seeded filter
    Given I am signed in as "admin"
    When I open the filter "Sample open issues"
    Then the search should be the filter "Sample open issues"
    And the search should not be the filter "Some other filter"
    And the search should find at least 7 issues
    And I should see the issue "KAN-1" in the search results
    And I should see the filter "Sample open issues" in my filters

  Scenario: A search that is not saved is no filter
    Given I am signed in as "alex"
    And I am on the issue search for "project = SCRUM"
    Then the search should not be the filter "Sample open issues"
    And I should not see the filter "Sample open issues" in my filters
