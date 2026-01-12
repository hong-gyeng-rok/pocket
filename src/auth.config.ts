import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  // 페이지 접근 제어 로직 (필요시 활성화)
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // 예: 로그인 여부 확인
      // const isLoggedIn = !!auth?.user
      // const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      // if (isOnDashboard) {
      //   if (isLoggedIn) return true
      //   return false 
      // }
      return true
    },
  },
} satisfies NextAuthConfig
