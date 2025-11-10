import "@fhevm/hardhat-plugin";
import { expect } from "chai";
import { zeroPadValue } from "ethers";
import { ethers, fhevm } from "hardhat";
import type { EInputDataStruct } from "../types/contracts-exposed/base/EInputHandler.sol/$EInputHandler";

describe("Engine", () => {
	beforeEach(async function () {
		// Check if running in FHEVM mock environment
		if (!fhevm.isMock) {
			throw new Error(
				`This hardhat test suite can only run in FHEVM mock environment`,
			);
		}
		const accounts = await ethers.getSigners();
		const [alice, player0, player1, player2, player3] = accounts;
		this.accounts = accounts.slice(4);
		this.alice = alice;
		this.player0 = player0;
		this.player1 = player1;
		this.player2 = player2;
		this.player3 = player3;

		const cardEngineFactory = await ethers.getContractFactory("CardEngine");
		const cardEngine = await cardEngineFactory.connect(alice).deploy();
		await cardEngine.waitForDeployment();
		this.cardEngine = cardEngine;

		const RngFactory = await ethers.getContractFactory("MockRNG");
		const rng = await RngFactory.connect(alice).deploy(12345);
		await rng.waitForDeployment();
		this.rng = rng;

		const rulesetFactory = await ethers.getContractFactory("WhotRuleset");
		const ruleset = await rulesetFactory
			.connect(alice)
			.deploy(await rng.getAddress());
		await ruleset.waitForDeployment();
		this.ruleset = ruleset;

		const WHOT_DECK_ARRAY = [
			1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 65, 66, 67, 68, 69, 71, 72, 74,
			75, 76, 77, 78, 33, 34, 35, 37, 39, 42, 43, 45, 46, 97, 98, 99, 101, 103,
			106, 107, 109, 110, 129, 130, 131, 132, 133, 135, 136, 180, 180, 180, 180,
			180,
		];

		const input = fhevm.createEncryptedInput(
			await this.cardEngine.target,
			this.alice.address,
		);

		input.add256(
			WHOT_DECK_ARRAY.slice(0, 32).reduce(
				(acc, v, i) => acc | (BigInt(v) << BigInt(i * 8)),
				0n,
			),
		);
		input.add256(
			WHOT_DECK_ARRAY.slice(32).reduce(
				(acc, v, i) => acc | (BigInt(v) << BigInt(i * 8)),
				0n,
			),
		);

		const encryptedDeck = await input.encrypt();
		this.encryptedDeck = encryptedDeck;
	});
	describe("Create Game", () => {
		it("Should emit game id", async function () {
			const inputData = ((): EInputDataStruct => {
				return {
					inputZero: this.encryptedDeck.handles[0],
					inputOneType: 2n,
					inputOne64: zeroPadValue("0x", 32),
					inputOne128: zeroPadValue("0x", 32),
					inputOne256: this.encryptedDeck.handles[1],
				};
			}).bind(this)();

			const createGameParams = {
				gameRuleset: await this.ruleset.getAddress(),
				cardBitSize: 8,
				cardDeckSize: 54,
				maxPlayers: 3,
				initialHandSize: 2,
				proposedPlayers: [
					this.player0.address,
					this.player1.address,
					this.player2.address,
				],
				hookPermissions: 0n,
				inputData: inputData,
				inputProof: this.encryptedDeck.inputProof,
			};

			const tx = await this.cardEngine
				.connect(this.alice)
				.createGame(createGameParams);
			await tx.wait();

			const gameId = 1;

			expect(tx)
				.to.emit(this.cardEngine, "GameCreated")
				.withArgs(gameId, this.alice.address);
		});
		it("Join Game", async function () {
      const inputData = ((): EInputDataStruct => {
				return {
					inputZero: this.encryptedDeck.handles[0],
					inputOneType: 2n,
					inputOne64: zeroPadValue("0x", 32),
					inputOne128: zeroPadValue("0x", 32),
					inputOne256: this.encryptedDeck.handles[1],
				};
			}).bind(this)();

			const createGameParams = {
				gameRuleset: await this.ruleset.getAddress(),
				cardBitSize: 8,
				cardDeckSize: 54,
				maxPlayers: 3,
				initialHandSize: 2,
				proposedPlayers: [
					this.player0.address,
					this.player1.address,
					this.player2.address,
				],
				hookPermissions: 0n,
				inputData: inputData,
				inputProof: this.encryptedDeck.inputProof,
			};

			const tx = await this.cardEngine
				.connect(this.alice)
				.createGame(createGameParams);
			await tx.wait();

			const gameId = 1;

			expect(tx)
				.to.emit(this.cardEngine, "GameCreated")
				.withArgs(gameId, this.alice.address);
    });
	});
  describe("Join Game", () => {
		it("Should emit", async function () {
			const inputData = ((): EInputDataStruct => {
				return {
					inputZero: this.encryptedDeck.handles[0],
					inputOneType: 2n,
					inputOne64: zeroPadValue("0x", 32),
					inputOne128: zeroPadValue("0x", 32),
					inputOne256: this.encryptedDeck.handles[1],
				};
			}).bind(this)();

			const createGameParams = {
				gameRuleset: await this.ruleset.getAddress(),
				cardBitSize: 8,
				cardDeckSize: 54,
				maxPlayers: 3,
				initialHandSize: 2,
				proposedPlayers: [
					this.player0.address,
					this.player1.address,
					this.player2.address,
				],
				hookPermissions: 0n,
				inputData: inputData,
				inputProof: this.encryptedDeck.inputProof,
			};

			const tx = await this.cardEngine
				.connect(this.alice)
				.createGame(createGameParams);
			await tx.wait();

			const gameId = 1;

			expect(tx)
				.to.emit(this.cardEngine, "GameCreated")
				.withArgs(gameId, this.alice.address);
		});
		it("Join Game", async function () {});
	})
});
