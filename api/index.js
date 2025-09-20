require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');

// Inicializa o Express
const app = express();
app.use(express.json());
app.use(express.text({ type: '*/*' }));
app.use(cors());

// --- Inicialização de Serviços ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

let emailTransporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

// Configura o limitador de requisições (Rate Limit)
const offerLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutos
    max: parseInt(process.env.RATE_LIMIT_MAX) || 5, // 5 requisições por IP a cada 15 minutos
    message: { success: false, message: 'Muitas tentativas de envio. Por favor, aguarde um momento.' },
    standardHeaders: true,
    legacyHeaders: false,
});


// --- Funções Auxiliares ---
function collectClientInfo(req) {
    return {
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        host: req.headers['x-vercel-deployment-url'] || req.headers.host,
    };
}

async function getIpLocation(ip) {
    if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Local/Desconhecida';
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        return data.status === 'success' ? `${data.city}, ${data.regionName}, ${data.country}` : 'N/A';
    } catch (error) {
        console.error('Erro ao buscar geolocalização do IP:', error);
        return 'N/A';
    }
}


// --- Rotas da API ---

// Rota para registrar a duração da visita
app.post('/api/log-duration', async (req, res) => {
    if (!supabase) return res.status(500).json({ message: "Configuração do banco de dados ausente." });
    try {
        const { duration } = JSON.parse(req.body);
        const clientInfo = collectClientInfo(req);
        const location = await getIpLocation(clientInfo.ip);

        await supabase.from('visitas').insert({
            dominio: clientInfo.host,
            ip: clientInfo.ip,
            user_agent: clientInfo.userAgent,
            localizacao: location,
            duracao_segundos: duration,
        });

        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// Rota para enviar a oferta, agora com a proteção do rate limit
app.post('/api/send-offer', offerLimiter, async (req, res) => {
    if (!supabase || !emailTransporter) return res.status(500).json({ message: "Configuração do servidor incompleta." });

    try {
        const { nome, email, comentario, durationOnSite } = req.body;
        const clientInfo = collectClientInfo(req);
        const location = await getIpLocation(clientInfo.ip);

        const { count } = await supabase.from('visitas').select('*', { count: 'exact', head: true });
        const visitorNumber = (count || 0) + 1;

        await supabase.from('ofertas').insert({
            nome, email, comentario,
            dominio: clientInfo.host,
            visitante_numero: visitorNumber,
            localizacao: location,
            ip: clientInfo.ip,
            user_agent: clientInfo.userAgent,
            tempo_no_site_segundos: durationOnSite,
        });

        const mailOptions = {
            from: `"${nome}" <${process.env.EMAIL_USER}>`,
            to: 'dominio.ia.br@gmail.com',
            subject: `[Visitante #${visitorNumber}] Nova Oferta para ${clientInfo.host}`,
            html: `<h3>Nova oferta recebida!</h3><p><strong>Domínio:</strong> ${clientInfo.host}</p><p><strong>Nome:</strong> ${nome}</p><p><strong>Email:</strong> ${email}</p><p><strong>Oferta:</strong> ${comentario}</p><hr><p><strong>Localização:</strong> ${location}</p><p><strong>Tempo no site:</strong> ${durationOnSite} segundos</p>`,
        };
        await emailTransporter.sendMail(mailOptions);

        res.status(200).json({ success: true, message: 'Oferta enviada com sucesso!' });
    } catch (error) {
        console.error("Erro em /api/send-offer:", error);
        res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor.' });
    }
});

// Rota para o dashboard
app.get('/api/reports/:password', async (req, res) => {
    if (req.params.password !== process.env.REPORTS_PASSWORD) {
        return res.status(403).json({ error: 'Acesso negado.' });
    }
    if (!supabase) return res.status(500).json({ message: "Configuração do banco de dados ausente." });

    try {
        const { data: ofertas } = await supabase.from('ofertas').select('*').order('created_at', { ascending: false }).limit(50);
        const { count: totalVisitas } = await supabase.from('visitas').select('*', { count: 'exact', head: true });
        const { count: totalOfertas } = await supabase.from('ofertas').select('*', { count: 'exact', head: true });

        res.status(200).json({
            totalVisitors: totalVisitas || 0,
            totalOffers: totalOfertas || 0,
            recentOffers: ofertas || [],
            dailyStats: {},
            averageDuration: 0,
        });
    } catch (error) {
        console.error("Erro em /api/reports:", error);
        res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor.' });
    }
});

// Exporta o app para a Vercel
module.exports = app;