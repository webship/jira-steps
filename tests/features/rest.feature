# The REST resources of the application, through webship-js's own REST steps: a REST
# request carries the cookies of the browser, so it is made as the signed-in account.
@rest
Feature: The REST resources behind the screens
  As a tester
  I want to check a REST resource with the session of the browser
  So that a scenario can assert what the screens and the resources agree on

  @critical
  Scenario: The signed-in account
    Given I am signed in as "alex"
    When I send a REST "GET" request to "/rest/api/2/myself"
    Then the REST response status code should be 200
    And the REST response should contain "Alex Tester"
    And the REST response should contain "alex@example.com"

  Scenario: A seeded issue
    Given I am signed in as "alex"
    When I send a REST "GET" request to "/rest/api/2/issue/SCRUM-2?fields=summary,status"
    Then the REST response status code should be 200
    And the REST response should contain "Fix the login redirect"
    And the REST response should contain "To Do"

  Scenario: An issue that does not exist
    Given I am signed in as "alex"
    When I send a REST "GET" request to "/rest/api/2/issue/SCRUM-99999"
    Then the REST response status code should be 404
    And the REST response should contain "Issue Does Not Exist"

  Scenario: A search with a query
    Given I am signed in as "alex"
    When I send a REST "GET" request to "/rest/api/2/search?jql=project%20%3D%20KAN&fields=summary"
    Then the REST response status code should be 200
    And the REST response should contain "Review the style guide"
    And the REST response should contain "Broken link in the footer"

  Scenario: The boards of a project
    Given I am signed in as "alex"
    When I send a REST "GET" request to "/rest/agile/1.0/board?projectKeyOrId=SCRUM"
    Then the REST response status code should be 200
    And the REST response should contain "SCRUM board"
    And the REST response should contain "scrum"

  Scenario: A visitor is refused
    Given I am not signed in
    When I send a REST "GET" request to "/rest/api/2/myself"
    Then the REST response status code should be 401

  Scenario: An ordinary account is refused an administrator resource
    Given I am signed in as "alex"
    When I send a REST "GET" request to "/rest/api/2/user?username=sam"
    Then the REST response status code should be 200
    When I send a REST "GET" request to "/rest/api/2/application-properties"
    Then the REST response status code should be 403
