import "@fhevm/hardhat-plugin";
import { randomInt } from "node:crypto";
import { expect } from "chai";
import { zeroPadValue } from "ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import type { EInputDataStruct } from "../types/contracts-exposed/base/EInputHandler.sol/$EInputHandler";
import type { CardEngine } from "../types/src/CardEngine";
import type { WhotRuleset } from "../types/src/rules/WhotRuleset";
import type { MockRNG } from "../types/src/mocks/MockRng.sol/MockRNG";
import type { MockManager } from "../types/src/mocks/MockManager";

const ACTION = {
	Play: 0,
	Defend: 1,
	Draw: 2,
	Pick: 3,
	Neutral: 4,
} as const;

const WHOT_DECK_TEMPLATE: ReadonlyArray<number> = [
	1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 65, 66, 67, 68, 69, 71, 72, 74, 75,
	76, 77, 78, 33, 34, 35, 37, 39, 42, 43, 45, 46, 97, 98, 99, 101, 103, 106,
	107, 109, 110, 129, 130, 131, 132, 133, 135, 136, 180, 180, 180, 180, 180,
];

type CreateGameOverrides = {
	gameRuleset?: string;
	cardBitSize?: number;
	cardDeckSize?: number;
	maxPlayers?: number;
	initialHandSize?: number;
	proposedPlayers?: string[];
	hookPermissions?: bigint;
	inputData?: EInputDataStruct;
	inputProof?: string;
};

type EncryptedDeckData = {
	handles: string[];
	inputProof: string;
};

type EngineTestContextProps = {
	cardEngine: CardEngine;
	ruleset: WhotRuleset;
	encryptedDeck: EncryptedDeckData;
	deckArray: number[];
	alice: HardhatEthersSigner;
	player0: HardhatEthersSigner;
	player1: HardhatEthersSigner;
	player2: HardhatEthersSigner;
	player3: HardhatEthersSigner;
	accounts: HardhatEthersSigner[];
	rng: MockRNG;
};

type EngineTestContext = Mocha.Context & EngineTestContextProps;

declare module "mocha" {
	interface Context extends EngineTestContextProps {}
}

const buildDefaultInputData = (ctx: EngineTestContext): EInputDataStruct => {
	return {
		inputZero: ctx.encryptedDeck.handles[0],
		inputOneType: 2n,
		inputOne64: zeroPadValue("0x", 32),
		inputOne128: zeroPadValue("0x", 32),
		inputOne256: ctx.encryptedDeck.handles[1],
	};
};

const createGameWithDefaults = async (
	ctx: EngineTestContext,
	overrides: CreateGameOverrides = {},
) => {
	const createGameParams = {
		gameRuleset: overrides.gameRuleset ?? (await ctx.ruleset.getAddress()),
		cardBitSize: overrides.cardBitSize ?? 8,
		cardDeckSize: overrides.cardDeckSize ?? 54,
		maxPlayers: overrides.maxPlayers ?? 3,
		initialHandSize: overrides.initialHandSize ?? 2,
		proposedPlayers: overrides.proposedPlayers ?? [
			ctx.player0.address,
			ctx.player1.address,
			ctx.player2.address,
		],
		hookPermissions: overrides.hookPermissions ?? 0n,
		inputData: overrides.inputData ?? buildDefaultInputData(ctx),
		inputProof: overrides.inputProof ?? ctx.encryptedDeck.inputProof,
	};

	const tx = await ctx.cardEngine
		.connect(ctx.alice)
		.createGame(createGameParams);
	const receipt = await tx.wait();

	let gameId = 1n;
	if (receipt?.logs?.length) {
		for (const log of receipt.logs) {
			try {
				const parsed = ctx.cardEngine.interface.parseLog(log);
				if (parsed?.name === "GameCreated") {
					gameId = parsed.args?.gameId ?? parsed.args?.[0] ?? 1n;
					break;
				}
			} catch (_) {}
		}
	}

	return { createGameParams, gameId };
};

const buildEncryptedInputFor = async (
	ctx: EngineTestContext,
	owner: string,
) => {
	const input = fhevm.createEncryptedInput(
		await ctx.cardEngine.getAddress(),
		owner,
	);
	input.add256(
		ctx.deckArray
			.slice(0, 32)
			.reduce(
				(acc: bigint, v: number, i: number) =>
					acc | (BigInt(v) << BigInt(i * 8)),
				0n,
			),
	);
	input.add256(
		ctx.deckArray
			.slice(32)
			.reduce(
				(acc: bigint, v: number, i: number) =>
					acc | (BigInt(v) << BigInt(i * 8)),
				0n,
			),
	);
	const raw = await input.encrypt();
	const handles = raw.handles.map((handle) =>
		typeof handle === "string" ? handle : ethers.hexlify(handle),
	);
	const inputProof =
		typeof raw.inputProof === "string"
			? raw.inputProof
			: ethers.hexlify(raw.inputProof);
	return {
		handles,
		inputProof,
	};
};

