const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const tinysecp = require('tiny-secp256k1');
const axios = require('axios');

const ECPair = ECPairFactory(tinysecp);

// Configuración de red Dogecoin
const DOGECOIN = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'dg',
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  const { adminPrivateKey, userAddress, amount } = req.body;

  try {
    const keyPair = ECPair.fromWIF(adminPrivateKey, DOGECOIN);
    const { address: adminAddress } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGECOIN });
    
    const amountSat = Math.round(parseFloat(amount) * 100000000);
    const feeSat = 100000000; // 1 DOGE de comisión
    const totalNeeded = amountSat + feeSat;

    // Obtener UTXOs
    const url = `https://dogechain.info/api/v1/unspent/${adminAddress}`;
    const resp = await axios.get(url);
    const data = resp.data;

    if (!data || !data.unspent_outputs || data.unspent_outputs.length === 0) {
      return res.status(200).json({ error: `Saldo insuficiente. Tu wallet (${adminAddress}) tiene 0 DOGE.` });
    }

    const psbt = new bitcoin.Psbt({ network: DOGECOIN });
    let inputSum = 0;

    for (const utxo of data.unspent_outputs) {
      const txResp = await axios.get(`https://dogechain.info/api/v1/tx/hex/${utxo.tx_hash}`);
      psbt.addInput({
        hash: utxo.tx_hash,
        index: utxo.tx_output_n,
        nonWitnessUtxo: Buffer.from(txResp.data.hex, 'hex'),
      });
      inputSum += Math.round(parseFloat(utxo.value) * 100000000);
      if (inputSum >= totalNeeded) break;
    }

    if (inputSum < totalNeeded) {
      return res.status(200).json({ error: `Saldo insuficiente. Tienes ${(inputSum/1e8).toFixed(2)} y necesitas ${(totalNeeded/1e8).toFixed(2)}` });
    }

    psbt.addOutput({ address: userAddress, value: amountSat });
    const change = inputSum - amountSat - feeSat;
    if (change > 0) psbt.addOutput({ address: adminAddress, value: change });

    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();
    const txHex = psbt.extractTransaction().toHex();

    res.status(200).json({ success: true, txid: psbt.extractTransaction().getId(), hex: txHex });

  } catch (error) {
    res.status(200).json({ error: "Error técnico: " + error.message });
  }
                                  }
