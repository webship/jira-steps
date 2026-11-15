# What an administrator reaches and an ordinary account does not. Nothing is changed:
# the suite reads the settings and the list of accounts, it never creates or deletes one.
@administration
Feature: Project settings and administration
  As an administrator
  I want the settings of a project and the administration of the site
  So that I can set up how the team works

  @critical
  Scenario: An administrator opens the settings of a project
    Given I am signed in as "admin"
    And I am on the "summary" settings of the "SCRUM" project
    Then I should see the settings of the "Scrum Sample" project

  Scenario: The sections of the project settings
    Given I am signed in as "admin"
    And I am on the "users and roles" settings of the "SCRUM" project
    Then I should see the settings of the "Scrum Sample" project
    And I should see "Users and roles"
    And I should see "Project lead"
    Given I am on the "workflows" settings of the "KAN" project
    Then I should see the settings of the "Kanban Sample" project
    And I should see "Workflows"

  Scenario: The project sidebar of an administrator leads to the settings
    Given I am signed in as "admin"
    And I am on the "SCRUM" project
    Then I should see "Project settings" in the project sidebar
    When I open "Project settings" in the project sidebar
    Then I should see the settings of the "Scrum Sample" project

  Scenario: An ordinary account is refused the settings of a project
    Given I am signed in as "alex"
    And I am on the "summary" settings of the "SCRUM" project
    Then I should be refused the project settings
    And I should see "You cannot edit the configuration of this project."

  Scenario: The list of accounts
    Given I am signed in as "admin"
    And I am on the "user management" screen
    Then I should be in the administration area
    And I should see the account "alex" in the user list
    And I should see the account "sam" in the user list
    And I should not see the account "nobody-with-this-name" in the user list

  Scenario: The system settings
    Given I am signed in as "admin"
    And I am on the "system settings" screen
    Then I should be in the administration area
    And I should see "Webship Test Site"

  Scenario: The pages of the site are not in the administration area
    Given I am signed in as "admin"
    And I am on the "projects" screen
    Then I should not be in the administration area
