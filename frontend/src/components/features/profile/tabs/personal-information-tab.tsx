'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, User } from 'lucide-react'

interface PersonalInformationTabProps {
  username: string
  realname: string
  email: string
  onRealnameChange: (value: string) => void
  onEmailChange: (value: string) => void
}

export function PersonalInformationTab({
  username,
  realname,
  email,
  onRealnameChange,
  onEmailChange,
}: PersonalInformationTabProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
        <CardTitle className="flex items-center space-x-2 text-white text-base">
          <User className="h-5 w-5" />
          <span>Personal Information</span>
        </CardTitle>
        <CardDescription className="text-blue-100">
          Update your personal details and account preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Username (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            disabled
            className="bg-slate-50"
          />
          <p className="text-sm text-slate-500">Username cannot be changed</p>
        </div>

        {/* Real Name */}
        <div className="space-y-2">
          <Label htmlFor="realname">Real Name</Label>
          <Input
            id="realname"
            value={realname}
            onChange={(e) => onRealnameChange(e.target.value)}
            placeholder="Enter your full name"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center space-x-2">
            <Mail className="h-4 w-4" />
            <span>Email</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Enter your email address"
          />
        </div>
      </CardContent>
    </Card>
  )
}
