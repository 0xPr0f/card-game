// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IRNG} from "../interfaces/IRNG.sol";
import {IRuleset} from "../interfaces/IRuleset.sol";
import {Action as GameAction, PendingAction as GamePendingAction} from "../libraries/CardEngineLib.sol";
import {ConditionalsLib} from "../libraries/ConditionalsLib.sol";
import {Card, WhotCardStandardLibx8 as Whot} from "../types/Card.sol";
import {PlayerStoreMap} from "../types/Map.sol";

// import "hardhat/console.sol";

contract WhotRuleset is IRuleset {
    using ConditionalsLib for *;
    using Whot for Card;

    uint256 constant CARD_SIZE_8 = 8;
    address immutable CARD_ENGINE_ADDRESS;
    IRNG internal rng;

    constructor(address _rng, address _cardEngineAddress) {
        CARD_ENGINE_ADDRESS = _cardEngineAddress;
        rng = IRNG(_rng);
    }

    modifier onlyCardEngine() {
        require(msg.sender == CARD_ENGINE_ADDRESS, "Only Card Engine can call");
        _;
    }

    function resolveMove(ResolveMoveParams memory params) public onlyCardEngine returns (Effect memory effect) {
        Action[] memory actionsToExec = new Action[](1);
        if (params.gameAction.eqs(GameAction.Play)) {
            if (!params.callCard.matchWhot(params.card)) {
                revert("Cards don't match");
            }
            effect.callCard = params.card;
            if (params.card.pickTwo()) {
                if (params.card.pickFour() && params.isSpecial) {
                    actionsToExec[0].op = EngineOp.PickPendingFour;
                } else {
                    actionsToExec[0].op = EngineOp.PickPendingTwo;
                }
                uint8 nextTurn = params.playerStoreMap.getNextIndex(params.currentPlayerIndex);
                actionsToExec[0].againstPlayerIndex = nextTurn; // Set turn to 1 for pick action
                effect.nextPlayerIndex = nextTurn;
            } else if (params.card.pickThree() && params.isSpecial) {
                actionsToExec[0].op = EngineOp.PickPendingThree;
                uint8 nextTurn = params.playerStoreMap.getNextIndex(params.currentPlayerIndex);
                actionsToExec[0].againstPlayerIndex = nextTurn;
                effect.nextPlayerIndex = nextTurn;
            } else if (params.card.holdOn()) {
                PlayerStoreMap playerStoreMap = params.playerStoreMap;
                effect.nextPlayerIndex =
                    playerStoreMap.getNextIndex(playerStoreMap.getNextIndex(params.currentPlayerIndex)); // Set turn to 1 for hold on op
            } else if (params.card.suspension()) {
                effect.nextPlayerIndex = params.currentPlayerIndex; // Set turn to 0 for suspension op
            } else if (params.card.generalMarket()) {
                actionsToExec[0].op = EngineOp.PickOne;
                actionsToExec[0].againstPlayerIndex = type(uint8).max; // Set turn to 0 for general market op
                effect.nextPlayerIndex = params.currentPlayerIndex;
            } else if (params.card.iWish()) {
                (Whot.CardShape wishShape) = abi.decode(params.extraData, (Whot.CardShape));
                effect.callCard = Whot.makeWhotWish(wishShape);
            } else {
                uint8 nextTurn = params.playerStoreMap.getNextIndex(params.currentPlayerIndex);
                effect.nextPlayerIndex = nextTurn; // Normal play, just advance turn
            }
            if(params.playerDeckMap.isMapEmpty() && effect.nextPlayerIndex == params.currentPlayerIndex){
                // Cannot end game with an action card.
                actionsToExec[0].op = EngineOp.PickOne;
                actionsToExec[0].againstPlayerIndex = params.currentPlayerIndex;
            }
        } else if (params.gameAction.eqs(GameAction.Defend)) {
            effect.callCard = params.callCard;
            if (!params.isSpecial) {
                revert("Defense not enabled");
            }
            uint8 nextTurn = params.playerStoreMap.getNextIndex(params.currentPlayerIndex);
            if (params.pendingAction == 4) {
                actionsToExec[0].op = EngineOp.PickTwo;
                actionsToExec[0].againstPlayerIndex = params.currentPlayerIndex;
            }
            effect.nextPlayerIndex = nextTurn;
        } else if (params.gameAction.eqs(GameAction.Draw)) {
            effect.callCard = params.callCard;
            if (params.pendingAction > 0) {
                actionsToExec[0].op = EngineOp(params.pendingAction % 8);
            } else {
                actionsToExec[0].op = EngineOp.PickOne;
            }
            actionsToExec[0].againstPlayerIndex = params.currentPlayerIndex;
            uint8 nextTurn = params.playerStoreMap.getNextIndex(params.currentPlayerIndex);
            effect.nextPlayerIndex = nextTurn; // Normal play, just advance turn
        } else {
            revert("Invalid action");
        }
        effect.actions = actionsToExec;
    }

    function computeStartIndex(PlayerStoreMap playerStoreMap) public view returns (uint8 startIdx) {
        return uint8(rng.generatePseudoRandomNumber() % playerStoreMap.len());
    }

    function computeNextTurnIndex(PlayerStoreMap playerStoreMap, uint256 currentPlayerIndex)
        public
        pure
        returns (uint8 nextTurnIdx)
    {
        return playerStoreMap.getNextIndex(uint8(currentPlayerIndex));
    }

    function isSpecialMoveCard(Card card) public pure returns (bool) {
        return false;
    }

    function getCardAttributes(Card card, uint256)
        /**
         * cardSize
         */
        public
        pure
        returns (uint256 cardId, uint256 cardValue)
    {
        return (uint256(card.shape()), card.number());
    }

    function supportsCardSize(uint256 cardBitsSize) public pure returns (bool) {
        return cardBitsSize == CARD_SIZE_8;
    }
}
