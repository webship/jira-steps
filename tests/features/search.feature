# Searches the issues the site build seeded: four in SCRUM, three in KAN.
@search
Feature: Searching for issues
  As a member of a project
  I want to search for issues with words and with a query
  So that I find the work I am looking for

  @critical
  Scenario: A query finds the issues of a project
    Given I am signed in as "alex"
    When I search for issues with the query "project = KAN ORDER BY key ASC"
    Then the search should find 3 issues
    And I should see the issue "KAN-1" in the search results
    And I should see the issue "Update the contact page" in the search results
    And I should see the issue "Broken link in the footer" in the search results
    And I should not see the issue "SCRUM-1" in the search results
    And the issue search should be in the advanced mode

  Scenario: A query with a text in quotes
    Given I am signed in as "alex"
    When I search for issues with the query "project = SCRUM AND summary ~ "release notes""
    Then the search should find 1 issue
    And I should see the issue "Write the release notes" in the search results

  Scenario: A query about the signed-in account
    Given I am signed in as "alex"
    When I search for issues with the query "assignee = currentUser() AND project in (SCRUM, KAN) AND summary !~ "Suite" ORDER BY key ASC"
    Then the search should find 2 issues
    And I should see the issue "Fix the login redirect" in the search results
    And I should see the issue "Update the contact page" in the search results

  Scenario: A query that finds nothing
    Given I am signed in as "alex"
    When I search for issues with the query "project = KAN AND summary ~ "nothing-like-this-anywhere""
    Then the search should find no issues
    And the search should find 0 issues
    And I should see "No issues were found to match your search"

  Scenario: A query with a mistake reports an error
    Given I am signed in as "alex"
    When I search for issues with the query "projectt = KAN"
    Then I should see the search error "Field 'projectt' does not exist or you do not have permission to view it."
    And I should not see the search error "Some other error"

  Scenario: A search opened by its address
    Given I am signed in as "alex"
    And I am on the issue search for "project = SCRUM AND type = Bug"
    Then the search should find 1 issue
    And I should see the issue "SCRUM-2" in the search results
    And the search should find at least 1 issue

  Scenario: The basic mode searches for words
    Given I am signed in as "alex"
    And I am on the issue search for "project = KAN"
    When I switch the issue search to the basic mode
    Then the issue search should be in the basic mode
    And the issue search should not be in the advanced mode
    When I search for issues containing "footer"
    Then I should see the issue "Broken link in the footer" in the search results
    And I should not see the issue "Review the style guide" in the search results
    When I switch the issue search to the advanced mode
    Then the issue search should be in the advanced mode

  Scenario: The list view and the detail view show the same results
    Given I am signed in as "alex"
    And I am on the issue search for "project = SCRUM ORDER BY key ASC"
    When I switch the search results to the list view
    Then the search should find 4 issues
    And I should see the issue "SCRUM-1" in the search results
    And I should see the issue "Add the search page" in the search results
    When I switch the search results to the detail view
    Then the search should find 4 issues
    And I should see the issue "SCRUM-4" in the search results
    And I should see the issue "Set up the build pipeline" in the search results

  Scenario: Open an issue from the results
    Given I am signed in as "alex"
    And I am on the issue search for "project = KAN ORDER BY key ASC"
    When I open the issue "Update the contact page" from the search results
    Then the issue key should be "KAN-2"
    And the issue summary should be "Update the contact page"
