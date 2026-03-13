import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');

  const { adminSeed, userAddress, amount } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    const mnemonicArray = adminSeed.split(" ");
    const keyPair = await mnemonicToPrivateKey(mnemonicArray);

    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    const balance = await contract.getBalance();
    const amountInNano = toNano(amount.toString());

    // Validar que el admin tenga saldo suficiente (monto + pequeño margen de gas)
    if (balance < (amountInNano + toNano("0.02"))) {
      return res.status(200).json({ error: "Saldo de administrador insuficiente" });
    }

    const seqno = await contract.getSeqno();

    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: userAddress,
          value: amountInNano,
          bounce: false,
          body: "Retiro KubaPay",
        })
      ]
    });

    await contract.send(transfer);

    res.status(200).json({ success: true, hash: "Enviado correctamente" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
          }
