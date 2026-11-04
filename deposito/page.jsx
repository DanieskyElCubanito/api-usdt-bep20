"use client";
import { useState } from 'react';
import QRCode from 'react-qr-code';

export default function DepositoMiniApp() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(false);

  const generarWallet = async () => {
    setLoading(true);
    try {
      // Llamando a tu API real de Vercel
      const res = await fetch('https://api-usdt-bep20.vercel.app/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: 'BSC' })
      });
      const data = await res.json();
      
      if (data.success) {
        setWallet(data.address);
        // La privateKey ya la puedes mandar a tu base de datos (Supabase o BJS) desde aquí
      }
    } catch (error) {
      console.error("Error generando wallet", error);
    }
    setLoading(false);
  };

  return (
    <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', padding: '20px', color: '#fff', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#00f0ff', textAlign: 'center', textShadow: '0 0 10px #00f0ff' }}>
        Kuba Pay
      </h2>

      {!wallet ? (
        <button 
          onClick={generarWallet}
          style={{
            display: 'block', margin: '40px auto', padding: '15px 30px',
            backgroundColor: 'transparent', color: '#ff1493',
            border: '2px solid #ff1493', borderRadius: '12px',
            boxShadow: '0 0 15px rgba(255, 20, 147, 0.4)',
            fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          {loading ? 'Conectando a Web3...' : 'Generar Billetera'}
        </button>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <p style={{ color: '#aaa', marginBottom: '20px' }}>Escanea para enviar USDT (BEP20)</p>
          
          <div style={{ 
            background: '#fff', padding: '20px', borderRadius: '15px', 
            display: 'inline-block', boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)' 
          }}>
            <QRCode value={wallet} size={200} />
          </div>
          
          <p style={{ marginTop: '20px', fontSize: '14px', wordBreak: 'break-all', color: '#00f0ff' }}>
            {wallet}
          </p>
        </div>
      )}
    </div>
  );
}
