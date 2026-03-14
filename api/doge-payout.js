const axios = require('axios');
const bitcoin = require('@exodus/bitcoinjs-lib-dogecoin');

// Configuración completa requerida por la librería
const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398
  },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e
};

const TATUM_API_KEY = "t-69b5b2ef206c6dc0637438a2-e096d6ed22d24709b5fb1808"; // Tu llave de Tatum

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).json({ success: false, error: 'Envía un POST' });

  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { wif, recipientAddress, amt } = data;

    // Crear par de llaves
    const keyPair = bitcoin.ECPair.fromWIF(wif, DOGE_NETWORK);
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });

    if (!amt || parseFloat(amt) === 0) {
      return res.status(200).json({ success: false, debug: `Wallet activa: ${address}` });
    }

    // 1. Obtener UTXOs
    const utxoRes = await axios.get(`https://api.tatum.io/v3/dogecoin/utxo/${address}`, {
      headers: { 'x-api-key': TATUM_API_KEY }
    });
    
    const utxos = utxoRes.data;
    if (!utxos || utxos.length === 0) {
      return res.status(200).json({ success: false, error: "Saldo insuficiente en la wallet del bot (UTXOs vacíos)." });
    }

    const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
    const satoshisToSend = Math.floor(amt * 100000000);
    const fee = 100000000; // 1 DOGE
    let totalInput = 0;

    utxos.forEach(u => {
      totalInput += parseInt(u.value);
      txb.addInput(u.hash || u.txHash, u.index);
    });

    const change = totalInput - satoshisToSend - fee;
    if (change < 0) {
      return res.status(200).json({ 
        success: false, 
        error: `Saldo insuficiente. Tienes ${(totalInput/100000000).toFixed(2)} y necesitas ${(satoshisToSend/100000000) + 1} DOGE.` 
      });
    }

    txb.addOutput(recipientAddress, satoshisToSend);
    if (change > 54600) txb.addOutput(address, change);

    // 2. Firmar cada entrada
    utxos.forEach((_, i) => {
      txb.sign(i, keyPair);
    });

    // 3. Transmitir
    const broadcast = await axios.post(`https://api.tatum.io/v3/dogecoin/broadcast`, 
      { txData: txb.build().toHex() },
      { headers: { 'x-api-key': TATUM_API_KEY } }
    );

    return res.status(200).json({
      success: true,
      txid: broadcast.data.txId
    });

  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message;
    return res.status(200).json({ 
      success: false, 
      error: "Error DogeStation: " + errorMessage 
    });
  }
};