const createGameWithManager = async (
	ctx: EngineTestContext,
	manager: MockManager,
	overrides: CreateGameOverrides = {},
) => {
	const managerAddress = await manager.getAddress();
	const encryptedDeck = await buildEncryptedInputFor(ctx, managerAddress);

	const createGameParams = {
		gameRuleset: overrides.gameRuleset ?? (await ctx.ruleset.getAddress()),
		cardBitSize: overrides.cardBitSize ?? 8,
		cardDeckSize: overrides.cardDeckSize ?? 54,
		maxPlayers: overrides.maxPlayers ?? 3,
		initialHandSize: overrides.initialHandSize ?? 2,
		proposedPlayers: overrides.proposedPlayers ?? [
			ctx.player0.address,
			ctx.player1.address,
			ctx.player2.address,
		],
		hookPermissions: overrides.hookPermissions ?? 0xffn,
		inputData: {
			inputZero: encryptedDeck.handles[0],
			inputOneType: 2n,
			inputOne64: zeroPadValue("0x", 32),
			inputOne128: zeroPadValue("0x", 32),
			inputOne256: encryptedDeck.handles[1],
		},
		inputProof: encryptedDeck.inputProof,
	};

	const tx = await manager.createGame(createGameParams);
	const receipt = await tx.wait();

	let gameId = 1n;
	if (receipt?.logs?.length) {
		for (const log of receipt.logs) {
			try {
				const parsed = ctx.cardEngine.interface.parseLog(log);
				if (parsed?.name === "GameCreated") {
					gameId = parsed.args?.gameId ?? parsed.args?.[0] ?? 1n;
					break;
				}
			} catch (_) {}
		}
	}

	return { createGameParams, gameId };
};

const setupManagedGame = async (
	ctx: EngineTestContext,
	options: { allowBootOut?: boolean; hookPermissions?: bigint } = {},
) => {
	const managerFactory = await ethers.getContractFactory("MockManager");
	const manager = (await managerFactory
		.connect(ctx.alice)
		.deploy(await ctx.cardEngine.getAddress())) as MockManager;
	await manager.waitForDeployment();
	if (options.allowBootOut) {
		await manager.connect(ctx.alice).setBootOutPermission(true);
	}

	const { gameId } = await createGameWithManager(ctx, manager, {
		hookPermissions: options.hookPermissions ?? 0xffn,
	});

	await joinPlayers(ctx, gameId, [ctx.player0, ctx.player1, ctx.player2]);
	await ctx.cardEngine.connect(ctx.alice).startGame(gameId);

	return { gameId, manager };
};

const joinPlayers = async (
	ctx: EngineTestContext,
	gameId: bigint,
	players: HardhatEthersSigner[],
) => {
	for (const player of players) {
		await ctx.cardEngine.connect(player).joinGame(gameId);
	}
};

const toBigInt = (value: bigint | { toString(): string }): bigint => {
	return typeof value === "bigint" ? value : BigInt(value.toString());
};

