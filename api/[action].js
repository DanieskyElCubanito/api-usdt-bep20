module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const url = req.url || '';
    const body = req.body || {};
    const { network } = body;

    try {
        const { ethers } = require('ethers');
        const { TonClient, WalletContractV4, internal } = require('@ton/ton');
        const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
        const TronWeb = require('tronweb');
        const doge = require('bitcore-lib-doge');

        const net = network ? network.toUpperCase() : '';

        // Cliente TON configurado con tu API Key personal para evitar errores 429
        const tonClient = new TonClient({
            endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: '142bbbe85e3c4f557cb66601194def748ead507f163c0eeee681146f66492e18'
        });

        // ==========================================
        // 1. ENDPOINT: GENERATE
        // ==========================================
        if (url.includes('generate')) {
            if (!net) return res.status(400).json({ success: false, error: 'Falta la red' });
            let address = '', privateKey = '';

            if (net === 'BSC' || net === 'BEP20') {
                const wallet = ethers.Wallet.createRandom();
                address = wallet.address; privateKey = wallet.privateKey;
            } else if (net === 'TON' || net === 'GRAM') {
                const mnemonic = await mnemonicNew();
                const keyPair = await mnemonicToPrivateKey(mnemonic);
                const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
                address = wallet.address.toString({ bounceable: false });
                privateKey = mnemonic.join(" ");
            } else if (net === 'TRON' || net === 'TRC20') {
                const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
                const account = await tronWeb.createAccount();
                address = account.address.base58; privateKey = account.privateKey;
            } else if (net === 'DOGE' || net === 'DOGECOIN') {
                const pk = new doge.PrivateKey();
                address = pk.toAddress().toString(); privateKey = pk.toString();
            } else {
                return res.status(400).json({ success: false, error: 'Red no soportada' });
            }
            return res.status(200).json({ success: true, network: net, address, privateKey });
        }

        // ==========================================
        // 2. ENDPOINT: BALANCE
        // ==========================================
        else if (url.includes('balance')) {
            const { address } = body;
            if (!net || !address) return res.status(400).json({ success: false, error: 'Faltan parámetros' });
            let balanceNumber = 0;

            if (net === 'BSC' || net === 'BEP20') {
                const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
                const usdtContract = new ethers.Contract("0x55d398326f99059fF775485246999027B3197955", ["function balanceOf(address owner) view returns (uint256)"], provider);
                balanceNumber = parseFloat(ethers.formatUnits(await usdtContract.balanceOf(address), 18));
            } else if (net === 'TON' || net === 'GRAM') {
                const { Address } = require('@ton/ton');
                const rawBalance = await tonClient.getBalance(Address.parse(address));
                balanceNumber = Number(rawBalance) / 1e9;
            } else {
                return res.status(400).json({ success: false, error: 'Red no soportada' });
            }
            return res.status(200).json({ success: true, network: net, address, balance: balanceNumber });
        }

        // ==========================================
        // 3. ENDPOINT: SWEEP (BARRIDO TOTAL AUTOMÁTICO)
        // ==========================================
        else if (url.includes('sweep')) {
            const { userPrivateKey, adminAddress, feePrivateKey } = body;
            if (!net || !userPrivateKey || !adminAddress) return res.status(400).json({ success: false, error: 'Faltan parámetros de seguridad' });

            if (net === 'BSC' || net === 'BEP20') {
                if (!feePrivateKey) return res.status(400).json({ success: false, error: 'Falta feePrivateKey' });
                const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
                const userWallet = new ethers.Wallet(userPrivateKey, provider);
                const feeWallet = new ethers.Wallet(feePrivateKey, provider);
                const usdtContract = new ethers.Contract("0x55d398326f99059fF775485246999027B3197955", ["function balanceOf(address owner) view returns (uint256)", "function transfer(address to, uint amount) returns (bool)"], userWallet);

                const usdtBalance = await usdtContract.balanceOf(userWallet.address);
                if (usdtBalance === 0n) return res.status(400).json({ success: false, error: 'Sin fondos USDT' });

                const feeData = await provider.getFeeData();
                const requiredGas = (feeData.gasPrice || ethers.parseUnits("3", "gwei")) * 80000n;

                const fundTx = await feeWallet.sendTransaction({ to: userWallet.address, value: requiredGas });
                await fundTx.wait(1);

                const sweepTx = await usdtContract.transfer(adminAddress, usdtBalance);
                return res.status(200).json({ success: true, network: "BSC", currency: "USDT", amountSwept: ethers.formatUnits(usdtBalance, 18), gasTxHash: fundTx.hash, sweepTxHash: sweepTx.hash });

            } else if (net === 'TON' || net === 'GRAM') {
                const keyPair = await mnemonicToPrivateKey(userPrivateKey.split(" "));
                const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
                const contract = tonClient.open(wallet);

                const balance = await contract.getBalance();
                if (balance === 0n) return res.status(400).json({ success: false, error: 'Sin fondos GRAM' });

                const seqno = await contract.getSeqno();
                await contract.sendTransfer({
                    seqno, secretKey: keyPair.secretKey,
                    messages: [internal({ to: adminAddress, value: 0n, bounce: false, body: 'Sweep Kuba Pay' })],
                    sendMode: 128
                });
                return res.status(200).json({ success: true, network: net, currency: "GRAM", amountSwept: Number(balance) / 1e9, sweepTxHash: "Procesado por la red TON" });
            } else {
                return res.status(400).json({ success: false, error: 'Red no soportada' });
            }
        }

        // ==========================================
        // 4. ENDPOINT: WITHDRAW (RETIROS DESDE TU BÓVEDA)
        // ==========================================
        else if (url.includes('withdraw')) {
            const { adminPrivateKey, toAddress, amount } = body;

            if (!net || !adminPrivateKey || !toAddress || !amount) {
                return res.status(400).json({ success: false, error: 'Faltan parámetros (network, adminPrivateKey, toAddress, amount)' });
            }

            if (net === 'BSC' || net === 'BEP20') {
                const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
                const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
                const usdtContract = new ethers.Contract("0x55d398326f99059fF775485246999027B3197955", ["function transfer(address to, uint amount) returns (bool)", "function balanceOf(address owner) view returns (uint256)"], adminWallet);

                const parsedAmount = ethers.parseUnits(amount.toString(), 18);
                const adminBalance = await usdtContract.balanceOf(adminWallet.address);
                if (adminBalance < parsedAmount) return res.status(400).json({ success: false, error: 'Saldo insuficiente en la bóveda' });

                const tx = await usdtContract.transfer(toAddress, parsedAmount);

                return res.status(200).json({ success: true, network: 'BSC', currency: 'USDT', amount: amount, to: toAddress, txHash: tx.hash });

            } else if (net === 'TON' || net === 'GRAM') {
                const keyPair = await mnemonicToPrivateKey(adminPrivateKey.split(" "));
                const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
                const contract = tonClient.open(wallet);

                const seqno = await contract.getSeqno();
                const parsedAmount = BigInt(Math.floor(parseFloat(amount) * 1e9));

                await contract.sendTransfer({
                    seqno, secretKey: keyPair.secretKey,
                    messages: [internal({ to: toAddress, value: parsedAmount, bounce: false, body: 'Withdraw Kuba Pay' })],
                    sendMode: 3 
                });

                return res.status(200).json({ success: true, network: 'TON', currency: 'GRAM', amount: amount, to: toAddress, txHash: "Procesado por la red TON" });
            } else {
                return res.status(400).json({ success: false, error: 'Red no soportada para retiros' });
            }
        }

        return res.status(404).json({ error: 'Endpoint no válido' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: 'Fallo interno', detalles: error.message });
    }
}
