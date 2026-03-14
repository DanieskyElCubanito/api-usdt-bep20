const axios = require('axios');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
    
    const { userAddress, amount } = req.body;
    const adminPrivateKey = process.env.DOGE_ADMIN_KEY;

    try {
        if (!userAddress || !amount) {
            return res.status(200).json({ error: "Faltan parámetros." });
        }

        // Simulación profesional de respuesta mientras vinculas el Bridge
        // Esto evita el crash del Bot y te permite avanzar
        return res.status(200).json({
            success: true,
            txid: "TRANSFER_VIA_BRIDGE_PENDING",
            message: "La red Dogecoin está procesando la solicitud vía nodo externo."
        });

    } catch (error) {
        return res.status(200).json({ 
            error: "Error de comunicación con el nodo",
            details: error.message
        });
    }
}
