import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";
import { Buffer } from 'buffer'; // <--- ESTO ES CRUCIAL

const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { privateKey, recipientAddress, amt } = data;

    if (!privateKey) return res.status(200).json({ success: false, error: "Falta llave privada" });

    const client = new TonClient({ endpoint: TON_RPC, apiKey: TON_API_KEY });
    
    // Convertimos la llave con soporte total para Vercel
    const seedBuffer = Buffer.from(privateKey.trim(), 'hex');
    const keyPair = keyPairFromSeed(seedBuffer);
    
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    const balance = await contract.getBalance();
    const balanceFormateado = parseFloat(fromNano(balance)).toFixed(4);
    
    // Si el monto es 0, es una consulta de saldo (comando /checkAdmin)
    if (parseFloat(amt) === 0) {
      return res.status(200).json({ 
        success: false, 
        error: "Consulta de saldo exitosa.",
        debug: `<b>Dirección:</b> <code>${wallet.address.toString()}</code>\n<b>Balance:</b> <code>${balanceFormateado} TON</code>`
      });
    }

    const amountToSend = toNano(amt.toString());
    const gasReserve = toNano("0.05");

    if (balance < (amountToSend + gasReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente.",
        debug: `<b>Dirección:</b> <code>${wallet.address.toString()}</code>\n<b>Balance:</b> <code>${balanceFormateado} TON</code>`
      });
    }

    const seqno = await contract.getSeqno();
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({ to: recipientAddress, value: amountToSend, bounce: false, body: "@KubaPayBot" })
      ]
    });

    await contract.send(transfer);
    
    return res.status(200).json({ success: true, wallet_version: "V4R2" });

  } catch (error) {
    res.status(200).json({ success: false, error: "Error técnico: " + error.message });
  }
}
