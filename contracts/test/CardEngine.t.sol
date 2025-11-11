// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {CardEngine} from "../src/CardEngine.sol";

import {EInputData, InputOneType} from "../src/base/EInputHandler.sol";
import {ICardEngine} from "../src/interfaces/ICardEngine.sol";
import {IRuleset} from "../src/interfaces/IRuleset.sol";
import {GameStatus} from "../src/libraries/CardEngineLib.sol";
import {MockACL, MockDecryptionOracle, MockFHEExecutor, MockKMSVerifier} from "../src/mocks/FHEMocks.sol";
import {MockRNG} from "../src/mocks/MockRng.sol";
import {WhotRuleset} from "../src/rules/WhotRuleSet.sol";

import {Card} from "../src/types/Card.sol";

import {HookPermissions} from "../src/types/Hook.sol";
import {externalEuint128, externalEuint256, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

contract CardEngineTest is Test {
    CardEngine internal engine;
    WhotRuleset internal ruleset;
    MockRNG internal rng;

    MockACL internal acl;
    MockDecryptionOracle internal oracle;
    MockKMSVerifier internal kms;
    MockFHEExecutor internal executor;

    address internal alice = address(0xA11CE);
    address internal player0 = address(0xB0);
    address internal player1 = address(0xB1);
    address internal player2 = address(0xB2);

    // Slot defined inside Impl.sol (CoprocessorConfigLocation).
    bytes32 internal constant FHE_CONFIG_SLOT = 0x9e7b61f58c47dc699ac88507c4f5bb9f121c03808c5676a8078fe583e4649700;

    bytes32 internal constant WHOT_PACKED_LOWER =
        bytes32(0x2d2b2a27252322214e4d4c4b4a484745444342410e0d0c0b0a08070504030201);
    bytes32 internal constant WHOT_PACKED_UPPER =
        bytes32(0x00000000000000000000b4b4b4b4b4888785848382816e6d6b6a67656362612e);
    uint8 internal constant WHOT_DECK_SIZE = 54;

    function setUp() public {
        acl = new MockACL();
        oracle = new MockDecryptionOracle();
        kms = new MockKMSVerifier();
        executor = new MockFHEExecutor();

        engine = new CardEngine();
        rng = new MockRNG(12345);
        ruleset = new WhotRuleset(address(rng), address(engine));

        _patchFHEConfig();
    }

    function testCreateJoinAndStartGame() public {
        ICardEngine.CreateGameParams memory params = _defaultCreateParams();

        vm.prank(alice);
        uint256 gameId = engine.createGame(params);

        vm.prank(player0);
        engine.joinGame(gameId);

        vm.prank(player1);
        engine.joinGame(gameId);

        vm.prank(player2);
        engine.joinGame(gameId);

        vm.prank(alice);
        engine.startGame(gameId);

        (address creator,,, GameStatus status,, uint8 maxPlayers, uint8 playersLeftToJoin,,,,, uint8 initialHandSize) =
            engine.getGameData(gameId);

        assertEq(creator, alice, "creator mismatch");
        assertEq(uint8(status), uint8(GameStatus.Started), "status should be Started");
        assertEq(playersLeftToJoin, 0, "no players should remain");
        assertEq(maxPlayers, params.maxPlayers, "max players stored");
        assertEq(initialHandSize, params.initialHandSize, "initial hand size stored");
    }

    /*//////////////////////////////////////////////////////////////
    // Helpers
    //////////////////////////////////////////////////////////////*/

    function _patchFHEConfig() internal {
        vm.store({target: address(engine), slot: FHE_CONFIG_SLOT, value: bytes32(uint256(uint160(address(acl))))});
        vm.store({
            target: address(engine),
            slot: bytes32(uint256(FHE_CONFIG_SLOT) + 1),
            value: bytes32(uint256(uint160(address(executor))))
        });
        vm.store({
            target: address(engine),
            slot: bytes32(uint256(FHE_CONFIG_SLOT) + 2),
            value: bytes32(uint256(uint160(address(oracle))))
        });
        vm.store({
            target: address(engine),
            slot: bytes32(uint256(FHE_CONFIG_SLOT) + 3),
            value: bytes32(uint256(uint160(address(kms))))
        });
    }

    function _defaultCreateParams() internal view returns (ICardEngine.CreateGameParams memory params) {
        params.gameRuleset = IRuleset(address(ruleset));
        params.cardBitSize = 8;
        params.cardDeckSize = uint8(WHOT_DECK_SIZE);
        params.maxPlayers = 3;
        params.initialHandSize = 2;
        params.proposedPlayers = new address[](3);
        params.proposedPlayers[0] = player0;
        params.proposedPlayers[1] = player1;
        params.proposedPlayers[2] = player2;
        params.hookPermissions = HookPermissions.wrap(0);
        params.inputData = _buildInputData();
        params.inputProof = hex"";
    }

    function _buildInputData() internal pure returns (EInputData memory inputData) {
        inputData.inputZero = externalEuint256.wrap(WHOT_PACKED_LOWER);
        inputData.inputOneType = InputOneType._EUINT256;
        inputData.inputOne64 = externalEuint64.wrap(bytes32(0));
        inputData.inputOne128 = externalEuint128.wrap(bytes32(0));
        inputData.inputOne256 = externalEuint256.wrap(WHOT_PACKED_UPPER);
    }
}
