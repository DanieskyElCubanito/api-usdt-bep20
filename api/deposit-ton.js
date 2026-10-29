import { TonClient, WalletContractV4, internal, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
    // 1. Configuración de Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    // 2. Seguridad Crítica: NUNCA recibas la frase semilla desde el cliente (req.body).
    // Debe almacenarse de forma segura en las variables de entorno de tu servidor/Vercel.
    const { recipientAddress, amt } = req.body;
    const seed = process.env.TON_HOT_WALLET_SEED; 

    if (!seed || !recipientAddress || !amt) {
        return res.status(400).json({ error: "Faltan parámetros de retiro o variable de entorno de la wallet." });
    }

    try {
        // 3. Lógica de Comisiones (Gas de red + 0.1% de tu ganancia)
        // Usamos BigInt (n) porque toNano devuelve BigInt y evita errores de decimales.
        const requestedAmountNano = toNano(amt.toString());
        const profitFeeNano = requestedAmountNano / 1000n; // 0.1% del monto solicitado
        const estimatedGasNano = toNano("0.02"); // Fee de red estándar en TON

        // Al usuario se le envía el monto solicitado menos el gas y tu comisión.
        // Ese 0.1% y los restos del gas se quedan automáticamente en tu Hot Wallet como ganancia.
        const amountToSendUserNano = requestedAmountNano - profitFeeNano - estimatedGasNano;

        if (amountToSendUserNano <= 0n) {
            return res.status(400).json({ error: "El monto a retirar es demasiado bajo para cubrir el gas y la comisión de la pasarela." });
        }

        // 4. Conexión a TON
        const client = new TonClient({ 
            endpoint: TON_RPC,
            apiKey: process.env.TONCENTER_API_KEY // Recomendado para evitar Rate Limits en producción
        });
        
        const mnemonicArray = seed.split(" ");
        const keyPair = await mnemonicToPrivateKey(mnemonicArray);
        const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
        const contract = client.open(wallet);

        const balance = await contract.getBalance();

        // Verificar si la Hot Wallet tiene liquidez para hacer el envío
        if (balance < amountToSendUserNano + estimatedGasNano) {
            return res.status(500).json({ error: "Liquidez insuficiente en la pasarela para procesar el retiro." });
        }

        const seqno = await contract.getSeqno();

        // 5. Ejecución del Retiro
        const transfer = await contract.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            messages: [
                internal({
                    to: recipientAddress,
                    value: amountToSendUserNano,
                    bounce: false, // Fundamental en false por si el usuario envía a una wallet que aún no está inicializada
                    body: "KubaPay - Retiro", 
                })
            ]
        });

        await contract.send(transfer);

        // 6. Respuesta detallada al frontend
        res.status(200).json({ 
            success: true, 
            requestedAmount: amt,
            sentToUser: Number(amountToSendUserNano) / 1e9, // Convertimos de Nano a Gram legible
            profitTaken: Number(profitFeeNano) / 1e9,
            recipient: recipientAddress
        });

    } catch (error) {
        console.error("Error procesando retiro TON:", error);
        res.status(500).json({ error: "Error interno procesando la transacción en la blockchain." });
    }
}
