/* =========================================================
   PLAYER DATA — playerData.js

   Sincroniza skin ativa, itens desbloqueados e moedas
   entre o localStorage (PlayerStore) e a tabela
   player_data no Supabase.

   Como usar no HTML (antes do logicagame.js):
   <script type="module" src="../js/playerData.js"></script>

   O playerData.js chama PlayerDataService.sync() no boot
   automaticamente. O logicagame.js deve chamar
   PlayerDataService.save() sempre que o storeState mudar.
   ========================================================= */

import { supabase } from './supabaseClient.js';

// =========================================================
// PlayerDataService
// =========================================================
export const PlayerDataService = {

  // ── Estado atual carregado do Supabase ──────────────────
  _loaded: false,

  // ── Carrega dados do Supabase e mescla com localStorage ─
  // Regra: Supabase sempre vence o localStorage
  async sync() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.info('[PlayerData] Sem sessão — usando dados locais.');
        return;
      }

      const { data, error } = await supabase
        .from('player_data')
        .select('active_skin, active_cosmetic, unlocked, coins')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = sem resultado (primeira vez) — não é erro real
        console.error('[PlayerData] Erro ao carregar:', error.message);
        return;
      }

      if (data) {
        // Supabase tem dados — sobrescreve o localStorage
        this._applyToStore({
          activeSkin:      data.active_skin     || 'skin_default',
          activeCosmetic:  data.active_cosmetic || null,
          unlocked:        data.unlocked        || ['skin_default'],
          coins:           data.coins           || 0,
        });
        console.info('[PlayerData] ✅ Dados carregados do Supabase:', data);
      } else {
        // Primeira vez — envia o localStorage para o Supabase
        console.info('[PlayerData] Primeira vez — enviando dados locais ao Supabase.');
        await this.save();
      }

      this._loaded = true;

    } catch (err) {
      console.error('[PlayerData] Erro inesperado no sync:', err.message);
    }
  },

  // ── Salva o storeState atual no Supabase ─────────────────
  async save() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Lê o storeState do logicagame.js (variável global)
      if (typeof storeState === 'undefined') {
        console.warn('[PlayerData] storeState não encontrado — logicagame.js carregou?');
        return;
      }

      const payload = {
        user_id:         user.id,
        active_skin:     storeState.activeSkin      || 'skin_default',
        active_cosmetic: storeState.activeCosmetic  || null,
        unlocked:        storeState.unlocked        || ['skin_default'],
        coins:           storeState.coins           || 0,
      };

      const { error } = await supabase
        .from('player_data')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.error('[PlayerData] Erro ao salvar:', error.message);
        return;
      }

      console.info('[PlayerData] ✅ Dados salvos no Supabase.');

    } catch (err) {
      console.error('[PlayerData] Erro inesperado ao salvar:', err.message);
    }
  },

  // ── Aplica dados do Supabase no storeState + localStorage ─
  _applyToStore(remoteData) {
    if (typeof storeState === 'undefined' || typeof PlayerStore === 'undefined') {
      // logicagame.js ainda não carregou — agenda para depois
      window.addEventListener('load', () => this._applyToStore(remoteData));
      return;
    }

    storeState.activeSkin     = remoteData.activeSkin;
    storeState.activeCosmetic = remoteData.activeCosmetic;
    storeState.unlocked       = remoteData.unlocked;
    storeState.coins          = remoteData.coins;

    // Persiste no localStorage também
    PlayerStore.save(storeState);
  },

  // ── Atualiza um campo específico e salva ─────────────────
  // Ex: PlayerDataService.update({ coins: storeState.coins + 10 })
  async update(fields) {
    if (typeof storeState === 'undefined') return;

    // Aplica localmente primeiro (responsividade imediata)
    Object.assign(storeState, fields);
    if (typeof PlayerStore !== 'undefined') PlayerStore.save(storeState);

    // Sincroniza com Supabase
    await this.save();
  },

  // ── Adiciona moedas e salva ───────────────────────────────
  async addCoins(amount) {
    if (typeof storeState === 'undefined') return;
    const newTotal = (storeState.coins || 0) + amount;
    await this.update({ coins: newTotal });
    console.info(`[PlayerData] +${amount} moedas → total: ${newTotal}`);
  },

  // ── Desbloqueia um item e salva ───────────────────────────
  async unlockItem(itemId) {
    if (typeof storeState === 'undefined') return;
    if (storeState.unlocked.includes(itemId)) return;

    storeState.unlocked.push(itemId);
    await this.save();
    console.info('[PlayerData] Item desbloqueado e salvo:', itemId);
  },

  // ── Equipa uma skin e salva ───────────────────────────────
  async equipSkin(skinId) {
    await this.update({ activeSkin: skinId });
    console.info('[PlayerData] Skin equipada:', skinId);
  },

  // ── Equipa um cosmético e salva ───────────────────────────
  async equipCosmetic(cosmeticId) {
    await this.update({ activeCosmetic: cosmeticId });
    console.info('[PlayerData] Cosmético equipado:', cosmeticId);
  },
};

// ── Sincroniza automaticamente ao carregar ───────────────
// Aguarda o DOM carregar para garantir que logicagame.js
// já executou e storeState está disponível
window.addEventListener('load', () => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      PlayerDataService.sync();
    }
  });
});
