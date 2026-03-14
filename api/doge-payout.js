const { Buffer } = require('buffer');
const axios = require('axios');
const bitcoin = require('@exodus/bitcoinjs-lib-dogecoin');

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e
};

// REEMPLAZA ESTO CON TU TOKEN DE BLOCKCYPHER
const TOKEN = "TU_TOKEN_AQUI";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { wif, recipientAddress, amt } = data;

    const keyPair = bitcoin.ECPair.fromWIF(wif, DOGE_NETWORK);
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });

    if (!amt || parseFloat(amt) === 0) {
      return res.status(200).json({ success: false, debug: `Wallet: ${address}` });
    }

    // 1. Obtener UTXOs desde BlockCypher (Evita el error 403)
    const utxoRes = await axios.get(`https://api.blockcypher.com/v1/doge/main/addrs/${address}?unspentOnly=true&token=${TOKEN}`);
    const utxos = utxoRes.data.txrefs;

    if (!utxos || utxos.length === 0) throw new Error("No tienes fondos suficientes (UTXOs vacíos).");

    const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
    const satoshisToSend = Math.floor(amt * 100000000);
    const fee = 100000000; // 1 DOGE
    let totalInput = 0;

    utxos.forEach(u => {
      totalInput += u.value;
      txb.addInput(u.tx_hash, u.tx_output_n);
    });

    const change = totalInput - satoshisToSend - fee;
    if (change < 0) throw new Error("Fondos insuficientes para envío + comisión.");

    txb.addOutput(recipientAddress, satoshisToSend);
    if (change > 54600) txb.addOutput(address, change);

    utxos.forEach((_, i) => txb.sign(i, keyPair));

    const txHex = txb.build().toHex();

    // 2. Transmitir vía BlockCypher
    const broadcast = await axios.post(`https://api.blockcypher.com/v1/doge/main/txs/push?token=${TOKEN}`, { tx: txHex });

    return res.status(200).json({
      success: true,
      txid: broadcast.data.tx.hash,
      from: address
    });

  } catch (err) {
    return res.status(200).json({ 
      success: false, 
      error: "Error API: " + (err.response?.data?.error || err.message) 
    });
  }
};
