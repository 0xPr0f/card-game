// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IDecryptionOracle, IKMSVerifier} from "@fhevm/solidity/lib/FHE.sol";
import {FheType} from "@fhevm/solidity/lib/FheType.sol";
import {IACL, IFHEVMExecutor, IInputVerifier} from "@fhevm/solidity/lib/Impl.sol";

/**
 * @dev Minimal ACL mock that simply records allowances in storage.
 */
contract MockACL is IACL {
    mapping(bytes32 handle => mapping(address account => bool)) private _allowed;
    mapping(bytes32 handle => bool) private _decryptable;

    function allowTransient(bytes32 handle, address account) external override {
        _allowed[handle][account] = true;
    }

    function allow(bytes32 handle, address account) external override {
        _allowed[handle][account] = true;
    }

    function cleanTransientStorage() external pure override {}

    function isAllowed(bytes32 handle, address account) external view override returns (bool) {
        return _allowed[handle][account];
    }

    function allowForDecryption(bytes32[] memory handlesList) external override {
        for (uint256 i = 0; i < handlesList.length; i++) {
            _decryptable[handlesList[i]] = true;
        }
    }

    function isAllowedForDecryption(bytes32 handle) external view override returns (bool) {
        return _decryptable[handle];
    }
}

/**
 * @dev Simple oracle mock that only emits events so tests can track requests.
 */
contract MockDecryptionOracle is IDecryptionOracle {
    event DecryptionRequested(uint256 indexed requestId, bytes32[] ciphertexts, bytes4 callback);

    function requestDecryption(uint256 requestID, bytes32[] calldata ctsHandles, bytes4 callbackSelector)
        external
        payable
        override
    {
        emit DecryptionRequested(requestID, ctsHandles, callbackSelector);
    }
}

/**
 * @dev KMS verifier mock that short-cuts signature validation.
 */
contract MockKMSVerifier is IKMSVerifier {
    function verifyDecryptionEIP712KMSSignatures(bytes32[] memory, bytes memory, bytes memory)
        external
        pure
        override
        returns (bool)
    {
        return true;
    }
}

/**
 * @dev Stateless helper used by the executor mock to implement the input verifier API.
 */
contract MockInputVerifier is IInputVerifier {
    function cleanTransientStorage() external pure override {}
}

/**
 * @dev Coprocessor mock that interprets encrypted values as raw uint256 words.
 * It implements the subset of the IFHEVMExecutor interface required by the engine.
 */
