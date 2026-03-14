import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import coininfo from 'coininfo';
import axios from 'axios';

// Importamos el motor WASM que no requiere compilación en el servidor
const ecc = require('@bitcoinerlab/secp256k1');
const ECPair = ECPairFactory(ecc);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
    const { adminPrivateKey, userAddress, amount } = req.body;

    try {
        // Configuración de red Dogecoin
        const dogeInfo = coininfo.dogecoin.main;
        const DOGE_NETWORK = {
            messagePrefix: dogeInfo.messagePrefix,
            bech32: dogeInfo.bech32,
            bip32: dogeInfo.bip32,
            pubKeyHash: dogeInfo.versions.public,
            scriptHash: dogeInfo.versions.scripthash,
            wif: dogeInfo.versions.private,
        };

        const keyPair = ECPair.fromWIF(adminPrivateKey, DOGE_NETWORK);
        const { address: adminAddress } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });

        const amountSat = Math.round(parseFloat(amount) * 100000000);
        const feeSat = 100000000; // 1 DOGE
        const totalNeeded = amountSat + feeSat;

        // 1. Obtener UTXOs de una fuente confiable (API de Dogechain)
        const utxoRes = await axios.get(`https://dogechain.info/api/v1/unspent/${adminAddress}`);
        const utxos = utxoRes.data.unspent_outputs;

        if (!utxos || utxos.length === 0) {
            return res.status(200).json({ error: "Saldo insuficiente en Wallet Admin." });
        }

        const psbt = new bitcoin.Psbt({ network: DOGE_NETWORK });
        let inputSum = 0;

        // 2. Construir entradas (Inputs)
        for (const utxo of utxos) {
            // Para Doge, necesitamos el HEX de la transacción previa para mayor seguridad
            const txData = await axios.get(`https://dogechain.info/api/v1/tx/hex/${utxo.tx_hash}`);
            
            psbt.addInput({
                hash: utxo.tx_hash,
                index: utxo.tx_output_n,
                nonWitnessUtxo: Buffer.from(txData.data.hex, 'hex'),
            });
            
            inputSum += Math.round(parseFloat(utxo.value) * 100000000);
            if (inputSum >= totalNeeded) break;
        }

        if (inputSum < totalNeeded) {
            return res.status(200).json({ error: "Faltan fondos confirmados en la Wallet Admin." });
        }

        // 3. Añadir Salidas (Outputs)
        psbt.addOutput({
            address: userAddress,
            value: amountSat,
        });

        // Cambio (lo que sobra vuelve a ti)
        const change = inputSum - amountSat - feeSat;
        if (change > 0) {
            psbt.addOutput({
                address: adminAddress,
                value: change,
            });
        }

        // 4. Firmar y Finalizar
        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();

        const transaction = psbt.extractTransaction();
        const txHex = transaction.toHex();
        const txId = transaction.getId();

        res.status(200).json({
            success: true,
            txid: txId,
            hex: txHex,
            message: "Transacción construida y firmada con éxito"
        });

    } catch (error) {
        res.status(200).json({ error: "Error técnico 2026: " + error.message });
    }
              }
