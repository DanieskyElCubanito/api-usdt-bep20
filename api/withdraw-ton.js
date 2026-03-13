import { TonClient, WalletContractV4, WalletContractV3R2, WalletContractV3R1, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey, keyPairFromSeed } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  // Solo permitir peticiones POST
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    // 1. CORRECCIÓN DE RECEPCIÓN: Validamos y limpiamos el cuerpo de la petición
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { seed, privateKey, recipientAddress, amt } = data;

    // Si no hay ninguna llave, devolvemos error claro
    if (!seed && !privateKey) {
      return res.status(200).json({ 
        success: false, 
        error: "La API no recibió ninguna llave (seed o privateKey).",
        received: data 
      });
    }

    const client = new TonClient({ endpoint: TON_RPC });
    let keyPair;

    // 2. CORRECCIÓN DE LLAVE: Procesamos según lo que envíe el bot
    if (seed) {
      const mnemonicArray = seed.trim().split(/\s+/);
      keyPair = await mnemonicToPrivateKey(mnemonicArray);
    } else {
      // Si envías 64 caracteres, usamos keyPairFromSeed (32 bytes)
      const seedBuffer = Buffer.from(privateKey.trim(), 'hex');
      keyPair = keyPairFromSeed(seedBuffer);
    }
    
    // Lista de versiones para probar automáticamente
    const versions = [
      { name: "V4R2", contract: WalletContractV4 },
      { name: "V3R2", contract: WalletContractV3R2 },
      { name: "V3R1", contract: WalletContractV3R1 }
    ];

    let activeWallet = null;
    let report = "";

    // 3. MODO DIAGNÓSTICO: Buscar saldo en todas las versiones
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

    // 4. LÓGICA DE ENVÍO
    if (activeWallet) {
      const amountToSend = toNano(amt.toString());
      const gasReserve = toNano("0.05");

      if (activeWallet.balance >= (amountToSend + gasReserve)) {
        const seqno = await activeWallet.contract.getSeqno();
        const transfer = await activeWallet.contract.createTransfer({
          seqno,
          secretKey: activeWallet.keyPair.secretKey,
          messages: [
            internal({ 
              to: recipientAddress, 
              value: amountToSend, 
              bounce: false, 
              body: "@kubaPayBot" 
            })
          ]
        });
        await activeWallet.contract.send(transfer);
        return res.status(200).json({ success: true, wallet_version: activeWallet.name });
      } else {
        return res.status(200).json({ 
          success: false, 
          error: "Saldo insuficiente en " + activeWallet.name + " para cubrir monto + gas.",
          debug: report 
        });
      }
    }

    // Si llegamos aquí, es porque todas las versiones marcaron 0 TON
    res.status(200).json({ 
      success: false, 
      error: "Todas las versiones de billetera detectadas están en 0 TON.",
      debug: report 
    });
    
  } catch (error) {
    res.status(200).json({ 
      success: false, 
      error: "Error interno: " + error.message 
    });
  }
}
