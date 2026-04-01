import { supabase } from './supabaseClient.js'

// CADASTRO
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
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
    window.location.href = '/dashboard.html'
  }
}

// LOGOUT
export async function logout() {
  await supabase.auth.signOut()
  window.location.href = '/login.html'
}

// VER USUÁRIO
export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}