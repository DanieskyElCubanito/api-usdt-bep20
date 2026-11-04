module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

    const { network, userPrivateKey, adminAddress, feePrivateKey } = req.body;

    if (!network) {
        return res.status(400).json({ success: false, error: 'Falta especificar la red (BSC o GRAM/TON)' });
    }
    
    // Para BSC feePrivateKey es obligatorio, para TON no importa si viene vacío, pero pedimos los básicos.
    if (!userPrivateKey || !adminAddress) {
        return res.status(400).json({ success: false, error: 'Faltan parámetros de seguridad (llave o admin)' });
    }

    try {
        const net = network.toUpperCase();

        // Importaciones dinámicas
        const { ethers } = require('ethers');
        const { TonClient, WalletContractV4, internal } = require('@ton/ton');
        const { mnemonicToPrivateKey } = require('@ton/crypto');

        // ==========================================
        // 1. BARRIDO RED BSC (USDT BEP20)
        // ==========================================
        if (net === 'BSC' || net === 'BEP20') {
            if (!feePrivateKey) return res.status(400).json({ success: false, error: 'BSC requiere feePrivateKey con BNB' });

            const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
            const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
            const usdtAbi = [
                "function balanceOf(address owner) view returns (uint256)",
                "function transfer(address to, uint amount) returns (bool)"
            ];

            const userWallet = new ethers.Wallet(userPrivateKey, provider);
            const feeWallet = new ethers.Wallet(feePrivateKey, provider);
            const usdtContract = new ethers.Contract(usdtAddress, usdtAbi, userWallet);

            const usdtBalance = await usdtContract.balanceOf(userWallet.address);
            if (usdtBalance === 0n) return res.status(400).json({ success: false, error: 'Sin fondos USDT' });

            const feeData = await provider.getFeeData();
            const currentGasPrice = feeData.gasPrice || ethers.parseUnits("3", "gwei");
            const requiredGas = currentGasPrice * 80000n; 

            const fundTx = await feeWallet.sendTransaction({ to: userWallet.address, value: requiredGas });
            await fundTx.wait(1);

            const sweepTx = await usdtContract.transfer(adminAddress, usdtBalance);
            const formattedAmount = ethers.formatUnits(usdtBalance, 18);

            return res.status(200).json({
                success: true,
                network: "BSC",
                currency: "USDT",
                amountSwept: formattedAmount,
                gasTxHash: fundTx.hash,
                sweepTxHash: sweepTx.hash
            });
        } 
        
        // ==========================================
        // 2. BARRIDO RED TON (GRAM / TONCOIN)
        // ==========================================
        else if (net === 'TON' || net === 'GRAM') {
            const client = new TonClient({
                endpoint: 'https://toncenter.com/api/v2/jsonRPC',
            });

            // Reconstruir la billetera V4 desde las 24 palabras
            const mnemonics = userPrivateKey.split(" ");
            const keyPair = await mnemonicToPrivateKey(mnemonics);
            const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
            const contract = client.open(wallet);

            const balance = await contract.getBalance();
            if (balance === 0n) {
                return res.status(400).json({ success: false, error: 'La billetera no tiene fondos en GRAM' });
            }

            // Obtener el número de secuencia para firmar la transacción
            const seqno = await contract.getSeqno();

            // Disparar el barrido total. SendMode 128 envía todo el balance restante y descuenta el gas solo.
            await contract.sendTransfer({
                seqno,
                secretKey: keyPair.secretKey,
                messages: [
                    internal({
                        to: adminAddress,
                        value: 0n, // 0 porque el modo 128 se encarga de vaciar la cuenta entera
                        bounce: false,
                        body: 'Sweep Kuba Pay'
                    })
                ],
                sendMode: 128 // CARRY_ALL_REMAINING_BALANCE
            });

            const formattedAmount = Number(balance) / 1e9;

            return res.status(200).json({
                success: true,
                network: net,
                currency: "GRAM",
                amountSwept: formattedAmount,
                sweepTxHash: "Procesado por la red TON"
            });
        }
        
        else {
            return res.status(400).json({ success: false, error: 'Red no soportada para barridos' });
        }

    } catch (error) {
        console.error("Error en el barrido:", error);
        return res.status(500).json({ 
            success: false, 
            error: 'Fallo al ejecutar el barrido', 
            detalles: error.message 
        });
    }
}
