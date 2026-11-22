Feature: Split a receipt live
  Everyone at the table opens the same room on their own phone,
  and each claim shows up for everyone straight away.

  Background:
    Given Claude has read a receipt from "Luigi's" for "Alice" and "Bob":
      | item   | price |
      | Burger | 12.00 |
      | Fries  | 4.00  |
    And Claude has created a receipt room
    And Alice has opened the room link Claude was given
    And Bob has joined Alice's room

  Scenario: A claim shows up for everyone in the room
    When Alice claims "Burger"
    Then Bob sees "Burger" claimed by one person
    And Bob sees that Alice owes "$12.00"

  Scenario: Two people share an item
    When Alice claims "Fries"
    And Bob claims "Fries"
    Then Alice sees "Fries" split at "$2.00 each"
    And Alice sees that Bob owes "$2.00"
