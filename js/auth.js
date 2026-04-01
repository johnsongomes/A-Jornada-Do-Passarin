import { supabase } from './supabaseClient.js'

// CADASTRO
export async function signUp(username, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username // 🔥 salva aqui
      }
    }
  })

  if (error) {
    alert(error.message)
  } else {
    alert('Conta criada!')
  }
}

// LOGIN
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    alert(error.message)
  } else {
    window.location.href = '../pages/dashboard.html'
  }
}

// LOGOUT
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = '../index.html'
}

// VER USUÁRIO
export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}