// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IRNG} from "../interfaces/IRNG.sol";
import {IRuleset} from "../interfaces/IRuleset.sol";
import {Action as GameAction, PendingAction as GamePendingAction} from "../libraries/CardEngineLib.sol";
import {ConditionalsLib} from "../libraries/ConditionalsLib.sol";
import {Standard52CardDeckLibx8} from "../libraries/StandardCardDeck.sol";
import {PlayerStoreMap} from "../types/Map.sol";
import {Card} from "../types/Card.sol";


import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint256} from "@fhevm/solidity/lib/FHE.sol";

// import "hardhat/console.sol";

contract MaoRuleset is IRuleset {
    using ConditionalsLib for *;
    using Standard52CardDeckLibx8 for Card;

    IRNG internal rng;

    constructor(address _rng) {
        rng = IRNG(_rng);
    }

    modifier onlyCardEngine() {
        require(msg.sender == address(this), "Only Card Engine can call");
        _;
    }

    function resolveMove(ResolveMoveParams memory params) public onlyCardEngine returns (Effect memory effect) {}

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
    }

    function supportsCardSize(uint256 cardBitsSize) public pure returns (bool) {}
}