const shuffleDeck = (source: ReadonlyArray<number>): number[] => {
	const deck = source.slice();
	for (let i = deck.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
};

const extractDeckCardIndexes = (
	deckMap: bigint | { toString(): string },
): number[] => {
	const indexes: number[] = [];
	let raw = toBigInt(deckMap) >> 2n;
	let bit = 0;
	while (raw !== 0n) {
		if ((raw & 1n) === 1n) {
			indexes.push(bit);
		}
		raw >>= 1n;
		bit++;
	}
	return indexes;
};

const countDeckCards = (deckMap: bigint | { toString(): string }): number => {
	return extractDeckCardIndexes(deckMap).length;
};

const getCardShape = (cardValue: number): number => cardValue >> 5;
const getCardNumber = (cardValue: number): number => cardValue & 0x1f;

const describeCardEffect = (cardValue: number): string => {
	const number = getCardNumber(cardValue);
	if (cardValue === -1) return "Unknown";
	if (number === 0) return "Empty";
	if (number === 1) return "Hold On";
	if (number === 2) return "Pick Two";
	if (number === 5) return "Pick Three";
	if (number === 8) return "Suspension";
	if (number === 20) return "I Wish";
	return "Normal Play";
};

const SHAPE_EMOJI: Record<number, string> = {
	0: "⭕️ Circle",
	1: "✝️ Cross",
	2: "🔺 Triangle",
	3: "🟥 Square",
	4: "⭐ Star",
	5: "🎯 Whot",
};

const SHAPE_LABEL: Record<number, string> = {
	0: "Circle",
	1: "Cross",
	2: "Triangle",
	3: "Square",
	4: "Star",
	5: "Whot",
};

const formatCard = (
	cardValue: number,
	options: { emoji?: boolean } = {},
): string => {
	if (cardValue <= 0) return "None";
	const shape = cardValue >> 5;
	const emojiPreferred = options.emoji ?? true;
	const shapeLabel = emojiPreferred
		? (SHAPE_EMOJI[shape] ?? `shape=${shape}`)
		: `${SHAPE_LABEL[shape] ?? `shape=${shape}`}`;
	const number = cardValue & 0x1f;
	return `${shapeLabel} ${number}`;
};

const describePlayerAlias = (
	ctx: EngineTestContext,
	address: string,
): string => {
	if (address === ctx.alice.address) return "Alice";
	if (address === ctx.player0.address) return "Player0";
	if (address === ctx.player1.address) return "Player1";
	if (address === ctx.player2.address) return "Player2";
	if (address === ctx.player3.address) return "Player3";
	return `${address.slice(0, 6)}…`;
};

const formatDeckSnapshot = (
	ctx: EngineTestContext,
	indexes: number[],
): string => {
	if (indexes.length === 0) return "empty";
	return indexes
		.map(
			(idx) =>
				`${idx}:${formatCard(ctx.deckArray[idx] ?? -1, { emoji: false })}`,
		)
		.join(", ");
};

const buildLifecycleHeader = (
	iteration: number,
	callCard: string,
	playerAlias: string,
	playerIdx: number,
	deckSnapshot: string,
): string => {
	return [
		`┌─ Turn #${iteration}`,
		`│ CallCard : ${callCard}`,
		`│ Player   : ${playerAlias} (idx ${playerIdx})`,
		`│ Hand     : ${deckSnapshot}`,
		"└─ Action:",
	].join("\n");
};

const logUpcomingState = (
	label: string,
	playerAlias: string,
	callCard: string,
) => {
	console.log(`    ${label} -> ${playerAlias} | CallCard=${callCard}`);
};

const formatActionDetails = (
	label: string,
	cardIdx: number,
	cardText: string,
	effect: string,
) => {
	return `[${label}] idx=${cardIdx} | card=${cardText} | effect=${effect}`;
};

const buildExtraDataForCard = (cardValue: number): string => {
	if (getCardNumber(cardValue) === 20) {
		return ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [0]);
	}
	return "0x";
};

const cardsMatchCallCard = (
	cardValue: number,
	callCardValue: number,
): boolean => {
	if (callCardValue === 0) return true;
	if (cardValue === 0) return true;
	return (
		getCardNumber(cardValue) === getCardNumber(callCardValue) ||
		getCardShape(cardValue) === getCardShape(callCardValue)
	);
};

const canAutoPlay = (cardValue: number): boolean => {
	const number = getCardNumber(cardValue);
	// Skip Whot/I Wish cards, they need extra data
	if (number === 20) return false;
	return true;
};

const findPlayableCardIndex = (
	ctx: EngineTestContext,
	candidateIndexes: number[],
	callCardValue: number,
): number | undefined => {
	for (const idx of candidateIndexes) {
		const cardValue = ctx.deckArray[idx];
		if (
			cardValue !== undefined &&
			canAutoPlay(cardValue) &&
			cardsMatchCallCard(cardValue, callCardValue)
		) {
			return idx;
		}
	}
	return undefined;
};

const selectPlayableCardIndex = (
	ctx: EngineTestContext,
	candidateIndexes: number[],
	callCardValue: number,
): number => {
	const match = findPlayableCardIndex(ctx, candidateIndexes, callCardValue);
	if (match !== undefined) return match;
	if (candidateIndexes.length === 0) {
		throw new Error("Current player has no cards to commit");
	}
	return candidateIndexes[0];
};

const describeAction = (action: number): string => {
	const entry = Object.entries(ACTION).find(([, value]) => value === action);
	return entry ? entry[0] : `Action(${action})`;
};

const describeMoveSummary = (
	playerIndex: number,
	cardIdx: number,
	cardValue: number,
	action: number,
): string => {
	if (action === ACTION.Draw) {
		return `${describeAction(action)} by player ${playerIndex}`;
	}
	return `${describeAction(action)} by player ${playerIndex} (idx ${cardIdx} value ${cardValue} - ${describeCardEffect(cardValue)})`;
};

const getSignerForAddress = (ctx: EngineTestContext, address: string) => {
	const candidates = [
		ctx.alice,
		ctx.player0,
		ctx.player1,
		ctx.player2,
		ctx.player3,
		...(ctx.accounts ?? []),
	].filter(Boolean);
	const signer = candidates.find((candidate) => candidate.address === address);
	if (!signer) {
		throw new Error(`Unknown signer for address ${address}`);
	}
	return signer;
};

const setupStartedGame = async (ctx: EngineTestContext) => {
	const { gameId } = await createGameWithDefaults(ctx);
	await joinPlayers(ctx, gameId, [ctx.player0, ctx.player1, ctx.player2]);
	await ctx.cardEngine.connect(ctx.alice).startGame(gameId);
	return gameId;
};

