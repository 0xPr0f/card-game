// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IRNG} from "../interfaces/IRNG.sol";
import {IRuleset} from "../interfaces/IRuleset.sol";
import {Action as GameAction, PendingAction as GamePendingAction} from "../libraries/CardEngineLib.sol";
import {ConditionalsLib} from "../libraries/ConditionalsLib.sol";
import {Standard52CardDeckLibx8} from "../libraries/StandardCardDeck.sol";
import {PlayerStoreMap} from "../types/Map.sol";

import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint256} from "@fhevm/solidity/lib/FHE.sol";

// import "hardhat/console.sol";

// This contract contains the rules for the Whot game.
// It includes functions to validate moves, check game state, etc.
contract PokerRuleset {}
