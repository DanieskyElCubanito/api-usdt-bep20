const { ethers } = require('ethers');
const { WalletContractV4 } = require('@ton/ton');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const TronWeb = require('tronweb');
const doge = require('bitcore-lib-doge');

module.exports = async function handler(req, res) {
    // CORS unificado para Mini Apps y Bots
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const { network } = req.body; 

    if (!network) {
        return res.status(400).json({ success: false, error: 'Falta la red (network)' });
    }

    try {
        let address = '';
        let privateKey = '';
        const net = network.toUpperCase();

        if (net === 'BSC' || net === 'BEP20') {
            const wallet = ethers.Wallet.createRandom();
            address = wallet.address;
            privateKey = wallet.privateKey;
        } 
        else if (net === 'TRON' || net === 'TRC20') {
            const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
            const account = await tronWeb.createAccount();
            address = account.address.base58;
            privateKey = account.privateKey;
        } 
        else if (net === 'TON' || net === 'GRAM') {
            const mnemonic = await mnemonicNew();
            const keyPair = await mnemonicToPrivateKey(mnemonic);
            const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
            address = wallet.address.toString({ bounceable: false });
            privateKey = mnemonic.join(" "); 
        } 
        else if (net === 'DOGE' || net === 'DOGECOIN') {
            const pk = new doge.PrivateKey();
            address = pk.toAddress().toString();
            privateKey = pk.toString();
        } 
        else {
            return res.status(400).json({ success: false, error: 'Red no soportada' });
        }

        return res.status(200).json({
            success: true,
            network: net,
            address: address,
            privateKey: privateKey
        });

    } catch (error) {
        console.error("Error generando wallet:", error);
        return res.status(500).json({ success: false, error: 'Error interno del servidor', details: error.message });
    }
}
