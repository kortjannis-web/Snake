/** Vibration: in der Android-App ueber Capacitor Haptics, im Browser navigator.vibrate */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { settings } from './storage'

const nativ = Capacitor.isNativePlatform()

function web(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* nicht unterstuetzt */
  }
}

export const haptic = {
  light() {
    if (!settings.vibration) return
    if (nativ) void Haptics.impact({ style: ImpactStyle.Light })
    else web(8)
  },
  medium() {
    if (!settings.vibration) return
    if (nativ) void Haptics.impact({ style: ImpactStyle.Medium })
    else web(18)
  },
  heavy() {
    if (!settings.vibration) return
    if (nativ) void Haptics.notification({ type: NotificationType.Error })
    else web([40, 40, 80])
  },
  success() {
    if (!settings.vibration) return
    if (nativ) void Haptics.notification({ type: NotificationType.Success })
    else web([12, 50, 12])
  },
}
