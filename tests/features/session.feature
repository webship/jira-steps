# The accounts "admin", "alex" and "sam" are in the users registry of cucumber.js; the
# site build created them (see site/build-jira-site.sh). No scenario creates an account.
@session
Feature: Signing in and out
  As a person with an account
  I want to sign in to and out of the site
  So that I reach my work and nobody else reaches it after me

  @critical
  Scenario: The sign-in page shows the sign-in form
    Given I am not signed in
    And I am on the sign-in page
    Then I should see the sign-in form
    And I should not be signed in
    And I should not see the sign-in error "Incorrect username or password."

  @critical
  Scenario: An account of the registry signs in
    Given I am signed in as "alex"
    Then I should be signed in
    And I should be signed in as "alex"
    And I should not be signed in as "admin"
    And I should not see the sign-in form

  Scenario: Signing in through the form opens the dashboard
    Given I am not signed in
    And I am on the sign-in page
    When I sign in with the "sam" account
    Then I should be signed in as "sam"
    And I should see "System Dashboard"

  Scenario: A wrong password is refused with an error
    Given I am not signed in
    When I sign in as "alex" with the password "not-the-right-password"
    Then I should see the sign-in error "Incorrect username or password."
    And I should not be signed in
    And I should see the sign-in form

  Scenario: An unknown account is refused with the same error
    Given I am not signed in
    When I sign in as "nobody-with-this-name" with the password "whatever"
    Then I should see the sign-in error "Incorrect username or password."
    And I should not be signed in

  Scenario: Signing out ends the session
    Given I am signed in as "alex"
    When I sign out
    Then I should not be signed in
    And I should see "You are now logged out"

  Scenario: Switching accounts signs the first one out
    Given I am signed in as "alex"
    And I am signed in as "admin"
    Then I should be signed in as "admin"
    And I should not be signed in as "alex"

  Scenario: A visitor is asked to sign in before seeing an issue
    Given I am not signed in
    When I go to "/browse/SCRUM-1"
    Then I should be asked to sign in
    And I should see "You must log in to access this page."

  Scenario: An ordinary account is asked to sign in again for an administration page
    Given I am signed in as "alex"
    When I go to "/secure/admin/ViewApplicationProperties.jspa"
    Then I should be asked to sign in
