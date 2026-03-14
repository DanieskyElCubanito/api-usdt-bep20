const bitcoin = require('bitcoinjs-lib');
const coininfo = require('coininfo');
const axios = require('axios');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  const { adminPrivateKey, userAddress, amount } = req.body;

  try {
    // Configuramos Dogecoin usando coininfo (Ligero y sin errores)
    const dogeInfo = coininfo.dogecoin.main;
    const DOGE_NETWORK = {
      messagePrefix: dogeInfo.messagePrefix,
      bech32: dogeInfo.bech32,
      bip32: dogeInfo.bip32,
      pubKeyHash: dogeInfo.versions.public,
      scriptHash: dogeInfo.versions.scripthash,
      wif: dogeInfo.versions.private,
    };

    // Crear el par de llaves desde WIF
    const keyPair = bitcoin.ECPair.fromWIF(adminPrivateKey, DOGE_NETWORK);
    const { address: adminAddress } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });
    
    const amountSat = Math.round(parseFloat(amount) * 100000000);
    const feeSat = 100000000; // 1 DOGE
    const totalNeeded = amountSat + feeSat;

    // Obtener UTXOs desde Dogechain
    const utxoRes = await axios.get(`https://dogechain.info/api/v1/unspent/${adminAddress}`);
    if (!utxoRes.data.unspent_outputs || utxoRes.data.unspent_outputs.length === 0) {
      return res.status(200).json({ error: "Saldo insuficiente en Wallet Admin." });
    }

    const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
    let currentCap = 0;

    for (const utxo of utxoRes.data.unspent_outputs) {
      txb.addInput(utxo.tx_hash, utxo.tx_output_n);
      currentCap += Math.round(parseFloat(utxo.value) * 100000000);
      if (currentCap >= totalNeeded) break;
    }

    if (currentCap < totalNeeded) {
      return res.status(200).json({ error: "Saldo insuficiente para cubrir monto + comisión." });
    }

    txb.addOutput(userAddress, amountSat);
    const change = currentCap - amountSat - feeSat;
    if (change > 0) txb.addOutput(adminAddress, change);

    // Firmar la transacción
    for (let i = 0; i < txb.__inputs.length; i++) {
      txb.sign(i, keyPair);
    }

    const txHex = txb.build().toHex();

    res.status(200).json({ 
      success: true, 
      txid: txb.build().getId(), 
      hex: txHex 
    });

  } catch (error) {
    res.status(200).json({ error: "Error en integración DOGE: " + error.message });
  }
                                           }
