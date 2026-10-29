import { ethers } from "ethers";

export default async function handler(req, res) {
    // 1. Configuración de Headers CORS corregida (alineada con vercel.json)
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    // 2. Manejo de la petición Preflight (IMPORTANTE)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. Validación de método HTTP (Buena práctica: usar POST para crear recursos)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: "Método no permitido" });
    }

    // 4. Lógica de generación de Wallet (USDT BEP20)
    try {
        const wallet = ethers.Wallet.createRandom();

        // ⚠️ ADVERTENCIA CRÍTICA PARA TU PASARELA:
        // Si esta es una wallet de depósito custodial, NUNCA expongas la privateKey en la respuesta.
        // Lo correcto es encriptar la privateKey y guardarla internamente en tu base de datos (como Supabase)
        // vinculada al Telegram ID del usuario de tu Mini App. Al cliente solo se le devuelve el 'address'.
        
        // TODO: Lógica para insertar { address, encryptedPrivateKey, telegramId } en tu base de datos aquí.

        res.status(200).json({ 
            address: wallet.address, 
            privateKey: wallet.privateKey // Solo mantenlo si es estrictamente necesario para el frontend (ej. non-custodial)
        });
    } catch (error) {
        console.error("Error al generar wallet:", error); // Vital para debugear en Vercel
        res.status(500).json({ error: "Error interno al generar la wallet de depósito" });
    }
}
