import { Label } from '@/components/ui/label'

interface InfoCardProps {
  label: string
  value: string | undefined
  sublabel?: string
}

export function InfoCard({ label, value, sublabel }: InfoCardProps) {
  return (
    <div className="p-3 border border-border rounded-md bg-muted">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium mt-1">{value || 'N/A'}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  )
}
