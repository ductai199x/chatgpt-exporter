export function getBase64FromImg(el: HTMLImageElement) {
    const canvas = document.createElement('canvas')
    canvas.width = el.naturalWidth
    canvas.height = el.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(el, 0, 0)
    return canvas.toDataURL('image/png')
}

export async function getBase64FromImageUrl(url: string) {
    const img = await loadImage(url)
    try {
        return getBase64FromImg(img)
    }
    catch {
        const response = await fetch(url)
        const blob = await response.blob()
        return await blobToDataURL(blob)
    }
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.src = url
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
    })
}

export function blobToDataURL(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = reject
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
    })
}

export async function getCompressedBase64FromImageUrl(url: string, quality = 0.95): Promise<string> {
    const response = await fetch(url)
    const blob = await response.blob()
    return await blobToCompressedBase64(blob, quality)
}

function blobToCompressedBase64(blob: Blob, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const url = URL.createObjectURL(blob)

        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(img, 0, 0)

            const base64 = canvas.toDataURL('image/jpeg', quality)

            URL.revokeObjectURL(url)
            resolve(base64)
        }

        img.onerror = (err) => {
            URL.revokeObjectURL(url)
            reject(err)
        }

        img.src = url
    })
}
