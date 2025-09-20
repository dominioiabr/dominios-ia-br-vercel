// VERSÃO FINAL PARA VERCEL
document.addEventListener('DOMContentLoaded', () => {
    const startTime = new Date();

    const domainNameElement = document.getElementById('domain-name');
    const offerForm = document.getElementById('offer-form');
    const statusElement = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    if(domainNameElement) {
        domainNameElement.textContent = window.location.hostname;
    }
    document.title = `${window.location.hostname} - À Venda`;

    if(offerForm) {
        offerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';
            statusElement.textContent = '';
            statusElement.className = '';

            const durationOnSite = Math.round((new Date() - startTime) / 1000);

            const formData = {
                nome: document.getElementById('nome').value,
                email: document.getElementById('email').value,
                comentario: document.getElementById('comentario').value,
                durationOnSite: durationOnSite
            };

            try {
                const response = await fetch('/api/send-offer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    throw new Error(`Erro no servidor: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    statusElement.textContent = result.message;
                    statusElement.classList.add('success');
                    offerForm.reset();
                } else {
                    statusElement.textContent = result.message || 'Ocorreu um erro.';
                    statusElement.classList.add('error');
                }
            } catch (error) {
                console.error('Erro de fetch:', error);
                statusElement.textContent = `Erro de conexão. Tente novamente.`;
                statusElement.classList.add('error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar Mensagem';
            }
        });
    }

    const logVisitDuration = () => {
        const duration = Math.round((new Date() - startTime) / 1000);
        const data = JSON.stringify({ duration });
        
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/log-duration', data);
        }
    };

    window.addEventListener('beforeunload', logVisitDuration);
});