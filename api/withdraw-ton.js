import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { Buffer } from 'buffer';

// Configuración de Toncenter (Mainnet)
const TON_API_KEY = "f8c2008d8ba557465e49df5bdd98eb987ef639a5ffabca82203c6d6f6b802fb5"; 
const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  // Solo permitir peticiones POST
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  try {
    const data = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    
    // IMPORTANTE: Ahora recibimos 'mnemonic' en lugar de 'privateKey'
    const { mnemonic, recipientAddress, amt } = data;

    if (!mnemonic) {
      return res.status(200).json({ success: false, error: "La API no recibió la frase mnemónica." });
    }

    const client = new TonClient({ 
      endpoint: TON_RPC,
      apiKey: TON_API_KEY 
    });
    
    // 1. Convertir las 24 palabras en el par de llaves (KeyPair)
    // El mnemonic debe venir como un solo string separado por espacios
    const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
    
    // 2. Crear el contrato de la billetera V4R2 (el estándar de SafePal)
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const contract = client.open(wallet);
    
    // 3. Obtener la dirección en formato "Unbounceable" (comienza con UQ...)
    const walletAddress = wallet.address.toString({ 
      bounceable: false, 
      testOnly: false 
    });
    
    // 4. Consultar balance actual
    const balance = await contract.getBalance();
    const balanceFormateado = parseFloat(fromNano(balance)).toFixed(4);

    // Si el monto es 0, es una consulta de estado desde el bot
    if (parseFloat(amt) === 0) {
      return res.status(200).json({ 
        success: false, 
        debug: `📊 <b>Billetera Sincronizada</b>\n\n<b>Dirección:</b> <code>${walletAddress}</code>\n<b>Balance:</b> <code>${balanceFormateado} TON</code>`
      });
    }

    // 5. Verificación de fondos para el retiro
    const amountToSend = toNano(amt.toString());
    const gasReserve = toNano("0.05"); // Reserva mínima para el gas de la red

    if (balance < (amountToSend + gasReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente en la wallet del bot.",
        debug: `Billetera: ${walletAddress} | Balance: ${balanceFormateado} TON`
      });
    }

    // 6. Obtener número de secuencia y enviar transferencia
    const seqno = await contract.getSeqno();
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
    
    return res.status(200).json({ 
        success: true, 
        address: walletAddress,
        balance_restante: balanceFormateado
    });

  } catch (error) {
    console.error(error);
    res.status(200).json({ 
        success: false, 
        error: "Error en la red TON: " + error.message 
    });
  }
  }
