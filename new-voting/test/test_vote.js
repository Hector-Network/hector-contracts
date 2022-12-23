const hre = require("hardhat");
const fetch = require('node-fetch');
const { ethers } = require("hardhat");
const erc20Abi = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json");
const { BigNumber } = require("@ethersproject/bignumber");
const tempData = require("./tempData.json");
require("dotenv").config();
const abiDecoder = require('abi-decoder');
const abi = require("../artifacts/contracts/Voting.sol/Voting.json");

async function main() {
  const mode = "single"; // mode: single, multi
  const [deployer] = await hre.ethers.getSigners();
  console.log("Testing account:", deployer.address);
  // console.log("Account balance:", (await deployer.getBalance()).toString());

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const VOTING_ADDRESS = "0x7ABf20402BCE654d5F902C599A2547b5557b5406";
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
      let [farmVote, weights, stakingToken, amount, fnft, fnftIds] = getVotingMethodDecode(history);

      if (farmVote?.value && weights?.value) {
        fnftVotingInfoFromHistories.push({
          _farmVote: farmVote.value,
          _weights: weights.value,
          _stakingToken: stakingToken.value,
          _amount: amount.value,
          _farmVote: farmVote.value,
          _fnft: fnft.value,
          _fnftIds: fnftIds.value
        });
      }
    }
  });

  console.log("VOTING COUUNT:", fnftVotingInfoFromHistories.length)
  return

  try {
    console.log()
  } catch (e) {
    console.log(e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
