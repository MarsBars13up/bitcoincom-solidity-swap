const Token = artifacts.require("Token");
const Weth = artifacts.require("WrappedEther");
const Router = artifacts.require("SwapsRouter");
const Factory = artifacts.require("SwapsFactory");
const SwapsPair = artifacts.require("SwapsPair")
const ISwapsPair = artifacts.require("ISwapsPair");

const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");

const BN = web3.utils.BN;
const APPROVE_VALUE = web3.utils.toWei("1000000");

const ONE_ETH = web3.utils.toWei("1");
const ONE_TOKEN = web3.utils.toWei("1");

const FOUR_TOKENS = web3.utils.toWei("4");
const FIVE_TOKENS = web3.utils.toWei("5");
const NINE_TOKENS = web3.utils.toWei("5");

const FOUR_ETH = web3.utils.toWei("4");
const FIVE_ETH = web3.utils.toWei("5");
const NINE_ETH = web3.utils.toWei("9");

const STATIC_SUPPLY = web3.utils.toWei("500");
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const getLastEvent = async (eventName, instance) => {
    const events = await instance.getPastEvents(eventName, {
        fromBlock: 0,
        toBlock: "latest",
    });
    return events.pop().returnValues;
};

contract("Swaps", ([owner, alice, bob, random]) => {

    let weth;
    let token;
    let token2;
    let token3;
    let factory;
    let router;
    let erc20;
    // let launchTime;

    // beforeEach(async () => {
    before(async () => {
        weth = await Weth.new();
        token = await Token.new();
        token2 = await Token.new();
        token3 = await Token.new();
        factory = await Factory.new(owner);
        router = await Router.new(
            factory.address,
            weth.address
        );
    });

    describe("Factory Initial Values and Functions", () => {

        it("should have correct feeToSetter address", async () => {
            const feeToSetterAddress = await factory.feeToSetter();
            assert.equal(
                feeToSetterAddress,
                owner
            );
        });

        it("should have correct pairCodeHash value", async () => {
            const pairCodeHash = await factory.pairCodeHash();

            // during coverage-test
            const expectedValue = '0x01ada0920ed343dcff2aa5c776daf53affb255ea2841b36cec8629f75f9b1c50';

            // during regular-test
            // const expectedValue = '0x34a38ffdad5e88b8e670d19a031204407a72a23edc334635c9c53a26774e3e72';

            assert.equal(
                pairCodeHash,
                expectedValue
            );
        });

        it("should have correct feeTo value", async () => {

            const feeToValue = await factory.feeTo();
            const expectedValue = owner;

            assert.equal(
                feeToValue,
                expectedValue
            );
        });

        it("should have correct feeToSetter value", async () => {
            const feeToSetterValue = await factory.feeToSetter();
            const expectedValue = owner;

            assert.equal(
                feeToSetterValue,
                expectedValue
            );
        });

        it("should allow to change feeTo value", async () => {

            const newFeeToAddress = bob;

            await factory.setFeeTo(
                newFeeToAddress
            );

            const expectedValue = await factory.feeTo();

            assert.equal(
                newFeeToAddress,
                expectedValue
            );
        });

        it("should allow to change feeToSetter value", async () => {

            const newFeeToSetterAddress = alice;

            await factory.setFeeToSetter(
                newFeeToSetterAddress,
            );

            const expectedValue = await factory.feeToSetter();

            assert.equal(
                newFeeToSetterAddress,
                expectedValue
            );
        });
    });

    describe("Factory Pairs", () => {

        it("should correctly generate pair address", async () => {

            await factory.createPair(
                token.address,
                weth.address
            );

            const { token0, token1, pair } = await getLastEvent(
                "PairCreated",
                factory
            );

            const lookupAddress = await router.pairFor(
                factory.address,
                token.address,
                weth.address
            );

            assert.equal(
                pair,
                lookupAddress
            );
        });

        it("should have corret token0 and token1 values in event", async () => {

            // pair already generated in previous test

            /* await factory.createPair(
                token.address,
                weth.address
            );*/

            const { token0, token1, pair } = await getLastEvent(
                "PairCreated",
                factory
            );

            const expectedToken0 = token.address > weth.address
                ? weth.address
                : token.address

            const expectedToken1 = token.address > weth.address
                ? token.address
                : weth.address

            assert.equal(
                expectedToken0,
                token0
            );

            assert.equal(
                expectedToken1,
                token1
            );
        });

        it("should revert if pair already exists", async () => {

            await catchRevert(
                factory.createPair(
                    token.address,
                    weth.address
                ),
                "revert PAIR_EXISTS"
            );
        });

        it("should not allow to create pair for identical tokens", async () => {
            await catchRevert(
                factory.createPair(
                    token.address,
                    token.address
                ),
                "revert IDENTICAL_ADDRESSES"
            );
        });

        it("should not allow to create pair for zero address", async () => {

            await catchRevert(
                factory.createPair(
                    token.address,
                    ZERO_ADDRESS
                ),
                "revert ZERO_ADDRESS"
            );

            await catchRevert(
                factory.createPair(
                    ZERO_ADDRESS,
                    token.address
                ),
                "revert ZERO_ADDRESS"
            );

            await catchRevert(
                factory.createPair(
                    ZERO_ADDRESS,
                    ZERO_ADDRESS,
                ),
                "revert ZERO_ADDRESS"
            );
        });

        it("should have correct token0 and token1 values in pair contract", async () => {

            await factory.createPair(
                token.address,
                token2.address
            );

            let { token0, token1, pair } = await getLastEvent(
                "PairCreated",
                factory
            );

            pair = await SwapsPair.at(pair);

            const token0Value = await pair.token0();
            const token1Value = await pair.token1();

            const expectedToken0 = token.address > token2.address
                ? token2.address
                : token.address

            const expectedToken1 = token.address > token2.address
                ? token.address
                : token2.address

            assert.equal(
                token0Value,
                expectedToken0
            );

            assert.equal(
                token1Value,
                expectedToken1
            );
        });

        it("should increment allPairsLength", async () => {

            const lengthBefore = await factory.allPairsLength();

            await factory.createPair(
                token2.address,
                token3.address
            );

            const lengthAfter = await factory.allPairsLength();

            assert.equal(
                parseInt(lengthBefore) + 1,
                parseInt(lengthAfter)
            );
        });
    });

    describe("Router Liquidity", () => {

        it("should be able to addLiquidity (Tokens)", async () => {

            const depositAmount = FIVE_TOKENS;

            await token.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await token2.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await router.addLiquidity(
                token.address,
                token2.address,
                depositAmount,
                depositAmount,
                1,
                1,
                owner,
                170000000000,
                {from: owner}
            );

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                token2.address
            );

            pair = await ISwapsPair.at(pairAddress);

            tokenBalance = await token.balanceOf(pairAddress);
            token2Balance = await token2.balanceOf(pairAddress);

            liquidityTokens = await pair.balanceOf(owner);

            assert.isAbove(
                parseInt(liquidityTokens),
                parseInt(0)
            );

            assert.equal(
                tokenBalance,
                depositAmount
            );

            assert.equal(
                token2Balance,
                depositAmount
            );
        });

        it("should be able to addLiquidityETH (Ether)", async () => {

            const depositAmount = FIVE_ETH;

            await token.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await router.addLiquidityETH(
                token.address,
                STATIC_SUPPLY,
                0,
                0,
                owner,
                170000000000,
                {from: owner, value: depositAmount}
            );

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                weth.address
            );

            pair = await ISwapsPair.at(pairAddress);
            wethBalance = await weth.balanceOf(pairAddress);
            tokenBalance = await token.balanceOf(pairAddress);

            liquidityTokens = await pair.balanceOf(owner);

            assert.isAbove(
                parseInt(liquidityTokens),
                parseInt(0)
            );

            assert.equal(
                tokenBalance,
                STATIC_SUPPLY
            );

            assert.equal(
                wethBalance,
                depositAmount
            );
        });

        it("should be able to removeLiquidity (Tokens)", async () => {

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                token2.address
            );

            pair = await ISwapsPair.at(pairAddress);
            ownersBalance = await pair.balanceOf(owner);

            assert.isAbove(
                parseInt(ownersBalance),
                0
            );

            await pair.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            const allowance = await pair.allowance(
                owner,
                router.address
            );

            assert.equal(
                allowance,
                APPROVE_VALUE
            );

            await router.removeLiquidity(
                token.address,
                token2.address,
                ownersBalance,
                0,
                0,
                owner,
                1700000000000
            );
        });

        it("should be able to removeLiquidityETH (Ether)", async () => {

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                weth.address
            );

            pair = await ISwapsPair.at(pairAddress);
            ownersBalance = await pair.balanceOf(owner);

            assert.isAbove(
                parseInt(ownersBalance),
                0
            );

            await pair.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            const allowance = await pair.allowance(
                owner,
                router.address
            );

            assert.equal(
                allowance,
                APPROVE_VALUE
            );

            await router.removeLiquidityETH(
                token.address,
                ownersBalance,
                0,
                0,
                owner,
                1700000000000
            );
        });
    });

    describe("Router Swap", () => {

        it("should be able to perform a swap (ETH > ERC20)", async () => {

            const depositAmount = FIVE_ETH;
            const swapAmount = FOUR_ETH;

            await token.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await router.addLiquidityETH(
                token.address,
                STATIC_SUPPLY,
                0,
                0,
                owner,
                170000000000,
                {from: owner, value: depositAmount}
            );

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                weth.address
            );

            wethBalanceBefore = await weth.balanceOf(pairAddress);

            const path = [
                weth.address,
                token.address
            ];

            await router.swapExactETHForTokens(
                0,
                path,
                owner,
                1700000000000,
                {
                    from: owner,
                    gasLimit: 10000000000,
                    value: swapAmount
                }
            );

            wethBalanceAfter = await weth.balanceOf(pairAddress);

            assert.equal(
                parseInt(wethBalanceBefore) + parseInt(swapAmount),
                parseInt(wethBalanceAfter)
            );
        });

        it("should be able to perform a swap (ERC20 > ETH)", async () => {

            const depositAmount = FIVE_ETH;
            const swapAmount = FOUR_ETH;

            await token.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await router.addLiquidityETH(
                token.address,
                STATIC_SUPPLY,
                0,
                0,
                owner,
                170000000000,
                {
                    from: owner,
                    value: depositAmount
                }
            );

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                weth.address
            );

            tokenBalanceBefore = await token.balanceOf(
                pairAddress
            );

            const path = [
                token.address,
                weth.address
            ];

            await router.swapExactTokensForETH(
                swapAmount,
                0,
                path,
                owner,
                1700000000000,
                {
                    from: owner,
                    gasLimit: 10000000000
                }
            );

            tokenBalanceAfter = await token.balanceOf(
                pairAddress
            );

            assert.equal(
                parseInt(tokenBalanceBefore) + parseInt(swapAmount),
                parseInt(tokenBalanceAfter)
            );
        });

        it("should be able to perform a swap (ERC20 > ERC20)", async () => {

            const depositAmount = FOUR_TOKENS;
            const swapAmount = ONE_TOKEN;

            await token.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await token2.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await router.addLiquidity(
                token.address,
                token2.address,
                depositAmount,
                depositAmount,
                1,
                1,
                owner,
                170000000000,
                {
                    from: owner
                }
            );

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                token2.address
            );

            tokenBalanceBefore = await token.balanceOf(
                pairAddress
            );

            const path = [
                token.address,
                token2.address
            ];

            await router.swapExactTokensForTokens(
                swapAmount,
                0,
                path,
                owner,
                1700000000000,
                {
                    from: owner,
                    gasLimit: 10000000000
                }
            );

            tokenBalanceAfter = await token.balanceOf(
                pairAddress
            );

            assert.equal(
                parseInt(tokenBalanceBefore) + parseInt(swapAmount),
                parseInt(tokenBalanceAfter)
            );
        });

        it("should be able to perform a swap (ERC20 > ERC20)", async () => {

            const depositAmount = FIVE_TOKENS;
            const swapAmount = ONE_TOKEN;

            await token.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await token2.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await router.addLiquidity(
                token.address,
                token2.address,
                depositAmount,
                depositAmount,
                1,
                1,
                owner,
                170000000000,
                {
                    from: owner
                }
            );

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                token2.address
            );

            tokenBalanceBefore = await token2.balanceOf(
                pairAddress
            );

            const path = [
                token.address,
                token2.address
            ];

            await router.swapTokensForExactTokens(
                swapAmount,
                depositAmount,
                path,
                owner,
                1700000000000,
                {
                    from: owner,
                    gasLimit: 10000000000
                }
            );

            tokenBalanceAfter = await token2.balanceOf(
                pairAddress
            );

            assert.equal(
                parseInt(tokenBalanceBefore),
                parseInt(tokenBalanceAfter) + parseInt(swapAmount)
            );
        });

        it("should revert if path is invalid", async () => {

            const swapAmount = ONE_TOKEN;
            const depositAmount = ONE_TOKEN;

            const path = [
                token.address
            ];

            await catchRevert(
                router.swapTokensForExactTokens(
                    swapAmount,
                    depositAmount,
                    path,
                    owner,
                    1700000000000,
                    {
                        from: owner,
                        gasLimit: 10000000000
                    }
                ),
                'revert INVALID_PATH'
            );
        });
    });

    describe("Swaps Pair", () => {

        it("should allow to perform skim() operation retrieve stuck tokens", async () => {

            const depositAmount = FIVE_TOKENS;

            const feeTo = await factory.feeTo();
            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                token2.address
            );

            pair = await SwapsPair.at(
                pairAddress
            );

            await token.transfer(
                pair.address,
                depositAmount,
                {
                    from: owner
                }
            );

            const balanceBefore = await token.balanceOf(feeTo);

            await pair.skim();

            const balanceAfter = await token.balanceOf(feeTo);

            assert.equal(
                parseInt(balanceBefore) + parseInt(depositAmount),
                parseInt(balanceAfter)
            );
        });

    });

    describe("Swaps Pair", () => {

        it("should have correct total supply", async () => {
            const depositAmount = FIVE_TOKENS;

            await token.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await token2.approve(
                router.address,
                APPROVE_VALUE,
                {from: owner}
            );

            await router.addLiquidity(
                token.address,
                token2.address,
                depositAmount,
                depositAmount,
                1,
                1,
                owner,
                170000000000,
                {from: owner}
            );

            const pairAddress = await router.pairFor(
                factory.address,
                token.address,
                token2.address
            );

            pair = await SwapsPair.at(pairAddress);

            const supply = await pair.totalSupply();
            const ownerBalance = await pair.balanceOf(owner);

            assert.isAbove(
                parseInt(supply),
                0
            );
        });

        it("should have correct name", async () => {
            const name = await pair.name();

            assert.equal(
                name,
                "Bitcoin.com Swaps"
            );
        });

        it("should have correct symbol", async () => {
            const symbol = await pair.symbol();

            assert.equal(
                symbol,
                "BCOM-S"
            );
        });

        it("should have correct decimals", async () => {
            const decimals = await pair.decimals();

            assert.equal(
                decimals,
                18
            );
        });

        it("should return correct balance for account", async () => {

            const expectedAmount = ONE_TOKEN;

            await pair.transfer(
                alice,
                expectedAmount,
                {
                    from: owner
                }
            );

            const balance = await pair.balanceOf(alice);

            assert.equal(
                parseInt(balance),
                parseInt(expectedAmount)
            );
        });

        it("should give the correct allowance for the given spender", async () => {

            const allowance = await pair.allowance(
                owner,
                bob
            );

            assert.equal(
                allowance,
                0
            );
        });

        it("should return correct PERMIT_TYPEHASH", async () => {
            const expectedHash = web3.utils.keccak256(
                "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
            );
            const hashInContract = await pair.PERMIT_TYPEHASH();
            assert.equal(
                hashInContract,
                expectedHash
            );
        });

        it("on approve should emit correct Approval event", async () => {
            const transferValue = ONE_TOKEN;

            await pair.approve(
                bob,
                transferValue,
                {
                    from: owner
                }
            );

            const { owner: transferOwner, spender, value } = await getLastEvent(
                "Approval",
                pair
            );

            assert.equal(
                transferOwner,
                owner
            );

            assert.equal(
                spender,
                bob
            );

            assert.equal(
                transferValue,
                value
            );
        });

        it("on transfer should emit correct Transfer event", async () => {
            const transferValue = ONE_TOKEN;
            const expectedRecepient = bob;

            await pair.transfer(
                expectedRecepient,
                transferValue,
                {
                    from: owner
                }
            );

            const { from, to, value } = await getLastEvent(
                "Transfer",
                pair
            );

            assert.equal(
                from,
                owner
            );

            assert.equal(
                to,
                expectedRecepient
            );

            assert.equal(
                value,
                transferValue
            );
        });

        it("should transfer correct amount from walletA to walletB", async () => {

            const transferValue = ONE_TOKEN;
            const balanceBefore = await　pair.balanceOf(bob);
            const ownerBalanceBefore = await pair.balanceOf(owner);

            await pair.transfer(
                bob,
                transferValue,
                {
                    from: owner
                }
            );

            const balanceAfter = await pair.balanceOf(bob);
            const ownerBalanceAfter = await pair.balanceOf(owner);

            assert.equal(
                (new BN(balanceAfter)).toString(),
                (new BN(balanceBefore).add(new BN(transferValue))).toString()
            );

            assert.equal(
                (new BN(ownerBalanceAfter)).toString(),
                (new BN(ownerBalanceBefore).sub(new BN(transferValue))).toString()
            );
        });

        it("should revert if not enough balance in the wallet", async () => {
            await catchRevert(
                pair.transfer(
                    alice,
                    ONE_TOKEN,
                    {
                        from: random
                    }
                )
            );
        });

        it("should increase allowance of wallet", async () => {

            const approvalValue = ONE_TOKEN;

            await pair.approve(
                bob,
                approvalValue,
                {
                    from: owner
                }
            );

            const allowanceValue = await pair.allowance(
                owner,
                bob
            );

            assert.equal(
                approvalValue,
                allowanceValue
            );
        });

        it("transferFrom should deduct correct amount from sender", async () => {

            const transferValue = ONE_TOKEN;
            const expectedRecipient = bob;

            await pair.approve(
                owner,
                transferValue
            );

            const balanceBefore = await pair.balanceOf(owner);

            await pair.transferFrom(
                owner,
                expectedRecipient,
                transferValue,
            );

            const balanceAfter = await pair.balanceOf(owner);

            assert.equal(
                (new BN(balanceAfter)).toString(),
                (new BN(balanceBefore).sub(new BN(transferValue))).toString()
            );
        });

        it("transferFrom should add correct amount to reciever", async () => {
            const transferValue = ONE_TOKEN;
            const expectedRecipient = alice;
            const balanceBefore = await pair.balanceOf(alice);

            await pair.approve(
                owner,
                transferValue
            );

            await pair.transferFrom(
                owner,
                expectedRecipient,
                transferValue,
            );

            const balanceAfter = await pair.balanceOf(alice);

            assert.equal(
                parseInt(balanceAfter),
                parseInt(balanceBefore) + parseInt(transferValue)
            );
        });

        it("should revert if there is no approval when using transferFrom", async () => {
            const transferValue = ONE_TOKEN;
            const expectedRecipient = bob;

            await catchRevert(
                pair.transferFrom(
                    owner,
                    expectedRecipient,
                    transferValue
                ),
                "revert REQUIRES APPROVAL"
            );
        });
    });
});
