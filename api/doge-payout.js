const { Buffer } = require('buffer');
const axios = require('axios');

// Intentamos cargar la librería con un bloque try/catch para capturar el error exacto
let bitcoin;
try {
  bitcoin = require('@exodus/bitcoinjs-lib-dogecoin');
} catch (e) {
  bitcoin = null;
}

const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e
};

module.exports = async (req, res) => {
  // 1. Verificación de seguridad de la librería
  if (!bitcoin) {
    return res.status(200).json({ 
      success: false, 
      error: "Librería @exodus/bitcoinjs-lib-dogecoin no instalada en el servidor." 
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { wif, recipientAddress, amt } = data;

    if (!wif) return res.status(200).json({ success: false, error: "Falta WIF" });

    // Generar wallet
    const keyPair = bitcoin.ECPair.fromWIF(wif, DOGE_NETWORK);
    const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });

    if (!amt || parseFloat(amt) === 0) {
      return res.status(200).json({
        success: false,
        debug: `Billetera: ${address} activa.`
      });
    }

    // Validar dirección destino
    try {
      bitcoin.address.toOutputScript(recipientAddress, DOGE_NETWORK);
    } catch (e) {
      return res.status(200).json({ success: false, error: "Dirección destino no es de Dogecoin." });
    }

    // Obtener UTXOs
    const utxoRes = await axios.get(`https://dogechain.info/api/v1/unspent/${address}`);
    if (!utxoRes.data || !utxoRes.data.unspent_outputs || utxoRes.data.unspent_outputs.length === 0) {
      return res.status(200).json({ success: false, error: "No hay fondos (UTXOs) disponibles en esta cuenta." });
    }

    const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
    const satoshisToSend = Math.floor(amt * 100000000);
    const fee = 100000000; // 1 DOGE
    let totalInput = 0;

    utxoRes.data.unspent_outputs.forEach(utxo => {
      totalInput += parseInt(utxo.value);
      txb.addInput(utxo.tx_hash, utxo.tx_output_n);
    });

    const change = totalInput - satoshisToSend - fee;
    if (change < 0) throw new Error(`Saldo insuficiente. Necesitas ${amt} + 1 DOGE de comisión.`);

    txb.addOutput(recipientAddress, satoshisToSend);
    if (change > 54600) {
      txb.addOutput(address, change);
    }

    utxoRes.data.unspent_outputs.forEach((_, i) => {
      txb.sign(i, keyPair);
    });

    const txHex = txb.build().toHex();
    
    // Transmitir
    const broadcast = await axios.post('https://dogechain.info/api/v1/pushtx', { tx: txHex });

    return res.status(200).json({
      success: true,
      txid: broadcast.data.txid,
      from: address
    });

  } catch (err) {
    return res.status(200).json({ 
      success: false, 
      error: err.message 
    });
  }
};
