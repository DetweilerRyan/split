Feature: Use the room without barriers
  People who use a screen reader, a keyboard or their voice can use every window in the room.
  An automated check finds the barriers it can; people still check the rest by hand.

  Scenario Outline: Nothing in the <window> window stands in the way
    Given Claude has read a receipt from "Luigi's" for "Alice" and "Bob":
      | item   | price |
      | Burger | 12.00 |
    And Claude has created a receipt room
    And Alice has opened the room link Claude was given
    When Alice opens the <window> window
    Then Alice finds no accessibility barriers on the screen

    Examples:
      | window             |
      | share              |
      | restaurant details |
      | who's at the table |
      | receipt presets    |
