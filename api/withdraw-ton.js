import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { keyPairFromSeed } from "@ton/crypto";

// 1. TU API KEY DE TONCENTER
const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    // Manejo de datos entrantes desde el bot
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const { privateKey, recipientAddress, amt } = data;

    if (!privateKey) {
        return res.status(200).json({ success: false, error: "La API no recibió la llave privada." });
    }

    // 2. CONFIGURACIÓN DEL CLIENTE CON TU API KEY
    const client = new TonClient({ 
      endpoint: TON_RPC,
      apiKey: TON_API_KEY 
    });
    
    // Procesar la llave de 64 caracteres (SafePal/Hex)
    const seedBuffer = Buffer.from(privateKey.trim(), 'hex');
    const keyPair = keyPairFromSeed(seedBuffer);
    
    // Usar la versión de contrato V4R2
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    // Obtener balance y forzar formato de 4 decimales
    const balance = await contract.getBalance();
    const balanceFormateado = parseFloat(fromNano(balance)).toFixed(4); 
    
    const amountToSend = toNano(amt.toString());
    const gasReserve = toNano("0.05"); // Reserva para el gas de la red

    // Verificación estricta de fondos
    if (balance < (amountToSend + gasReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente en la wallet del bot.",
        debug: `Dirección: ${wallet.address.toString()} | Balance: ${balanceFormateado} TON`
      });
    }

    // Prevención de error en billeteras nuevas sin historial
    let seqno = 0;
    try {
        seqno = await contract.getSeqno();
    } catch (e) {
        console.log("Billetera nueva, seqno iniciado en 0.");
    }
    
    // Crear y enviar la transferencia a la blockchain
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({ 
          to: recipientAddress, 
          value: amountToSend, 
          bounce: false, 
          body: "@KubaPayBot" 
        })
      ]
    });

    await contract.send(transfer);
    
    // Respuesta de éxito al bot
    return res.status(200).json({ 
        success: true, 
        wallet_version: "V4R2",
        address: wallet.address.toString(),
        balance_actual: balanceFormateado // Enviamos el balance al bot por si quieres usarlo
    });

  } catch (error) {
    res.status(200).json({ 
        success: false, 
        error: "Error en la red TON: " + error.message 
    });
  }
  }
