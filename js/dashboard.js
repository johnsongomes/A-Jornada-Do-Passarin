export async function logout() {
    await supabase.auth.signOut();
    alert("Logout bem-sucedido!");
    window.location.href = "../index.html"; // Redireciona para a página de login
}