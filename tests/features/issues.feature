# Issues the scenarios create are deleted at their end, and a "... is removed" step at the
# start clears what a failed run left. Deleting needs the administrator: an ordinary
# account has no Delete operation in the default permission scheme.
@issues
Feature: The life of an issue
  As a member of a project
  I want to create, edit, move, comment on and assign an issue
  So that the work of the team is recorded where everybody sees it

  @critical
  Scenario: Create an issue in one step and read it back
    Given I am signed in as "admin"
    And the issue "Suite: check the footer links" is removed
    And I am signed in as "alex"
    When I create a "Task" issue in the "Scrum Sample" project with the summary "Suite: check the footer links"
    Then I should see the success message "has been successfully created"
    When I open the issue I created
    Then the issue summary should be "Suite: check the footer links"
    And the issue key should contain "SCRUM-"
    And the issue project should be "Scrum Sample"
    And the issue type should be "Task"
    And the issue status should be "To Do"
    And the issue resolution should be "Unresolved"
    And the issue reporter should be "Alex Tester"
    Given I am signed in as "admin"
    And the issue "Suite: check the footer links" is removed
    Then the issue "Suite: check the footer links" should not exist

  Scenario: Create an issue through the dialog, field by field
    Given I am signed in as "admin"
    And the issue "Suite: search box loses focus" is removed
    And I am signed in as "alex"
    And I am on the "system dashboard" screen
    When I open the create issue dialog
    Then the "Create Issue" dialog should be open
    When I pick "Kanban Sample" in the "Project" field
    And I pick "Bug" in the "Issue Type" field
    And I fill in the "Summary" field of the dialog with "Suite: search box loses focus"
    And I fill in the "Description" field of the dialog with "Typing in the search box stops after the first letter."
    And I pick "High" in the "Priority" field
    And I pick "Sam Reporter" in the "Assignee" field
    And I submit the dialog
    Then I should see the success message "Suite: search box loses focus has been successfully created"
    And the "Create Issue" dialog should not be open
    When I open the issue "Suite: search box loses focus"
    Then the issue type should be "Bug"
    And the issue priority should be "High"
    And the issue assignee should be "Sam Reporter"
    And the issue project should be "Kanban Sample"
    And the issue status should be "Backlog"
    And the issue description should be "Typing in the search box stops after the first letter."
    Given I am signed in as "admin"
    And the issue "Suite: search box loses focus" is removed

  Scenario: The create dialog refuses an issue without a summary
    Given I am signed in as "alex"
    And I am on the "system dashboard" screen
    When I open the create issue dialog
    And I pick "Scrum Sample" in the "Project" field
    Then I should not see the field error "You must specify a summary of the issue."
    When I submit the dialog expecting errors
    Then the "Create Issue" dialog should be open
    And I should see the error message "There is 1 error in this form."
    And I should see the field error "You must specify a summary of the issue."
    When I cancel the dialog
    Then the "Create Issue" dialog should not be open

  Scenario: Edit the summary and the description
    Given I am signed in as "admin"
    And the issue "Suite: export the report" is removed
    And the issue "Suite: export the report as PDF" is removed
    And I am signed in as "alex"
    When I create a "Story" issue in the "SCRUM" project with the summary "Suite: export the report"
    And I open the issue I created
    And I change the issue summary to "Suite: export the report as PDF"
    Then the issue summary should be "Suite: export the report as PDF"
    And I should see the success message "has been updated."
    When I change the issue description to "The report has a button that saves it as a PDF file."
    Then the issue description should contain "saves it as a PDF file"
    And the issue description should not contain "spreadsheet"
    When I open the edit issue dialog
    Then the "Edit Issue" dialog should be open
    When I cancel the dialog
    Then the "Edit Issue" dialog should not be open
    And the issue summary should be "Suite: export the report as PDF"
    Given I am signed in as "admin"
    And the issue "Suite: export the report as PDF" is removed

  Scenario: Move an issue through the workflow
    Given I am signed in as "admin"
    And the issue "Suite: tidy the release page" is removed
    And I am signed in as "alex"
    When I create a "Task" issue in the "Scrum Sample" project with the summary "Suite: tidy the release page"
    And I open the issue I created
    Then the issue status should be "To Do"
    And the issue should offer the "In Progress" transition
    And the issue should offer the "Done" transition
    When I move the issue to "In Progress"
    Then the issue status should be "In Progress"
    And the issue resolution should be "Unresolved"
    When I move the issue to "Done"
    Then the issue status should be "Done"
    And the issue resolution should be "Done"
    And the issue should offer the "To Do" transition
    Given I am signed in as "admin"
    And the issue "Suite: tidy the release page" is removed

  Scenario: Comment on an issue and delete the comment
    Given I am signed in as "admin"
    And the issue "Suite: review the help page" is removed
    And I am signed in as "alex"
    When I create a "Task" issue in the "Kanban Sample" project with the summary "Suite: review the help page"
    And I open the issue I created
    And I comment "Checked on the staging site, the page reads well." on the issue
    Then I should see the comment "Checked on the staging site" on the issue
    And the comment "Checked on the staging site" should be by "Alex Tester"
    And the comment "Checked on the staging site" should not be by "Sam Reporter"
    And I should not see the comment "Never written" on the issue
    When I delete the comment "Checked on the staging site" from the issue
    Then I should not see the comment "Checked on the staging site" on the issue
    Given I am signed in as "admin"
    And the issue "Suite: review the help page" is removed

  Scenario: A second person reads the comment of the first
    Given I am signed in as "admin"
    And the issue "Suite: agree on the colours" is removed
    And I am signed in as "alex"
    When I create a "Task" issue in the "Scrum Sample" project with the summary "Suite: agree on the colours"
    And I open the issue I created
    And I comment "Blue for links, please." on the issue
    Given I am signed in as "sam"
    When I open the issue "Suite: agree on the colours"
    Then I should see the comment "Blue for links, please." on the issue
    And the comment "Blue for links, please." should be by "Alex Tester"
    Given I am signed in as "admin"
    And the issue "Suite: agree on the colours" is removed

  Scenario: Assign an issue to a person and to myself
    Given I am signed in as "admin"
    And the issue "Suite: write the changelog" is removed
    And I am signed in as "alex"
    When I create a "Task" issue in the "Scrum Sample" project with the summary "Suite: write the changelog"
    And I open the issue I created
    And I assign the issue to "Sam Reporter"
    Then the issue assignee should be "Sam Reporter"
    And I should see the success message "has been assigned."
    When I close the messages on top of the page
    Then I should not see the success message "has been assigned."
    When I assign the issue to me
    Then the issue assignee should be "Alex Tester"
    And the issue assignee should not be "Sam Reporter"
    Given I am signed in as "admin"
    And the issue "Suite: write the changelog" is removed

  Scenario: Delete an issue
    Given I am signed in as "admin"
    And the issue "Suite: remove me" is removed
    When I create a "Task" issue in the "Kanban Sample" project with the summary "Suite: remove me"
    Then the issue "Suite: remove me" should exist
    When I open the issue I created
    And I delete the issue
    Then I should see the success message "has been deleted."
    And the issue "Suite: remove me" should not exist
