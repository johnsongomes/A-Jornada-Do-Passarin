import { supabase } from "./supabaseClient"
export async function signUp(nome, email, password) {
    const { user, error } = await supabase.auth.signUp({
        email: email,
        password: password,
    });

    if (error) {
        console.error("Erro ao criar conta:", error.message);
        return { success: false, message: error.message };
    }
    else {        
        alert("Conta criada com sucesso:", user);
    }

    return { success: true, user: user };
}