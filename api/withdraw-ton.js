import { TonClient, WalletContractV4, WalletContractV3R2, WalletContractV3R1, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  // Aceptamos tanto seed (frase) como privateKey (hex)
  const { seed, privateKey, recipientAddress, amt } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    let keyPair;

    if (seed) {
      const mnemonicArray = seed.trim().split(/\s+/);
      keyPair = await mnemonicToPrivateKey(mnemonicArray);
    } else {
      keyPair = { secretKey: Buffer.from(privateKey, 'hex'), publicKey: Buffer.from(privateKey, 'hex').slice(32) };
    }
    
    // Lista de versiones para probar
    const versions = [
      { name: "V4R2", contract: WalletContractV4 },
      { name: "V3R2", contract: WalletContractV3R2 },
      { name: "V3R1", contract: WalletContractV3R1 }
    ];

    let activeWallet = null;
    let report = "";

    for (let v of versions) {
      let w = v.contract.create({ workchain: 0, publicKey: keyPair.publicKey });
      let c = client.open(w);
      let b = await c.getBalance();
      let addr = w.address.toString();
      
      report += `[${v.name}]: ${addr} | Bal: ${fromNano(b)} TON\n`;

      if (b > 0n && !activeWallet) {
        activeWallet = { contract: c, keyPair, balance: b, name: v.name };
      }
    }

    // Si encontramos una con saldo, procedemos al retiro
    if (activeWallet) {
      const amountToSend = toNano(amt.toString());
      if (activeWallet.balance > (amountToSend + toNano("0.05"))) {
        const seqno = await activeWallet.contract.getSeqno();
        const transfer = await activeWallet.contract.createTransfer({
          seqno,
          secretKey: activeWallet.keyPair.secretKey,
          messages: [internal({ to: recipientAddress, value: amountToSend, bounce: false, body: "@kubaPayBot" })]
        });
        await activeWallet.contract.send(transfer);
        return res.status(200).json({ success: true, version: activeWallet.name });
      }
    }

    // Si no hay saldo suficiente en ninguna, enviamos el reporte detallado
    res.status(200).json({ 
      success: false, 
      error: "No se encontró saldo suficiente en ninguna versión de billetera.",
      debug: report 
    });
    
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
    }
