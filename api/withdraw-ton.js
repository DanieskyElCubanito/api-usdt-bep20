import { TonClient, WalletContractV4, WalletContractV3R2, fromNano, toNano, internal } from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";
import { Buffer } from 'buffer';

const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { privateKey, recipientAddress, amt } = data;

    const client = new TonClient({ endpoint: TON_RPC, apiKey: TON_API_KEY });
    
    // Limpiamos la llave por si tiene espacios
    const cleanKey = privateKey.trim();
    const seedBuffer = Buffer.from(cleanKey, 'hex');
    const keyPair = keyPairFromSeed(seedBuffer);

    // Lista de billeteras posibles que SafePal suele usar
    const wallets = [
      WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey }), // Estándar V4
      WalletContractV3R2.create({ workchain: 0, publicKey: keyPair.publicKey }) // Estándar V3
    ];

    let activeWallet = null;
    let maxBalance = BigInt(0);

    // Buscamos cuál tiene el dinero (los 0.75 TON)
    for (const w of wallets) {
      const b = await client.getBalance(w.address);
      if (b >= maxBalance) {
        maxBalance = b;
        activeWallet = w;
      }
    }

    const balanceFormateado = parseFloat(fromNano(maxBalance)).toFixed(4);

    // Respuesta para tu comando /checkAdmin
    if (parseFloat(amt) === 0) {
      return res.status(200).json({ 
        success: false, 
        debug: `📊 <b>Billetera Encontrada</b>\n\n<b>Dirección:</b> <code>${activeWallet.address.toString()}</code>\n<b>Balance:</b> <code>${balanceFormateado} TON</code>\n\nSi el balance sigue en 0, la llave hex no corresponde a la frase de 24 palabras de SafePal.`
      });
    }

    // Lógica de retiro
    const amountToSend = toNano(amt.toString());
    const gasReserve = toNano("0.05");

    if (maxBalance < (amountToSend + gasReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente.",
        debug: `Viste: ${balanceFormateado} TON | Necesitas: ${fromNano(amountToSend + gasReserve)}`
      });
    }

    const contract = client.open(activeWallet);
    const seqno = await contract.getSeqno();
    
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: recipientAddress,
          value: amountToSend,
          bounce: false,
          body: "@KubaPayBot"
        })
      ]
    });

    await contract.send(transfer);
    
    return res.status(200).json({ success: true, version: activeWallet.constructor.name });

  } catch (error) {
    res.status(200).json({ success: false, error: "Error de conexión: " + error.message });
  }
      }
