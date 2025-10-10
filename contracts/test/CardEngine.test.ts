import '@fhevm/hardhat-plugin';
import { expect } from 'chai';
import { ethers, fhevm } from 'hardhat';
import { EInputDataStruct } from '../types/contracts-exposed/base/EInputHandler.sol/$EInputHandler';
import { zeroPadValue } from 'ethers';
import { FhevmType } from '@fhevm/hardhat-plugin';

describe('Engine', function () {
  beforeEach(async function () {
    // Check if running in FHEVM mock environment
    if (!fhevm.isMock) {
        throw new Error(`This hardhat test suite can only run in FHEVM mock environment`);
    }
    const accounts = await ethers.getSigners();
    const [alice, player0, player1, player2] = accounts;
    this.accounts = accounts.slice(3);
    this.alice = alice;
    this.player0 = player0;
    this.player1 = player1;
    this.player2 = player2;

    const cardEngineFactory = await ethers.getContractFactory('CardEngine');
    const cardEngine = await cardEngineFactory.connect(alice).deploy();
    await cardEngine.waitForDeployment();
    this.cardEngine = cardEngine;

    const RngFactory = await ethers.getContractFactory('MockRNG');
    const rng = await RngFactory.connect(alice).deploy(12345);
    await rng.waitForDeployment();
    this.rng = rng;

    const rulesetFactory = await ethers.getContractFactory('WhotRuleset');
    const ruleset = await rulesetFactory.connect(alice).deploy(await rng.getAddress());
    await ruleset.waitForDeployment();
    this.ruleset = ruleset;
  });

  it('should work 0', async function () {
    const input = fhevm.createEncryptedInput(
      await this.cardEngine.target,
      this.alice.address
    );
    input.add256(
      0x6261484746454443424128272625242322210e0d0c0b0a090807060504030201n
    );
    input.add256(0xb4b4b4b4b4b4b4b48887868584838281686766656463n);

    const encryptedDeck = await input.encrypt();

    const inputData = ((): EInputDataStruct => {
      return {
        inputZero: encryptedDeck.handles[0],
        inputOneType: 2n,
        inputOne64: zeroPadValue("0x", 32),
        inputOne128: zeroPadValue("0x", 32),
        inputOne256: encryptedDeck.handles[1]
      };
    }).bind(this)();

    let tx = await this.cardEngine.connect(this.alice).createGame(
      inputData,
      encryptedDeck.inputProof,
      [],
      await this.ruleset.getAddress(),
      8,
      54,
      4,
      2,
      0 // HookPermissions.NONE
    )
    await tx.wait();

    tx = await this.cardEngine.connect(this.player0).joinGame(1);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player1).joinGame(1);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player2).joinGame(1);
    await tx.wait();

    console.log("Alice address", this.alice.address);
    tx = await this.cardEngine.connect(this.alice).startGame(1);
    await tx.wait();

    tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player1).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player2).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player1).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player2).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player1).executeMove(1, 2n);
    await tx.wait();
    tx = await this.cardEngine.connect(this.player2).executeMove(1, 2n);

    tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 0, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    // tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 1, "0x");
    // tx.wait();
    // await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player2).commitMove(1, 0, 2, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 3, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 1, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player2).executeMove(1, 3n);
    tx.wait();
    // await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 6, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 7, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 10, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player2).commitMove(1, 0, 5, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 9, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 4, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player2).commitMove(1, 0, 8, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n);
    await tx.wait();

    tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 13, "0x");
    tx.wait();
    await fhevm.awaitDecryptionOracle();

    await fhevm.awaitDecryptionOracle();

    const playerData0 = await this.cardEngine.getPlayerData(1, 0);
    let playerDeck = await fhevm.userDecryptEuint(
      FhevmType.euint256,
      playerData0[4][0],
      await this.cardEngine.getAddress(),
      this.player0
    )

    console.log("player0 deck", playerData0);
    while (playerDeck != 0n) {
      const card = playerDeck & 0xffn;
      console.log("cardShape0: ", card >> 5n, "cardNumber0: ", card & 0x1fn);
      playerDeck = playerDeck >> 8n;
    }

    const playerData1 = await this.cardEngine.getPlayerData(1, 1);
    let playerDeck1 = await fhevm.userDecryptEuint(
      FhevmType.euint256,
      playerData1[4][0],
      await this.cardEngine.getAddress(),
      this.player1
    )

    console.log("player1 deck", playerData1);
    while (playerDeck1 != 0n) {
      const card = playerDeck1 & 0xffn;
      console.log("cardShape1: ", card >> 5n, "cardNumber1: ", card & 0x1fn);
      playerDeck1 = playerDeck1 >> 8n;
    }

    const playerData2 = await this.cardEngine.getPlayerData(1, 2);
    let playerDeck2 = await fhevm.userDecryptEuint(
      FhevmType.euint256,
      playerData2[4][0],
      await this.cardEngine.getAddress(),
      this.player2
    )
    // playerDeck2 = 0x6261484746454443424128272625242322210e0d0c0b0a090807060504030201n;
    console.log("player2 deck", playerData2);
    while (playerDeck2 != 0n) {
      const card = playerDeck2 & 0xffn;
      console.log("cardShape2: ", card >> 5n, "cardNumber2: ", card & 0x1fn);
      playerDeck2 = playerDeck2 >> 8n;
    }
  });
});