export default async function handler(req, res) {
    res.status(200).json({ 
        success: true, 
        message: "Conexión exitosa con Vercel",
        nota: "Si ves este mensaje, el problema es la librería bitcore-lib-doge"
    });
}
