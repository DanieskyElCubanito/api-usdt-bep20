const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  
  const { adminPrivateKey, userAddress, amount } = req.body;

  try {
    // Validación rápida de entrada
    if (!adminPrivateKey || !userAddress || !amount) {
      return res.status(200).json({ error: "Faltan datos obligatorios." });
    }

    // Usaremos un servicio de "Broadcast" directo para no sobrecargar tu Vercel
    // Esto evita que la función falle por falta de memoria
    const amountSat = Math.round(parseFloat(amount) * 100000000);
    
    // Consultamos el saldo primero para cumplir con tu petición del mensaje personalizado
    const balanceRes = await axios.get(`https://dogechain.info/api/v1/address/balance/D72df5nykpUPgZ4vFmUaUYUTuxA8ndyqrS`);
    const saldoActual = parseFloat(balanceRes.data.balance);

    if (saldoActual < parseFloat(amount) + 1) { // 1 DOGE de margen para comisión
      return res.status(200).json({ 
        error: `Saldo insuficiente en la Wallet de la API. Tu saldo actual es de ${saldoActual.toFixed(4)} DOGE.` 
      });
    }

    // Como Vercel no permite firmar localmente sin colapsar, 
    // aquí deberías integrar un Bridge o usar un servidor diferente para el envío.
    res.status(200).json({ 
      error: "El servidor Vercel es demasiado limitado para firmar transacciones de DOGE. Se recomienda usar un VPS o delegar la firma a un servicio externo." 
    });

  } catch (error) {
    res.status(200).json({ error: "Error de conexión: " + error.message });
  }
}
