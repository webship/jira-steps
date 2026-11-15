# The Kanban board of the KAN project, seeded with three cards in "Backlog". The scenario
# that moves a card uses a card of its own and deletes it.
@board
Feature: The board
  As a member of a team
  I want the board to show the work in columns and to move a card
  So that everybody sees where the work stands

  @critical
  Scenario: The columns and the cards of the Kanban board
    Given I am signed in as "alex"
    And I am on the board of the "KAN" project
    Then the board columns should be "Backlog, Selected for Development, In Progress, Done"
    And the board should have the "In Progress" column
    And the board should not have the "Review" column
    And I should see the card "KAN-1" on the board
    And I should see the card "Update the contact page" on the board
    And I should not see the card "SCRUM-1" on the board
    And the card "KAN-1" should be in the "Backlog" column
    And the card "Broken link in the footer" should be in the "Backlog" column
    And the card "KAN-2" should not be in the "Done" column

  Scenario: Move a card across the board
    Given I am signed in as "admin"
    And the issue "Suite: card on the move" is removed
    And I am signed in as "alex"
    When I create a "Task" issue in the "Kanban Sample" project with the summary "Suite: card on the move"
    And I am on the board of the "KAN" project
    Then the card "Suite: card on the move" should be in the "Backlog" column
    When I move the card "Suite: card on the move" to the "Selected for Development" column
    Then the card "Suite: card on the move" should be in the "Selected for Development" column
    And the card "Suite: card on the move" should not be in the "Backlog" column
    When I move the card "Suite: card on the move" to the "In Progress" column
    Then the card "Suite: card on the move" should be in the "In Progress" column
    When I open the issue "Suite: card on the move"
    Then the issue status should be "In Progress"
    Given I am signed in as "admin"
    And the issue "Suite: card on the move" is removed
    And I am on the board of the "KAN" project
    Then I should not see the card "Suite: card on the move" on the board

  Scenario: A transition of the issue moves its card
    Given I am signed in as "admin"
    And the issue "Suite: card moved by its issue" is removed
    And I am signed in as "alex"
    When I create a "Task" issue in the "Kanban Sample" project with the summary "Suite: card moved by its issue"
    And I open the issue I created
    And I move the issue to "Selected for Development"
    And I am on the board of the "KAN" project
    Then the card "Suite: card moved by its issue" should be in the "Selected for Development" column
    Given I am signed in as "admin"
    And the issue "Suite: card moved by its issue" is removed

  Scenario: The Scrum board between sprints
    Given I am signed in as "alex"
    And I am on the board of the "SCRUM" project
    Then the board should have no active sprint
    And I should see "There are no active sprints"
