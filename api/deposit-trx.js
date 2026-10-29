const TronWeb = require('tronweb');

export default async function handler(req, res) {
    // 1. Configuración de Headers CORS (Compatibilidad con Mini Apps y Web)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // 2. Seguridad Crítica: Extraemos la dirección de destino desde el entorno.
    // La 'userPrivateKey' DEBE venir de tu base de datos (Supabase), nunca enviada directamente por el cliente HTTP.
    const { userPrivateKey } = req.body; 
    const adminAddress = process.env.TRON_ADMIN_WALLET; // Tu billetera central donde caen los fondos

    if (!userPrivateKey || !adminAddress) {
        return res.status(400).json({ error: "Faltan credenciales de usuario o variable de entorno administrativa." });
    }

    try {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } // Vital en producción para evitar Rate Limits
        });

        tronWeb.setPrivateKey(userPrivateKey);
        const address = tronWeb.address.fromPrivateKey(userPrivateKey);
        
        const balanceSun = await tronWeb.trx.getBalance(address); // 1 TRX = 1,000,000 SUN
        
        // Estimación de gas en TRX para envío nativo (Suele ser ~1.5 TRX a 2 TRX dependiendo del ancho de banda)
        const estimatedGasSun = 1500000; 
        
        if (balanceSun <= estimatedGasSun) {
            return res.status(400).json({ error: "Saldo insuficiente en la wallet de depósito para cubrir el gas de red." });
        }

        // 3. Lógica del Barrido (Sweep) y Cálculo del 0.1%
        // Enviamos TODO el saldo posible (menos el gas) hacia tu wallet administrativa
        const amountToSweepSun = balanceSun - estimatedGasSun;
        
        // Calculamos tu 0.1% de ganancia sobre lo que se barrió
        const profitFeeSun = Math.floor(amountToSweepSun * 0.001);
        
        // Esto es lo que realmente le vas a acreditar al usuario en el dashboard de la Mini App
        const amountToCreditUserSun = amountToSweepSun - profitFeeSun;

        // 4. Ejecución de la transferencia a tu wallet
        const trade = await tronWeb.trx.sendTransaction(adminAddress, amountToSweepSun);

        if (trade.result) {
            res.status(200).json({ 
                success: true, 
                txid: trade.txid,
                sweptAmountTRX: amountToSweepSun / 1000000,
                // TODO: Ejecutar UPDATE en tu base de datos sumándole esto al balance del usuario:
                userCreditTRX: amountToCreditUserSun / 1000000, 
                profitTRX: profitFeeSun / 1000000 // Tu 0.1% que ya quedó asegurado en la wallet administrativa
            });
        } else {
            res.status(500).json({ error: "La red de TRON rechazó la transacción." });
        }

    } catch (error) {
        console.error("Error en TRX Sweep:", error);
        res.status(500).json({ error: "Error interno al comunicarse con TronGrid." });
    }
}
