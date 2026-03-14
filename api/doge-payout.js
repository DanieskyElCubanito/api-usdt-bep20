const doge = require('bitcore-lib-doge');
const axios = require('axios');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
    const { adminPrivateKey, userAddress, amount } = req.body;

    try {
        const pKey = new doge.PrivateKey(adminPrivateKey);
        const adminAddress = pKey.toAddress().toString();
        
        // 1. Obtener UTXOs de Dogechain (Gratis y sin registro)
        const utxoRes = await axios.get(`https://dogechain.info/api/v1/unspent/${adminAddress}`);
        const data = utxoRes.data;

        if (!data || !data.unspent_outputs || data.unspent_outputs.length === 0) {
            return res.status(200).json({ 
                error: `Saldo insuficiente. Tu wallet (${adminAddress}) tiene 0 DOGE.` 
            });
        }

        const amountSat = Math.round(parseFloat(amount) * 100000000);
        const feeSat = 100000000; // 1 DOGE de comisión
        const totalNeeded = amountSat + feeSat;

        let totalAvailableSat = 0;
        const utxos = data.unspent_outputs.map(u => {
            const sats = Math.round(parseFloat(u.value) * 100000000);
            totalAvailableSat += sats;
            return {
                txId: u.tx_hash,
                outputIndex: u.tx_output_n,
                address: adminAddress,
                script: u.script,
                satoshis: sats
            };
        });

        if (totalAvailableSat < totalNeeded) {
            return res.status(200).json({ 
                error: `Fondos insuficientes. Tienes ${(totalAvailableSat/100000000).toFixed(4)} DOGE, necesitas ${(totalNeeded/100000000).toFixed(4)}.` 
            });
        }

        // 2. Construir la transacción
        const tx = new doge.Transaction()
            .from(utxos)
            .to(userAddress, amountSat)
            .fee(feeSat)
            .change(adminAddress)
            .sign(pKey);

        const rawTx = tx.serialize();

        // 3. Transmitir a la red (Broadcast)
        // Usamos una red pública que no pide API KEY
        const broadcastRes = await axios.post('https://dogechain.info/api/v1/pushtx', {
            tx: rawTx
        });

        res.status(200).json({
            success: true,
            txid: tx.hash,
            message: "Retiro procesado con éxito"
        });

    } catch (error) {
        // Esto captura el error y lo envía como JSON para que el bot NO de error de "Unexpected token A"
        res.status(200).json({ 
            error: "Error técnico: " + error.message 
        });
    }
              }