const getCurrentPlayerContext = async (
	ctx: EngineTestContext,
	gameId: bigint,
) => {
	const gameData = await ctx.cardEngine.getGameData(gameId);
	const currentIndex = Number(gameData.playerTurnIdx);
	const playerData = await ctx.cardEngine.getPlayerData(gameId, currentIndex);
	const playerSigner = getSignerForAddress(ctx, playerData.playerAddr);
	const cardIndexes = extractDeckCardIndexes(playerData.deckMap);
	return {
		gameData,
		currentIndex,
		playerData,
		playerSigner,
		cardIndexes,
	};
};

const commitCardForCurrentPlayer = async (
	ctx: EngineTestContext,
	gameId: bigint,
	action: number,
) => {
	const context = await getCurrentPlayerContext(ctx, gameId);
	const callCardValue = Number(context.gameData.callCard);
	const targetCardIdx = selectPlayableCardIndex(
		ctx,
		context.cardIndexes,
		callCardValue,
	);
	const normalizedGameId = Number(gameId);
	const commitTx = await ctx.cardEngine
		.connect(context.playerSigner)
		.commitMove(normalizedGameId, action, targetCardIdx);
	await commitTx.wait();
	await fhevm.awaitDecryptionOracle();
	return {
		...context,
		callCardValue,
		targetCardIdx,
		targetCardValue: ctx.deckArray[targetCardIdx] ?? -1,
		currentAction: action,
	};
};

