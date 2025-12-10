'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Clock, Mail, Shield, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

function ApprovalPendingContent() {
  const searchParams = useSearchParams()
  
  // Read directly from URL params instead of using state
  // This avoids setState in useEffect and is more performant
  const username = searchParams.get('username') || ''
  const email = searchParams.get('email') || ''
  const provider = searchParams.get('provider') || ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-2">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
            Account Approval Pending
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 dark:text-gray-300">
            Your account has been successfully created
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Account Created Confirmation */}
          <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                  Account Successfully Created
                </h3>
                {username && (
                  <p className="text-green-800 dark:text-green-200 mb-1">
                    <span className="font-medium">Username:</span> {username}
                  </p>
                )}
                {email && (
                  <p className="text-green-800 dark:text-green-200 mb-1">
                    <span className="font-medium">Email:</span> {email}
                  </p>
                )}
                {provider && (
                  <p className="text-green-800 dark:text-green-200">
                    <span className="font-medium">Authentication Provider:</span> {provider}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Approval Required Notice */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-2">
                  Administrator Approval Required
                </h3>
                <p className="text-amber-800 dark:text-amber-200 mb-4">
                  Your account must be approved by an administrator before you can access the system. 
                  This is a security measure to ensure only authorized users have access.
                </p>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  What Happens Next?
                </h3>
                <ul className="space-y-2 text-blue-800 dark:text-blue-200">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                    <span>An administrator will review your account request</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                    <span>You will receive an email notification once your account is approved</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                    <span>After approval, you can log in using the same authentication method</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="mb-2">
              If you have questions about your account status, please contact your system administrator.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Approval times may vary depending on administrator availability.
            </p>
          </div>

          {/* Back to Login Button */}
          <div className="flex justify-center pt-4">
            <Link href="/login">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Return to Login Page
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ApprovalPendingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          </CardContent>
        </Card>
      </div>
    }>
      <ApprovalPendingContent />
    </Suspense>
  )
}
