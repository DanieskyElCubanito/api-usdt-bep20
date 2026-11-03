const { ethers } = require('ethers');

module.exports = async function handler(req, res) {
    // CORS unificado
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const { network, address } = req.body;

    if (!network || !address) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros (network, address)' });
    }

    try {
        const net = network.toUpperCase();
        let balanceNumber = 0;

        if (net === 'BSC' || net === 'BEP20') {
            // Conexión de solo lectura a la red BSC
            const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
            
            // Contrato de USDT BEP20
            const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
            const usdtAbi = ["function balanceOf(address owner) view returns (uint256)"];
            
            const usdtContract = new ethers.Contract(usdtAddress, usdtAbi, provider);
            
            // Consultar saldo
            const rawBalance = await usdtContract.balanceOf(address);
            
            // Formatear el resultado a un número decimal normal (USDT tiene 18 decimales en BSC)
            balanceNumber = parseFloat(ethers.formatUnits(rawBalance, 18));
        } 
        else {
            return res.status(400).json({ success: false, error: 'Red no soportada para consultar saldo aún' });
        }

        return res.status(200).json({
            success: true,
            network: net,
            address: address,
            balance: balanceNumber // Devuelve un número (ej. 0, o 1.5, o 50)
        });

    } catch (error) {
        console.error("Error consultando balance:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'Error interno de lectura en la blockchain', 
            detalles: error.message 
        });
    }
}
