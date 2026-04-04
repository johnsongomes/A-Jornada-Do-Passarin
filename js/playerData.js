/* =========================================================
   PLAYER DATA — playerData.js
   Sincroniza skin ativa, itens desbloqueados e moedas
   entre o PlayerStore (logicagame.js) e o Supabase.
   ========================================================= */

import { supabase }              from './supabaseClient.js';
import { storeState, PlayerStore } from './logicagame.js';

export const PlayerDataService = {

  // ── Carrega dados do Supabase e aplica no storeState ─────
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
        .maybeSingle(); // não estoura erro se não existir

      if (error) {
        console.error('[PlayerData] Erro ao carregar:', error.message);
        return;
      }

      if (data) {
        // Supabase tem dados → sobrescreve storeState
        storeState.activeSkin     = data.active_skin     || 'skin_default';
        storeState.activeCosmetic = data.active_cosmetic || null;
        storeState.unlocked       = data.unlocked        || ['skin_default'];
        storeState.coins          = data.coins           || 0;
        PlayerStore.save(storeState);
        console.info('[PlayerData] ✅ Dados carregados do Supabase:', data);
      } else {
        // Primeira vez → envia localStorage para o Supabase
        console.info('[PlayerData] Primeira vez — enviando dados locais.');
        await this.save();
      }

    } catch (err) {
      console.error('[PlayerData] Erro inesperado no sync:', err.message);
    }
  },

  // ── Salva storeState atual no Supabase ───────────────────
  async save() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('player_data')
        .upsert({
          user_id:         user.id,
          active_skin:     storeState.activeSkin     || 'skin_default',
          active_cosmetic: storeState.activeCosmetic || null,
          unlocked:        storeState.unlocked       || ['skin_default'],
          coins:           storeState.coins          || 0,
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[PlayerData] Erro ao salvar:', error.message);
        return;
      }

      console.info('[PlayerData] ✅ Dados salvos no Supabase.');

    } catch (err) {
      console.error('[PlayerData] Erro inesperado ao salvar:', err.message);
    }
  },
};

// ── Sincroniza automaticamente ao importar ───────────────
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) PlayerDataService.sync();
});
