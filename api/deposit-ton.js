import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  // Recibimos seed (la tuya), recipientAddress (la del usuario) y amt (monto)
  const { seed, recipientAddress, amt } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    const mnemonicArray = seed.split(" ");
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    const balance = await contract.getBalance();
    const amountToSend = toNano(amt.toString());

    // Verificar si tu wallet tiene suficiente para el envío + gas
    if (balance < amountToSend + toNano("0.02")) {
      return res.status(200).json({ error: "Saldo insuficiente en la billetera administrativa para cubrir el retiro y el gas." });
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
          body: "@KubaPaybot", // Mensaje profesional
        })
      ]
    });

    await contract.send(transfer);
    
    // Devolvemos el hash o éxito
    res.status(200).json({ 
        success: true, 
        amount: amt,
        recipient: recipientAddress
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
  }
