import { ethers } from "ethers";

export default async function handler(req, res) {
    // 1. Configuración de Headers CORS (Para que la Mini App pueda entrar)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 2. Manejo de la petición Preflight (IMPORTANTE)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 3. Lógica de generación de Wallet
    try {
        const wallet = ethers.Wallet.createRandom();
        
        // Enviamos la respuesta a la Mini App
        res.status(200).json({ 
            address: wallet.address, 
            privateKey: wallet.privateKey 
        });
    } catch (error) {
        res.status(500).json({ error: "Error al generar la wallet" });
    }
}
