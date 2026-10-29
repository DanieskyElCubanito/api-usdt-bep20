const TronWeb = require('tronweb');

export default async function handler(req, res) {
    // 1. Configuración de Headers CORS (Estándar unificado para tu pasarela)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const tronWeb = new TronWeb({
            fullHost: 'https://api.trongrid.io',
            // Opcional pero recomendado en producción si esta instancia hace más que solo generar wallets:
            // headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } 
        });

        // 2. Generación de la Wallet TRX / USDT TRC20 (Funciona para ambos)
        const account = await tronWeb.createAccount();

        // ⚠️ SEGURIDAD CRÍTICA (Arquitectura Custodial)
        // Al igual que con las redes anteriores, la clave privada otorga control total.
        // Encríptala y envíala directamente a tu base de datos (Supabase) vinculada al usuario.
        // El frontend de la Mini App solo debe recibir el 'address' para generar el código QR de depósito.

        // TODO: Lógica para insertar { telegramId, trxAddress, encryptedPrivateKey } en tu base de datos.

        res.status(200).json({
            success: true,
            address: account.address.base58, // Formato estándar de Tron (empieza con 'T')
            privateKey: account.privateKey // 🚨 Elimina esto de la respuesta al cliente en producción
        });
    } catch (error) {
        console.error("Error generando wallet TRON:", error);
        res.status(500).json({ error: "Error interno al generar la billetera TRX/TRC20." });
    }
}
