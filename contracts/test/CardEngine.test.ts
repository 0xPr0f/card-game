import "@fhevm/hardhat-plugin";
import { FhevmType } from "@fhevm/hardhat-plugin";
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

		const PACKED_WHOT_DECK = [
			WHOT_DECK_ARRAY.slice(0, 32).reduce(
				(acc, v, i) => acc | (BigInt(v) << BigInt(i * 8)),
				0n,
			),
			WHOT_DECK_ARRAY.slice(32).reduce(
				(acc, v, i) => acc | (BigInt(v) << BigInt(i * 8)),
				0n,
			),
		];
		this.PACKED_WHOT_DECK = PACKED_WHOT_DECK;
	});

	describe("Create Game", () => {
		it("Should emit", async function () {
			const input = fhevm.createEncryptedInput(
				await this.cardEngine.target,
				this.alice.address,
			);

			input.add256(this.PACKED_WHOT_DECK[0]);
			input.add256(this.PACKED_WHOT_DECK[1]);

			const encryptedDeck = await input.encrypt();

			const inputData = ((): EInputDataStruct => {
				return {
					inputZero: encryptedDeck.handles[0],
					inputOneType: 2n,
					inputOne64: zeroPadValue("0x", 32),
					inputOne128: zeroPadValue("0x", 32),
					inputOne256: encryptedDeck.handles[1],
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
				inputProof: encryptedDeck.inputProof,
			};

			const tx = await this.cardEngine
				.connect(this.alice)
				.createGame(createGameParams);
			await tx.wait();

			const gameId = 1;
			console.log("encrypted handle", inputData.inputZero.toString());
			console.log("encrypted handle1", inputData.inputOne256.toString());

			expect(tx)
				.to.emit(this.cardEngine, "GameCreated")
				.withArgs(gameId, this.alice.address);

			// 	console.log("Alice address", this.alice.address);
			// 	tx = await this.cardEngine.connect(this.alice).startGame(1);
			// 	await tx.wait();
			// 	console.log("Alice address0", this.alice.address);
			// 	tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 0, "0x");
			// 	tx.wait();
			// 	await fhevm.awaitDecryptionOracle();
			// 	console.log("Alice address1", this.alice.address);
			// 	tx = await this.cardEngine.connect(this.player2).commitMove(1, 0, 2, "0x");
			// 	tx.wait();
			// 	await fhevm.awaitDecryptionOracle();
			// 	console.log("Alice address2", this.alice.address);
			// 	tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 3, "0x");
			// 	tx.wait();
			// 	await fhevm.awaitDecryptionOracle();
			// 	console.log("Alice address3", this.alice.address);
			// 	tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 4, "0x");
			// 	tx.wait();
			// 	await fhevm.awaitDecryptionOracle();
			// 	console.log("Alice address4", this.alice.address);
			// 	tx = await this.cardEngine.connect(this.player2).executeMove(1, 2n, "0x");
			// 	await tx.wait();

			// 	// tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	console.log("Alice address5", this.alice.address);
			// 	tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 1, "0x");
			// 	tx.wait();
			// 	await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player1).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player2).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player1).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player2).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player1).executeMove(1, 2n, "0x");
			// 	// await tx.wait();
			// 	// tx = await this.cardEngine.connect(this.player2).executeMove(1, 2n, "0x");

			// 	// tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 0, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// // tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 1, "0x");
			// 	// // tx.wait();
			// 	// // await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player2).commitMove(1, 0, 2, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 3, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 1, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player2).executeMove(1, 3n, "0x");
			// 	// tx.wait();
			// 	// // await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 6, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 7, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 10, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player2).commitMove(1, 0, 5, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player0).commitMove(1, 0, 9, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 4, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player2).commitMove(1, 0, 8, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	// tx = await this.cardEngine.connect(this.player0).executeMove(1, 2n, "0x");
			// 	// await tx.wait();

			// 	// tx = await this.cardEngine.connect(this.player1).commitMove(1, 0, 13, "0x");
			// 	// tx.wait();
			// 	// await fhevm.awaitDecryptionOracle();

			// 	await fhevm.awaitDecryptionOracle();

			// 	const playerData0 = await this.cardEngine.getPlayerData(1, 0);
			// 	let playerDeck = await fhevm.userDecryptEuint(
			// 		FhevmType.euint256,
			// 		playerData0[4][0],
			// 		await this.cardEngine.getAddress(),
			// 		this.player0,
			// 	);

			// 	console.log("player0 deck", playerData0);
			// 	while (playerDeck != 0n) {
			// 		const card = playerDeck & 0xffn;
			// 		console.log("cardShape0: ", card >> 5n, "cardNumber0: ", card & 0x1fn);
			// 		playerDeck = playerDeck >> 8n;
			// 	}

			// 	const playerData1 = await this.cardEngine.getPlayerData(1, 1);
			// 	let playerDeck1 = await fhevm.userDecryptEuint(
			// 		FhevmType.euint256,
			// 		playerData1[4][0],
			// 		await this.cardEngine.getAddress(),
			// 		this.player1,
			// 	);

			// 	console.log("player1 deck", playerData1);
			// 	while (playerDeck1 != 0n) {
			// 		const card = playerDeck1 & 0xffn;
			// 		console.log("cardShape1: ", card >> 5n, "cardNumber1: ", card & 0x1fn);
			// 		playerDeck1 = playerDeck1 >> 8n;
			// 	}

			// 	const playerData2 = await this.cardEngine.getPlayerData(1, 2);
			// 	let playerDeck2 = await fhevm.userDecryptEuint(
			// 		FhevmType.euint256,
			// 		playerData2[4][0],
			// 		await this.cardEngine.getAddress(),
			// 		this.player2,
			// 	);
			// 	// playerDeck2 = 0x6261484746454443424128272625242322210e0d0c0b0a090807060504030201n;
			// 	console.log("player2 deck", playerData2);
			// 	while (playerDeck2 != 0n) {
			// 		const card = playerDeck2 & 0xffn;
			// 		console.log("cardShape2: ", card >> 5n, "cardNumber2: ", card & 0x1fn);
			// 		playerDeck2 = playerDeck2 >> 8n;
			// 	}
		});
		it("Join Game", async () => {});
	});
});
