import { Buffer } from 'buffer';
const bitcoin = require('@exodus/bitcoinjs-lib-dogecoin');
const axios = require('axios');

// Configuración oficial de Dogecoin extraída de tus archivos de red
const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e, // Las direcciones empiezan con 'D'
  scriptHash: 0x16,
  wif: 0x9e
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { wif, recipientAddress, amt } = data;

    if (!wif) return res.status(200).json({ success: false, error: "Falta WIF (PrivKey)" });

    // 1. Generar la billetera desde el WIF
    const keyPair = bitcoin.ECPair.fromWIF(wif, DOGE_NETWORK);
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });

    // 2. Si amt es 0, devolvemos info de la billetera (Modo Debug)
    if (!amt || parseFloat(amt) === 0) {
      return res.status(200).json({
        success: false,
        debug: `📊 <b>DogeStation Sincronizada</b>\n\n<b>Dirección:</b> <code>${address}</code>\n<b>Estado:</b> Lista para procesar.`
      });
    }

    // 3. Validar dirección de destino (Usando la lógica de address.js que pasaste)
    try {
      bitcoin.address.toOutputScript(recipientAddress, DOGE_NETWORK);
    } catch (e) {
      return res.status(200).json({ success: false, error: "Dirección de destino inválida para Dogecoin." });
    }

    // 4. Obtener UTXOs (monedas disponibles) desde un explorador confiable
    const utxoRes = await axios.get(`https://dogechain.info/api/v1/unspent/${address}`);
    if (!utxoRes.data || utxoRes.data.unspent_outputs.length === 0) {
      throw new Error("Saldo insuficiente en la billetera de origen.");
    }

    // 5. Construcción de la transacción (Builder)
    const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
    const satoshisToSend = Math.floor(amt * 100000000);
    const fee = 100000000; // 1 DOGE de comisión (ajustable)
    let totalInput = 0;

    utxoRes.data.unspent_outputs.forEach(utxo => {
      totalInput += parseInt(utxo.value);
      txb.addInput(utxo.tx_hash, utxo.tx_output_n);
    });

    const change = totalInput - satoshisToSend - fee;
    if (change < 0) throw new Error("Fondos insuficientes para cubrir el envío y la comisión.");

    txb.addOutput(recipientAddress, satoshisToSend);
    if (change > 54600) { // Solo añadir cambio si es mayor al polvo (dust)
      txb.addOutput(address, change);
    }

    // 6. Firma de cada entrada
    utxoRes.data.unspent_outputs.forEach((_, i) => {
      txb.sign(i, keyPair);
    });

    const txHex = txb.build().toHex();

    // 7. Transmisión a la red
    const broadcast = await axios.post('https://dogechain.info/api/v1/pushtx', { tx: txHex });

    return res.status(200).json({
      success: true,
      txid: broadcast.data.txid || "Transmisión iniciada",
      address: address
    });

  } catch (err) {
    // Evitamos el crash de Vercel devolviendo siempre un JSON
    return res.status(200).json({ 
      success: false, 
      error: "Error en Doge: " + (err.response?.data?.error || err.message) 
    });
  }
        }
