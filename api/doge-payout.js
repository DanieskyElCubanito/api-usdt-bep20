const axios = require('axios');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
    
    const { userAddress, amount } = req.body;
    // Usaremos una API Key de un servicio como BlockCypher o similares
    const API_KEY = process.env.DOGE_API_TOKEN; 

    try {
        if (!userAddress || !amount) {
            return res.status(200).json({ error: "Faltan parámetros." });
        }

        // Simulación de éxito para que el bot no de error mientras configuras el bridge
        // Aquí conectarás con un servicio tipo BlockCypher que no requiere firmar localmente
        
        return res.status(200).json({
            success: true,
            message: "Sistema en mantenimiento: Migrando a nodo dedicado para evitar límites de Vercel.",
            txid: "PENDING_EXTERNAL_NODE"
        });

    } catch (error) {
        return res.status(200).json({ 
            error: "Error de infraestructura",
            details: error.message
        });
    }
            }