const logFinalGameState = async (
	ctx: EngineTestContext,
	gameId: bigint,
	label: string,
) => {
	await fhevm.awaitDecryptionOracle();
	const gameData = await ctx.cardEngine.getGameData(gameId);
	const marketIdxs = extractDeckCardIndexes(gameData.marketDeckMap);
	const marketCards = marketIdxs.map((idx) =>
		formatCard(ctx.deckArray[idx] ?? -1, { emoji: false }),
	);
	console.log(
		`[${label}] Market deck idx=[${marketIdxs.join(", ")}] cards=[${marketCards.join(
			", ",
		)}]`,
	);
	const playerCount = Number(gameData.maxPlayers);
	for (let i = 0; i < playerCount; i++) {
		const playerData = await ctx.cardEngine.getPlayerData(gameId, i);
		if (playerData.playerAddr === ethers.ZeroAddress) continue;
		const remainingIdxs = extractDeckCardIndexes(playerData.deckMap);
		const remainingCards = remainingIdxs.map((idx) =>
			formatCard(ctx.deckArray[idx] ?? -1, { emoji: false }),
		);
		console.log(
			`[${label}] Player ${i} addr=${playerData.playerAddr} forfeited=${
				playerData.forfeited
			} score=${playerData.score} remainingIdx=[${remainingIdxs.join(", ")}] cards=[${remainingCards.join(
				", ",
			)}]`,
		);
	}
};

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
			.deploy(await rng.getAddress(), await cardEngine.getAddress());
		await ruleset.waitForDeployment();
		this.ruleset = ruleset;

		this.deckArray = shuffleDeck(WHOT_DECK_TEMPLATE);

		this.encryptedDeck = await buildEncryptedInputFor(this, this.alice.address);
	});
	describe("Create Game", () => {
		it("Should emit game id", async function () {
			const inputData = buildDefaultInputData(this);

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
		it("Should persist game data retrievable via getGameData", async function () {
			const inputData = buildDefaultInputData(this);

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

			const {
				gameCreator,
				callCard,
				playerTurnIdx,
				status,
				lastMoveTimestamp,
				maxPlayers,
				playersLeftToJoin,
				hookPermissions,
				playerStoreMap,
				ruleset,
				marketDeckMap,
				initialHandSize,
			} = await this.cardEngine.getGameData(gameId);

			const expectedMarketDeckMap =
				(((1n << BigInt(createGameParams.cardDeckSize)) - 1n) << 2n) |
				(BigInt(createGameParams.cardBitSize) & 0x03n);

			expect(gameCreator).to.equal(this.alice.address);
			expect(callCard).to.equal(0n);
			expect(playerTurnIdx).to.equal(0n);
			expect(status).to.equal(0n);
			expect(lastMoveTimestamp).to.equal(0n);
			expect(maxPlayers).to.equal(BigInt(createGameParams.maxPlayers));
			expect(playersLeftToJoin).to.equal(BigInt(createGameParams.maxPlayers));
			expect(hookPermissions).to.equal(createGameParams.hookPermissions);
			expect(playerStoreMap).to.equal(0n);
			expect(ruleset).to.equal(createGameParams.gameRuleset);
			expect(marketDeckMap).to.equal(expectedMarketDeckMap);
			expect(initialHandSize).to.equal(
				BigInt(createGameParams.initialHandSize),
			);
		});
	});
	describe("Join Game", () => {
		it("allows proposed players to join and decrements players left to join", async function () {
			const { gameId } = await createGameWithDefaults(this);

			await expect(this.cardEngine.connect(this.player0).joinGame(gameId))
				.to.emit(this.cardEngine, "PlayerJoined")
				.withArgs(gameId, this.player0.address);

			const { playersLeftToJoin } = await this.cardEngine.getGameData(gameId);
			const playerData = await this.cardEngine.getPlayerData(gameId, 0);

			expect(playersLeftToJoin).to.equal(2n);
			expect(playerData.playerAddr).to.equal(this.player0.address);
		});

		it("allows the game creator to join the game they created", async function () {
			const { gameId } = await createGameWithDefaults(this, {
				proposedPlayers: [],
				maxPlayers: 2,
			});

			await expect(this.cardEngine.connect(this.alice).joinGame(gameId))
				.to.emit(this.cardEngine, "PlayerJoined")
				.withArgs(gameId, this.alice.address);

			const { playersLeftToJoin } = await this.cardEngine.getGameData(gameId);
			const playerData = await this.cardEngine.getPlayerData(gameId, 0);

			expect(playerData.playerAddr).to.equal(this.alice.address);
			expect(playersLeftToJoin).to.equal(1n);
		});

		it("rejects addresses that are not proposed players", async function () {
			const { gameId } = await createGameWithDefaults(this);

			await expect(this.cardEngine.connect(this.player3).joinGame(gameId))
				.to.be.revertedWithCustomError(this.cardEngine, "NotProposedPlayer")
				.withArgs(this.player3.address);
		});

		it("allows every proposed player to join and tracks their indices", async function () {
			const { gameId } = await createGameWithDefaults(this);

			await this.cardEngine.connect(this.player0).joinGame(gameId);
			await this.cardEngine.connect(this.player1).joinGame(gameId);
			await this.cardEngine.connect(this.player2).joinGame(gameId);

			const [player0Data, player1Data, player2Data] = await Promise.all([
				this.cardEngine.getPlayerData(gameId, 0),
				this.cardEngine.getPlayerData(gameId, 1),
				this.cardEngine.getPlayerData(gameId, 2),
			]);
			const { playersLeftToJoin } = await this.cardEngine.getGameData(gameId);

			expect(player0Data.playerAddr).to.equal(this.player0.address);
			expect(player1Data.playerAddr).to.equal(this.player1.address);
			expect(player2Data.playerAddr).to.equal(this.player2.address);
			expect(playersLeftToJoin).to.equal(0n);
		});

		it("allows non-proposed players to join open games until capacity is reached", async function () {
			const { gameId } = await createGameWithDefaults(this, {
				proposedPlayers: [],
				maxPlayers: 3,
			});

			await this.cardEngine.connect(this.player0).joinGame(gameId);
			await this.cardEngine.connect(this.player1).joinGame(gameId);

			await expect(this.cardEngine.connect(this.player2).joinGame(gameId))
				.to.emit(this.cardEngine, "PlayerJoined")
				.withArgs(gameId, this.player2.address);

			const { playersLeftToJoin } = await this.cardEngine.getGameData(gameId);
			expect(playersLeftToJoin).to.equal(0n);
		});

		it("rejects join attempts once the game has started", async function () {
			const { gameId } = await createGameWithDefaults(this);

			await this.cardEngine.connect(this.player0).joinGame(gameId);
			await this.cardEngine.connect(this.player1).joinGame(gameId);
			await this.cardEngine.connect(this.player2).joinGame(gameId);

			await this.cardEngine.connect(this.alice).startGame(gameId);

			const spectator = this.accounts[0];
			await expect(
				this.cardEngine.connect(spectator).joinGame(gameId),
			).to.be.revertedWithCustomError(this.cardEngine, "GameAlreadyStarted");
		});

		it("caps open games at maxPlayers when proposedPlayers is empty", async function () {
			const { gameId } = await createGameWithDefaults(this, {
				proposedPlayers: [],
				maxPlayers: 2,
			});

			await this.cardEngine.connect(this.player0).joinGame(gameId);
			await this.cardEngine.connect(this.player1).joinGame(gameId);

			const { playersLeftToJoin } = await this.cardEngine.getGameData(gameId);
			expect(playersLeftToJoin).to.equal(0n);

			await expect(this.cardEngine.connect(this.player2).joinGame(gameId))
				.to.be.revertedWithCustomError(this.cardEngine, "NotProposedPlayer")
				.withArgs(this.player2.address);
		});
	});

	describe("Start Game", () => {
		it("allows the game creator to start once all proposed players join", async function () {
			const { gameId } = await createGameWithDefaults(this);
			await joinPlayers(this, gameId, [
				this.player0,
				this.player1,
				this.player2,
			]);

			await expect(this.cardEngine.connect(this.alice).startGame(gameId))
				.to.emit(this.cardEngine, "GameStarted")
				.withArgs(gameId);

			const { status, playersLeftToJoin, playerTurnIdx } =
				await this.cardEngine.getGameData(gameId);

			expect(status).to.equal(1n);
			expect(playersLeftToJoin).to.equal(0n);
			expect(Number(playerTurnIdx)).to.be.lessThan(3);
		});

		it("prevents non-creators from starting before all players join", async function () {
			const { gameId } = await createGameWithDefaults(this);
			await joinPlayers(this, gameId, [this.player0, this.player1]);

			await expect(
				this.cardEngine.connect(this.player0).startGame(gameId),
			).to.be.revertedWithCustomError(this.cardEngine, "CannotStartGame");
		});

		it("allows the creator to start with at least two players even if spots remain", async function () {
			const { gameId } = await createGameWithDefaults(this, {
				proposedPlayers: [],
				maxPlayers: 4,
			});
			await joinPlayers(this, gameId, [this.alice, this.player0]);

			await expect(this.cardEngine.connect(this.alice).startGame(gameId))
				.to.emit(this.cardEngine, "GameStarted")
				.withArgs(gameId);

			const { status, playersLeftToJoin, playerTurnIdx } =
				await this.cardEngine.getGameData(gameId);

			expect(status).to.equal(1n);
			expect(playersLeftToJoin).to.equal(2n);
			expect(Number(playerTurnIdx)).to.be.lessThan(2);
		});

		it("requires at least two players to start even for the creator", async function () {
			const { gameId } = await createGameWithDefaults(this, {
				proposedPlayers: [],
				maxPlayers: 3,
			});
			await joinPlayers(this, gameId, [this.alice]);

			await expect(
				this.cardEngine.connect(this.alice).startGame(gameId),
			).to.be.revertedWithCustomError(this.cardEngine, "CannotStartGame");
		});

		it("allows non-creators to start once every seat is filled", async function () {
			const { gameId } = await createGameWithDefaults(this);
			await joinPlayers(this, gameId, [
				this.player0,
				this.player1,
				this.player2,
			]);

			await expect(this.cardEngine.connect(this.player0).startGame(gameId))
				.to.emit(this.cardEngine, "GameStarted")
				.withArgs(gameId);

			const { status, playersLeftToJoin } =
				await this.cardEngine.getGameData(gameId);

			expect(status).to.equal(1n);
			expect(playersLeftToJoin).to.equal(0n);
		});

		describe("Execute Move", () => {
			it("reverts when executing a Play action without a committed move", async function () {
				const gameId = await setupStartedGame(this);
				const { currentIndex, playerSigner } = await getCurrentPlayerContext(
					this,
					gameId,
				);

				await expect(
					this.cardEngine
						.connect(playerSigner)
						.executeMove(Number(gameId), ACTION.Play, "0x"),
				).to.be.revertedWith("No committed move for game");

				const postGame = await this.cardEngine.getGameData(gameId);
				expect(Number(postGame.playerTurnIdx)).to.equal(currentIndex);
			});

			it("requires the relayer to resolve a committed move before execution", async function () {
				const gameId = await setupStartedGame(this);
				const { currentIndex, playerSigner, cardIndexes } =
					await getCurrentPlayerContext(this, gameId);

				const targetCardIdx = cardIndexes[0];
				const commitTx = await this.cardEngine
					.connect(playerSigner)
					.commitMove(Number(gameId), ACTION.Play, targetCardIdx);
				await commitTx.wait();

				await expect(
					this.cardEngine
						.connect(playerSigner)
						.executeMove(Number(gameId), ACTION.Play, "0x"),
				).to.be.revertedWith("Latest committed move not fulfilled");

				const postGame = await this.cardEngine.getGameData(gameId);
				expect(Number(postGame.playerTurnIdx)).to.equal(currentIndex);
			});

			it("prevents non-current players from executing Play actions", async function () {
				const gameId = await setupStartedGame(this);
				const {
					currentIndex,
					playerSigner,
					targetCardValue,
				} = await commitCardForCurrentPlayer(
					this,
					gameId,
					ACTION.Play,
				);

				const allPlayers = [this.player0, this.player1, this.player2];
				const nextPlayer =
					allPlayers.find(
						(candidate) => candidate.address !== playerSigner.address,
					) ?? this.player0;

				await expect(
					this.cardEngine
						.connect(nextPlayer)
						.executeMove(Number(gameId), ACTION.Play, "0x"),
				)
					.to.be.revertedWithCustomError(
						this.cardEngine,
						"InvalidPlayerAddress",
					)
					.withArgs(nextPlayer.address);

				const postGame = await this.cardEngine.getGameData(gameId);
				expect(Number(postGame.playerTurnIdx)).to.equal(currentIndex);
			});

			it("executes a committed Play action end-to-end", async function () {
				const gameId = await setupStartedGame(this);
				const {
					currentIndex,
					playerSigner,
					targetCardValue,
				} = await commitCardForCurrentPlayer(
					this,
					gameId,
					ACTION.Play,
				);

				const playerBefore = await this.cardEngine.getPlayerData(
					gameId,
					currentIndex,
				);
				const cardsBefore = countDeckCards(playerBefore.deckMap);

				await expect(
					this.cardEngine
						.connect(playerSigner)
						.executeMove(
							Number(gameId),
							ACTION.Play,
							buildExtraDataForCard(targetCardValue),
						),
				)
					.to.emit(this.cardEngine, "MoveExecuted")
					.withArgs(gameId, currentIndex, ACTION.Play);

				const playerAfter = await this.cardEngine.getPlayerData(
					gameId,
					currentIndex,
				);

				expect(countDeckCards(playerAfter.deckMap)).to.equal(cardsBefore - 1);
			});
		});

		describe("Boot Out / Forfeit", () => {
			it("allows the current player to forfeit after the game has started", async function () {
				const gameId = await setupStartedGame(this);

				await expect(this.cardEngine.connect(this.player0).forfeit(gameId))
					.to.emit(this.cardEngine, "PlayerForfeited")
					.withArgs(gameId, 0);

				const playerData = await this.cardEngine.getPlayerData(gameId, 0);
				expect(playerData.forfeited).to.equal(true);
			});

			it("prevents forfeiting before the game has started", async function () {
				const { gameId } = await createGameWithDefaults(this);
				await joinPlayers(this, gameId, [this.player0, this.player1]);

				await expect(
					this.cardEngine.connect(this.player0).forfeit(gameId),
				).to.be.revertedWithCustomError(this.cardEngine, "GameNotStarted");
			});

			it("prevents booting out an idle player when the manager denies", async function () {
				const { gameId } = await setupManagedGame(this, {
					allowBootOut: false,
				});

				await ethers.provider.send("evm_increaseTime", [300]); // 5 minutes
				await ethers.provider.send("evm_mine", []);

				await expect(this.cardEngine.connect(this.alice).bootOut(gameId, 0))
					.to.be.revertedWithCustomError(this.cardEngine, "CannotBootOutPlayer")
					.withArgs(this.player0.address);
			});

			it("prevents a booted player from executing moves", async function () {
				const { gameId } = await setupManagedGame(this, {
					allowBootOut: true,
				});

				await ethers.provider.send("evm_increaseTime", [300]);
				await ethers.provider.send("evm_mine", []);

				await this.cardEngine.connect(this.alice).bootOut(gameId, 0);

				const bootedData = await this.cardEngine.getPlayerData(gameId, 0);
				expect(bootedData.forfeited).to.equal(true);

				await expect(
					this.cardEngine
						.connect(this.player0)
						.executeMove(Number(gameId), ACTION.Play, "0x"),
				)
					.to.be.revertedWithCustomError(
						this.cardEngine,
						"InvalidPlayerAddress",
					)
					.withArgs(this.player0.address);
			});

			it("prevents booting out players with an unfulfilled commitment", async function () {
				const { gameId, manager } = await setupManagedGame(this, {
					allowBootOut: true,
				});

				await commitCardForCurrentPlayer(this, gameId, ACTION.Play);
				await manager.connect(this.alice).setBootOutPermission(true);

				await expect(
					this.cardEngine.connect(this.alice).bootOut(gameId, 0),
				).to.be.revertedWithCustomError(
					this.cardEngine,
					"PlayerAlreadyCommittedAction",
				);
			});
		});
	});

	describe("Full Lifecycle", () => {
		it("plays through game creation, moves, and completion", async function () {
			const { gameId } = await createGameWithDefaults(this);
			await joinPlayers(this, gameId, [
				this.player0,
				this.player1,
				this.player2,
			]);
			await this.cardEngine.connect(this.alice).startGame(gameId);

					const {
						playerSigner,
						currentIndex,
						targetCardIdx,
						targetCardValue,
				callCardValue,
				cardIndexes,
				currentAction,
			} = await commitCardForCurrentPlayer(this, gameId, ACTION.Play);

			console.log(
				`[Lifecycle] Call=${callCardValue} Player=${currentIndex} HandIdx=[${cardIndexes.join(
					", ",
				)}] -> idx ${targetCardIdx} value ${targetCardValue} (${describeCardEffect(
					targetCardValue,
				)}) via ${describeAction(currentAction)}`,
			);

			await expect(
				this.cardEngine
					.connect(playerSigner)
					.executeMove(
						Number(gameId),
						ACTION.Play,
						buildExtraDataForCard(targetCardValue),
					),
			)
				.to.emit(this.cardEngine, "MoveExecuted")
				.withArgs(gameId, currentIndex, ACTION.Play);

			const postMoveState = await this.cardEngine.getGameData(gameId);
			console.log(
				`[Lifecycle] -> NextPlayer=${
					postMoveState.playerTurnIdx
				} CallCard=${formatCard(Number(postMoveState.callCard), { emoji: false })} (played ${describeMoveSummary(
					currentIndex,
					targetCardIdx,
					targetCardValue,
					currentAction,
				)})`,
			);

			await expect(this.cardEngine.connect(this.player1).forfeit(gameId))
				.to.emit(this.cardEngine, "PlayerForfeited")
				.withArgs(gameId, 1);

			await expect(this.cardEngine.connect(this.player2).forfeit(gameId))
				.to.emit(this.cardEngine, "GameEnded")
				.and.to.emit(this.cardEngine, "PlayerForfeited")
				.withArgs(gameId, 2);

			const finalState = await this.cardEngine.getGameData(gameId);
			expect(finalState.status).to.equal(2n);
			await logFinalGameState(this, gameId, "Lifecycle-with-forfeit");
		});

		it("ends when players empty their decks or market deck is depleted (no forfeits)", async function () {
			const { gameId } = await createGameWithDefaults(this, {
				maxPlayers: 3,
				initialHandSize: 4,
			});
			await joinPlayers(this, gameId, [
				this.player0,
				this.player1,
				this.player2,
			]);
			await this.cardEngine.connect(this.alice).startGame(gameId);

			let iterations = 0;
			while (true) {
				const gameData = await this.cardEngine.getGameData(gameId);
				if (Number(gameData.status) === 2) break;

				const context = await getCurrentPlayerContext(this, gameId);
				const callCardValue = Number(context.gameData.callCard);
				const playerAlias = describePlayerAlias(
					this,
					context.playerData.playerAddr,
				);
				const deckSnapshot = formatDeckSnapshot(this, context.cardIndexes);
				console.log(
					buildLifecycleHeader(
						iterations,
						formatCard(callCardValue, { emoji: false }),
						playerAlias,
						context.currentIndex,
						deckSnapshot,
					),
				);
				const playableIdx = findPlayableCardIndex(
					this,
					context.cardIndexes,
					callCardValue,
				);

				if (playableIdx === undefined) {
					console.log(
						`    ${playerAlias} -> ${formatActionDetails(
							"Draw",
							-1,
							"n/a",
							"no playable cards",
						)}`,
					);
					await this.cardEngine
						.connect(context.playerSigner)
						.executeMove(Number(gameId), ACTION.Draw, "0x");
					const stateAfterDraw = await this.cardEngine.getGameData(gameId);
					if (Number(stateAfterDraw.status) !== 2) {
						const nextPlayerData = await this.cardEngine.getPlayerData(
							gameId,
							Number(stateAfterDraw.playerTurnIdx),
						);
						const nextAlias = describePlayerAlias(
							this,
							nextPlayerData.playerAddr,
						);
						logUpcomingState(
							"Next",
							nextAlias,
							formatCard(Number(stateAfterDraw.callCard), { emoji: false }),
						);
					} else {
						console.log(
							`    Game ended after draw. Final CallCard=${formatCard(
								Number(stateAfterDraw.callCard),
								{ emoji: false },
							)}`,
						);
					}
					await fhevm.awaitDecryptionOracle();
				} else {
					const { playerSigner, targetCardIdx, targetCardValue } =
						await commitCardForCurrentPlayer(this, gameId, ACTION.Play);

					console.log(
						`    ${describePlayerAlias(
							this,
							playerSigner.address,
						)} -> ${formatActionDetails(
							"Play",
							targetCardIdx,
							formatCard(targetCardValue),
							describeCardEffect(targetCardValue),
						)}`,
					);

					await this.cardEngine
						.connect(playerSigner)
						.executeMove(
							Number(gameId),
							ACTION.Play,
							buildExtraDataForCard(targetCardValue),
						);

					const stateAfter = await this.cardEngine.getGameData(gameId);
					if (Number(stateAfter.status) !== 2) {
						const nextPlayerData = await this.cardEngine.getPlayerData(
							gameId,
							Number(stateAfter.playerTurnIdx),
						);
						const nextAlias = describePlayerAlias(
							this,
							nextPlayerData.playerAddr,
						);
						logUpcomingState(
							"Next",
							nextAlias,
							formatCard(Number(stateAfter.callCard), { emoji: false }),
						);
					} else {
						console.log(
							`    Game ended after play. Final CallCard=${formatCard(
								Number(stateAfter.callCard),
								{ emoji: false },
							)}`,
						);
					}
				}
			}

			const finishedPlayers: number[] = [];
			for (let i = 0; i < 3; i++) {
				const playerData = await this.cardEngine.getPlayerData(gameId, i);
				expect(playerData.forfeited).to.equal(false);
				if (countDeckCards(playerData.deckMap) === 0) {
					finishedPlayers.push(i);
				}
				iterations++;
			}

			const finalState = await this.cardEngine.getGameData(gameId);
			const remainingMarketCards = countDeckCards(finalState.marketDeckMap);
			expect(
				finishedPlayers.length >= 1 || remainingMarketCards === 0,
				"Game should end with at least one player emptying their deck or a depleted market deck",
			).to.equal(true);
			expect(finalState.status).to.equal(2n);
			await logFinalGameState(this, gameId, "Lifecycle-no-forfeit");
		});
	});
});
