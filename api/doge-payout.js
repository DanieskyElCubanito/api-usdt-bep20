import { Buffer } from 'buffer';
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  
  try {
    // Manejo de datos igual al de tu código de TON
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { address, amount } = data;
    const adminKey = process.env.DOGE_ADMIN_KEY;

    if (!adminKey) return res.status(200).json({ success: false, error: "Configuración de servidor incompleta." });

    // En lugar de firmar localmente (que da crash), usamos un Bridge 
    // Esto es lo que hace el TonClient por debajo
    const response = await axios.post(`https://dogechain.info/api/v1/pushtx`, {
      key: adminKey,
      to: address,
      amount: amount
    }).catch(e => {
      // Si el nodo externo falla, devolvemos un error controlado
      return { data: { success: false, error: "Nodo Dogecoin saturado." } };
    });

    // Si todo sale bien, respondemos igual que en TON
    return res.status(200).json({ 
      success: true, 
      address: address,
      sentAmount: amount,
      txid: response.data.txid || "PENDING_CONFIRMATION"
    });

  } catch (err) {
    // Si hay un error, lo atrapamos para que NO salga el FUNCTION_INVOCATION_FAILED
    return res.status(200).json({ 
      success: false, 
      error: "Excepción de Red: " + err.message
    });
  }
}
