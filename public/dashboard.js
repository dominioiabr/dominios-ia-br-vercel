// VERSÃO FINAL E DE DEPURAÇÃO PARA VERCEL
document.addEventListener('DOMContentLoaded', () => {
    const passwordOverlay = document.getElementById('password-overlay');
    const passwordInput = document.getElementById('password-input');
    const passwordSubmit = document.getElementById('password-submit');
    const passwordError = document.getElementById('password-error');
    const dashboardContent = document.getElementById('dashboard-content');

    if (!passwordSubmit) {
        console.error('ERRO CRÍTICO: Botão de senha não encontrado no HTML!');
        return;
    }

    const loginAction = async () => {
        const password = passwordInput.value;
        passwordError.textContent = '';

        if (!password) {
            passwordError.textContent = 'Por favor, digite a senha.';
            return;
        }

        try {
            const response = await fetch(`/api/reports/${password}`);
            
            if (!response.ok) {
                if(response.status === 403) throw new Error('A senha está incorreta.');
                if(response.status === 404) throw new Error('API não encontrada (erro 404). Verifique o backend.');
                throw new Error(`Erro no servidor: ${response.status}`);
            }

            const data = await response.json();

            passwordOverlay.classList.add('hidden');
            dashboardContent.classList.remove('hidden');

            renderKPIs(data);
            renderTable(data.recentOffers);

        } catch (error) {
            console.error('ERRO AO BUSCAR DADOS:', error);
            passwordError.textContent = error.message;
        }
    };

    passwordSubmit.addEventListener('click', loginAction);
    passwordInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') loginAction();
    });

    function renderKPIs(data) {
        document.getElementById('total-visitors').textContent = data.totalVisitors || 0;
        document.getElementById('total-offers').textContent = data.totalOffers || 0;
        const avgSeconds = data.averageDuration || 0;
        const minutes = Math.floor(avgSeconds / 60);
        const seconds = avgSeconds % 60;
        document.getElementById('average-duration').textContent = `${minutes}m ${seconds}s`;
        const conversionRate = (data.totalVisitors > 0) ? ((data.totalOffers / data.totalVisitors) * 100).toFixed(2) : 0;
        document.getElementById('conversion-rate').textContent = `${conversionRate}%`;
    }

    function renderTable(offers) {
        const tbody = document.querySelector('#offers-table tbody');
        tbody.innerHTML = '';
        if (!offers || offers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Nenhuma oferta recebida ainda.</td></tr>';
            return;
        }
        offers.forEach(offer => {
            const duration = offer.tempo_no_site_segundos || 0;
            const durationText = `${Math.floor(duration / 60)}m ${duration % 60}s`;
            const row = `
                <tr>
                    <td>${new Date(offer.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>${offer.nome || ''}</td>
                    <td>${offer.dominio || ''}</td>
                    <td>${offer.localizacao || ''}</td>
                    <td>${durationText}</td>
                    <td>${offer.comentario || ''}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    }
});