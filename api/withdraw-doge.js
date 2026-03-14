const doge = require('bitcore-lib-doge');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const { adminPrivateKey, userAddress, amount } = req.body;

  try {
    // 1. Validar Clave Privada
    if (!doge.PrivateKey.isValid(adminPrivateKey)) {
      return res.status(200).json({ error: "La clave privada de administrador no es válida." });
    }

    const pKey = new doge.PrivateKey(adminPrivateKey);
    const adminAddress = pKey.toAddress().toString();
    const amountInSatoshis = Math.round(parseFloat(amount) * 100000000);
    const fee = 100000000; // 1 DOGE de comisión fija

    // 2. Obtener UTXO desde un explorador estable
    const url = `https://chain.so/api/v2/get_unspent_utxo/DOGE/${adminAddress}`;
    const resp = await axios.get(url);
    
    if (!resp.data.data.txs || resp.data.data.txs.length === 0) {
      return res.status(200).json({ error: "La billetera admin no tiene fondos suficientes (UTXOs)." });
    }

    // 3. Formatear UTXOs para Bitcore
    const utxos = resp.data.data.txs.map(u => ({
      address: adminAddress,
      txId: u.txid,
      outputIndex: u.output_no,
      script: u.script_asm, // Usamos el script ASM que es más estable
      satoshis: Math.round(parseFloat(u.value) * 100000000)
    }));

    // 4. Crear transacción manual para evitar errores de librería
    const tx = new doge.Transaction()
      .from(utxos)
      .to(userAddress, amountInSatoshis)
      .fee(fee)
      .change(adminAddress)
      .sign(pKey);

    res.status(200).json({ 
      success: true, 
      txid: tx.hash,
      message: "Retiro procesado correctamente" 
    });

  } catch (error) {
    // Esto enviará el error real a Bots.Business en lugar de romper Vercel
    res.status(200).json({ error: "Fallo en API: " + error.message });
  }
  }
