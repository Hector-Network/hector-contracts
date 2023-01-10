import { ethers } from "ethers";
import { BigNumber } from "@ethersproject/bignumber";

export const ether = (amount: number | string): BigNumber => {
  const weiString = ethers.utils.parseEther(amount.toString());
  return BigNumber.from(weiString);
};

export const wei = (amount: number | string): BigNumber => {
  const weiString = ethers.utils.parseUnits(amount.toString(), 0);
  return BigNumber.from(weiString);
};

export const gWei = (amount: number): BigNumber => {
  const weiString = BigNumber.from("1000000000").mul(amount);
  return BigNumber.from(weiString);
};

export const usdc = (amount: number): BigNumber => {
  const weiString = BigNumber.from("1000000").mul(amount);
  return BigNumber.from(weiString);
};