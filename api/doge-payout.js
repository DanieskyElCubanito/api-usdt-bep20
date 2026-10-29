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
    // 1. Configuración CORS para compatibilidad universal
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // 2. Extracción segura de datos
    // Las claves privadas y de API DEBEN estar en process.env, nunca en el código duro ni enviadas por el frontend.
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { recipientAddress, amt } = data;
    
    const wif = process.env.DOGE_HOT_WALLET_WIF; 
    const GETBLOCK_ID = process.env.GETBLOCK_API_KEY;

    if (!wif || !GETBLOCK_ID || !recipientAddress || !amt) {
        return res.status(400).json({ error: "Faltan parámetros de retiro o variables de entorno." });
    }

    try {
        const keyPair = bitcoin.ECPair.fromWIF(wif, DOGE_NETWORK);
        const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: DOGE_NETWORK });

        // 3. Cálculo de Comisiones (Red + 0.1% Ganancia)
        // Trabajamos en "Koinu" (Satoshis de Dogecoin, 1 DOGE = 100,000,000 Koinu)
        const requestedAmtSatoshis = Math.floor(parseFloat(amt) * 100000000);
        const networkFeeSatoshis = 1000000; // Comisión estándar de Dogecoin: 0.01 DOGE
        
        // Tu ganancia del 0.1% sobre el retiro
        const profitFeeSatoshis = Math.floor(requestedAmtSatoshis * 0.001); 
        
        // Lo que viaja físicamente por la blockchain al usuario
        const satoshisToSendToUser = requestedAmtSatoshis - networkFeeSatoshis - profitFeeSatoshis;

        if (satoshisToSendToUser <= 0) {
            return res.status(400).json({ error: "El monto es muy bajo para cubrir el gas de red y la comisión de retiro." });
        }

        // 4. Obtención de UTXOs
        const utxoRes = await axios.get(`https://api.blockcypher.com/v1/doge/main/addrs/${address}?unspentOnly=true`);
        const utxos = utxoRes.data.txrefs;

        if (!utxos || utxos.length === 0) {
            return res.status(400).json({ error: "La pasarela no tiene UTXOs disponibles en este momento. Intenta en unos minutos." });
        }

        const txb = new bitcoin.TransactionBuilder(DOGE_NETWORK);
        let totalInput = 0;

        utxos.forEach(u => {
            totalInput += u.value;
            txb.addInput(u.tx_hash, u.tx_output_n);
        });

        // 5. Gestión del Cambio (Aquí se materializa tu ganancia)
        // Al restarle solo el envío al usuario y el gas de red al total de entrada,
        // el `profitFeeSatoshis` queda automáticamente retenido dentro del `change`, 
        // devolviéndose a tu Hot Wallet de Dogecoin.
        const change = totalInput - satoshisToSendToUser - networkFeeSatoshis;
        
        if (change < 0) {
            return res.status(500).json({ error: "Liquidez insuficiente en la pasarela." });
        }

        txb.addOutput(recipientAddress, satoshisToSendToUser);
        
        // Límite de "dust" (polvo) en Dogecoin suele ser de 0.01 DOGE (1000000 Koinu)
        if (change > 1000000) {
            txb.addOutput(address, change); 
        }

        utxos.forEach((_, i) => txb.sign(i, keyPair));

        const txHex = txb.build().toHex();

        // 6. Transmitir la transacción
        const broadcast = await axios.post(`https://go.getblock.io/${GETBLOCK_ID}/`, {
            jsonrpc: "2.0",
            method: "sendrawtransaction",
            params: [txHex],
            id: "doge"
        });

        if (broadcast.data.error) throw new Error(broadcast.data.error.message);

        return res.status(200).json({
            success: true,
            txid: broadcast.data.result,
            requestedAmountDOGE: amt,
            sentToUserDOGE: satoshisToSendToUser / 100000000,
            profitTakenDOGE: profitFeeSatoshis / 100000000
        });

    } catch (err) {
        console.error("Error en retiro DOGE:", err.response?.data || err.message);
        return res.status(500).json({ 
            error: "Error interno al procesar la transacción en la blockchain de Dogecoin." 
        });
    }
};
