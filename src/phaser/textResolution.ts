export function getPreferredTextResolution(devicePixelRatio?: number): number
{
    const ratio =
        devicePixelRatio ??
        (typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1);

    if (!Number.isFinite(ratio) || ratio <= 0)
    {
        return 1;
    }

    // Prefer an integer resolution to avoid fractional canvas sizes while still
    // improving crispness on non-integer DPR displays (e.g. 150% scaling).
    return Math.max(1, Math.min(3, Math.ceil(ratio)));
}

