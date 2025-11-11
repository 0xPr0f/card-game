// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ICardEngine} from "../interfaces/ICardEngine.sol";
import {IManagerHook, IManagerView} from "../interfaces/IManager.sol";
import {Action, PlayerScoreData} from "../libraries/CardEngineLib.sol";
import {Card} from "../types/Card.sol";
import {DeckMap} from "../types/Map.sol";

contract MockManager is IManagerHook, IManagerView {
    ICardEngine public immutable cardEngine;
    bool public allowBootOut;

    constructor(ICardEngine engine) {
        cardEngine = engine;
    }

    function setBootOutPermission(bool allowed) external {
        allowBootOut = allowed;
    }

    function createGame(ICardEngine.CreateGameParams calldata params) external returns (uint256) {
        return cardEngine.createGame(params);
    }

    // IManagerHook
    function onStartGame(uint256) external pure override returns (bool) {
        return false;
    }

    function onJoinGame(uint256, address) external pure override {}

    function onExecuteMove(uint256, address, Card, Action) external pure override returns (bool) {
        return false;
    }

    function onPlayerExit(uint256, address, bool) external pure override {}

    function onFinishGame(uint256, PlayerScoreData[] calldata, uint256[2] calldata) external pure override {}

    // IManagerView
    function hasSpecialMoves(uint256, address, Card, Action) external pure override returns (bool) {
        return false;
    }

    function canBootOut(uint256, address, uint40) external view override returns (bool) {
        return allowBootOut;
    }
}
