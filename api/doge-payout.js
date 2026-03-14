const { Buffer } = require('buffer');
global.Buffer = Buffer;

const bitcoin = require('bitcoinjs-lib');
const coininfo = require('coininfo');
const axios = require('axios');
const { ECPairFactory } = require('ecpair');
const tinysecp = require('tiny-secp256k1');

const ECPair = ECPairFactory(tinysecp);
const DOGE_NETWORK = coininfo.dogecoin.main.toBitcoinJS();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
    
    const { userAddress, amount } = req.body;
    const adminPrivateKey = process.env.DOGE_ADMIN_KEY;

    try {
        if (!adminPrivateKey || !userAddress || !amount) {
            return res.status(200).json({ error: "Faltan datos en la petición." });
        }

        const keyPair = ECPair.fromWIF(adminPrivateKey, DOGE_NETWORK);
        const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });
        
        const utxoRes = await axios.get(`https://dogechain.info/api/v1/unspent/${address}`);
        const utxos = utxoRes.data.unspent_outputs;

        if (!utxos || utxos.length === 0) {
            return res.status(200).json({ error: "Saldo insuficiente en wallet admin." });
        }

        const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
        const amountSat = Math.round(parseFloat(amount) * 100000000);
        const feeSat = 100000000; 
        
        let totalInput = 0;
        utxos.forEach((utxo) => {
            const sats = Math.round(parseFloat(utxo.value) * 100000000);
            totalInput += sats;
            txb.addInput(utxo.tx_hash, utxo.tx_output_n);
        });

        if (totalInput < (amountSat + feeSat)) {
            return res.status(200).json({ error: "Fondos insuficientes para cubrir monto + fee." });
        }

        txb.addOutput(userAddress, amountSat);
        txb.addOutput(address, totalInput - amountSat - feeSat);

        for (let i = 0; i < utxos.length; i++) {
            txb.sign(i, keyPair);
        }

        const rawTx = txb.build().toHex();

        const broadcastRes = await axios.post('https://dogechain.info/api/v1/pushtx', {
            tx: rawTx
        });

        return res.status(200).json({
            success: true,
            txid: txb.build().getId(),
            message: "Retiro real procesado con éxito."
        });

    } catch (error) {
        return res.status(200).json({ 
            error: "Error en proceso de retiro",
            details: error.message
        });
    }
}
