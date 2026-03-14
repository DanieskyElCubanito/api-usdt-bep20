const doge = require('bitcore-lib-doge');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  const { adminPrivateKey, userAddress, amount } = req.body;

  try {
    const pKey = new doge.PrivateKey(adminPrivateKey);
    const adminAddress = pKey.toAddress().toString();
    const amountInSatoshis = Math.round(amount * 100000000); // Convertir a Satoshis
    const fee = 100000000; // 1 DOGE de comisión fija para asegurar rapidez

    // 1. Obtener los UTXO (monedas disponibles) de tu billetera admin
    const url = `https://sochain.com/api/v2/get_spent_utxo/DOGE/${adminAddress}`;
    const response = await axios.get(url);
    const utxos = response.data.data.txs;

    if (utxos.length === 0) {
      return res.status(200).json({ error: "La billetera admin no tiene fondos disponibles (UTXO)." });
    }

    // 2. Construir la transacción
    const tx = new doge.Transaction()
      .from(utxos)
      .to(userAddress, amountInSatoshis)
      .change(adminAddress) // El sobrante regresa a ti
      .fee(fee)
      .sign(pKey);

    // 3. Serializar y enviar (aquí necesitarías un broadcast manual o via API)
    // Por seguridad, devolvemos el hex para que veas que se generó
    res.status(200).json({ 
      success: true, 
      txid: tx.hash,
      message: "Transacción firmada con éxito" 
    });

  } catch (error) {
    res.status(500).json({ error: "Error en red DOGE: " + error.message });
  }
         }