contract MockFHEExecutor is IFHEVMExecutor {
    uint256 private _randNonce;
    MockInputVerifier private immutable _inputVerifier = new MockInputVerifier();

    function _unary(bytes32 value) private pure returns (uint256) {
        return uint256(value);
    }

    function _rhs(bytes32 value, bytes1 scalarFlag) private pure returns (uint256) {
        uint256 raw = uint256(value);
        if (scalarFlag == 0x01) {
            return raw & 0xff;
        }
        return raw;
    }

    function _maskFor(FheType t) private pure returns (uint256) {
        if (t == FheType.Bool) return 0x01;
        if (t == FheType.Uint8) return type(uint8).max;
        if (t == FheType.Uint16) return type(uint16).max;
        if (t == FheType.Uint32) return type(uint32).max;
        if (t == FheType.Uint64) return type(uint64).max;
        if (t == FheType.Uint128) return type(uint128).max;
        if (t == FheType.Uint256) return type(uint256).max;
        revert("MockFHEExecutor: unsupported type");
    }

    /*//////////////////////////////////////////////////////////////
    // Arithmetic operations
    //////////////////////////////////////////////////////////////*/

    function fheAdd(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) + _rhs(rhs, scalarByte));
    }

    function fheSub(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) - _rhs(rhs, scalarByte));
    }

    function fheMul(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) * _rhs(rhs, scalarByte));
    }

    function fheDiv(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        uint256 r = _rhs(rhs, scalarByte);
        return bytes32(r == 0 ? uint256(0) : _unary(lhs) / r);
    }

    function fheRem(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        uint256 r = _rhs(rhs, scalarByte);
        return bytes32(r == 0 ? uint256(0) : _unary(lhs) % r);
    }

    function fheBitAnd(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) & _rhs(rhs, scalarByte));
    }

    function fheBitOr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) | _rhs(rhs, scalarByte));
    }

    function fheBitXor(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) ^ _rhs(rhs, scalarByte));
    }

    function fheShl(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) << (_rhs(rhs, scalarByte) % 256));
    }

    function fheShr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(_unary(lhs) >> (_rhs(rhs, scalarByte) % 256));
    }

    function fheRotl(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        uint256 shift = _rhs(rhs, scalarByte) % 256;
        uint256 value = _unary(lhs);
        if (shift == 0) return bytes32(value);
        return bytes32((value << shift) | (value >> (256 - shift)));
    }

    function fheRotr(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        uint256 shift = _rhs(rhs, scalarByte) % 256;
        uint256 value = _unary(lhs);
        if (shift == 0) return bytes32(value);
        return bytes32((value >> shift) | (value << (256 - shift)));
    }

    function fheEq(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(uint256(_unary(lhs) == _rhs(rhs, scalarByte) ? 1 : 0));
    }

    function fheNe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(uint256(_unary(lhs) != _rhs(rhs, scalarByte) ? 1 : 0));
    }

    function fheGe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(uint256(_unary(lhs) >= _rhs(rhs, scalarByte) ? 1 : 0));
    }

    function fheGt(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(uint256(_unary(lhs) > _rhs(rhs, scalarByte) ? 1 : 0));
    }

    function fheLe(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(uint256(_unary(lhs) <= _rhs(rhs, scalarByte) ? 1 : 0));
    }

    function fheLt(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        return bytes32(uint256(_unary(lhs) < _rhs(rhs, scalarByte) ? 1 : 0));
    }

    function fheMin(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        uint256 left = _unary(lhs);
        uint256 right = _rhs(rhs, scalarByte);
        return bytes32(left < right ? left : right);
    }

    function fheMax(bytes32 lhs, bytes32 rhs, bytes1 scalarByte) external pure override returns (bytes32) {
        uint256 left = _unary(lhs);
        uint256 right = _rhs(rhs, scalarByte);
        return bytes32(left > right ? left : right);
    }

    function fheNeg(bytes32 ct) external pure override returns (bytes32) {
        return bytes32(type(uint256).max - _unary(ct) + 1);
    }

    function fheNot(bytes32 ct) external pure override returns (bytes32) {
        return bytes32(~_unary(ct));
    }

    function verifyCiphertext(bytes32 inputHandle, address, bytes memory, FheType)
        external
        pure
        override
        returns (bytes32)
    {
        return inputHandle;
    }

    function cast(bytes32 ct, FheType toType) external pure override returns (bytes32) {
        return bytes32(_unary(ct) & _maskFor(toType));
    }

    function trivialEncrypt(uint256 value, FheType toType) external pure override returns (bytes32) {
        return bytes32(value & _maskFor(toType));
    }

    function fheIfThenElse(bytes32 control, bytes32 ifTrue, bytes32 ifFalse) external pure override returns (bytes32) {
        return _unary(control) != 0 ? ifTrue : ifFalse;
    }

    function fheRand(FheType) external view override returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), block.timestamp, block.prevrandao));
    }

    function fheRandBounded(uint256 upperBound, FheType) external returns (bytes32) {
        if (upperBound == 0) {
            return bytes32(0);
        }
        _randNonce++;
        return bytes32(uint256(keccak256(abi.encodePacked(address(this), _randNonce))) % upperBound);
    }

    function getInputVerifierAddress() external view override returns (address) {
        return address(_inputVerifier);
    }
}
