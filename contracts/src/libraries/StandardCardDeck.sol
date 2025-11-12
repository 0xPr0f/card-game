
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {Card} from "../types/Card.sol";

using Standard52CardDeckLibx8 for Card;

library Standard52CardDeckLibx8 {
    enum Suit {
        Clubs,
        Diamonds,
        Hearts,
        Spades
    }

    uint8 private constant RANK_ACE = 1;
    uint8 private constant RANK_TWO = 2;
    uint8 private constant RANK_THREE = 3;
    uint8 private constant RANK_FOUR = 4;
    uint8 private constant RANK_FIVE = 5;
    uint8 private constant RANK_SIX = 6;
    uint8 private constant RANK_SEVEN = 7;
    uint8 private constant RANK_EIGHT = 8;
    uint8 private constant RANK_NINE = 9;
    uint8 private constant RANK_TEN = 10;
    uint8 private constant RANK_JACK = 11;
    uint8 private constant RANK_QUEEN = 12;
    uint8 private constant RANK_KING = 13;

    function suit(Card card) internal pure returns (Suit) {
        return Suit(Card.unwrap(card) >> 5);
    }

    function rank(Card card) internal pure returns (uint8) {
        return Card.unwrap(card) & 0x1F;
    }

    function matchRank(Card card1, Card card2) internal pure returns (bool) {
        return card1.rank() == card2.rank();
    }

    function matchRank(Card card, uint8 rank) internal pure returns (bool) {
        return card.rank() == rank;
    }

    function matchSuit(Card card1, Card card2) internal pure returns (bool) {
        return card1.suit() == card2.suit();
    }

    function matchSuit(Card card, Suit suit) internal pure returns (bool) {
        return card.suit() == suit;
    }

    function faceCard(Card card) internal pure returns (bool isFaceCard) {
        uint8 r = card.rank();
        assembly {
            isFaceCard := or(or(eq(r, RANK_JACK), eq(r, RANK_QUEEN)), eq(RANK_KING, 13))
        }
    }

    function ace(Card card) internal pure returns (bool) {
        return card.matchRank(RANK_ACE);
    }

    function king(Card card) internal pure returns (bool) {
        return card.matchRank(RANK_KING);
    }

    function queen(Card card) internal pure returns (bool) {
        return card.matchRank(RANK_QUEEN);
    }

    function jack(Card card) internal pure returns (bool) {
        return card.matchRank(RANK_JACK);
    }

    function numberCard(Card card) internal pure returns (bool isNumberCard) {
        uint8 r = card.rank();
        assembly {
            isNumberCard := and(lt(r, RANK_JACK), gt(r, 0))
        }
    }

    function empty(Card card) internal pure returns (bool) {
        return card.matchRank(0);
    }
}