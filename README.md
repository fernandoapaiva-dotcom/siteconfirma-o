# Batizado da Analu - RSVP e Galeria

Um sistema web completo para gerenciar o convite digital, confirmação de presença (RSVP), localização e compartilhamento de fotos para o batizado da Analu. 

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React, Vite, CSS puro
- **Backend:** Node.js, Express, Multer
- **Integração:** Google Drive API (via OAuth 2.0), Google Sheets API
- **Infraestrutura:** Docker, Docker Compose, Nginx (proxy reverso)
- **Deploy:** Oracle Cloud (OCI Free Tier)

## 📌 Funcionalidades Principais

- **Convite Digital Interativo:** Um design limpo, focado no mobile, simulando um convite físico elegante.
- **RSVP (Confirmação de Presença):** Hóspedes podem confirmar presença. Os dados podem ser salvos em JSON local ou enviados diretamente para o Google Sheets.
- **Localização:** Componente com mapas e redirecionamento direto para Waze e Google Maps.
- **Galeria de Fotos (Upload e Visualização):**
  - Integração com o Google Drive via OAuth 2.0 (superando os limites de cota de Service Accounts).
  - Suporte a uploads gigantes (vídeos) através de tecnologia de "Chunking" (fatiamento de 5MB) em segundo plano, estilo WhatsApp.
  - O visualizador de fotos (Lightbox) puxa os arquivos hospedados no Drive automaticamente.
- **Painel Admin Oculto (`/admin`):**
  - Protegido por senha.
  - Tabela com lista completa de RSVPs (com opção de exclusão manual).
  - Exportação de lista de convidados em PDF (Lista geral ou Lista para Restaurante).
  - Gerenciador visual das contas OAuth do Google Drive e da Galeria (apagar fotos).

## 🚀 Como rodar localmente

1. Clone o repositório.
2. Na pasta `/backend`, crie um `.env` baseado no `.env.example`.
3. Instale as dependências de ambas as pastas (`npm install`).
4. Inicie o frontend com `npm run dev` e o backend com `npm start`.

*No modo local (Mock Mode), se você não configurar o Google Drive, o app salva os uploads e confirmações temporariamente em arquivos JSON locais na pasta `backend/data`.*
