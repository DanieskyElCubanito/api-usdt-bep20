export default async function handler(req, res) {
    // 1. Configuración de Headers CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permite peticiones desde cualquier origen
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // 2. Manejo de la petición Preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Aquí continúa tu lógica actual para generar la wallet...
    // Ejemplo de respuesta exitosa:
    // res.status(200).json({ address: "0x..." })

import { ethers } from "ethers";

export default function handler(req, res) {
  const wallet = ethers.Wallet.createRandom();
  res.status(200).json({ 
    address: wallet.address, 
    privateKey: wallet.privateKey 
  });
    }
