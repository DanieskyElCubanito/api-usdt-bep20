import { TonClient, WalletContractV4, fromNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Buffer } from 'buffer';

const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST solamente' });
  
  try {
    const data = req.body;
    const { mnemonic, amt } = data;

    if (!mnemonic) return res.status(200).json({ success: false, error: "Falta el mnemonic" });

    const client = new TonClient({ endpoint: TON_RPC, apiKey: TON_API_KEY });
    
    // 1. Generar llaves
    const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
    
    // 2. Crear contrato V4R2 con Wallet ID estándar (696618115)
    // Este es el que usa SafePal y Tonkeeper por defecto
    const wallet = WalletContractV4.create({ 
      workchain: 0, 
      publicKey: keyPair.publicKey,
      walletId: 696618115 
    });
    
    const contract = client.open(wallet);
    
    // 3. Generar dirección en formato UQ (User Friendly / Non-bounceable)
    const walletAddress = wallet.address.toString({ 
      bounceable: false, 
      testOnly: false 
    });
    
    // 4. Obtener balance
    const balance = await contract.getBalance();
    const balanceFormateado = parseFloat(fromNano(balance)).toFixed(4);

    return res.status(200).json({ 
      success: false, 
      debug: `📊 <b>Billetera Sincronizada</b>\n\n<b>Dirección:</b> <code>${walletAddress}</code>\n<b>Balance:</b> <code>${balanceFormateado} TON</code>`
    });

  } catch (err) {
    return res.status(200).json({ success: false, error: "Error de red: " + err.message });
  }
                                 }
