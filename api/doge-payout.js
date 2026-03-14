const axios = require('axios');
const bitcoin = require('@exodus/bitcoinjs-lib-dogecoin');

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e
};

// Tu llave de GetBlock
const GETBLOCK_ID = "b38259c302374e3bb97bdca7c15a4f60";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).json({ success: false, error: 'Envía un POST' });

  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { wif, recipientAddress, amt } = data;

    const keyPair = bitcoin.ECPair.fromWIF(wif, DOGE_NETWORK);
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });

    if (!amt || parseFloat(amt) === 0) {
      return res.status(200).json({ success: true, debug: `Wallet: ${address}` });
    }

    // 1. Obtener UTXOs (Saldo) desde Blockcypher
    const utxoRes = await axios.get(`https://api.blockcypher.com/v1/doge/main/addrs/${address}?unspentOnly=true`);
    const utxos = utxoRes.data.txrefs;

    if (!utxos || utxos.length === 0) {
      return res.status(200).json({ success: false, error: "Saldo insuficiente o transacciones sin confirmar." });
    }

    const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
    const satoshisToSend = Math.floor(amt * 100000000);
    // Para una comisión de 0.009 DOGE
const fee = 900000; 
    let totalInput = 0;

    utxos.forEach(u => {
      totalInput += u.value;
      txb.addInput(u.tx_hash, u.tx_output_n);
    });

    const change = totalInput - satoshisToSend - fee;
    if (change < 0) throw new Error("Saldo insuficiente para envío + comisión.");

    txb.addOutput(recipientAddress, satoshisToSend);
    if (change > 54600) txb.addOutput(address, change);

    utxos.forEach((_, i) => txb.sign(i, keyPair));

    const txHex = txb.build().toHex();

    // 2. Transmitir usando tu nuevo Endpoint de GetBlock
    const broadcast = await axios.post(`https://go.getblock.io/${GETBLOCK_ID}/`, {
      jsonrpc: "2.0",
      method: "sendrawtransaction",
      params: [txHex],
      id: "doge"
    });

    if (broadcast.data.error) throw new Error(broadcast.data.error.message);

    return res.status(200).json({
      success: true,
      txid: broadcast.data.result
    });

  } catch (err) {
    return res.status(200).json({ 
      success: false, 
      error: "Error: " + (err.response?.data?.error || err.message) 
    });
  }
};
