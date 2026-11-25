Feature: Create a receipt room through the MCP server
  An assistant that has read a receipt asks the MCP server for a room,
  and the people at the table open the link it returns.

  Background:
    Given Claude has read a receipt from "Luigi's" for "Alice" and "Bob":
      | item   | price |
      | Burger | 12.00 |
      | Fries  |  4.00 |

  Scenario: The link opens a room holding the receipt
    When Claude creates a receipt room
    And Alice opens the room link Claude was given
    Then Alice sees the receipt titled "Luigi's"
    And Alice sees "Burger" priced at "$12.00" and unclaimed
    And Alice sees "Fries" priced at "$4.00" and unclaimed

  Scenario: A receipt with a duplicated item id is refused
    Given Claude gave "Fries" the same id as "Burger"
    When Claude creates a receipt room
    Then Claude is told the receipt is invalid because "\"item-0\" is duplicated"

  Scenario: An empty item id that reads as another item's id is refused, saying how to fix it
    Given Claude gave "Burger" the id "item-1"
    And Claude gave "Fries" the id ""
    When Claude creates a receipt room
    Then Claude is told the receipt is invalid because "read as \"item-1\", which items[0] already uses"
    And Claude is told the receipt is invalid because "give each item its own id"

  Scenario: Claude fixes a refused receipt and tries again
    Given Claude gave "Burger" the id "item-1"
    And Claude gave "Fries" the id ""
    And Claude has created a receipt room
    And Claude gave "Fries" the id "item-2"
    When Claude creates a receipt room
    And Alice opens the room link Claude was given
    Then Alice sees "Burger" priced at "$12.00" and unclaimed
    And Alice sees "Fries" priced at "$4.00" and unclaimed
