import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";

// 1. PEGA TU API KEY AQUÍ
const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    // Manejo de datos entrantes desde el bot
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { privateKey, recipientAddress, amt } = data;

    if (!privateKey) {
        return res.status(200).json({ success: false, error: "La API no recibió la llave privada." });
    }

    // 2. CONFIGURACIÓN DEL CLIENTE CON TU API KEY
    const client = new TonClient({ 
      endpoint: TON_RPC,
      apiKey: TON_API_KEY 
    });
    
    // Procesar la llave de 64 caracteres (SafePal/Hex)
    const seedBuffer = Buffer.from(privateKey.trim(), 'hex');
    const keyPair = keyPairFromSeed(seedBuffer);
    
    // Usamos V4R2 que es el estándar actual
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    const balance = await contract.getBalance();
    const amountToSend = toNano(amt.toString());
    const gasReserve = toNano("0.05"); // Reserva para el gas de la red

    if (balance < (amountToSend + gasReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente en la wallet del bot.",
        debug: `Dirección: ${wallet.address.toString()} | Balance: ${fromNano(balance)} TON`
      });
    }

    // Obtener número de secuencia de la transacción
    const seqno = await contract.getSeqno();
    
    // Crear y enviar la transferencia
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
    
    return res.status(200).json({ 
        success: true, 
        wallet_version: "V4R2",
        address: wallet.address.toString()
    });

  } catch (error) {
    res.status(200).json({ 
        success: false, 
        error: "Error en la red TON: " + error.message 
    });
  }
        }
