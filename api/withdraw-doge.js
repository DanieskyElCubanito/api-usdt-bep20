const doge = require('bitcore-lib-doge');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  const { adminPrivateKey, userAddress, amount } = req.body;

  try {
    const pKey = new doge.PrivateKey(adminPrivateKey);
    const adminAddress = pKey.toAddress().toString();
    
    // Convertimos todo a Satoshis para evitar errores decimales
    const amountSat = Math.round(parseFloat(amount) * 100000000);
    const feeSat = 100000000; // 1 DOGE (puedes bajarlo a 0.1 si prefieres)
    const totalNeeded = amountSat + feeSat;

    // Consultamos el explorador
    const url = `https://chain.so/api/v2/get_unspent_utxo/DOGE/${adminAddress}`;
    const resp = await axios.get(url);
    const utxosRaw = resp.data.data.txs;

    if (!utxosRaw || utxosRaw.length === 0) {
      return res.status(200).json({ 
        error: `Saldo insuficiente en la Wallet Admin. Saldo actual: 0 DOGE. Dirección: ${adminAddress}` 
      });
    }

    // Calculamos saldo total disponible
    let totalAvailableSat = 0;
    const utxos = utxosRaw.map(u => {
      const sats = Math.round(parseFloat(u.value) * 100000000);
      totalAvailableSat += sats;
      return {
        txId: u.txid,
        outputIndex: u.output_no,
        address: adminAddress,
        script: u.script_asm,
        satoshis: sats
      };
    });

    // VALIDACIÓN MANUAL DE SALDO
    if (totalAvailableSat < totalNeeded) {
      const saldoDoge = (totalAvailableSat / 100000000).toFixed(4);
      return res.status(200).json({ 
        error: `Saldo insuficiente en la Wallet de la API. Tienes ${saldoDoge} DOGE, pero necesitas ${amount} + ${feeSat/100000000} de comisión.` 
      });
    }

    // 3. Si hay saldo, creamos la transacción
    const tx = new doge.Transaction()
      .from(utxos)
      .to(userAddress, amountSat)
      .fee(feeSat)
      .change(adminAddress)
      .sign(pKey);

    res.status(200).json({ 
      success: true, 
      txid: tx.hash,
      message: "Retiro enviado" 
    });

  } catch (error) {
    // Si algo falla, enviamos el error como JSON, no como crash
    res.status(200).json({ error: "Error en el proceso: " + error.message });
  }
      }
