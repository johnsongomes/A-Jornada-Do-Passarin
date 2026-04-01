export async function signIn(email, password) {
    const { data, error } = await
        supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Erro ao fazer login:", error.message);
        return { success: false, message: error.message };
    }
    else {
        alert("Login bem-sucedido:", data.user);
        window.location.href = "../pages/dashboard.html"; // Redireciona para a página principal do jogo
    }
    return { success: true, user: data.user };
}

export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

import { getUser } from "../js/auth.js"
async function checkAuth() {
    const user = await getUser()
    if (!user) {
        alert("Você precisa estar logado para acessar esta página.");
        window.location.href = "../index.html"; // Redireciona para a página de login
    }else { document.getElementById("userEmail").innerText = user.email; }
}