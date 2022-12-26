const hre = require("hardhat");
const fetch = require('node-fetch');
const { ethers } = require("hardhat");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { BigNumber } = require("@ethersproject/bignumber");
const tempData = require("./tempData.json");
require("dotenv").config();
const abiDecoder = require('abi-decoder');
const abi = require("../artifacts/contracts/Voting.sol/Voting.json");
const { off } = require("process");

async function main() {
  const mode = "single"; // mode: single, multi
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  // console.log("Account balance:", (await deployer.getBalance()).toString());

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const VOTING_ADDRESS = process.env.VOTING_ADDRESS;
  const OLD_VOTING_ADDRESS = "0x4040761F70921d4E03A34B8F8E6d74097206E7e9";
  const ftmscanApiKey = process.env.FTM_API_KEY;

  const votingContract = new ethers.Contract(
    VOTING_ADDRESS,
    abi.abi,
    deployer
  );

  const voteDelayTime = await votingContract.voteDelay();

  const getCurrentTimeInSecond = async () => {
    try {
      const r = await (await fetch('https://timeapi.io/api/Time/current/zone?timeZone=UTC')).json();

      return Math.trunc(new Date(`${r.dateTime}Z`).getTime() / 1000);
    } catch (error) {
      console.log(error);
      return Math.trunc(new Date().getTime() / 1000);
    }
  }

  const currentTime = await getCurrentTimeInSecond();
  const startTimeStamp = currentTime - voteDelayTime; // 7 days


  const startBlockApiResult = await fetch(
    `https://api.ftmscan.com/api?module=block&action=getblocknobytime&timestamp=${startTimeStamp}&closest=before&apikey=${ftmscanApiKey}`,
  ).then((res) => res.json());

  let startBlock = 0;
  if (startBlockApiResult?.message === 'OK') {
    startBlock = startBlockApiResult.result;
  }

  let txHistories = await fetch(
    `https://api.ftmscan.com/api?module=account&action=txlist&address=${OLD_VOTING_ADDRESS}&startblock=${startBlock}&endblock=99999999&sort=asc&apikey=${ftmscanApiKey}`,
  ).then((res) => res.json());

  if (txHistories?.message === 'OK') {
    txHistories = txHistories.result;
  } else {
    txHistories = [];
  }

  const ABI = [
    {
      inputs: [
        {
          internalType: 'contract LockFarm[]',
          name: '_farmVote',
          type: 'address[]',
        },
        {
          internalType: 'uint256[]',
          name: '_weights',
          type: 'uint256[]',
        },
        {
          internalType: 'contract IERC20',
          name: '_stakingToken',
          type: 'address',
        },
        {
          internalType: 'uint256',
          name: '_amount',
          type: 'uint256',
        },
        {
          internalType: 'contract FNFT',
          name: '_fnft',
          type: 'address',
        },
        {
          internalType: 'uint256[]',
          name: '_fnftIds',
          type: 'uint256[]',
        },
      ],
      name: 'vote',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ];

  const fnftVotingInfoFromHistories = [];

  const getVotingMethodDecode = (voteTx) => {
    abiDecoder.addABI(ABI);
    const decodedData = abiDecoder.decodeMethod(voteTx.input);
    return decodedData?.params ? decodedData?.params : [];
  }

  txHistories.map((history) => {
    if (history.txreceipt_status) {
      let _time = history.timeStamp;
      let [farmVote, weights, stakingToken, amount, fnft, fnftIds] = getVotingMethodDecode(history);
      const newWeights = [];
      weights.value.map((weight) => {
        newWeights.push(BigNumber.from(weight))
      })
      const newFNFTIds = [];
      fnftIds.value.map((fnftId) => {
        newFNFTIds.push(BigNumber.from(fnftId))
      })

      if (farmVote?.value && weights?.value) {
        fnftVotingInfoFromHistories.push({
          _farmVote: farmVote.value,
          _weights: newWeights,
          _stakingToken: stakingToken.value,
          _amount: BigNumber.from(amount.value),
          _farmVote: farmVote.value,
          _fnft: fnft.value,
          _fnftIds: newFNFTIds,
          time: BigNumber.from(_time)
        });
      }
    }
  });

  console.log("TOTAL VOTED COUNT:", fnftVotingInfoFromHistories.length)
  try {
    for (let i = 0; i < fnftVotingInfoFromHistories.length; i++) {
      const lastTime = await votingContract.lastTimeByOwner()
      if (lastTime == 0 || (fnftVotingInfoFromHistories[i].time > lastTime && fnftVotingInfoFromHistories[i].time != lastTime)) {
        console.log({ lastTime })
        const txVote = await votingContract.voteByTime(
          fnftVotingInfoFromHistories[i]._farmVote,
          fnftVotingInfoFromHistories[i]._weights,
          fnftVotingInfoFromHistories[i]._stakingToken,
          fnftVotingInfoFromHistories[i]._amount,
          fnftVotingInfoFromHistories[i]._fnft,
          fnftVotingInfoFromHistories[i]._fnftIds,
          fnftVotingInfoFromHistories[i].time
        )
        await txVote.wait()
        console.log({hash:txVote.hash})
      }
    }

    // const votingInfo = fnftVotingInfoFromHistories[0];
    // if (votingInfo.time != lastTime) {
    //   const txVote = await votingContract.voteByTime(
    //     votingInfo._farmVote,
    //     votingInfo._weights,
    //     votingInfo._stakingToken,
    //     votingInfo._amount,
    //     votingInfo._fnft,
    //     votingInfo._fnftIds,
    //     votingInfo.time
    //   )
    //   console.log(txVote.transactionHash)
    // }
  } catch (e) {
    console.log(e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
