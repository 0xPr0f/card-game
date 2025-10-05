// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IManagerHook, IManagerView} from "../interfaces/IManager.sol";
import {Action} from "../libraries/CardEngineLib.sol";
import {Card} from "../types/Card.sol";

type HookPermissions is uint8;

library Hook {
    uint8 constant ON_START_GAME_FLAG = 1 << 0;
    uint8 constant ON_JOIN_GAME_FLAG = 1 << 1;
    uint8 constant ON_EXECUTE_MOVE_FLAG = 1 << 2;
    uint8 constant ON_FINISH_GAME_FLAG = 1 << 3;

    function callHook() internal returns (bytes memory retData) {}
    function onStartGame(IManagerHook hook, HookPermissions permissions, uint256 gameId) internal returns (bool) {}
    function onJoinGame(IManagerHook hook, HookPermissions permissions, uint256 gameId, address player) internal {}
    function onExecuteMove(
        IManagerHook hook,
        HookPermissions permissions,
        uint256 gameId,
        address player,
        Card playingCard,
        Action action
    ) internal {}
    function onFinishGame(
        IManagerHook hook,
        HookPermissions permissions,
        uint256 gameId,
        uint256[] memory playersScoreData
    ) internal {}
    function hasSpecialMoves(
        IManagerView hook,
        HookPermissions permissions,
        uint256 gameId,
        address player,
        Card playingCard,
        Action action
    ) internal view returns (bool) {}

    function canBootOut(
        IManagerView hook,
        HookPermissions permissions,
        uint256 gameId,
        address player,
        uint40 playerLastMoveTimestamp,
        bool defaultResult
    ) internal view returns (bool) {}
}
