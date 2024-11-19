import { setTheme } from '@/lib/set-theme'
import { User, userWithSettingsSchema } from '@/schemas/user-schema'
import { queryOptions } from '@tanstack/react-query'
import { pb } from './pocketbase'

export async function authRefresh() {
  await pb.collection('users').authRefresh()
}

export function checkUserIsLoggedIn() {
  return pb.authStore.isValid
}

export function checkEmailIsVerified() {
  return pb.authStore.model?.verified
}

export function checkVerifiedUserIsLoggedIn() {
  return checkUserIsLoggedIn() && checkEmailIsVerified()
}

export async function sendVerificationEmail(email: string) {
  await pb.collection('users').requestVerification(email)
}

export async function createNewUser(newUserData: {
  name: string
  email: string
  password: string
  passwordConfirm: string
}) {
  await pb.collection('users').create({ ...newUserData, emailVisibility: true })
  await sendVerificationEmail(newUserData.email)
}

export async function verifyEmailByToken(token: string) {
  await pb.collection('users').confirmVerification(token)
  if (pb.authStore.model) await authRefresh()
}

export async function loginWithPassword(email: string, password: string) {
  const authResult = await pb
    .collection('users')
    .authWithPassword(email, password)
  return authResult
}

export async function loginWithGoogle() {
  const authResult = await pb
    .collection('users')
    .authWithOAuth2({ provider: 'google' })
  await authRefresh()
  return authResult
}

export function logout() {
  pb.authStore.clear()
}

export async function requestPasswordReset(email: string) {
  await pb.collection('users').requestPasswordReset(email)
}

export async function confirmPasswordReset(
  password: string,
  passwordConfirm: string,
  token: string
) {
  await pb
    .collection('users')
    .confirmPasswordReset(token, password, passwordConfirm)
  if (pb.authStore.model)
    await loginWithPassword(pb.authStore.model.email, password)
}

export async function subscribeToUserChanges(
  userId: string,
  callback: (record: User) => void
) {
  pb.collection('users').subscribe(userId, (e) => {
    const userData = e.record as unknown as User
    callback(userData)
  })
}

export async function unsubscribeFromUserChanges() {
  pb.collection('users').unsubscribe('*')
}

export const userQueryOptions = queryOptions({
  queryKey: ['user'],
  queryFn: async () => {
    if (!checkUserIsLoggedIn()) return null

    try {
      await authRefresh()
    } catch {
      logout()
      return null
    }

    const settings = await pb
      .collection('settings')
      .getFirstListItem(`user="${pb.authStore.model?.id}"`)

    setTheme(settings.theme)

    const userData = userWithSettingsSchema.parse({
      ...pb.authStore.model,
      settings
    })

    return userData
  }
})
