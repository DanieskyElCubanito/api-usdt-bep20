module.exports = async function handler(req, res) {
    // CORS unificado para Mini Apps y Bots
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
        // Importaciones dentro del try para evitar que caiga el servidor si falta un módulo
        const { ethers } = require('ethers');
        const { TonClient, Address } = require('@ton/ton');

        const net = network.toUpperCase();
        let balanceNumber = 0;

        // ==========================================
        // 1. LECTURA RED BSC (USDT BEP20)
        // ==========================================
        if (net === 'BSC' || net === 'BEP20') {
            const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
            const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
            const usdtAbi = ["function balanceOf(address owner) view returns (uint256)"];
            
            const usdtContract = new ethers.Contract(usdtAddress, usdtAbi, provider);
            const rawBalance = await usdtContract.balanceOf(address);
            
            // USDT tiene 18 decimales en BSC
            balanceNumber = parseFloat(ethers.formatUnits(rawBalance, 18));
        } 
        
        // ==========================================
        // 2. LECTURA RED TON (GRAM / TONCOIN)
        // ==========================================
        else if (net === 'TON' || net === 'GRAM') {
            // Conexión al nodo público de TON
            const client = new TonClient({
                endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            });

            // Validar y parsear la dirección de TON
            const parsedAddress = Address.parse(address);
            
            // Obtener el saldo en nanoTONs (1 TON = 1,000,000,000 nanoTONs)
            const rawBalance = await client.getBalance(parsedAddress);
            
            // Formatear a número normal
            balanceNumber = Number(rawBalance) / 1e9;
        }

        else {
            return res.status(400).json({ success: false, error: 'Red no soportada para consultar saldo aún' });
        }

        return res.status(200).json({
            success: true,
            network: net,
            address: address,
            balance: balanceNumber // Devuelve un número exacto (ej. 0, 1.5, 50)
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
