import { TonClient, WalletContractV4, WalletContractV3R2, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  const { seed, recipientAddress, amt } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    const mnemonicArray = seed.trim().split(/\s+/); // Limpia espacios extra
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    
    // Probamos primero con la versión V4R2 (La que usa Tonkeeper por defecto)
    let wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    let contract = client.open(wallet);
    let balance = await contract.getBalance();

    // Si la V4 está en 0, probamos con la V3R2 por si acaso
    if (balance === 0n) {
        wallet = WalletContractV3R2.create({ workchain: 0, publicKey: keyPair.publicKey });
        contract = client.open(wallet);
        balance = await contract.getBalance();
    }

    const amountToSend = toNano(amt.toString());
    const feeReserve = toNano("0.05");

    if (balance < (amountToSend + feeReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente. Balance detectado: " + fromNano(balance) + " TON. Asegúrate de que las 24 palabras sean las correctas." 
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
    res.status(200).json({ success: true, amount: amt });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
    }
