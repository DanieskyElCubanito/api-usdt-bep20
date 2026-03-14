const doge = require('bitcore-lib-doge');
const axios = require('axios');

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { adminPrivateKey, userAddress, amount } = req.body;

  // Validar que lleguen los datos
  if (!adminPrivateKey || !userAddress || !amount) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (Key, Address o Amount)' });
  }

  try {
    const pKey = new doge.PrivateKey(adminPrivateKey);
    const adminAddress = pKey.toAddress().toString();
    const amountInSatoshis = Math.round(parseFloat(amount) * 100000000);
    const fee = 100000000; // 1 DOGE de comisión

    // Usamos un explorador confiable para obtener los UTXO
    const url = `https://dogechain.info/api/v1/unspent/${adminAddress}`;
    const response = await axios.get(url);
    
    if (!response.data || !response.data.unspent_outputs || response.data.unspent_outputs.length === 0) {
      return res.status(200).json({ error: "La billetera admin no tiene fondos suficientes o confirmados." });
    }

    const utxos = response.data.unspent_outputs.map(utxo => ({
      txId: utxo.tx_hash,
      outputIndex: utxo.tx_output_n,
      address: adminAddress,
      script: utxo.script,
      satoshis: Math.round(parseFloat(utxo.value) * 100000000)
    }));

    const tx = new doge.Transaction()
      .from(utxos)
      .to(userAddress, amountInSatoshis)
      .change(adminAddress)
      .fee(fee)
      .sign(pKey);

    // Enviar el HEX de la transacción para procesar
    res.status(200).json({ 
      success: true, 
      txid: tx.hash,
      message: "Transacción lista" 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno: " + error.message });
  }
      }
