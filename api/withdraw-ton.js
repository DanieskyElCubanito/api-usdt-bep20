import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { privateKey, recipientAddress, amt } = data;

    if (!privateKey) return res.status(200).json({ success: false, error: "No se recibió la llave." });

    const client = new TonClient({ endpoint: TON_RPC });
    
    // Procesar la llave de 64 caracteres
    const seedBuffer = Buffer.from(privateKey.trim(), 'hex');
    const keyPair = keyPairFromSeed(seedBuffer);
    
    // Ir directo a la V4R2 (La más común) para evitar el error 429
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    // Pequeña pausa antes de pedir el balance para no saturar
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const balance = await contract.getBalance();
    const amountToSend = toNano(amt.toString());
    const gasReserve = toNano("0.05");

    if (balance < (amountToSend + gasReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente.",
        debug: `Dirección V4R2: ${wallet.address.toString()}\nBalance actual: ${fromNano(balance)} TON`
      });
    }

    const seqno = await contract.getSeqno();
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({ 
          to: recipientAddress, 
          value: amountToSend, 
          bounce: false, 
          body: "@kubaPayBot" 
        })
      ]
    });

    await contract.send(transfer);
    return res.status(200).json({ success: true, wallet_version: "V4R2" });

  } catch (error) {
    // Si el error es de Toncenter (429), damos un mensaje amigable
    const errorMsg = error.message.includes("429") 
      ? "La red TON está saturada (Error 429). Reintenta en 10 segundos." 
      : error.message;
      
    res.status(200).json({ success: false, error: errorMsg });
  }
          }
