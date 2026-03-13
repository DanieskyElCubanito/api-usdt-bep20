import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import { keyPairFromSecretKey } from "@ton/crypto";

const TON_RPC = "https://toncenter.com/api/v2/jsonRPC";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Método no permitido');
  
  const { privateKey, recipientAddress, amt } = req.body;

  try {
    const client = new TonClient({ endpoint: TON_RPC });
    
    // Convertimos la llave privada de hexadecimal a Buffer
    const secretKeyBuffer = Buffer.from(privateKey, 'hex');
    
    // Derivamos el par de llaves (necesario para obtener la clave pública)
    const keyPair = keyPairFromSecretKey(secretKeyBuffer);
    
    // Abrimos el contrato de la billetera V4R2
    const wallet = WalletContractV4.create({ 
        workchain: 0, 
        publicKey: keyPair.publicKey 
    });
    
    const contract = client.open(wallet);
    const balance = await contract.getBalance();
    const amountToSend = toNano(amt.toString());
    const feeReserve = toNano("0.05");

    if (balance < (amountToSend + feeReserve)) {
      return res.status(200).json({ 
        success: false, 
        error: "Saldo insuficiente. Balance en wallet: " + fromNano(balance) + " TON." 
      });
    }

    const seqno = await contract.getSeqno();
    const transfer = await contract.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: recipientAddress,
          value: amountToSend,
          bounce: false,
          body: "@kubaPayBot", // Comentario actualizado
        })
      ]
    });

    await contract.send(transfer);
    
    res.status(200).json({ 
        success: true, 
        amount: amt,
        txid: "Transacción enviada con éxito"
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
      }
