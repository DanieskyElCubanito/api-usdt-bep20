const doge = require('bitcore-lib-doge');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const { adminPrivateKey, userAddress, amount } = req.body;

  try {
    // Validar datos de entrada
    if (!adminPrivateKey || !userAddress || !amount) {
      return res.status(200).json({ error: "Faltan datos en la solicitud." });
    }

    const pKey = new doge.PrivateKey(adminPrivateKey);
    const adminAddress = pKey.toAddress().toString();
    
    const amountSat = Math.round(parseFloat(amount) * 100000000);
    const feeSat = 100000000; // 1 DOGE
    const totalNeeded = amountSat + feeSat;

    // Usamos el explorador oficial de Dogechain para los UTXO
    const url = `https://dogechain.info/api/v1/unspent/${adminAddress}`;
    const resp = await axios.get(url);
    const data = resp.data;

    if (!data || !data.unspent_outputs || data.unspent_outputs.length === 0) {
       return res.status(200).json({ 
         error: `Saldo insuficiente. Tu wallet de la API (${adminAddress}) tiene 0 DOGE.` 
       });
    }

    let totalAvailableSat = 0;
    const utxos = data.unspent_outputs.map(u => {
      const sats = Math.round(parseFloat(u.value) * 100000000);
      totalAvailableSat += sats;
      return {
        txId: u.tx_hash,
        outputIndex: u.tx_output_n,
        address: adminAddress,
        script: u.script,
        satoshis: sats
      };
    });

    // Validación de saldo manual
    if (totalAvailableSat < totalNeeded) {
      const actualDoge = (totalAvailableSat / 100000000).toFixed(4);
      return res.status(200).json({ 
        error: `Saldo insuficiente en API. Tienes ${actualDoge} DOGE, pero el retiro + comisión requieren ${totalNeeded / 100000000} DOGE.` 
      });
    }

    // Construcción de la transacción
    const tx = new doge.Transaction()
      .from(utxos)
      .to(userAddress, amountSat)
      .fee(feeSat)
      .change(adminAddress)
      .sign(pKey);

    res.status(200).json({ 
      success: true, 
      txid: tx.hash,
      message: "Retiro procesado" 
    });

  } catch (error) {
    // Si el error es de la librería bitcore, lo capturamos aquí para que no rompa Vercel
    res.status(200).json({ error: "Error técnico en la API: " + error.message });
  }
}
