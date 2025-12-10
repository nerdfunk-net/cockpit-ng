import { Label } from '@/components/ui/label'

interface InfoCardProps {
  label: string
  value: string | undefined
  colorScheme: 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'teal' | 'gray'
  sublabel?: string
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200 text-blue-600',
  green: 'bg-green-50 border-green-200 text-green-600',
  purple: 'bg-purple-50 border-purple-200 text-purple-600',
  orange: 'bg-orange-50 border-orange-200 text-orange-600',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600',
  teal: 'bg-teal-50 border-teal-200 text-teal-600',
  gray: 'bg-gray-50 border-gray-200 text-gray-600',
}

export function InfoCard({ label, value, colorScheme, sublabel }: InfoCardProps) {
  return (
    <div className={`p-3 border rounded-md ${colorClasses[colorScheme]}`}>
      <Label className={`text-xs font-semibold ${colorClasses[colorScheme].split(' ')[2]}`}>
        {label}
      </Label>
      <p className="text-sm font-medium mt-1">{value || 'N/A'}</p>
      {sublabel && (
        <p className="text-xs text-gray-600 mt-1">{sublabel}</p>
      )}
    </div>
  )
}
