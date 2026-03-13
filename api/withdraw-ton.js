import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Buffer } from 'buffer';

const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { mnemonic, recipientAddress, amt } = data;

    if (!mnemonic) {
      return res.status(200).json({ success: false, error: "Faltan las 24 palabras en la petición." });
    }

    const client = new TonClient({ endpoint: TON_RPC, apiKey: TON_API_KEY });
    
    // Generar llaves SIEMPRE desde las palabras (estándar SafePal)
    const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
    
    // Crear billetera V4R2
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    // Generar dirección exacta UQA_t...
    const walletAddress = wallet.address.toString({ bounceable: false, testOnly: false });
    
    const balance = await contract.getBalance();
    const balanceFormateado = parseFloat(fromNano(balance)).toFixed(4);

    if (parseFloat(amt) === 0) {
      return res.status(200).json({ 
        success: false, 
        debug: `📊 <b>Billetera Sincronizada</b>\n\n<b>Dirección:</b> <code>${walletAddress}</code>\n<b>Balance:</b> <code>${balanceFormateado} TON</code>`
      });
    }

    const amountToSend = toNano(amt.toString());
    const gasReserve = toNano("0.05");

    if (balance < (amountToSend + gasReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente.",
        debug: `Balance: ${balanceFormateado} TON`
      });
    }

    const seqno = await contract.getSeqno();
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({ to: recipientAddress, value: amountToSend, bounce: false, body: "@KubaPayBot" })]
    });

    await contract.send(transfer);
    return res.status(200).json({ success: true });

  } catch (error) {
    res.status(200).json({ success: false, error: "Error: " + error.message });
  }
        }
