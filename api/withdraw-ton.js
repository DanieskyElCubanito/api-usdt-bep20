import { TonClient, WalletContractV5R1, fromNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Buffer } from 'buffer';

const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });
  
  try {
    const data = req.body;
    const { mnemonic } = data;

    if (!mnemonic) return res.status(200).json({ success: false, error: "Falta el mnemonic" });

    const client = new TonClient({ endpoint: TON_RPC, apiKey: TON_API_KEY });
    const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
    
    // 🚀 AQUÍ ESTÁ EL CAMBIO: Usamos Wallet v5 R1
    const wallet = WalletContractV5R1.create({ 
      workchain: 0, 
      publicKey: keyPair.publicKey 
    });
    
    const contract = client.open(wallet);
    const walletAddress = wallet.address.toString({ bounceable: false, testOnly: false });
    
    const balance = await contract.getBalance();
    const balanceFormateado = parseFloat(fromNano(balance)).toFixed(4);

    return res.status(200).json({ 
      success: false, 
      debug: `📊 <b>Billetera W5 Sincronizada</b>\n\n<b>Dirección:</b> <code>${walletAddress}</code>\n<b>Balance:</b> <code>${balanceFormateado} TON</code>`
    });

  } catch (err) {
    return res.status(200).json({ success: false, error: "Error W5: " + err.message });
  }
                                               }
