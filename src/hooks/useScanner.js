import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

/**
 * Shared QR/barcode scanner hook.
 * @param {string} elementId  - DOM id of the container div for the scanner
 * @param {number} qrboxSize  - Width/height of the scan box in px (default 240)
 *
 * Usage:
 *   const { isScanning, startScanner, stopScanner } = useScanner({ elementId: 'reader' })
 *   // Start: startScanner(onScanned)  — calls onScanned(decodedText) after auto-stopping
 */
export function useScanner({ elementId, qrboxSize = 240 }) {
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef(null)

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        try { scannerRef.current.clear() } catch (_) {}
        scannerRef.current = null
      }
    }
  }, [])

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch (_) {}
      try { scannerRef.current.clear() } catch (_) {}
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  /**
   * @param {(decodedText: string) => void | Promise<void>} onScanned
   *   Called once after the scanner is stopped and a code is decoded.
   * @throws if the camera cannot be accessed
   */
  const startScanner = async (onScanned) => {
    setIsScanning(true)
    await new Promise(r => setTimeout(r, 150))
    let handled = false
    try {
      const qrcode = new Html5Qrcode(elementId)
      scannerRef.current = qrcode
      const config = { fps: 12, qrbox: { width: qrboxSize, height: qrboxSize } }

      const handleDecode = async (decoded) => {
        if (handled) return
        handled = true
        await stopScanner()
        onScanned(decoded)
      }

      try {
        await qrcode.start({ facingMode: { exact: 'environment' } }, config, handleDecode, () => {})
      } catch (_) {
        await qrcode.start('environment', config, handleDecode, () => {})
      }
    } catch (err) {
      setIsScanning(false)
      throw err
    }
  }

  return { isScanning, startScanner, stopScanner }
}
