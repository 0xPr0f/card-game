// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// import {SepoliaConfig} from "fhevm/config/ZamaConfig.sol";
import {FHE, euint256, euint8} from "@fhevm/solidity/lib/FHE.sol";

import {Action} from "../libraries/CardEngineLib.sol";
import {DeckMap} from "../types/Map.sol";

abstract contract AsyncHandler {
    using FHE for *;

    // uint256 immutable MAX_CALLBACK_DELAY;
    uint256 private _latestRequest;

    mapping(uint256 requestId => CommittedMoveData) private requestToCommittedMove;
    // mapping(uint256 gameId => uint256 requestId) private committedMoveToGatewayRequest;
    mapping(uint256 requestId => CommittedMarketDeck) private requestToCommittedMarketDeck;
    mapping(uint256 gameId => mapping(uint256 req => bool)) private _isLatestRequest;
    mapping(uint256 gameId => bool) private _hasCommittedAction;

    mapping(uint256 requestId => bool) private _isRequestIdCommittedMove;

    struct CommittedMoveData {
        Action action;
        uint40 timestamp;
        uint8 playerIndex;
        uint8 cardIndex;
        uint256 gameId;
        bytes extraData;
    }

    struct CommittedMarketDeck {
        uint256 gameId;
        euint256[2] marketDeck;
    }

    function _commitMove(
        uint256 gameId,
        euint8 cardToCommit,
        Action action,
        uint256 cardIndex,
        uint256 playerIndex,
        bytes memory extraData
    ) internal {
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(cardToCommit);

        uint256 reqId = FHE.requestDecryption(cts, this.handleCommitMove.selector);

        CommittedMoveData memory cc = CommittedMoveData({
            action: action,
            timestamp: uint40(block.timestamp),
            playerIndex: uint8(playerIndex),
            cardIndex: uint8(cardIndex),
            gameId: gameId,
            extraData: extraData
        });

        _hasCommittedAction[gameId] = true;
        _isLatestRequest[gameId][reqId] = true;
        requestToCommittedMove[reqId] = cc;
        // committedMoveToGatewayRequest[gameId] = reqId;
    }

    function _commitMarketDeck(uint256 gameId, euint256[2] memory marketDeck) internal {
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(marketDeck[0]);
        cts[1] = FHE.toBytes32(marketDeck[1]);

        uint256 reqId = FHE.requestDecryption(cts, this.handleCommitMarketDeck.selector);

        CommittedMarketDeck memory committedMarketDeck = CommittedMarketDeck({gameId: gameId, marketDeck: marketDeck});
        // committedMarketDeck.gameId = gameId;
        // committedMarketDeck.playerIndexes = playerIndexes;
        _hasCommittedAction[gameId] = true;
        _isLatestRequest[gameId][reqId] = true;
        requestToCommittedMarketDeck[reqId] = committedMarketDeck;
    }

    function __validateCallbackSignature(
        uint256 reqId,
        bytes memory clearTexts,
        uint256 gameId,
        bytes memory decryptionProof
    ) internal {
        if (!_isLatestRequest[gameId][reqId]) revert();
        FHE.checkSignatures(reqId, clearTexts, decryptionProof);
    }

    function getCommittedMove(uint256 reqId) internal view returns (CommittedMoveData memory) {
        return requestToCommittedMove[reqId];
    }

    function getCommittedMarketDeck(uint256 reqId) internal view returns (CommittedMarketDeck memory) {
        return requestToCommittedMarketDeck[reqId];
    }

    function hasCommittedAction(uint256 gameId) internal view returns (bool) {
        // return committedMoveToGatewayRequest[gameId] != 0;
        return _hasCommittedAction[gameId];
    }

    function isReqComittedMove(uint256 reqId) internal view returns (bool) {
        return _isRequestIdCommittedMove[reqId];
    }

    function _clearCommitment(uint256 gameId, uint256 reqId) internal {
        // committedMoveToGatewayRequest[gameId] = 0;
        _hasCommittedAction[gameId] = false;
        _isLatestRequest[gameId][reqId] = false;
    }

    function _clearLatestCommittedMove(uint256 gameId, uint256 playerIndex) internal {
        uint256 latestReqId = _latestRequest;
        if (isReqComittedMove(latestReqId) && getCommittedMove(latestReqId).playerIndex == playerIndex) {
            _clearCommitment(gameId, latestReqId);
        }
    }

    function isLatestRequest(uint256 gameId, uint256 reqId) internal view returns (bool) {
        return _isLatestRequest[gameId][reqId];
    }

    function handleCommitMove(uint256 requestId, bytes memory clearTexts, bytes memory signatures) external virtual;
    function handleCommitMarketDeck(uint256 requestId, bytes memory clearTexts, bytes memory signatures)
        external
        virtual;
}
