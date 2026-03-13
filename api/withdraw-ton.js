import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  const { privateKey, recipientAddress, amt } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    
    // Convertimos tus 64 caracteres a un Buffer de 32 bytes
    const seed = Buffer.from(privateKey, 'hex');
    
    if (seed.length !== 32) {
      return res.status(200).json({ success: false, error: "La llave debe tener exactamente 64 caracteres hexadecimales. Tamaño actual: " + (seed.length * 2) });
    }

    // Generamos el par de llaves (Esto crea un secretKey de 64 bytes)
    const keyPair = keyPairFromSeed(seed);
    
    const wallet = WalletContractV4.create({ 
        workchain: 0, 
        publicKey: keyPair.publicKey 
    });
    
    const contract = client.open(wallet);
    const balance = await contract.getBalance();
    const amountToSend = toNano(amt.toString());
    const feeReserve = toNano("0.05");

    if (balance < (amountToSend + feeReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente. Balance detectado: " + fromNano(balance) + " TON." 
      });
    }

    const seqno = await contract.getSeqno();
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey, // Aquí ya van los 64 bytes exactos
      messages: [
        internal({
          to: recipientAddress,
          value: amountToSend,
          bounce: false,
          body: "@kubaPayBot", 
        })
      ]
    });

    await contract.send(transfer);
    res.status(200).json({ success: true, amount: amt });
    
  } catch (error) {
    // Si sigue dando error de tamaño, capturamos qué parte del código lo lanza
    res.status(200).json({ success: false, error: "Error Cripto: " + error.message });
  }
  }
