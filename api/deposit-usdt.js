import { ethers } from "ethers";

const RPC_URL = "https://bsc-dataseed.binance.org/";
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

export default async function handler(req, res) {
    // 1. Configuración de Headers CORS (Corregida para el ecosistema Telegram / Web)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Seguridad Crítica: Extraer direcciones y claves maestras del entorno (Variables de entorno)
    // NUNCA confíes en que el frontend te envíe la 'adminAddress' o la 'feePrivateKey'
    const { userPrivateKey } = req.body; 
    const adminAddress = process.env.BSC_ADMIN_WALLET;
    const feePrivateKey = process.env.BSC_FEE_WALLET_PRIVATE_KEY; // Wallet que inyecta BNB para el gas

    if (!userPrivateKey || !adminAddress || !feePrivateKey) {
        return res.status(400).json({ error: "Faltan credenciales del usuario o variables de entorno administrativas." });
    }

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const userWallet = new ethers.Wallet(userPrivateKey, provider);
        const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, userWallet);

        // Obtener balance de USDT y sus decimales
        const [usdtBalance, decimals] = await Promise.all([
            usdtContract.balanceOf(userWallet.address),
            usdtContract.decimals()
        ]);

        const formattedBalance = ethers.formatUnits(usdtBalance, decimals);
        const totalSweptFloat = parseFloat(formattedBalance);

        // Si el balance es casi cero, abortar para no gastar BNB en gas innecesariamente
        if (totalSweptFloat < 0.01) {
            return res.status(200).json({ 
                success: false, 
                error: "Saldo USDT insuficiente para realizar el barrido (sweep).", 
                balance: formattedBalance 
            });
        }

        // Verificar BNB para el gas de la transferencia de USDT
        const bnbBalance = await provider.getBalance(userWallet.address);
        const feeData = await provider.getFeeData();
        const gasLimit = 80000n; // Margen de seguridad recomendado para tokens BEP20
        const requiredBnb = (feeData.gasPrice || 5000000000n) * gasLimit;

        // Si la wallet de depósito no tiene BNB, fondeamos el gas
        if (bnbBalance < requiredBnb) {
            const feeWallet = new ethers.Wallet(feePrivateKey, provider);
            const txFee = await feeWallet.sendTransaction({ 
                to: userWallet.address, 
                value: requiredBnb 
            });
            await txFee.wait();
            
            // Informamos que se inyectó el gas. El sistema o un cronjob debe reintentar este webhook.
            return res.status(200).json({ 
                success: true, 
                method: "gas_sent", 
                message: "Fondeo de BNB enviado para cubrir el gas. Reintente el barrido en unos instantes." 
            });
        }

        // 3. Cálculo de la comisión del 0.1% (Ganancia de tu plataforma)
        // La transacción en la blockchain envía el 100% de los USDT a tu billetera administrativa.
        const profitFee = totalSweptFloat * 0.001; 
        
        // Esto es lo que debes guardar en tu base de datos como saldo real del usuario.
        const amountToCreditUser = totalSweptFloat - profitFee; 

        // 4. Ejecutar el barrido de USDT hacia la wallet central
        const tx = await usdtContract.transfer(adminAddress, usdtBalance);
        const receipt = await tx.wait();

        return res.status(200).json({ 
            success: true, 
            transactionHash: receipt.hash, 
            sweptAmountUSDT: totalSweptFloat,
            userCreditUSDT: amountToCreditUser, // Acreditar en DB
            profitUSDT: profitFee // Ganancia líquida retenida en adminAddress
        });

    } catch (error) {
        console.error("Error en barrido de USDT BEP20:", error);
        return res.status(500).json({ error: "Error interno al interactuar con Binance Smart Chain." });
    }
}
