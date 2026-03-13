import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  const { seed, recipientAddress, amt } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    const mnemonicArray = seed.split(" ");
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    const balance = await contract.getBalance();
    const amountToSend = toNano(amt.toString());
    const feeReserve = toNano("0.05"); // Reserva para el gas

    // Verificación real de saldo
    if (balance < (amountToSend + feeReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente. Balance: " + fromNano(balance) + " TON. Intento: " + amt + " TON + Gas." 
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
          body: "Retiro KubaPay", 
        })
      ]
    });

    await contract.send(transfer);
    
    res.status(200).json({ 
        success: true, 
        amount: amt,
        txid: "Transacción enviada a la red"
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
