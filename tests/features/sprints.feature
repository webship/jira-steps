# The Scrum board of the SCRUM project has no sprint between runs. The scenarios create
# their own sprint and issue and remove both; a completed sprint has no delete in the
# screens, so "the sprint ... is removed from the ... project" removes it.
@sprints
Feature: The backlog and a sprint
  As a member of a Scrum team
  I want to plan a sprint from the backlog, start it and complete it
  So that the team works on an agreed set of issues

  @critical
  Scenario: The backlog lists the open issues of the project
    Given I am signed in as "alex"
    And I am on the backlog of the "SCRUM" project
    Then the issue "SCRUM-1" should be in the backlog
    And the issue "Fix the login redirect" should be in the backlog
    And the issue "Write the release notes" should be in the backlog
    And the issue "KAN-1" should not be in the backlog
    And I should not see the sprint "Suite Sprint" in the backlog

  Scenario: Create a sprint and delete it
    Given I am signed in as "alex"
    And the sprint "Suite Planning Sprint" is removed from the "SCRUM" project
    And I am on the backlog of the "SCRUM" project
    When I create the sprint "Suite Planning Sprint"
    Then I should see the success message "Sprint Suite Planning Sprint has been created."
    And I should see the sprint "Suite Planning Sprint" in the backlog
    And the sprint "Suite Planning Sprint" should not be active
    When I delete the sprint "Suite Planning Sprint"
    Then I should see the success message "Sprint Suite Planning Sprint has been deleted."
    And I should not see the sprint "Suite Planning Sprint" in the backlog

  Scenario: Plan, start and complete a sprint
    Given I am signed in as "admin"
    And the issue "Suite: sprint work" is removed
    And I am signed in as "alex"
    And the sprint "Suite Sprint" is removed from the "SCRUM" project
    When I create a "Story" issue in the "Scrum Sample" project with the summary "Suite: sprint work"
    And I am on the backlog of the "SCRUM" project
    Then the issue "Suite: sprint work" should be in the backlog
    When I create the sprint "Suite Sprint"
    And I add the issue "Suite: sprint work" to the sprint "Suite Sprint"
    Then the issue "Suite: sprint work" should be in the sprint "Suite Sprint"
    And the issue "Suite: sprint work" should not be in the backlog
    And the issue "SCRUM-1" should not be in the sprint "Suite Sprint"
    When I start the sprint "Suite Sprint"
    Then I should see the success message "Sprint Suite Sprint has successfully been started."
    And the board should show the sprint "Suite Sprint"
    And the board columns should be "To Do, In Progress, Done"
    And the card "Suite: sprint work" should be in the "To Do" column
    When I move the card "Suite: sprint work" to the "In Progress" column
    Then the card "Suite: sprint work" should be in the "In Progress" column
    Given I am on the backlog of the "SCRUM" project
    Then the sprint "Suite Sprint" should be active
    Given I am on the board of the "SCRUM" project
    When I complete the active sprint
    Then I should see "Sprint Report"
    Given I am on the board of the "SCRUM" project
    Then the board should have no active sprint
    Given I am on the backlog of the "SCRUM" project
    Then the issue "Suite: sprint work" should be in the backlog
    And I should not see the sprint "Suite Sprint" in the backlog
    Given the sprint "Suite Sprint" is removed from the "SCRUM" project
    And I am signed in as "admin"
    And the issue "Suite: sprint work" is removed
