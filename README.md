PASSARINHO JORNADA v5.2
   NOVIDADES:
   - Sistema de moedas: obstáculos desvios geram moedas
   - Chão animado com paralaxe (2 camadas)
   - Fundo animado com paralaxe (nuvens/pirâmides)
   - Obstáculos piscam vermelho antes de colidir (aviso)
   - Pássaro pisca e tem efeito de invencibilidade colorido
   - Tela de pausa (tecla P ou botão na HUD)
   - Efeito de câmera shake na colisão
   - Contador de moedas na HUD
   - Moedas ganhas ao desviar adicionadas ao storeState
   BUGS CORRIGIDOS:
   - handleHit chamado múltiplas vezes no mesmo frame (debounce)
   - Escudo sendo aplicado depois de já estar em colisão
   - Input.consume() faltando em alguns caminhos da loja
   - Spawn do coração durante invencibilidade ativa
   - Obstacle scored não resetando ao reciclar avião
   - frameCount não resetando ao reiniciar (acumulava lixo)
   - Combo não zerando ao perder uma vida
   INTEGRAÇÃO SUPABASE REAL:
   - Importa supabase do supabaseClient.js do projeto
   - Lê usuário logado via auth.getUser() (auth.js)
   - Username vem de user.user_metadata.username
   - Salva score na tabela "scores" via supabase.from()
   - Busca top 10 ranking global via supabase.from()
   - Tela de ranking (LEADERBOARD) acessível no menu
   - Se não há sessão ativa, usa nome local como fallback
