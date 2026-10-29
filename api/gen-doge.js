const doge = require('bitcore-lib-doge');

export default async function handler(req, res) {
    // 1. Configuración de Headers CORS (Estándar unificado para tu pasarela)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Permitimos POST (ideal para crear recursos) o GET (si lo llamas sin body)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        // 2. Generación de la Wallet DOGE
        const privateKey = new doge.PrivateKey();
        const address = privateKey.toAddress();

        // ⚠️ SEGURIDAD CRÍTICA (Al igual que en la generación de USDT)
        // Como esta es una pasarela de pagos (custodial), el bot o Mini App solo necesita conocer el 'address' 
        // para mostrarle al usuario dónde depositar.
        // La 'privateKey' JAMÁS debe viajar al frontend. Debes encriptarla y guardarla en tu base de datos 
        // (ej. Supabase) junto al ID del usuario para que tu sistema pueda hacer el barrido (sweep) después.
        
        // TODO: Insertar { telegramId, dogeAddress, encryptedPrivateKey } en base de datos.

        res.status(200).json({
            success: true,
            address: address.toString(),
            privateKey: privateKey.toString() // 🚨 Elimina esto en producción para evitar robos de fondos
        });

    } catch (error) {
        console.error("Error generando wallet DOGE:", error);
        res.status(500).json({ error: "Error interno en el servidor al generar la billetera." });
    }
}
