import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

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
        // 2. Generación de la Frase Semilla y la Wallet TON (GRAM)
        const mnemonic = await mnemonicNew();
        const keyPair = await mnemonicToPrivateKey(mnemonic);
        const wallet = WalletContractV4.create({
            workchain: 0,
            publicKey: keyPair.publicKey,
        });

        // ⚠️ SEGURIDAD CRÍTICA (Arquitectura Custodial)
        // Al igual que con USDT y DOGE, la frase semilla da control total sobre los fondos.
        // No debes enviarla al frontend de la Mini App ni al bot. Debes encriptarla y guardarla 
        // en tu base de datos (Supabase) vinculada al usuario para futuros barridos (sweeps).
        
        // TODO: Lógica para insertar { telegramId, tonAddress, encryptedSeed } en tu base de datos aquí.

        res.status(200).json({
            success: true,
            // Mantener 'bounceable: false' es CORRECTO y VITAL. 
            // En TON, si una wallet es nueva y no tiene saldo, enviar fondos a su versión 'bounceable' 
            // hará que la red rechaze el depósito. 'bounceable: false' asegura que reciba el primer pago.
            address: wallet.address.toString({ bounceable: false }),
            seed: mnemonic.join(" ") // 🚨 Elimina esto de la respuesta al cliente en producción
        });

    } catch (error) {
        console.error("Error generando wallet TON:", error);
        res.status(500).json({ error: "Error interno al generar la billetera en la red TON." });
    }
}
