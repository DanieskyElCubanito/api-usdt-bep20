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

    // 1. Obtener UTXOs desde SoChain (No requiere Token)
    const utxoRes = await axios.get(`https://sochain.com/api/v2/get_spent_txos/DOGE/${address}`);
    
    // SoChain devuelve los datos un poco diferente, los filtramos:
    const utxos = utxoRes.data.data.txs.filter(t => t.value > 0);

    if (!utxos || utxos.length === 0) throw new Error("No tienes fondos (UTXOs) suficientes.");

    const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
    const satoshisToSend = Math.floor(amt * 100000000);
    const fee = 100000000; // 1 DOGE de comisión
    let totalInput = 0;

    utxos.forEach(u => {
      totalInput += Math.floor(parseFloat(u.value) * 100000000);
      txb.addInput(u.txid, u.output_no);
    });

    const change = totalInput - satoshisToSend - fee;
    if (change < 0) throw new Error("Saldo insuficiente para envío + comisión de red.");

    txb.addOutput(recipientAddress, satoshisToSend);
    if (change > 54600) txb.addOutput(address, change);

    utxos.forEach((_, i) => txb.sign(i, keyPair));

    const txHex = txb.build().toHex();

    // 2. Transmitir la transacción
    const broadcast = await axios.post(`https://sochain.com/api/v2/send_tx/DOGE`, { tx_hex: txHex });

    return res.status(200).json({
      success: true,
      txid: broadcast.data.data.txid,
      from: address
    });

  } catch (err) {
    return res.status(200).json({ 
      success: false, 
      error: "Error API: " + (err.response?.data?.data?.error_message || err.message) 
    });
  }
};
