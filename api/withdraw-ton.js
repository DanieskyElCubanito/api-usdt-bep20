import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto"; // Usamos keyPairFromSeed para 32 bytes

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  const { privateKey, recipientAddress, amt } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    
    // Convertimos tus 64 caracteres (32 bytes) a Buffer
    const seed = Buffer.from(privateKey, 'hex');
    
    // En TON, si tienes 32 bytes, se usa como "seed" para generar el par de llaves completo (64 bytes)
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
        error: "Saldo insuficiente. Balance: " + fromNano(balance) + " TON." 
      });
    }

    const seqno = await contract.getSeqno();
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey, // Aquí ya van los 64 bytes que pide la librería
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
    
    res.status(200).json({ 
        success: true, 
        amount: amt
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
