import { Minus } from 'lucide-react'

export function OffboardHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="bg-red-100 p-2 rounded-lg">
          <Minus className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Offboard Devices</h1>
          <p className="text-gray-600 mt-1">Remove devices and corresponding IP addresses from Nautobot and Checkmk</p>
        </div>
      </div>
    </div>
  )
}
